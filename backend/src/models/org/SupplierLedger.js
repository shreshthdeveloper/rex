const mongoose = require('mongoose');

const supplierLedgerSchema = new mongoose.Schema(
  {
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    transactionType: {
      type: String,
      enum: [
        'purchase_invoice', 'payment', 'credit_note', 'debit_note',
        'balance_topup', 'balance_adjustment', 'opening_balance',
      ],
      required: true,
    },
    referenceType: {
      type: String,
      enum: ['grn', 'payment', 'return', 'topup', 'manual'],
      required: true,
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    referenceNumber: { type: String, default: '' },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    balanceAfter: { type: Number, required: true },
    narration: { type: String, default: '' },
    idempotencyKey: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Immutable — block every possible mutation route
const IMMUTABLE_MSG = 'Supplier ledger records are immutable';
supplierLedgerSchema.pre('findOneAndUpdate', function () { throw new Error(IMMUTABLE_MSG); });
supplierLedgerSchema.pre('updateOne', function () { throw new Error(IMMUTABLE_MSG); });
supplierLedgerSchema.pre('updateMany', function () { throw new Error(IMMUTABLE_MSG); });
supplierLedgerSchema.pre('replaceOne', function () { throw new Error(IMMUTABLE_MSG); });
supplierLedgerSchema.pre('findOneAndReplace', function () { throw new Error(IMMUTABLE_MSG); });
supplierLedgerSchema.pre('deleteOne', function () { throw new Error(IMMUTABLE_MSG); });
supplierLedgerSchema.pre('deleteMany', function () { throw new Error(IMMUTABLE_MSG); });
supplierLedgerSchema.pre('findOneAndDelete', function () { throw new Error(IMMUTABLE_MSG); });

supplierLedgerSchema.index({ supplier: 1, createdAt: -1 });
supplierLedgerSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = supplierLedgerSchema;
