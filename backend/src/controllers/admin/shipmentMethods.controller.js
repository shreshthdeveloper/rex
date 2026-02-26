const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

const list = asyncHandler(async (req, res) => {
  const { search, isActive } = req.query;
  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  const shipmentMethods = await req.models.ShipmentMethod.find(filter).sort({ name: 1 });
  res.json(new ApiResponse(200, shipmentMethods));
});

const getById = asyncHandler(async (req, res) => {
  const shipmentMethod = await req.models.ShipmentMethod.findById(req.params.id);
  if (!shipmentMethod) throw new ApiError(404, 'Shipment method not found');
  res.json(new ApiResponse(200, shipmentMethod));
});

const create = asyncHandler(async (req, res) => {
  const { name, description, cost, isActive, paymentRequired } = req.body;
  
  const shipmentMethod = await req.models.ShipmentMethod.create({
    name,
    description,
    cost,
    isActive,
    paymentRequired,
  });
  
  res.status(201).json(new ApiResponse(201, shipmentMethod, 'Shipment method created'));
});

const update = asyncHandler(async (req, res) => {
  const { name, description, cost, isActive, paymentRequired } = req.body;
  
  const shipmentMethod = await req.models.ShipmentMethod.findByIdAndUpdate(
    req.params.id,
    { $set: { name, description, cost, isActive, paymentRequired } },
    { new: true }
  );
  
  if (!shipmentMethod) throw new ApiError(404, 'Shipment method not found');
  res.json(new ApiResponse(200, shipmentMethod, 'Shipment method updated'));
});

const remove = asyncHandler(async (req, res) => {
  const shipmentMethod = await req.models.ShipmentMethod.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  
  if (!shipmentMethod) throw new ApiError(404, 'Shipment method not found');
  res.json(new ApiResponse(200, null, 'Shipment method deleted'));
});

module.exports = { list, getById, create, update, remove };
