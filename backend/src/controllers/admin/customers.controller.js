const bcrypt = require('bcryptjs');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');
const { getNextSequence } = require('../../services/counterService');
const { createCustomerLedgerEntry } = require('../../services/ledgerService');
const { withTransaction } = require('../../utils/transaction');

const list = asyncHandler(async (req, res) => {
  const { page, limit, search, tier } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  if (tier) filter.tier = tier;
  const [customers, total] = await Promise.all([
    req.models.Customer.find(filter).select('-password').skip(skip).limit(lim).sort({ createdAt: -1 }),
    req.models.Customer.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { customers, pagination: paginationMeta(total, pg, lim) }));
});

const create = asyncHandler(async (req, res) => {
  const { name, email, phone, password, tier, addresses, creditLimit, openingBalance } = req.body;
  const existing = await req.models.Customer.findOne({ email });
  if (existing) throw new ApiError(400, 'Customer email already exists');
  const hashed = password ? await bcrypt.hash(password, 12) : '';
  const customer = await req.models.Customer.create({
    name, email, phone: phone || '', password: hashed,
    tier: tier || 'retail', addresses: addresses || [],
    creditLimit: creditLimit || 0, currentBalance: 0,
  });
  // Opening balance ledger entry
  if (openingBalance && openingBalance > 0) {
    await withTransaction(req.orgConn, async (session) => {
      const topupNum = await getNextSequence(req.models, 'customer_topup', 'TOP-');
      const topup = new req.models.CustomerTopup({
        topupNumber: topupNum, customer: customer._id, amount: openingBalance,
        type: 'opening_balance', method: 'other', narration: 'Opening balance',
        createdBy: req.user._id,
      });
      await topup.save({ session });
      await createCustomerLedgerEntry(req.models, {
        customerId: customer._id, transactionType: 'opening_balance',
        referenceType: 'topup', referenceId: topup._id, referenceNumber: topupNum,
        debit: openingBalance, credit: 0, narration: 'Opening balance carried forward',
        userId: req.user._id,
        idempotencyKey: `topup:${topup._id}:opening`,
      }, session);
    });
  }
  const obj = customer.toObject();
  delete obj.password;
  res.status(201).json(new ApiResponse(201, obj, 'Customer created'));
});

const getById = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.params.id).select('-password');
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json(new ApiResponse(200, customer));
});

const update = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  const allowed = ['name', 'phone', 'tier', 'addresses', 'creditLimit', 'isActive', 'notes', 'documents'];
  allowed.forEach((k) => { if (req.body[k] !== undefined) customer[k] = req.body[k]; });
  if (req.body.email && req.body.email !== customer.email) {
    const dup = await req.models.Customer.findOne({ email: req.body.email });
    if (dup) throw new ApiError(400, 'Email already in use');
    customer.email = req.body.email;
  }
  await customer.save();
  const obj = customer.toObject();
  delete obj.password;
  res.json(new ApiResponse(200, obj, 'Customer updated'));
});

const remove = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  await customer.softDelete();
  res.json(new ApiResponse(200, null, 'Customer deleted'));
});

const getLedger = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { customer: req.params.id };
  const [entries, total] = await Promise.all([
    req.models.CustomerLedger.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.CustomerLedger.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { entries, pagination: paginationMeta(total, pg, lim) }));
});

const getBalance = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.params.id).select('name currentBalance creditLimit');
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json(new ApiResponse(200, {
    name: customer.name,
    currentBalance: customer.currentBalance,
    creditLimit: customer.creditLimit,
  }));
});

const topup = asyncHandler(async (req, res) => {
  const { amount, method, reference, narration } = req.body;
  if (!amount || amount <= 0) throw new ApiError(400, 'Amount must be positive');
  const { result: topupDoc } = await withTransaction(req.orgConn, async (session) => {
    const customer = await req.models.Customer.findById(req.params.id).session(session);
    if (!customer) throw new ApiError(404, 'Customer not found');
    const topupNum = await getNextSequence(req.models, 'customer_topup', 'TOP-');

    const topupDoc = new req.models.CustomerTopup({
      topupNumber: topupNum, customer: customer._id, amount,
      type: 'topup', method: method || 'cash', reference: reference || '',
      narration: narration || 'Balance top-up',
      createdBy: req.user._id,
    });
    await topupDoc.save({ session });

    await createCustomerLedgerEntry(req.models, {
      customerId: customer._id, transactionType: 'balance_topup',
      referenceType: 'topup', referenceId: topupDoc._id, referenceNumber: topupNum,
      debit: 0, credit: amount, narration: narration || 'Cash top-up received from customer',
      userId: req.user._id,
      idempotencyKey: `topup:${topupDoc._id}:topup`,
    }, session);
    return topupDoc;
  });
  res.json(new ApiResponse(200, topupDoc, 'Top-up successful'));
});

