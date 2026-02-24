const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');
const { getNextSequence } = require('../../services/counterService');
const { createSupplierLedgerEntry } = require('../../services/ledgerService');
const { withTransaction } = require('../../utils/transaction');

const list = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  const [suppliers, total] = await Promise.all([
    req.models.Supplier.find(filter).skip(skip).limit(lim).sort({ createdAt: -1 }),
    req.models.Supplier.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { suppliers, pagination: paginationMeta(total, pg, lim) }));
});

const create = asyncHandler(async (req, res) => {
  // Ensure email uniqueness among suppliers (same email allowed for customer+supplier dual-role)
  if (req.body.email) {
    const existing = await req.models.Supplier.findOne({ email: req.body.email });
    if (existing) throw new ApiError(400, 'Supplier with this email already exists');
  }
  const supplier = await req.models.Supplier.create(req.body);
  // Opening balance
  if (req.body.openingBalance && req.body.openingBalance > 0) {
    await withTransaction(req.orgConn, async (session) => {
      const adjNum = await getNextSequence(req.models, 'supplier_adjustment', 'SADJ-');
      const adj = new req.models.SupplierAdjustment({
        adjustmentNumber: adjNum, supplier: supplier._id, amount: req.body.openingBalance,
        type: 'opening_balance', narration: 'Opening balance',
        balanceBefore: 0, balanceAfter: req.body.openingBalance, createdBy: req.user._id,
      });
      await adj.save({ session });
      await createSupplierLedgerEntry(req.models, {
        supplierId: supplier._id, transactionType: 'opening_balance',
        referenceType: 'manual', referenceId: adj._id, referenceNumber: adjNum,
        debit: req.body.openingBalance, credit: 0,
        narration: 'Opening balance carried forward', userId: req.user._id,
      }, session);
    });
  }
  res.status(201).json(new ApiResponse(201, supplier, 'Supplier created'));
});

const getById = asyncHandler(async (req, res) => {
  const supplier = await req.models.Supplier.findById(req.params.id);
  if (!supplier) throw new ApiError(404, 'Supplier not found');
  res.json(new ApiResponse(200, supplier));
});

const update = asyncHandler(async (req, res) => {
  const supplier = await req.models.Supplier.findById(req.params.id);
  if (!supplier) throw new ApiError(404, 'Supplier not found');
  // Check email uniqueness among suppliers on change
  if (req.body.email && req.body.email !== supplier.email) {
    const dup = await req.models.Supplier.findOne({ email: req.body.email });
    if (dup) throw new ApiError(400, 'Supplier email already in use');
  }
  Object.assign(supplier, req.body);
  await supplier.save();
  res.json(new ApiResponse(200, supplier, 'Supplier updated'));
});

const remove = asyncHandler(async (req, res) => {
  const supplier = await req.models.Supplier.findById(req.params.id);
  if (!supplier) throw new ApiError(404, 'Supplier not found');
  await supplier.softDelete();
  res.json(new ApiResponse(200, null, 'Supplier deleted'));
});

const getLedger = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { supplier: req.params.id };
  const [entries, total] = await Promise.all([
    req.models.SupplierLedger.find(filter).sort({ createdAt: 1 }).skip(skip).limit(lim),
    req.models.SupplierLedger.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { entries, pagination: paginationMeta(total, pg, lim) }));
});

const getBalance = asyncHandler(async (req, res) => {
  const supplier = await req.models.Supplier.findById(req.params.id).select('name currentBalance creditLimit');
  if (!supplier) throw new ApiError(404, 'Supplier not found');
  res.json(new ApiResponse(200, { name: supplier.name, currentBalance: supplier.currentBalance, creditLimit: supplier.creditLimit }));
});

