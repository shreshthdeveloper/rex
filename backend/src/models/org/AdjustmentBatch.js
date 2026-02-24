const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const batchItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  requestedQty: { type: Number, required: true },
}, { _id: true });

const adjustmentBatchSchema = new mongoose.Schema(
  {
    batchNumber: { type: String, required: true, unique: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    adjustmentType: { type: String, enum: ['increase', 'decrease'], required: true },
    reason: {
      type: String,
      enum: ['damage', 'theft', 'count_correction', 'expiry', 'other'],
      required: true,
    },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'cancelled'],
      default: 'pending',
    },
    items: [batchItemSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

adjustmentBatchSchema.plugin(softDeletePlugin);

module.exports = adjustmentBatchSchema;
