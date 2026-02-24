const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { connectSuperAdminDB, getOrgConnection } = require('../config/database');
const { registerSuperAdminModels } = require('../models/superadmin');
const { registerOrgModels } = require('../models/org');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateSlug } = require('../utils/helpers');

// --- Super Admin Auth ---
const superAdminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const saConn = await connectSuperAdminDB();
  const { SuperAdmin } = registerSuperAdminModels(saConn);
  const admin = await SuperAdmin.findOne({ email });
  if (!admin) throw new ApiError(401, 'Invalid credentials');
  const match = await bcrypt.compare(password, admin.password);
  if (!match) throw new ApiError(401, 'Invalid credentials');
  const token = jwt.sign({ adminId: admin._id, role: 'superadmin' }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.json(new ApiResponse(200, { token, user: { _id: admin._id, name: admin.name, email: admin.email, role: 'superadmin' } }, 'Login successful'));
});

// --- Organization CRUD ---
const listOrgs = asyncHandler(async (req, res) => {
  const saConn = await connectSuperAdminDB();
  const { Organization } = registerSuperAdminModels(saConn);
  const orgs = await Organization.find({ deletedAt: null });
  res.json(new ApiResponse(200, orgs));
});

const createOrg = asyncHandler(async (req, res) => {
  const { name, plan } = req.body;
  const saConn = await connectSuperAdminDB();
  const { Organization } = registerSuperAdminModels(saConn);
  const slug = generateSlug(name);
  const existing = await Organization.findOne({ slug });
  if (existing) throw new ApiError(400, 'Organization with this name already exists');
  const dbName = `org_${slug}`;
  const org = await Organization.create({ name, slug, dbName, plan: plan || 'basic', createdBy: req.user._id });
  // Initialize the org DB connection so it's ready
  await getOrgConnection(dbName);
  res.status(201).json(new ApiResponse(201, org, 'Organization created'));
});

const getOrg = asyncHandler(async (req, res) => {
  const saConn = await connectSuperAdminDB();
  const { Organization } = registerSuperAdminModels(saConn);
  const org = await Organization.findOne({ _id: req.params.id, deletedAt: null });
  if (!org) throw new ApiError(404, 'Organization not found');
  res.json(new ApiResponse(200, org));
});

const updateOrg = asyncHandler(async (req, res) => {
  const saConn = await connectSuperAdminDB();
  const { Organization } = registerSuperAdminModels(saConn);
  const org = await Organization.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $set: req.body },
    { new: true }
  );
  if (!org) throw new ApiError(404, 'Organization not found');
  res.json(new ApiResponse(200, org, 'Organization updated'));
});

const deleteOrg = asyncHandler(async (req, res) => {
  const saConn = await connectSuperAdminDB();
  const { Organization } = registerSuperAdminModels(saConn);
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, 'Organization not found');
  org.deletedAt = new Date();
  org.isActive = false;
  await org.save();
  res.json(new ApiResponse(200, null, 'Organization deleted'));
});

// --- Admin provisioning for org ---
const createOrgAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const saConn = await connectSuperAdminDB();
  const { Organization } = registerSuperAdminModels(saConn);
  const org = await Organization.findOne({ _id: req.params.id, deletedAt: null });
  if (!org) throw new ApiError(404, 'Organization not found');
  const orgConn = await getOrgConnection(org.dbName);
  const models = registerOrgModels(orgConn);
  const existing = await models.User.findOne({ email });
  if (existing) throw new ApiError(400, 'User with this email already exists');
  const hashed = await bcrypt.hash(password, 12);
  const user = await models.User.create({ name, email, password: hashed, role: role || 'admin' });
  const userObj = user.toObject();
  delete userObj.password;
  res.status(201).json(new ApiResponse(201, userObj, 'Admin user created'));
});

const listOrgAdmins = asyncHandler(async (req, res) => {
  const saConn = await connectSuperAdminDB();
  const { Organization } = registerSuperAdminModels(saConn);
  const org = await Organization.findOne({ _id: req.params.id, deletedAt: null });
  if (!org) throw new ApiError(404, 'Organization not found');
  const orgConn = await getOrgConnection(org.dbName);
  const models = registerOrgModels(orgConn);
  const users = await models.User.find({}).select('-password');
  res.json(new ApiResponse(200, users));
});

module.exports = {
  superAdminLogin, listOrgs, createOrg, getOrg, updateOrg, deleteOrg,
  createOrgAdmin, listOrgAdmins,
};
