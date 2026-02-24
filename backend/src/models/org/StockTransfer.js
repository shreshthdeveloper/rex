const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const transferItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  requestedQty: { type: Number, required: true },
  transferredQty: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { _id: true });

const stockTransferSchema = new mongoose.Schema(
  {
    transferNumber: { type: String, required: true, unique: true },
    fromWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    toWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    status: {
      type: String,
      enum: ['draft', 'in_transit', 'completed', 'cancelled'],
      default: 'draft',
    },
    items: [transferItemSchema],
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

stockTransferSchema.plugin(softDeletePlugin);

module.exports = stockTransferSchema;
