const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const poItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  orderedQty: { type: Number, required: true },
  receivedQty: { type: Number, default: 0 },
  unitCost: { type: Number, required: true },
  taxSlab: {
    name: { type: String, default: '' },
    rate: { type: Number, default: 0 },
  },
  lineTotal: { type: Number, default: 0 },
}, { _id: true });

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    status: {
      type: String,
      enum: ['draft', 'ordered', 'partial', 'received', 'cancelled'],
      default: 'draft',
    },
    orderDate: { type: Date, default: Date.now },
    expectedDate: { type: Date },
    items: [poItemSchema],
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

purchaseOrderSchema.plugin(softDeletePlugin);

module.exports = purchaseOrderSchema;
