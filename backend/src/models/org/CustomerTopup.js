const mongoose = require('mongoose');

const customerTopupSchema = new mongoose.Schema(
  {
    topupNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ['topup', 'debit_adjustment', 'credit_adjustment', 'opening_balance'],
      required: true,
    },
    method: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'other'],
      default: 'cash',
    },
    reference: { type: String, default: '' },
    narration: { type: String, default: '' },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = customerTopupSchema;
