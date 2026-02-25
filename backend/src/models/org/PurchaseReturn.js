const mongoose = require('mongoose');

const purchaseReturnItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  returnQty: { type: Number, required: true },
  reason: { type: String, default: '' },
  unitCost: { type: Number, required: true },
  lineTotal: { type: Number, default: 0 },
}, { _id: true });

const purchaseReturnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, required: true, unique: true },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    items: [purchaseReturnItemSchema],
    totalValue: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['initiated', 'approved', 'completed'],
      default: 'initiated',
    },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = purchaseReturnSchema;
