const mongoose = require('mongoose');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// ─── Sales Report ───
const salesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, warehouse, groupBy } = req.query;
  const match = { status: { $nin: ['cancelled'] } };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }
  if (warehouse) match.warehouse = new mongoose.Types.ObjectId(warehouse);

  const groupStage = groupBy === 'daily'
    ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
    : groupBy === 'monthly'
      ? { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
      : null;

  const pipeline = [{ $match: match }];
  if (groupStage) {
    pipeline.push({
      $group: {
        _id: groupStage,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$grandTotal' },
        totalTax: { $sum: '$taxTotal' },
        totalDiscount: { $sum: '$discountAmount' },
        avgOrderValue: { $avg: '$grandTotal' },
      },
    }, { $sort: { _id: 1 } });
  } else {
    pipeline.push({
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$grandTotal' },
        totalTax: { $sum: '$taxTotal' },
        totalDiscount: { $sum: '$discountAmount' },
        avgOrderValue: { $avg: '$grandTotal' },
      },
    });
  }

  const result = await req.models.Order.aggregate(pipeline);

  // Top products
  const topProducts = await req.models.Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        productName: { $first: '$items.productSnapshot.name' },
        sku: { $first: '$items.productSnapshot.sku' },
        totalQty: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.lineTotal' },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 },
  ]);

  res.json(new ApiResponse(200, { summary: result, topProducts }));
});

// ─── Stock Report ───
const stockReport = asyncHandler(async (req, res) => {
  const { warehouse } = req.query;
  const match = {};
  if (warehouse) match.warehouse = new mongoose.Types.ObjectId(warehouse);

  const stock = await req.models.ProductStock.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'products', localField: 'product', foreignField: '_id', as: 'productInfo',
      },
    },
    { $unwind: '$productInfo' },
    {
      $lookup: {
        from: 'warehouses', localField: 'warehouse', foreignField: '_id', as: 'warehouseInfo',
      },
    },
    { $unwind: '$warehouseInfo' },
    {
      $project: {
        productName: '$productInfo.name',
        sku: '$productInfo.sku',
        warehouse: '$warehouseInfo.name',
        quantity: 1, reservedQuantity: 1,
        availableStock: { $subtract: ['$quantity', '$reservedQuantity'] },
        lowStockThreshold: 1,
        isLow: { $lte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, '$lowStockThreshold'] },
      },
    },
    { $sort: { isLow: -1, availableStock: 1 } },
  ]);

  const totalValue = await req.models.ProductStock.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'products', localField: 'product', foreignField: '_id', as: 'p',
      },
    },
    { $unwind: '$p' },
    {
      $group: {
        _id: null,
        totalItems: { $sum: '$quantity' },
        totalValue: { $sum: { $multiply: ['$quantity', { $ifNull: ['$p.costPrice', '$p.basePrice'] }] } },
      },
    },
  ]);

  res.json(new ApiResponse(200, { stock, summary: totalValue[0] || { totalItems: 0, totalValue: 0 } }));
});

// ─── Customer Aging Report ───
const customerAgingReport = asyncHandler(async (req, res) => {
  const now = new Date();
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
  const d60 = new Date(now); d60.setDate(d60.getDate() - 60);
  const d90 = new Date(now); d90.setDate(d90.getDate() - 90);

  // Get customers with positive balance (they owe us)
  const customers = await req.models.Customer.find({ currentBalance: { $gt: 0.01 } })
    .select('name email phone currentBalance creditLimit')
    .sort({ currentBalance: -1 })
    .lean();

  // For each customer, find their oldest unpaid invoice to determine aging bucket
  for (const c of customers) {
    const oldestInvoice = await req.models.CustomerLedger.findOne({
      customer: c._id,
      transactionType: 'invoice',
    }).sort({ createdAt: 1 }).select('createdAt').lean();

    if (oldestInvoice) {
      const age = Math.floor((now - new Date(oldestInvoice.createdAt)) / (1000 * 60 * 60 * 24));
      c.ageDays = age;
      c.bucket = age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+';
    } else {
      c.ageDays = 0;
      c.bucket = '0-30';
    }
  }

  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const c of customers) buckets[c.bucket] = (buckets[c.bucket] || 0) + (c.currentBalance || 0);
  for (const k of Object.keys(buckets)) buckets[k] = Math.round(buckets[k] * 100) / 100;

  const totalOutstanding = customers.reduce((sum, c) => sum + (c.currentBalance || 0), 0);
  res.json(new ApiResponse(200, { customers, buckets, totalOutstanding: Math.round(totalOutstanding * 100) / 100, count: customers.length }));
});

