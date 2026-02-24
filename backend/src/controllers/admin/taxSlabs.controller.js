const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

const list = asyncHandler(async (req, res) => {
  const slabs = await req.models.TaxSlab.find().sort({ rate: 1 });
  res.json(new ApiResponse(200, slabs));
});

const create = asyncHandler(async (req, res) => {
  const { name, rate } = req.body;
  const slab = await req.models.TaxSlab.create({ name, rate });
  res.status(201).json(new ApiResponse(201, slab, 'Tax slab created'));
});

const update = asyncHandler(async (req, res) => {
  const slab = await req.models.TaxSlab.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!slab) throw new ApiError(404, 'Tax slab not found');
  res.json(new ApiResponse(200, slab, 'Tax slab updated'));
});

const remove = asyncHandler(async (req, res) => {
  const slab = await req.models.TaxSlab.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!slab) throw new ApiError(404, 'Tax slab not found');
  res.json(new ApiResponse(200, null, 'Tax slab deleted'));
});

module.exports = { list, create, update, remove };
