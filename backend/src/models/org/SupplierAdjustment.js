const mongoose = require('mongoose');

const supplierAdjustmentSchema = new mongoose.Schema(
  {
    adjustmentNumber: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ['topup', 'debit_adjustment', 'credit_adjustment', 'opening_balance'],
      required: true,
    },
    narration: { type: String, default: '' },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = supplierAdjustmentSchema;
