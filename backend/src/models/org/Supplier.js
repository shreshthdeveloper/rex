const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    contactPerson: { type: String, default: '' },
    address: {
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    gstNumber: { type: String, default: '' },
    taxId: { type: String, default: '' },
    paymentTerms: { type: String, default: 'Immediate' },
    creditLimit: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.plugin(softDeletePlugin);

module.exports = supplierSchema;
