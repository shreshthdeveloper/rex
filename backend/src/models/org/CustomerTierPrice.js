const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const customerTierPriceSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    tier: { type: String, enum: ['retail', 'wholesale', 'vip', 'custom'], required: true },
    price: { type: Number, required: true },
    minQty: { type: Number, default: 1 },
  },
  { timestamps: true }
);

customerTierPriceSchema.index({ product: 1, tier: 1 });

customerTierPriceSchema.plugin(softDeletePlugin);

module.exports = customerTierPriceSchema;
