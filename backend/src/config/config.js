const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  jwtSecret: process.env.JWT_SECRET || 'default_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtCustomerExpiresIn: process.env.JWT_CUSTOMER_EXPIRES_IN || '7d',
  superadminDb: process.env.SUPERADMIN_DB || 'superadmin_db',
  superadminEmail: process.env.SUPERADMIN_EMAIL || 'superadmin@platform.com',
  superadminPassword: process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123',
};
