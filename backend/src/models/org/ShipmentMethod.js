const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const shipmentMethodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    paymentRequired: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

shipmentMethodSchema.plugin(softDeletePlugin);

module.exports = shipmentMethodSchema;
