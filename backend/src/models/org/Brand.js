const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    hideFromGuests: { type: Boolean, default: false },
    hideFromCustomers: { type: Boolean, default: false },
  },
  { timestamps: true }
);

brandSchema.plugin(softDeletePlugin);
brandSchema.index({ slug: 1 });

module.exports = brandSchema;
