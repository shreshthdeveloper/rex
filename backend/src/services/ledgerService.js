/**
 * Ledger Service — Handles immutable ledger entries for customers and suppliers.
 * All operations must be within a MongoDB transaction.
 */

const ApiError = require('../utils/ApiError');

/**
 * Create customer ledger entry and update customer balance
 */
const createCustomerLedgerEntry = async (models, {
  customerId, transactionType, referenceType, referenceId, referenceNumber,
  debit, credit, narration, userId,
}, session) => {
  const Customer = models.Customer;
  const CustomerLedger = models.CustomerLedger;

  const customer = await Customer.findById(customerId).session(session);
  if (!customer) throw new ApiError(404, 'Customer not found');

  // Get last ledger entry balance
  const lastEntry = await CustomerLedger.findOne({ customer: customerId })
    .sort({ createdAt: -1 })
    .session(session);

  const previousBalance = lastEntry ? lastEntry.balanceAfter : 0;
  const balanceAfter = previousBalance + (debit || 0) - (credit || 0);

  const entry = new CustomerLedger({
    customer: customerId,
    transactionType,
    referenceType,
    referenceId,
    referenceNumber: referenceNumber || '',
    debit: debit || 0,
    credit: credit || 0,
    balanceAfter,
    narration: narration || '',
    createdBy: userId,
  });
  await entry.save({ session });

  // Update customer running balance
  customer.currentBalance = balanceAfter;
  await customer.save({ session });

  return entry;
};

/**
 * Create supplier ledger entry and update supplier balance
 */
const createSupplierLedgerEntry = async (models, {
  supplierId, transactionType, referenceType, referenceId, referenceNumber,
  debit, credit, narration, userId,
}, session) => {
  const Supplier = models.Supplier;
  const SupplierLedger = models.SupplierLedger;

  const supplier = await Supplier.findById(supplierId).session(session);
  if (!supplier) throw new ApiError(404, 'Supplier not found');

  const lastEntry = await SupplierLedger.findOne({ supplier: supplierId })
    .sort({ createdAt: -1 })
    .session(session);

  const previousBalance = lastEntry ? lastEntry.balanceAfter : 0;
  const balanceAfter = previousBalance + (debit || 0) - (credit || 0);

  const entry = new SupplierLedger({
    supplier: supplierId,
    transactionType,
    referenceType,
    referenceId,
    referenceNumber: referenceNumber || '',
    debit: debit || 0,
    credit: credit || 0,
    balanceAfter,
    narration: narration || '',
    createdBy: userId,
  });
  await entry.save({ session });

  supplier.currentBalance = balanceAfter;
  await supplier.save({ session });

  return entry;
};

module.exports = { createCustomerLedgerEntry, createSupplierLedgerEntry };
