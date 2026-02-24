const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');
const { resolvePrice } = require('../../services/priceResolver');

/**
 * Customer tier prices CRUD + price resolution endpoint
 */

const listTierPrices = asyncHandler(async (req, res) => {
  const { page, limit, product, tier } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (product) filter.product = product;
  if (tier) filter.tier = tier;
  const [prices, total] = await Promise.all([
    req.models.CustomerTierPrice.find(filter)
      .populate('product', 'name sku')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.CustomerTierPrice.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { tierPrices: prices, pagination: paginationMeta(total, pg, lim) }));
});

const createTierPrice = asyncHandler(async (req, res) => {
  const { product, tier, price, minQty } = req.body;
  if (!tier) throw new ApiError(400, 'tier is required (retail, wholesale, vip, custom)');
  const existing = await req.models.CustomerTierPrice.findOne({ product, tier, minQty: minQty || 1 });
  if (existing) throw new ApiError(409, 'Tier price already exists for this product/tier/qty combination');
  const tierPrice = await req.models.CustomerTierPrice.create({
    product, tier, price, minQty: minQty || 1,
  });
  res.status(201).json(new ApiResponse(201, tierPrice, 'Tier price created'));
});

const updateTierPrice = asyncHandler(async (req, res) => {
  const tp = await req.models.CustomerTierPrice.findById(req.params.id);
  if (!tp) throw new ApiError(404, 'Tier price not found');
  if (req.body.price !== undefined) tp.price = req.body.price;
  if (req.body.minQty !== undefined) tp.minQty = req.body.minQty;
  await tp.save();
  res.json(new ApiResponse(200, tp, 'Tier price updated'));
});

const removeTierPrice = asyncHandler(async (req, res) => {
  const tp = await req.models.CustomerTierPrice.findById(req.params.id);
  if (!tp) throw new ApiError(404, 'Tier price not found');
  await tp.softDelete();
  res.json(new ApiResponse(200, null, 'Tier price deleted'));
});

/**
 * Resolve price for a product given context (customer, warehouse, qty)
 */
const resolve = asyncHandler(async (req, res) => {
  const { productId, warehouseId, customerId, qty } = req.body;
  if (!productId) throw new ApiError(400, 'productId is required');
  const result = await resolvePrice(req.models, { productId, warehouseId, customerId, qty: qty || 1 });
  res.json(new ApiResponse(200, result));
});

module.exports = { listTierPrices, createTierPrice, updateTierPrice, removeTierPrice, resolve };
