const mongoose = require('mongoose');
const softDeletePlugin = require('../../plugins/softDelete');

const addressSubSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Default' },
    line1: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zip: { type: String, default: '' },
    country: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    companyName: { type: String, default: '' },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: '' },
    password: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    paymentTerms: { type: String, default: '' },
    website: { type: String, default: '' },
    tier: {
      type: String,
      enum: ['retail', 'wholesale', 'vip', 'custom'],
      default: 'retail',
    },
    addresses: [addressSubSchema],
    creditLimit: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    termsAcceptedAt: { type: Date, default: null },
    documents: [{
      name: { type: String, required: true },
      fileUrl: { type: String, default: '' },
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      uploadedAt: { type: Date, default: Date.now },
    }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.plugin(softDeletePlugin);
customerSchema.index({ phone: 1 });

module.exports = customerSchema;
