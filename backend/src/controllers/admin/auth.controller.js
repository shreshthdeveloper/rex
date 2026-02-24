const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config/config');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

const login = asyncHandler(async (req, res) => {
  const { email, password, orgSlug } = req.body;
  if (!orgSlug) throw new ApiError(400, 'orgSlug is required');

  const { connectSuperAdminDB, getOrgConnection } = require('../../config/database');
  const { registerSuperAdminModels } = require('../../models/superadmin');
  const { registerOrgModels } = require('../../models/org');

  const saConn = await connectSuperAdminDB();
  const { Organization } = registerSuperAdminModels(saConn);
  const org = await Organization.findOne({ slug: orgSlug, isActive: true, deletedAt: null });
  if (!org) throw new ApiError(404, 'Organization not found');

  const orgConn = await getOrgConnection(org.dbName);
  const models = registerOrgModels(orgConn);
  const user = await models.User.findOne({ email, deletedAt: null });
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid credentials');

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new ApiError(401, 'Invalid credentials');

  const token = jwt.sign(
    { userId: user._id, orgId: org._id, orgDb: org.dbName, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  const userObj = user.toObject();
  delete userObj.password;
  res.json(new ApiResponse(200, { token, user: userObj, org: { _id: org._id, name: org.name, slug: org.slug } }, 'Login successful'));
});

const getMe = asyncHandler(async (req, res) => {
  const user = await req.models.User.findById(req.user._id).select('-password');
  res.json(new ApiResponse(200, user));
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await req.models.User.findById(req.user._id);
  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) throw new ApiError(400, 'Current password is incorrect');
  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json(new ApiResponse(200, null, 'Password changed'));
});

module.exports = { login, getMe, changePassword };
