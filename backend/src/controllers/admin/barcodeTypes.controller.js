const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

const list = asyncHandler(async (req, res) => {
  const types = await req.models.BarcodeType.find().sort({ name: 1 });
  res.json(new ApiResponse(200, types));
});

const create = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const bt = await req.models.BarcodeType.create({ name, description: description || '' });
  res.status(201).json(new ApiResponse(201, bt, 'Barcode type created'));
});

const update = asyncHandler(async (req, res) => {
  const bt = await req.models.BarcodeType.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!bt) throw new ApiError(404, 'Barcode type not found');
  res.json(new ApiResponse(200, bt, 'Barcode type updated'));
});

const remove = asyncHandler(async (req, res) => {
  const bt = await req.models.BarcodeType.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!bt) throw new ApiError(404, 'Barcode type not found');
  res.json(new ApiResponse(200, null, 'Barcode type deleted'));
});

module.exports = { list, create, update, remove };
