/**
 * Ledger Service — Handles immutable ledger entries for customers and suppliers.
 *
 * Balance updates use atomic $inc on the entity (Customer/Supplier) instead of
 * the fragile "read-last-entry → compute → write" pattern.  This eliminates
 * race conditions even under concurrent transactions.
 *
 * Idempotency: if an `idempotencyKey` is supplied and an entry with that key
 * already exists, the function returns the existing entry without writing a
 * duplicate.  Callers generate keys like  `order:<orderId>:invoice`.
 *
 * Transaction Log: every entry is mirrored into the central TransactionLog for
 * unified audit trail and reporting.
 */

const ApiError = require('../utils/ApiError');

const round2 = v => Math.round((Number(v) || 0) * 100) / 100;

/* ─── Event-type mapping tables ─── */

const CUSTOMER_EVENT_MAP = {
  invoice:            { eventType: 'sale_invoice',       sourceType: 'order',          direction: 'out' },
  payment:            { eventType: 'sale_payment',       sourceType: 'order_payment',  direction: 'in' },
  credit_note:        { eventType: 'sale_credit_note',   sourceType: 'order',          direction: 'out' },
  debit_note:         { eventType: 'sale_debit_note',    sourceType: 'order',          direction: 'out' },
  balance_topup:      { eventType: 'customer_topup',     sourceType: 'customer_topup', direction: 'in' },
  balance_adjustment: { eventType: 'customer_adjustment',sourceType: 'manual',         direction: 'out' },
  opening_balance:    { eventType: 'customer_opening',   sourceType: 'customer_topup', direction: 'out' },
};

const SUPPLIER_EVENT_MAP = {
  purchase_invoice:   { eventType: 'purchase_invoice',    sourceType: 'grn',                direction: 'out' },
  payment:            { eventType: 'purchase_payment',    sourceType: 'supplier_payment',   direction: 'out' },
  credit_note:        { eventType: 'purchase_credit_note',sourceType: 'purchase_return',    direction: 'in' },
  balance_topup:      { eventType: 'supplier_adjustment', sourceType: 'supplier_adjustment',direction: 'out' },
  balance_adjustment: { eventType: 'supplier_adjustment', sourceType: 'supplier_adjustment',direction: 'out' },
  opening_balance:    { eventType: 'supplier_opening',    sourceType: 'supplier_adjustment',direction: 'out' },
};

/**
 * Write a mirrored entry into the central TransactionLog.
 */
const writeTransactionLog = async (TransactionLog, {
  eventType, partyType, partyId, partyName,
  sourceType, sourceId, sourceNumber,
  amount, direction, narration, paymentMethod,
  ledgerEntryId, createdBy,
}, session) => {
  if (!amount || amount <= 0) return null;
  const entry = new TransactionLog({
    eventType, partyType, partyId, partyName,
    sourceType, sourceId, sourceNumber: sourceNumber || '',
    amount, direction,
    narration: narration || '', paymentMethod: paymentMethod || '',
    ledgerEntryId, createdBy,
  });
  await entry.save({ session });
  return entry;
};

/**
 * Create customer ledger entry and atomically update customer balance.
 */
