const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    movementType: {
      type: String,
      enum: [
        'purchase_in', 'sale_out', 'return_in',
        'return_in_pending', 'return_in_approved',
        'transfer_in', 'transfer_out',
        'adjustment_in', 'adjustment_out', 'opening_stock',
      ],
      required: true,
    },
    quantityBefore: { type: Number, required: true },
    quantityChange: { type: Number, required: true },
    quantityAfter: { type: Number, required: true },
    referenceType: {
      type: String,
      enum: ['grn', 'order', 'return', 'stock_transfer', 'stock_adjustment', 'manual'],
      required: true,
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    referenceNumber: { type: String, default: '' },
    fromWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    toWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Immutable — prevent updates
stockMovementSchema.pre('findOneAndUpdate', function () {
  throw new Error('Stock movements are immutable and cannot be updated');
});

stockMovementSchema.index({ product: 1, warehouse: 1, createdAt: -1 });
stockMovementSchema.index({ referenceId: 1, referenceType: 1 });

module.exports = stockMovementSchema;
