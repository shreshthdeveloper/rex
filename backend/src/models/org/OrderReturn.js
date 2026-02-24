const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema({
  lineItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  returnQty: { type: Number, required: true },
  reason: { type: String, default: '' },
  condition: { type: String, default: 'good' },
}, { _id: true });

const orderReturnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, required: true, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    returnType: { type: String, enum: ['full', 'partial'], required: true },
    items: [returnItemSchema],
    returnWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    refundAmount: { type: Number, default: 0 },
    refundMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'credit_note', 'ledger_credit'],
      default: 'ledger_credit',
    },
    status: {
      type: String,
      enum: ['initiated', 'approved', 'completed'],
      default: 'initiated',
    },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = orderReturnSchema;
