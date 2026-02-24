const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'manager', 'cashier', 'warehouse_staff', 'accountant'],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.plugin(softDeletePlugin);

module.exports = userSchema;