// ─── Supplier Aging Report ───
const supplierAgingReport = asyncHandler(async (req, res) => {
  const now = new Date();

  const suppliers = await req.models.Supplier.find({ currentBalance: { $gt: 0.01 } })
    .select('name email phone currentBalance creditLimit')
    .sort({ currentBalance: -1 })
    .lean();

  for (const s of suppliers) {
    const oldestInvoice = await req.models.SupplierLedger.findOne({
      supplier: s._id,
      transactionType: 'purchase_invoice',
    }).sort({ createdAt: 1 }).select('createdAt').lean();

    if (oldestInvoice) {
      const age = Math.floor((now - new Date(oldestInvoice.createdAt)) / (1000 * 60 * 60 * 24));
      s.ageDays = age;
      s.bucket = age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+';
    } else {
      s.ageDays = 0;
      s.bucket = '0-30';
    }
  }

  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const s of suppliers) buckets[s.bucket] = (buckets[s.bucket] || 0) + (s.currentBalance || 0);
  for (const k of Object.keys(buckets)) buckets[k] = Math.round(buckets[k] * 100) / 100;

  const totalPayable = suppliers.reduce((sum, s) => sum + (s.currentBalance || 0), 0);
  res.json(new ApiResponse(200, { suppliers, buckets, totalPayable: Math.round(totalPayable * 100) / 100, count: suppliers.length }));
});

// ─── Profit & Loss ───
const profitAndLoss = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = { status: { $nin: ['cancelled'] } };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  // Revenue from orders (minus returns)
  const salesAgg = await req.models.Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        grossRevenue: { $sum: '$grandTotal' },
        totalReturns: { $sum: { $ifNull: ['$sellReturn', 0] } },
        totalDiscount: { $sum: '$discountAmount' },
        totalCouponDiscount: { $sum: { $ifNull: ['$couponDiscount', 0] } },
        totalTax: { $sum: '$taxTotal' },
        orderCount: { $sum: 1 },
        totalPaid: { $sum: '$amountPaid' },
      },
    },
  ]);

  // COGS: cost price × delivered quantity from order items (more accurate than GRN totals)
  const cogsAgg = await req.models.Order.aggregate([
    { $match: { ...match, status: { $nin: ['cancelled', 'placed'] } } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod',
      },
    },
    { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        totalCOGS: {
          $sum: {
            $multiply: [
              { $subtract: ['$items.quantity', { $ifNull: ['$items.returnedQty', 0] }] },
              { $ifNull: ['$prod.costPrice', '$prod.basePrice'] },
            ],
          },
        },
      },
    },
  ]);

  // Also show total purchases from GRN for completeness
  const purchaseMatch = { status: 'approved' };
  if (startDate || endDate) {
    purchaseMatch.createdAt = {};
    if (startDate) purchaseMatch.createdAt.$gte = new Date(startDate);
    if (endDate) purchaseMatch.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }
  const purchaseAgg = await req.models.GRN.aggregate([
    { $match: purchaseMatch },
    { $group: { _id: null, totalPurchases: { $sum: '$totalValue' } } },
  ]);

  const sales = salesAgg[0] || { grossRevenue: 0, totalReturns: 0, totalDiscount: 0, totalCouponDiscount: 0, totalTax: 0, orderCount: 0, totalPaid: 0 };
  const cogs = cogsAgg[0] || { totalCOGS: 0 };
  const purchases = purchaseAgg[0] || { totalPurchases: 0 };
  const netRevenue = Math.round((sales.grossRevenue - sales.totalReturns) * 100) / 100;
  const grossProfit = Math.round((netRevenue - cogs.totalCOGS) * 100) / 100;

  res.json(new ApiResponse(200, {
    period: { startDate: startDate || 'all', endDate: endDate || 'all' },
    grossRevenue: sales.grossRevenue,
    totalReturns: sales.totalReturns,
    netRevenue,
    totalCOGS: Math.round(cogs.totalCOGS * 100) / 100,
    grossProfit,
    totalPurchases: purchases.totalPurchases,
    totalDiscount: sales.totalDiscount,
    totalCouponDiscount: sales.totalCouponDiscount,
    totalTax: sales.totalTax,
    orderCount: sales.orderCount,
    totalCollected: sales.totalPaid,
  }));
});

