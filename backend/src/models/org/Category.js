const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    hideFromCustomers: { type: Boolean, default: false },
    hideFromGuests: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.plugin(softDeletePlugin);

module.exports = categorySchema;
