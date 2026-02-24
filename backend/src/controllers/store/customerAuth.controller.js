const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config/config');

/**
 * Customer auth — public store endpoints
 * resolveOrg middleware provides req.models / req.orgId / req.orgDb
 */

const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, termsAccepted, documents } = req.body;
  if (!email || !password || !name) throw new ApiError(400, 'Name, email and password are required');

  // Check terms acceptance if required
  const settings = await req.models.EcomSettings.findOne().lean();
  if (settings?.requireTermsOnSignup && !termsAccepted) {
    throw new ApiError(400, 'You must accept the terms and conditions');
  }

  const exists = await req.models.Customer.findOne({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, 'Email already registered');

  const hashed = await bcrypt.hash(password, 12);
  const customerData = {
    name, email: email.toLowerCase(), phone: phone || '',
    password: hashed, isActive: true, currentBalance: 0,
  };

  if (termsAccepted) customerData.termsAcceptedAt = new Date();
  if (Array.isArray(documents) && documents.length > 0) {
    customerData.documents = documents.map((d) => ({
      name: d.name, fileUrl: d.fileUrl || '', status: 'pending',
    }));
  }

  const customer = await req.models.Customer.create(customerData);

  const token = jwt.sign(
    { customerId: customer._id, orgId: req.orgId, orgDb: req.orgDb, role: 'customer' },
    config.jwtSecret,
    { expiresIn: '7d' },
  );

  res.status(201).json(new ApiResponse(201, {
    customer: { _id: customer._id, name: customer.name, email: customer.email },
    token,
  }, 'Registration successful'));
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');
  const customer = await req.models.Customer.findOne({ email: email.toLowerCase() }).select('+password');
  if (!customer) throw new ApiError(401, 'Invalid credentials');
  if (!customer.password) throw new ApiError(401, 'Password login not set. Contact support.');
  if (!customer.isActive) throw new ApiError(403, 'Account is deactivated');

  const match = await bcrypt.compare(password, customer.password);
  if (!match) throw new ApiError(401, 'Invalid credentials');

  const token = jwt.sign(
    { customerId: customer._id, orgId: req.orgId, orgDb: req.orgDb, role: 'customer' },
    config.jwtSecret,
    { expiresIn: '7d' },
  );

  res.json(new ApiResponse(200, {
    customer: { _id: customer._id, name: customer.name, email: customer.email },
    token,
  }, 'Login successful'));
});

const getProfile = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.customer._id).select('-password');
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json(new ApiResponse(200, customer));
});

const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone', 'addresses'];
  const customer = await req.models.Customer.findById(req.customer._id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  allowed.forEach(k => { if (req.body[k] !== undefined) customer[k] = req.body[k]; });
  await customer.save();
  res.json(new ApiResponse(200, customer, 'Profile updated'));
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new ApiError(400, 'Current and new password required');
  const customer = await req.models.Customer.findById(req.customer._id).select('+password');
  const match = await bcrypt.compare(currentPassword, customer.password);
  if (!match) throw new ApiError(401, 'Current password is incorrect');
  customer.password = await bcrypt.hash(newPassword, 12);
  await customer.save();
  res.json(new ApiResponse(200, null, 'Password changed'));
});

module.exports = { register, login, getProfile, updateProfile, changePassword };
