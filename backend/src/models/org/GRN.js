const mongoose = require('mongoose');

const grnItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  orderedQty: { type: Number, default: 0 },
  receivedQty: { type: Number, required: true },
  unitCost: { type: Number, required: true },
  lineTotal: { type: Number, default: 0 },
}, { _id: true });

const grnSchema = new mongoose.Schema(
  {
    grnNumber: { type: String, required: true, unique: true },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    items: [grnItemSchema],
    totalValue: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'approved', 'rejected'], default: 'draft' },
    receivedDate: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = grnSchema;
