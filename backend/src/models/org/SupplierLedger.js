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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Immutable
supplierLedgerSchema.pre('findOneAndUpdate', function () {
  throw new Error('Supplier ledger records are immutable');
});

supplierLedgerSchema.index({ supplier: 1, createdAt: -1 });

module.exports = supplierLedgerSchema;
