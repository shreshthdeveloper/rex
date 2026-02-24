const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    discountType: { type: String, enum: ['flat', 'percentage'], required: true },
    discountValue: { type: Number, required: true },
    maxDiscountAmount: { type: Number, default: null },
    minOrderValue: { type: Number, default: 0 },
    usageLimit: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    applicableTo: {
      type: String,
      enum: ['all', 'specific_products', 'specific_categories'],
      default: 'all',
    },
    applicableIds: [{ type: mongoose.Schema.Types.ObjectId }],
    validFrom: { type: Date },
    validUntil: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.plugin(softDeletePlugin);

module.exports = couponSchema;