const recordPayment = asyncHandler(async (req, res) => {
  const { amount, method, reference, narration, purchaseOrder } = req.body;
  const { result: payment } = await withTransaction(req.orgConn, async (session) => {
    const supplier = await req.models.Supplier.findById(req.params.id).session(session);
    if (!supplier) throw new ApiError(404, 'Supplier not found');
    const payNum = await getNextSequence(req.models, 'supplier_payment', 'SPAY-');
    const balanceBefore = supplier.currentBalance;
    const payment = new req.models.SupplierPayment({
      paymentNumber: payNum, supplier: supplier._id,
      purchaseOrder: purchaseOrder || null, amount,
      method: method || 'bank_transfer', reference: reference || '',
      narration: narration || 'Payment to supplier', paymentDate: new Date(),
      balanceBefore, balanceAfter: balanceBefore - amount,
      createdBy: req.user._id,
    });
    await payment.save({ session });

    await createSupplierLedgerEntry(req.models, {
      supplierId: supplier._id, transactionType: 'payment',
      referenceType: 'payment', referenceId: payment._id, referenceNumber: payNum,
      debit: 0, credit: amount, narration: narration || `Payment via ${method || 'bank_transfer'} ${payNum}`,
      userId: req.user._id,
    }, session);

    // Update PO amountPaid if linked
    if (purchaseOrder) {
      const po = await req.models.PurchaseOrder.findById(purchaseOrder).session(session);
      if (po) {
        po.amountPaid += amount;
        po.balanceDue = Math.max(0, po.grandTotal - po.amountPaid);
        await po.save({ session });
      }
    }
    return payment;
  });
  res.json(new ApiResponse(200, payment, 'Payment recorded'));
});

const adjust = asyncHandler(async (req, res) => {
  const { amount, type, narration } = req.body;
  const { result: adj } = await withTransaction(req.orgConn, async (session) => {
    const supplier = await req.models.Supplier.findById(req.params.id).session(session);
    if (!supplier) throw new ApiError(404, 'Supplier not found');
    const adjNum = await getNextSequence(req.models, 'supplier_adjustment', 'SADJ-');
    const balanceBefore = supplier.currentBalance;
    const debit = ['topup', 'debit_adjustment'].includes(type) ? amount : 0;
    const credit = ['credit_adjustment'].includes(type) ? amount : 0;
    // For topup (advance to supplier): credit reduces what we owe
    const actualDebit = type === 'debit_adjustment' ? amount : 0;
    const actualCredit = type === 'topup' ? amount : type === 'credit_adjustment' ? amount : 0;

    const adj = new req.models.SupplierAdjustment({
      adjustmentNumber: adjNum, supplier: supplier._id, amount,
      type, narration: narration || `Manual ${type}`,
      balanceBefore, balanceAfter: balanceBefore + actualDebit - actualCredit,
      createdBy: req.user._id,
    });
    await adj.save({ session });

    const txnType = type === 'topup' ? 'balance_topup' : 'balance_adjustment';
    await createSupplierLedgerEntry(req.models, {
      supplierId: supplier._id, transactionType: txnType,
      referenceType: type === 'topup' ? 'topup' : 'manual',
      referenceId: adj._id, referenceNumber: adjNum,
      debit: actualDebit, credit: actualCredit,
      narration: narration || `Manual ${type}`, userId: req.user._id,
    }, session);
    return adj;
  });
  res.json(new ApiResponse(200, adj, 'Adjustment recorded'));
});

const getPurchaseOrders = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { supplier: req.params.id };
  const [pos, total] = await Promise.all([
    req.models.PurchaseOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.PurchaseOrder.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { purchaseOrders: pos, pagination: paginationMeta(total, pg, lim) }));
});

const getStatement = asyncHandler(async (req, res) => {
  const supplier = await req.models.Supplier.findById(req.params.id);
  if (!supplier) throw new ApiError(404, 'Supplier not found');
  const entries = await req.models.SupplierLedger.find({ supplier: req.params.id }).sort({ createdAt: 1 });
  res.json(new ApiResponse(200, { supplier, entries }));
});

module.exports = {
  list, create, getById, update, remove,
  getLedger, getBalance, recordPayment, adjust,
  getPurchaseOrders, getStatement,
};
