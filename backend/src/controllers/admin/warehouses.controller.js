const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const warehouses = await req.models.Warehouse.find().sort({ name: 1 });
  res.json(new ApiResponse(200, warehouses));
});

const create = asyncHandler(async (req, res) => {
  const { name, code, location, contactPerson, phone } = req.body;
  const existing = await req.models.Warehouse.findOne({ code });
  if (existing) throw new ApiError(400, 'Warehouse code already exists');
  const wh = await req.models.Warehouse.create({ name, code, location, contactPerson, phone });
  res.status(201).json(new ApiResponse(201, wh, 'Warehouse created'));
});

const getById = asyncHandler(async (req, res) => {
  const wh = await req.models.Warehouse.findById(req.params.id);
  if (!wh) throw new ApiError(404, 'Warehouse not found');
  res.json(new ApiResponse(200, wh));
});

const update = asyncHandler(async (req, res) => {
  const wh = await req.models.Warehouse.findById(req.params.id);
  if (!wh) throw new ApiError(404, 'Warehouse not found');
  Object.assign(wh, req.body);
  await wh.save();
  res.json(new ApiResponse(200, wh, 'Warehouse updated'));
});

const remove = asyncHandler(async (req, res) => {
  const wh = await req.models.Warehouse.findById(req.params.id);
  if (!wh) throw new ApiError(404, 'Warehouse not found');
  await wh.softDelete();
  res.json(new ApiResponse(200, null, 'Warehouse deleted'));
});

const getStock = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { warehouse: req.params.id };
  const [stocks, total] = await Promise.all([
    req.models.ProductStock.find(filter).populate('product', 'name sku type').skip(skip).limit(lim),
    req.models.ProductStock.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { stocks, pagination: paginationMeta(total, pg, lim) }));
});

const getMovements = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { warehouse: req.params.id };
  const [movements, total] = await Promise.all([
    req.models.StockMovement.find(filter).populate('product', 'name sku').sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.StockMovement.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { movements, pagination: paginationMeta(total, pg, lim) }));
});

module.exports = { list, create, getById, update, remove, getStock, getMovements };