// ─── Dashboard Stats ───
const dashboardStats = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    todayOrders, totalOrders, totalCustomers, totalProducts,
    todayRevenue, lowStockCount, pendingPOs,
    receivableAgg, payableAgg, todayCollectedAgg,
  ] = await Promise.all([
    req.models.Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
    req.models.Order.countDocuments({}),
    req.models.Customer.countDocuments({}),
    req.models.Product.countDocuments({}),
    req.models.Order.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow }, status: { $nin: ['cancelled'] } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } },
    ]),
    req.models.ProductStock.countDocuments({
      $expr: { $lte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, '$lowStockThreshold'] },
    }),
    req.models.PurchaseOrder.countDocuments({ status: { $in: ['ordered', 'partial'] } }),
    // Total outstanding receivable (customers who owe us)
    req.models.Customer.aggregate([
      { $match: { currentBalance: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$currentBalance' } } },
    ]),
    // Total outstanding payable (we owe suppliers)
    req.models.Supplier.aggregate([
      { $match: { currentBalance: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$currentBalance' } } },
    ]),
    // Cash collected today (payments from customers)
    req.models.OrderPayment.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  res.json(new ApiResponse(200, {
    todayOrders,
    todayRevenue: todayRevenue[0]?.total || 0,
    todayCollected: todayCollectedAgg[0]?.total || 0,
    totalOrders,
    totalCustomers,
    totalProducts,
    lowStockCount,
    pendingPOs,
    outstandingReceivable: Math.round((receivableAgg[0]?.total || 0) * 100) / 100,
    outstandingPayable: Math.round((payableAgg[0]?.total || 0) * 100) / 100,
  }));
});

// ─── Bulk Reconciliation ───
const reconcileAll = asyncHandler(async (req, res) => {
  const round2 = v => Math.round((Number(v) || 0) * 100) / 100;
  const fix = req.query.fix === 'true';

  // Customer reconciliation
  const customerAgg = await req.models.CustomerLedger.aggregate([
    { $group: { _id: '$customer', totalDebit: { $sum: '$debit' }, totalCredit: { $sum: '$credit' }, count: { $sum: 1 } } },
  ]);
  const customerMap = new Map(customerAgg.map(a => [String(a._id), a]));
  const customers = await req.models.Customer.find({}).select('name currentBalance').lean();

  const customerResults = [];
  for (const c of customers) {
    const ledger = customerMap.get(String(c._id)) || { totalDebit: 0, totalCredit: 0, count: 0 };
    const computed = round2(ledger.totalDebit - ledger.totalCredit);
    const stored = round2(c.currentBalance || 0);
    const diff = round2(stored - computed);
    if (Math.abs(diff) >= 0.01) {
      customerResults.push({ id: c._id, name: c.name, stored, computed, diff, entries: ledger.count });
      if (fix) await req.models.Customer.updateOne({ _id: c._id }, { currentBalance: computed });
    }
  }

  // Supplier reconciliation
  const supplierAgg = await req.models.SupplierLedger.aggregate([
    { $group: { _id: '$supplier', totalDebit: { $sum: '$debit' }, totalCredit: { $sum: '$credit' }, count: { $sum: 1 } } },
  ]);
  const supplierMap = new Map(supplierAgg.map(a => [String(a._id), a]));
  const suppliers = await req.models.Supplier.find({}).select('name currentBalance').lean();

  const supplierResults = [];
  for (const s of suppliers) {
    const ledger = supplierMap.get(String(s._id)) || { totalDebit: 0, totalCredit: 0, count: 0 };
    const computed = round2(ledger.totalDebit - ledger.totalCredit);
    const stored = round2(s.currentBalance || 0);
    const diff = round2(stored - computed);
    if (Math.abs(diff) >= 0.01) {
      supplierResults.push({ id: s._id, name: s.name, stored, computed, diff, entries: ledger.count });
      if (fix) await req.models.Supplier.updateOne({ _id: s._id }, { currentBalance: computed });
    }
  }

  res.json(new ApiResponse(200, {
    customersChecked: customers.length,
    customerMismatches: customerResults,
    suppliersChecked: suppliers.length,
    supplierMismatches: supplierResults,
    fixed: fix,
  }));
});

// ─── Cash Flow Report (from TransactionLog) ───
const cashFlowReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy } = req.query;
  const match = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const dateFormat = groupBy === 'monthly'
    ? { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
    : groupBy === 'weekly'
      ? { $dateToString: { format: '%Y-W%V', date: '$createdAt' } }
      : { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: { period: dateFormat, direction: '$direction' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.period': 1 } },
  ];

  const result = await req.models.TransactionLog.aggregate(pipeline);

  // Pivot into { period, inflow, outflow, net }
  const periodMap = new Map();
  for (const r of result) {
    const key = r._id.period;
    if (!periodMap.has(key)) periodMap.set(key, { period: key, inflow: 0, outflow: 0, count: 0 });
    const row = periodMap.get(key);
    if (r._id.direction === 'in') row.inflow += r.total;
    else row.outflow += r.total;
    row.count += r.count;
  }

  const rows = Array.from(periodMap.values()).map(r => ({
    period: r.period,
    inflow: Math.round(r.inflow * 100) / 100,
    outflow: Math.round(r.outflow * 100) / 100,
    net: Math.round((r.inflow - r.outflow) * 100) / 100,
    transactions: r.count,
  }));

  const totals = rows.reduce((acc, r) => ({ inflow: acc.inflow + r.inflow, outflow: acc.outflow + r.outflow }), { inflow: 0, outflow: 0 });

  res.json(new ApiResponse(200, {
    rows,
    totals: {
      inflow: Math.round(totals.inflow * 100) / 100,
      outflow: Math.round(totals.outflow * 100) / 100,
      net: Math.round((totals.inflow - totals.outflow) * 100) / 100,
    },
  }));
});

module.exports = {
  salesReport, stockReport, customerAgingReport, supplierAgingReport,
  profitAndLoss, dashboardStats, reconcileAll, cashFlowReport,
};
