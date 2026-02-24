const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (status === 'active') filter.isActive = true;
  else if (status === 'inactive') filter.isActive = false;
  const [coupons, total] = await Promise.all([
    req.models.Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.Coupon.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { coupons, pagination: paginationMeta(total, pg, lim) }));
});

const create = asyncHandler(async (req, res) => {
  const exists = await req.models.Coupon.findOne({ code: req.body.code.toUpperCase() });
  if (exists) throw new ApiError(409, 'Coupon code already exists');
  req.body.code = req.body.code.toUpperCase();
  const coupon = await req.models.Coupon.create(req.body);
  res.status(201).json(new ApiResponse(201, coupon, 'Coupon created'));
});

const getById = asyncHandler(async (req, res) => {
  const coupon = await req.models.Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  res.json(new ApiResponse(200, coupon));
});

const update = asyncHandler(async (req, res) => {
  const coupon = await req.models.Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  if (req.body.code) req.body.code = req.body.code.toUpperCase();
  Object.assign(coupon, req.body);
  await coupon.save();
  res.json(new ApiResponse(200, coupon, 'Coupon updated'));
});

const remove = asyncHandler(async (req, res) => {
  const coupon = await req.models.Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  await coupon.softDelete();
  res.json(new ApiResponse(200, null, 'Coupon deleted'));
});

/**
 * Validate coupon - used by store or admin for preview
 */
const validate = asyncHandler(async (req, res) => {
  const { code, cartTotal, customerId } = req.body;
  const coupon = await req.models.Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon) throw new ApiError(404, 'Invalid coupon code');
  if (!coupon.isActive) throw new ApiError(400, 'Coupon is not active');
  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) throw new ApiError(400, 'Coupon not yet valid');
  if (coupon.validUntil && now > coupon.validUntil) throw new ApiError(400, 'Coupon has expired');
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new ApiError(400, 'Coupon usage limit reached');
  if (coupon.minOrderValue && cartTotal < coupon.minOrderValue) {
    throw new ApiError(400, `Minimum order amount is ${coupon.minOrderValue}`);
  }

  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = (cartTotal * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount) discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
  } else {
    discountAmount = Math.min(coupon.discountValue, cartTotal);
  }

  res.json(new ApiResponse(200, {
    valid: true,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalTotal: Math.round((cartTotal - discountAmount) * 100) / 100,
  }));
});

module.exports = { list, create, getById, update, remove, validate };
