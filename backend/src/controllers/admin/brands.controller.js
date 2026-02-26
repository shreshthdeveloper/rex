const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { generateSlug } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const brands = await req.models.Brand.find().sort({ name: 1 });
  res.json(new ApiResponse(200, brands));
});

const create = asyncHandler(async (req, res) => {
  const { name, image, description, isActive, hideFromGuests, hideFromCustomers } = req.body;
  if (!name?.trim()) throw new ApiError(400, 'Brand name is required');
  const slug = generateSlug(name);
  const existing = await req.models.Brand.findOne({ slug });
  if (existing) throw new ApiError(400, 'Brand with this name already exists');
  const brand = await req.models.Brand.create({
    name, slug, image: image || '', description: description || '',
    isActive: isActive !== false,
    hideFromGuests: !!hideFromGuests,
    hideFromCustomers: !!hideFromCustomers,
  });
  res.status(201).json(new ApiResponse(201, brand, 'Brand created'));
});

const getById = asyncHandler(async (req, res) => {
  const brand = await req.models.Brand.findById(req.params.id);
  if (!brand) throw new ApiError(404, 'Brand not found');
  res.json(new ApiResponse(200, brand));
});

const update = asyncHandler(async (req, res) => {
  const brand = await req.models.Brand.findById(req.params.id);
  if (!brand) throw new ApiError(404, 'Brand not found');
  const updates = req.body;
  if (updates.name) updates.slug = generateSlug(updates.name);
  Object.assign(brand, updates);
  await brand.save();
  res.json(new ApiResponse(200, brand, 'Brand updated'));
});

const remove = asyncHandler(async (req, res) => {
  const brand = await req.models.Brand.findById(req.params.id);
  if (!brand) throw new ApiError(404, 'Brand not found');
  await brand.softDelete();
  res.json(new ApiResponse(200, null, 'Brand deleted'));
});

module.exports = { list, create, getById, update, remove };
