const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { generateSlug } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  // Return a flat list with parentCategory populated so the admin table
  // can display all categories (including sub-categories) in one flat view.
  const categories = await req.models.Category.find()
    .populate('parentCategory', 'name')
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  res.json(new ApiResponse(200, categories));
});

const create = asyncHandler(async (req, res) => {
  const { name, parentCategory, image, description, sortOrder, isActive, hideFromCustomers, hideFromGuests } = req.body;
  const slug = generateSlug(name);
  const cat = await req.models.Category.create({
    name, slug, parentCategory: parentCategory || null,
    image: image || '', description: description || '',
    sortOrder: sortOrder || 0, isActive: isActive !== false,
    hideFromCustomers: !!hideFromCustomers, hideFromGuests: !!hideFromGuests,
  });
  res.status(201).json(new ApiResponse(201, cat, 'Category created'));
});

const getById = asyncHandler(async (req, res) => {
  const cat = await req.models.Category.findById(req.params.id);
  if (!cat) throw new ApiError(404, 'Category not found');
  const children = await req.models.Category.find({ parentCategory: cat._id });
  res.json(new ApiResponse(200, { ...cat.toObject(), children }));
});

const update = asyncHandler(async (req, res) => {
  const cat = await req.models.Category.findById(req.params.id);
  if (!cat) throw new ApiError(404, 'Category not found');
  const updates = req.body;
  if (updates.name) updates.slug = generateSlug(updates.name);
  Object.assign(cat, updates);
  await cat.save();
  res.json(new ApiResponse(200, cat, 'Category updated'));
});

const remove = asyncHandler(async (req, res) => {
  const cat = await req.models.Category.findById(req.params.id);
  if (!cat) throw new ApiError(404, 'Category not found');
  await cat.softDelete();
  res.json(new ApiResponse(200, null, 'Category deleted'));
});

const reorder = asyncHandler(async (req, res) => {
  const { items } = req.body; // [{ id, sortOrder }]
  if (!Array.isArray(items)) throw new ApiError(400, 'items array required');
  const ops = items.map((i) => ({
    updateOne: { filter: { _id: i.id }, update: { $set: { sortOrder: i.sortOrder } } },
  }));
  await req.models.Category.bulkWrite(ops);
  res.json(new ApiResponse(200, null, 'Categories reordered'));
});

module.exports = { list, create, getById, update, remove, reorder };
