const bcrypt = require('bcryptjs');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  const [users, total] = await Promise.all([
    req.models.User.find(filter).select('-password').skip(skip).limit(lim).sort({ createdAt: -1 }),
    req.models.User.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { users, pagination: paginationMeta(total, pg, lim) }));
});

const create = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const existing = await req.models.User.findOne({ email });
  if (existing) throw new ApiError(400, 'Email already in use');
  const hashed = await bcrypt.hash(password, 12);
  const user = await req.models.User.create({ name, email, password: hashed, role });
  const userObj = user.toObject();
  delete userObj.password;
  res.status(201).json(new ApiResponse(201, userObj, 'User created'));
});

const getById = asyncHandler(async (req, res) => {
  const user = await req.models.User.findById(req.params.id).select('-password');
  if (!user) throw new ApiError(404, 'User not found');
  res.json(new ApiResponse(200, user));
});

const update = asyncHandler(async (req, res) => {
  const { name, email, role, isActive } = req.body;
  const user = await req.models.User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (email && email !== user.email) {
    const dup = await req.models.User.findOne({ email });
    if (dup) throw new ApiError(400, 'Email already in use');
  }
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  await user.save();
  const obj = user.toObject();
  delete obj.password;
  res.json(new ApiResponse(200, obj, 'User updated'));
});

const remove = asyncHandler(async (req, res) => {
  const user = await req.models.User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  await user.softDelete();
  res.json(new ApiResponse(200, null, 'User deleted'));
});

const toggleActive = asyncHandler(async (req, res) => {
  const user = await req.models.User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  user.isActive = !user.isActive;
  await user.save();
  res.json(new ApiResponse(200, { isActive: user.isActive }, `User ${user.isActive ? 'activated' : 'deactivated'}`));
});

module.exports = { list, create, getById, update, remove, toggleActive };