const createCustomerLedgerEntry = async (models, {
  customerId, transactionType, referenceType, referenceId, referenceNumber,
  debit, credit, narration, userId, idempotencyKey,
}, session) => {
  const Customer = models.Customer;
  const CustomerLedger = models.CustomerLedger;

  // Idempotency guard — skip if already written
  if (idempotencyKey) {
    const existing = await CustomerLedger.findOne({ idempotencyKey }).session(session || null);
    if (existing) return existing;
  }

  const delta = round2((debit || 0) - (credit || 0));

  // Atomic $inc — guaranteed correct even under concurrency
  const sessionOpt = session ? { session, new: true } : { new: true };
  const customer = await Customer.findOneAndUpdate(
    { _id: customerId },
    { $inc: { currentBalance: delta } },
    sessionOpt,
  );
  if (!customer) throw new ApiError(404, 'Customer not found');

  const entry = new CustomerLedger({
    customer: customerId,
    transactionType,
    referenceType,
    referenceId,
    referenceNumber: referenceNumber || '',
    debit: debit || 0,
    credit: credit || 0,
    balanceAfter: round2(customer.currentBalance),
    narration: narration || '',
    idempotencyKey: idempotencyKey || null,
    createdBy: userId,
  });
  await entry.save({ session });

  // Mirror to TransactionLog
  if (models.TransactionLog) {
    const mapping = CUSTOMER_EVENT_MAP[transactionType] || {};
    // Determine direction: credit to customer = money out (refund/credit) or in (payment)
    let direction = mapping.direction || 'out';
    // Payments & topups are money coming IN; everything else is OUT
    if (['payment', 'balance_topup'].includes(transactionType)) direction = 'in';
    // For credit_note referencing a return, override sourceType
    let sourceType = mapping.sourceType || referenceType;
    if (transactionType === 'credit_note' && referenceType === 'return') sourceType = 'order_return';

    await writeTransactionLog(models.TransactionLog, {
      eventType: mapping.eventType || transactionType,
      partyType: 'customer',
      partyId: customerId,
      partyName: customer.name || '',
      sourceType,
      sourceId: referenceId,
      sourceNumber: referenceNumber || '',
      amount: round2(Math.abs((debit || 0) - (credit || 0))) || round2(Math.max(debit || 0, credit || 0)),
      direction,
      narration: narration || '',
      ledgerEntryId: entry._id,
      createdBy: userId,
    }, session);
  }

  return entry;
};

/**
 * Create supplier ledger entry and atomically update supplier balance.
 */
const createSupplierLedgerEntry = async (models, {
  supplierId, transactionType, referenceType, referenceId, referenceNumber,
  debit, credit, narration, userId, idempotencyKey,
}, session) => {
  const Supplier = models.Supplier;
  const SupplierLedger = models.SupplierLedger;

  // Idempotency guard
  if (idempotencyKey) {
    const existing = await SupplierLedger.findOne({ idempotencyKey }).session(session || null);
    if (existing) return existing;
  }

  const delta = round2((debit || 0) - (credit || 0));

  const sessionOpt = session ? { session, new: true } : { new: true };
  const supplier = await Supplier.findOneAndUpdate(
    { _id: supplierId },
    { $inc: { currentBalance: delta } },
    sessionOpt,
  );
  if (!supplier) throw new ApiError(404, 'Supplier not found');

  const entry = new SupplierLedger({
    supplier: supplierId,
    transactionType,
    referenceType,
    referenceId,
    referenceNumber: referenceNumber || '',
    debit: debit || 0,
    credit: credit || 0,
    balanceAfter: round2(supplier.currentBalance),
    narration: narration || '',
    idempotencyKey: idempotencyKey || null,
    createdBy: userId,
  });
  await entry.save({ session });

  // Mirror to TransactionLog
  if (models.TransactionLog) {
    const mapping = SUPPLIER_EVENT_MAP[transactionType] || {};
    let direction = mapping.direction || 'out';
    if (transactionType === 'credit_note') direction = 'in';

    await writeTransactionLog(models.TransactionLog, {
      eventType: mapping.eventType || transactionType,
      partyType: 'supplier',
      partyId: supplierId,
      partyName: supplier.name || '',
      sourceType: mapping.sourceType || referenceType,
      sourceId: referenceId,
      sourceNumber: referenceNumber || '',
      amount: round2(Math.abs((debit || 0) - (credit || 0))) || round2(Math.max(debit || 0, credit || 0)),
      direction,
      narration: narration || '',
      ledgerEntryId: entry._id,
      createdBy: userId,
    }, session);
  }

  return entry;
};

module.exports = { createCustomerLedgerEntry, createSupplierLedgerEntry };
