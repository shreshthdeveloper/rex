const mongoose = require('mongoose');

const contactQuerySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  subject: { type: String, trim: true, maxlength: 180, default: '' },
  message: { type: String, required: true, trim: true, maxlength: 4000 },
  status: { type: String, enum: ['new', 'in_progress', 'resolved'], default: 'new' },
  sourcePage: { type: String, trim: true, maxlength: 120, default: 'contact' },
  meta: {
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  resolvedAt: { type: Date },
}, { timestamps: true });

module.exports = contactQuerySchema;
