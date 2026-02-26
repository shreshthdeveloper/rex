const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const getShipmentMethods = asyncHandler(async (req, res) => {
  // Only return active shipment methods for storefront
  const shipmentMethods = await req.models.ShipmentMethod.find({ isActive: true })
    .select('name description cost')
    .sort({ name: 1 });
  
  res.json(new ApiResponse(200, shipmentMethods));
});

module.exports = { getShipmentMethods };
