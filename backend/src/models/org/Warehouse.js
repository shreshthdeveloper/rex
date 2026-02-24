const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const warehouseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    location: { type: String, default: '' },
    contactPerson: { type: String, default: '' },
    phone: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

warehouseSchema.plugin(softDeletePlugin);

module.exports = warehouseSchema;
