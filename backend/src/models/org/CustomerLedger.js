const mongoose = require('mongoose');

const customerLedgerSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    transactionType: {
      type: String,
      enum: [
        'invoice', 'payment', 'credit_note', 'debit_note',
        'balance_topup', 'balance_adjustment', 'opening_balance',
      ],
      required: true,
    },
    referenceType: {
      type: String,
      enum: ['order', 'payment', 'return', 'topup', 'manual'],
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
const IMMUTABLE_MSG = 'Customer ledger records are immutable';
customerLedgerSchema.pre('findOneAndUpdate', function () { throw new Error(IMMUTABLE_MSG); });
customerLedgerSchema.pre('updateOne', function () { throw new Error(IMMUTABLE_MSG); });
customerLedgerSchema.pre('updateMany', function () { throw new Error(IMMUTABLE_MSG); });
customerLedgerSchema.pre('replaceOne', function () { throw new Error(IMMUTABLE_MSG); });
customerLedgerSchema.pre('findOneAndReplace', function () { throw new Error(IMMUTABLE_MSG); });
customerLedgerSchema.pre('deleteOne', function () { throw new Error(IMMUTABLE_MSG); });
customerLedgerSchema.pre('deleteMany', function () { throw new Error(IMMUTABLE_MSG); });
customerLedgerSchema.pre('findOneAndDelete', function () { throw new Error(IMMUTABLE_MSG); });

customerLedgerSchema.index({ customer: 1, createdAt: -1 });
customerLedgerSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = customerLedgerSchema;
