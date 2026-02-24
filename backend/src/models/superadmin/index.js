const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    dbName: { type: String, required: true, unique: true },
    plan: { type: String, enum: ['basic', 'pro', 'enterprise'], default: 'basic' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const superAdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'superadmin' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/**
 * Register models on a given connection
 */
const registerSuperAdminModels = (connection) => {
  if (!connection.models.Organization) {
    connection.model('Organization', organizationSchema);
  }
  if (!connection.models.SuperAdmin) {
    connection.model('SuperAdmin', superAdminSchema);
  }
  return {
    Organization: connection.model('Organization'),
    SuperAdmin: connection.model('SuperAdmin'),
  };
};

module.exports = { registerSuperAdminModels, organizationSchema, superAdminSchema };
