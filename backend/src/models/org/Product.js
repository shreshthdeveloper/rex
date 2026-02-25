const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const imageSubSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    altText: { type: String, default: '' },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    type: { type: String, enum: ['single', 'parent', 'variant'], required: true },
    parentProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    variantAttribute: { type: String, default: null },
    variantValue: { type: String, default: null },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', default: null },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', default: null },
    barcodeType: { type: mongoose.Schema.Types.ObjectId, ref: 'BarcodeType', default: null },
    barcodeValue: { type: String, default: '' },
    description: { type: String, default: '' },
    images: [imageSubSchema],
    basePrice: { type: Number, default: 0 },
    costPrice: { type: Number, default: 0 },
    taxSlab: { type: mongoose.Schema.Types.ObjectId, ref: 'TaxSlab', default: null },
    weight: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    slug: { type: String, default: '' },
    compareAtPrice: { type: Number, default: 0 },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

productSchema.plugin(softDeletePlugin);
productSchema.index({ parentProduct: 1 });
productSchema.index({ categories: 1 });
productSchema.index({ barcodeValue: 1 });

module.exports = productSchema;
