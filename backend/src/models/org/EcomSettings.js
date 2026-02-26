const mongoose = require('mongoose');

const modalButtonSchema = new mongoose.Schema({
  label: { type: String, default: 'OK' },
  action: { type: String, enum: ['close', 'submit', 'decline', 'url'], default: 'close' },
  url: { type: String, default: '' },
  style: { type: String, enum: ['primary', 'secondary', 'danger', 'outline'], default: 'primary' },
}, { _id: true });

const modalFormFieldSchema = new mongoose.Schema({
  label: { type: String, required: true },
  placeholder: { type: String, default: '' },
  fieldType: { type: String, enum: ['text', 'email', 'phone', 'checkbox', 'select', 'textarea'], default: 'text' },
  options: [{ type: String }],     // for select
  required: { type: Boolean, default: false },
}, { _id: true });

const modalSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  body: { type: String, default: '' },
  showOn: [{ type: String, enum: ['home', 'products', 'product_detail', 'cart', 'checkout', 'account', 'all'], default: 'all' }],
  trigger: { type: String, enum: ['on_load', 'on_exit', 'on_scroll', 'manual'], default: 'on_load' },
  triggerDelay: { type: Number, default: 0 },    // milliseconds
  frequency: { type: String, enum: ['every_visit', 'once_per_session', 'once'], default: 'once_per_session' },
  isEnabled: { type: Boolean, default: true },
  formFields: [modalFormFieldSchema],
  buttons: [modalButtonSchema],
  bgColor: { type: String, default: '' },
  textColor: { type: String, default: '' },
  overlayColor: { type: String, default: '' },
  maxWidth: { type: String, enum: ['sm', 'md', 'lg', 'xl'], default: 'md' },
}, { _id: true });

const bannerSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  image: { type: String, default: '' },
  link: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { _id: true });

const sectionSchema = new mongoose.Schema({
  type: { type: String, enum: ['featured', 'new_arrivals', 'sale', 'category', 'custom'], default: 'featured' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  maxProducts: { type: Number, default: 8 },
}, { _id: true });

const ecomSettingsSchema = new mongoose.Schema({
  /* Branding */
  storeName: { type: String, default: '' },
  tagline: { type: String, default: '' },
  logo: { type: String, default: '' },
  favicon: { type: String, default: '' },

  /* Colors & Theme */
  primaryColor: { type: String, default: '#06b6d4' },   // cyan-500
  secondaryColor: { type: String, default: '#8b5cf6' },  // violet-500
  accentColor: { type: String, default: '#f59e0b' },     // amber-500
  theme: { type: String, enum: ['glass', 'modern', 'minimal', 'bold'], default: 'glass' },

  /* Hero / Banners */
  banners: [bannerSchema],

  /* Marquee / Alerts */
  marqueeText: { type: String, default: '' },
  marqueeEnabled: { type: Boolean, default: false },
  saleAlertText: { type: String, default: '' },
  saleAlertEnabled: { type: Boolean, default: false },

  /* Layout */
  productsPerRow: { type: Number, default: 4, min: 2, max: 6 },
  productsPerPage: { type: Number, default: 12, min: 4, max: 48 },
  showFeatured: { type: Boolean, default: true },
  showCategories: { type: Boolean, default: true },

  /* Sections (dynamic homepage sections) */
  sections: [sectionSchema],

  /* Terms & Conditions */
  termsAndConditions: { type: String, default: '' },       // HTML or markdown
  requireTermsOnSignup: { type: Boolean, default: true },
  requiredDocuments: [{
    name: { type: String, required: true },
    description: { type: String, default: '' },
    required: { type: Boolean, default: false },
  }],

  /* Footer */
  footerText: { type: String, default: '' },
  socialLinks: {
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    twitter: { type: String, default: '' },
    youtube: { type: String, default: '' },
  },

  /* Custom Modals */
  modals: [modalSchema],

  /* Age Verification */
  ageVerificationEnabled: { type: Boolean, default: false },
  ageVerificationTitle: { type: String, default: 'Age Verification Required' },
  ageVerificationMessage: { type: String, default: 'You must be at least 18 years old to access this website. Please confirm your age to continue.' },
  ageVerificationMinAge: { type: Number, default: 18 },
  ageVerificationLockMessage: { type: String, default: 'Access to this website is restricted to users aged 18 and above.' },
}, { timestamps: true });

module.exports = ecomSettingsSchema;
