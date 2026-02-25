const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    displayName: { type: String, required: true, trim: true },
    logo: { type: String, default: '' },
    isActive: { type: Boolean, default: false },
    apiKey: { type: String, default: '' },
    webhookUrl: { type: String, default: '' },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = integrationSchema;
