const mongoose = require('mongoose');

const stockAdjustmentSchema = new mongoose.Schema(
  {
    adjustmentNumber: { type: String, required: true, unique: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantityBefore: { type: Number, required: true },
    adjustedQuantity: { type: Number, required: true },
    quantityAfter: { type: Number, required: true },
    adjustmentType: { type: String, enum: ['increase', 'decrease'], required: true },
    reason: {
      type: String,
      enum: ['damage', 'theft', 'count_correction', 'expiry', 'other'],
      required: true,
    },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = stockAdjustmentSchema;
