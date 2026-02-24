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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Immutable
customerLedgerSchema.pre('findOneAndUpdate', function () {
  throw new Error('Customer ledger records are immutable');
});

customerLedgerSchema.index({ customer: 1, createdAt: -1 });

module.exports = customerLedgerSchema;
