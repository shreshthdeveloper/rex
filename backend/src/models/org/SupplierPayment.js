const mongoose = require('mongoose');

const supplierPaymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'cheque'],
      required: true,
    },
    reference: { type: String, default: '' },
    paymentDate: { type: Date, default: Date.now },
    narration: { type: String, default: '' },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = supplierPaymentSchema;
