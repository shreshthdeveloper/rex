const mongoose = require('mongoose');

const productStockSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    quantity: { type: Number, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    supplierPrice: { type: Number, default: null },
    lowStockThreshold: { type: Number, default: 10 },
  },
  { timestamps: true }
);

productStockSchema.index({ product: 1, warehouse: 1 }, { unique: true });

module.exports = productStockSchema;
