const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const orderLineItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productSnapshot: {
    name: String,
    sku: String,
    barcodeValue: String,
    unitName: String,
    image: String,
  },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  discountType: { type: String, enum: ['flat', 'percentage', null], default: null },
  discountValue: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxSlab: {
    name: { type: String, default: '' },
    rate: { type: Number, default: 0 },
  },
  taxAmount: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['active', 'returned', 'partial_returned', 'cancelled'],
    default: 'active',
  },
  returnedQty: { type: Number, default: 0 },
}, { _id: true });

const statusHistorySchema = new mongoose.Schema({
  status: String,
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String, default: '' },
}, { _id: false });

const shippingAddressSchema = new mongoose.Schema({
  label: String, line1: String, city: String, state: String,
  zip: String, country: String,
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    status: {
      type: String,
      enum: [
        'placed', 'processing', 'shipped', 'in_transit',
        'out_for_delivery', 'delivered', 'return', 'partial_return',
        'cancelled', 'failed_delivery',
      ],
      default: 'placed',
    },
    orderDate: { type: Date, default: Date.now },
    items: [orderLineItemSchema],
    subtotal: { type: Number, default: 0 },
    discountType: { type: String, enum: ['flat', 'percentage', null], default: null },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    couponCode: { type: String, default: null },
    couponDiscount: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    shippingCharge: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    shippingAddress: shippingAddressSchema,
    notes: { type: String, default: '' },
    referenceNumber: { type: String, default: '' },
    saleType: {
      type: String,
      enum: ['retail', 'wholesale', 'online', ''],
      default: '',
    },
    orderSource: {
      type: String,
      enum: ['walk_in', 'phone', 'online', 'marketplace', ''],
      default: '',
    },
    invoiceNumber: { type: String, default: '' },
    editHistory: [{ type: mongoose.Schema.Types.Mixed }],
    statusHistory: [statusHistorySchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

orderSchema.plugin(softDeletePlugin);
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

module.exports = orderSchema;
