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
  const customers = await req.models.Customer.find({ currentBalance: { $ne: 0 } })
    .select('name email phone currentBalance creditLimit')
    .sort({ currentBalance: -1 })
    .lean();

  const totalOutstanding = customers.reduce((sum, c) => sum + (c.currentBalance || 0), 0);
  res.json(new ApiResponse(200, { customers, totalOutstanding, count: customers.length }));
});

// ─── Supplier Aging Report ───
const supplierAgingReport = asyncHandler(async (req, res) => {
  const suppliers = await req.models.Supplier.find({ currentBalance: { $ne: 0 } })
    .select('name email phone currentBalance creditLimit')
    .sort({ currentBalance: -1 })
    .lean();

  const totalPayable = suppliers.reduce((sum, s) => sum + (s.currentBalance || 0), 0);
  res.json(new ApiResponse(200, { suppliers, totalPayable, count: suppliers.length }));
});

// ─── Profit & Loss (Simple) ───
const profitAndLoss = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = { status: { $nin: ['cancelled'] } };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  // Revenue from orders
  const salesAgg = await req.models.Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$grandTotal' },
        totalDiscount: { $sum: '$discountAmount' },
        totalTax: { $sum: '$taxTotal' },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  // Cost from GRNs (purchases)
  const costAgg = await req.models.GRN.aggregate([
    { $match: { status: 'approved' } },
    {
      $group: {
        _id: null,
        totalCost: { $sum: '$totalValue' },
      },
    },
  ]);

  const sales = salesAgg[0] || { totalRevenue: 0, totalDiscount: 0, totalTax: 0, orderCount: 0 };
  const costs = costAgg[0] || { totalCost: 0 };
  const grossProfit = sales.totalRevenue - costs.totalCost;

  res.json(new ApiResponse(200, {
    period: { startDate: startDate || 'all', endDate: endDate || 'all' },
    totalRevenue: sales.totalRevenue,
    totalCost: costs.totalCost,
    grossProfit,
    totalDiscount: sales.totalDiscount,
    totalTax: sales.totalTax,
    orderCount: sales.orderCount,
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
  ]);

  res.json(new ApiResponse(200, {
    todayOrders,
    todayRevenue: todayRevenue[0]?.total || 0,
    totalOrders,
    totalCustomers,
    totalProducts,
    lowStockCount,
    pendingPOs,
  }));
});

module.exports = {
  salesReport, stockReport, customerAgingReport, supplierAgingReport,
  profitAndLoss, dashboardStats,
};
