const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

const list = asyncHandler(async (req, res) => {
  const units = await req.models.Unit.find().sort({ name: 1 });
  res.json(new ApiResponse(200, units));
});

const create = asyncHandler(async (req, res) => {
  const { name, shortName } = req.body;
  const unit = await req.models.Unit.create({ name, shortName });
  res.status(201).json(new ApiResponse(201, unit, 'Unit created'));
});

const update = asyncHandler(async (req, res) => {
  const unit = await req.models.Unit.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!unit) throw new ApiError(404, 'Unit not found');
  res.json(new ApiResponse(200, unit, 'Unit updated'));
});

const remove = asyncHandler(async (req, res) => {
  const unit = await req.models.Unit.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!unit) throw new ApiError(404, 'Unit not found');
  res.json(new ApiResponse(200, null, 'Unit deleted'));
});

module.exports = { list, create, update, remove };