const adjust = asyncHandler(async (req, res) => {
  const { amount, type, narration } = req.body;
  // type: debit_adjustment or credit_adjustment
  if (!['debit_adjustment', 'credit_adjustment'].includes(type)) {
    throw new ApiError(400, 'type must be debit_adjustment or credit_adjustment');
  }
  const { result: topupDoc } = await withTransaction(req.orgConn, async (session) => {
    const customer = await req.models.Customer.findById(req.params.id).session(session);
    if (!customer) throw new ApiError(404, 'Customer not found');
    const topupNum = await getNextSequence(req.models, 'customer_topup', 'TOP-');
    const debit = type === 'debit_adjustment' ? amount : 0;
    const credit = type === 'credit_adjustment' ? amount : 0;

    const topupDoc = new req.models.CustomerTopup({
      topupNumber: topupNum, customer: customer._id, amount,
      type, method: 'other', narration: narration || `Manual ${type}`,
      createdBy: req.user._id,
    });
    await topupDoc.save({ session });

    await createCustomerLedgerEntry(req.models, {
      customerId: customer._id, transactionType: 'balance_adjustment',
      referenceType: 'manual', referenceId: topupDoc._id, referenceNumber: topupNum,
      debit, credit, narration: narration || `Manual ${type}`,
      userId: req.user._id,
      idempotencyKey: `topup:${topupDoc._id}:adjustment`,
    }, session);
    return topupDoc;
  });
  res.json(new ApiResponse(200, topupDoc, 'Adjustment successful'));
});

const getOrders = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { customer: req.params.id };
  const [orders, total] = await Promise.all([
    req.models.Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.Order.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { orders, pagination: paginationMeta(total, pg, lim) }));
});

const getPayments = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { customer: req.params.id };
  const [payments, total] = await Promise.all([
    req.models.OrderPayment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim)
      .populate('order', 'orderNumber'),
    req.models.OrderPayment.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { payments, pagination: paginationMeta(total, pg, lim) }));
});

const getTopups = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { customer: req.params.id };
  const [topups, total] = await Promise.all([
    req.models.CustomerTopup.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.CustomerTopup.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { topups, pagination: paginationMeta(total, pg, lim) }));
});

const getStatement = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.params.id).select('-password');
  if (!customer) throw new ApiError(404, 'Customer not found');
  const entries = await req.models.CustomerLedger.find({ customer: req.params.id }).sort({ createdAt: 1 });
  res.json(new ApiResponse(200, { customer, entries }));
});

/**
 * Reconcile — compares stored balance to the sum of all ledger entries.
 * Returns { match, storedBalance, computedBalance, difference, entryCount }
 * If fix=true query param, corrects the stored balance to match the ledger sum.
 */
const reconcile = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const agg = await req.models.CustomerLedger.aggregate([
    { $match: { customer: customer._id } },
    { $group: { _id: null, totalDebit: { $sum: '$debit' }, totalCredit: { $sum: '$credit' }, count: { $sum: 1 } } },
  ]);
  const { totalDebit = 0, totalCredit = 0, count = 0 } = agg[0] || {};
  const computedBalance = Math.round((totalDebit - totalCredit) * 100) / 100;
  const storedBalance = Math.round((customer.currentBalance || 0) * 100) / 100;
  const difference = Math.round((storedBalance - computedBalance) * 100) / 100;
  const match = Math.abs(difference) < 0.01;

  if (req.query.fix === 'true' && !match) {
    customer.currentBalance = computedBalance;
    await customer.save();
  }

  res.json(new ApiResponse(200, {
    customerId: customer._id,
    name: customer.name,
    storedBalance,
    computedBalance,
    difference,
    match,
    entryCount: count,
    fixed: req.query.fix === 'true' && !match,
  }));
});

module.exports = {
  list, create, getById, update, remove,
  getLedger, getBalance, topup, adjust,
  getOrders, getPayments, getTopups, getStatement,
  reconcile,
};
