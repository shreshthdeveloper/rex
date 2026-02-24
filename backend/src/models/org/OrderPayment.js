const mongoose = require('mongoose');

const splitMethodSchema = new mongoose.Schema({
  method: { type: String, enum: ['cash', 'card', 'bank_transfer', 'credit'], required: true },
  amount: { type: Number, required: true },
  reference: { type: String, default: '' },
}, { _id: false });

const orderPaymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    amount: { type: Number, required: true },
    splitMethods: [splitMethodSchema],
    method: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'credit', 'split'],
      required: true,
    },
    reference: { type: String, default: '' },
    paymentDate: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

orderPaymentSchema.index({ order: 1 });
orderPaymentSchema.index({ customer: 1 });

module.exports = orderPaymentSchema;
