const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { connectSuperAdminDB, getOrgConnection } = require('../config/database');
const { registerSuperAdminModels } = require('../models/superadmin');
const { registerOrgModels } = require('../models/org');
const ApiError = require('../utils/ApiError');

/**
 * Authenticate admin/org user JWT
 */
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required');
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.role === 'superadmin') {
      const saConn = await connectSuperAdminDB();
      const { SuperAdmin } = registerSuperAdminModels(saConn);
      const admin = await SuperAdmin.findById(decoded.adminId);
      if (!admin || !admin.isActive) throw new ApiError(401, 'Invalid token');
      req.user = { _id: admin._id, role: 'superadmin', name: admin.name, email: admin.email };
      req.isSuperAdmin = true;
      return next();
    }

    if (!decoded.orgId) throw new ApiError(401, 'Invalid token');

    const orgConn = await getOrgConnection(decoded.orgDb);
    const models = registerOrgModels(orgConn);
    const user = await models.User.findById(decoded.userId);
    if (!user || !user.isActive) throw new ApiError(401, 'Invalid token or inactive user');

    req.user = { _id: user._id, role: user.role, name: user.name, email: user.email };
    req.orgId = decoded.orgId;
    req.orgDb = decoded.orgDb;
    req.orgConn = orgConn;
    req.models = models;
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Invalid or expired token'));
    }
    next(error);
  }
};

/**
 * Authenticate customer portal JWT
 */
const customerAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Customer authentication required');
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.role !== 'customer') throw new ApiError(401, 'Invalid customer token');

    const orgConn = await getOrgConnection(decoded.orgDb);
    const models = registerOrgModels(orgConn);
    const customer = await models.Customer.findById(decoded.customerId);
    if (!customer || !customer.isActive) throw new ApiError(401, 'Invalid token or inactive customer');

    req.customer = customer;
    req.orgId = decoded.orgId;
    req.orgDb = decoded.orgDb;
    req.orgConn = orgConn;
    req.models = models;
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Invalid or expired token'));
    }
    next(error);
  }
};

/**
 * Resolve org connection from orgSlug param (for public store routes)
 */
const resolveOrg = async (req, res, next) => {
  try {
    const { orgSlug } = req.params;
    if (!orgSlug) throw new ApiError(400, 'Organization slug is required');

    const saConn = await connectSuperAdminDB();
    const { Organization } = registerSuperAdminModels(saConn);
    const org = await Organization.findOne({ slug: orgSlug, isActive: true, deletedAt: null });
    if (!org) throw new ApiError(404, 'Organization not found');

    const orgConn = await getOrgConnection(org.dbName);
    const models = registerOrgModels(orgConn);

    req.org = org;
    req.orgId = org._id;
    req.orgDb = org.dbName;
    req.orgConn = orgConn;
    req.models = models;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * SuperAdmin-only auth — rejects org-level tokens
 */
const superAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required');
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.role !== 'superadmin') throw new ApiError(403, 'SuperAdmin access required');

    const saConn = await connectSuperAdminDB();
    const { SuperAdmin } = registerSuperAdminModels(saConn);
    const admin = await SuperAdmin.findById(decoded.adminId);
    if (!admin || !admin.isActive) throw new ApiError(401, 'Invalid token');

    req.user = { _id: admin._id, role: 'superadmin', name: admin.name, email: admin.email };
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Invalid or expired token'));
    }
    next(error);
  }
};

/**
 * Optional customer auth — sets req.customer if token present, otherwise continues silently
 */
const optionalCustomerAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.role !== 'customer') return next();
    const customer = await req.models.Customer.findById(decoded.customerId);
    if (customer && customer.isActive) req.customer = customer;
  } catch { /* silently ignore */ }
  next();
};

module.exports = { adminAuth, customerAuth, optionalCustomerAuth, resolveOrg, superAdminAuth };
