const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta, generateSlug } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const { page, limit, type, category, search, warehouse, brand } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  const hasExplicitType = !!type;
  if (type) filter.type = type;
  if (category) filter.categories = category;
  if (brand) filter.brand = brand;

  // By default, only show single & parent products (hide variants)
  if (!type) {
    filter.type = { $in: ['single', 'parent'] };
  }

  if (search) {
    // First check if search matches any variant's sku/barcode → return parent instead
    const matchingVariants = await req.models.Product.find({
      type: 'variant',
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcodeValue: { $regex: search, $options: 'i' } },
      ],
    }).select('parentProduct').lean();

    const parentIdsFromVariants = [...new Set(matchingVariants.map(v => v.parentProduct?.toString()).filter(Boolean))];

    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { barcodeValue: { $regex: search, $options: 'i' } },
    ];

    // Also include parent products whose variants matched the search
    if (parentIdsFromVariants.length > 0) {
      filter.$or.push({ _id: { $in: parentIdsFromVariants } });
    }

    // When searching without explicit type, constrain to single/parent.
    // When explicit type is provided (e.g. variant search), keep that type filter intact.
    if (!hasExplicitType) {
      delete filter.type;
      filter.$and = [{ type: { $in: ['single', 'parent'] } }];
    }
  }

  const [products, total] = await Promise.all([
    req.models.Product.find(filter)
      .populate('categories', 'name slug')
      .populate('brand', 'name slug')
      .populate('unit', 'name shortName')
      .populate('taxSlab', 'name rate')
      .populate('parentProduct', 'name sku')
      .skip(skip).limit(lim).sort({ createdAt: -1 }),
    req.models.Product.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { products, pagination: paginationMeta(total, pg, lim) }));
});

const create = asyncHandler(async (req, res) => {
  const data = req.body;
  if (data.type === 'variant') throw new ApiError(400, 'Use POST /products/:id/variants to create variants');
  const existing = await req.models.Product.findOne({ sku: data.sku });
  if (existing) throw new ApiError(400, 'SKU already exists');
  if (!data.slug && data.name) data.slug = generateSlug(data.name);
  const product = await req.models.Product.create(data);
  res.status(201).json(new ApiResponse(201, product, 'Product created'));
});

const getById = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findById(req.params.id)
    .populate('categories', 'name slug')
    .populate('brand', 'name slug')
    .populate('unit', 'name shortName')
    .populate('barcodeType', 'name')
    .populate('taxSlab', 'name rate')
    .populate('parentProduct', 'name sku');
  if (!product) throw new ApiError(404, 'Product not found');

  let variants = [];
  if (product.type === 'parent') {
    variants = await req.models.Product.find({ parentProduct: product._id }).populate('taxSlab', 'name rate');
  }

  const stocks = await req.models.ProductStock.find({
    product: { $in: [product._id, ...variants.map((v) => v._id)] },
  }).populate('warehouse', 'name code');

  res.json(new ApiResponse(200, { product, variants, stocks }));
});

const update = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  if (req.body.sku && req.body.sku !== product.sku) {
    const dup = await req.models.Product.findOne({ sku: req.body.sku });
    if (dup) throw new ApiError(400, 'SKU already exists');
  }
  Object.assign(product, req.body);
  await product.save();
  res.json(new ApiResponse(200, product, 'Product updated'));
});

const remove = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  await product.softDelete();
  // Also soft delete variants if parent
  if (product.type === 'parent') {
    await req.models.Product.updateMany(
      { parentProduct: product._id },
      { $set: { deletedAt: new Date() } }
    );
  }
  res.json(new ApiResponse(200, null, 'Product deleted'));
});

const addVariant = asyncHandler(async (req, res) => {
  const parent = await req.models.Product.findById(req.params.id);
  if (!parent || parent.type !== 'parent') throw new ApiError(400, 'Parent product not found or not a parent type');
  const data = req.body;
  const existing = await req.models.Product.findOne({ sku: data.sku });
  if (existing) throw new ApiError(400, 'SKU already exists');
  const variant = await req.models.Product.create({
    ...data,
    type: 'variant',
    parentProduct: parent._id,
    variantAttribute: parent.variantAttribute || data.variantAttribute,
    categories: parent.categories,
    unit: parent.unit,
    barcodeType: parent.barcodeType,
    taxSlab: data.taxSlab || parent.taxSlab,
  });
  res.status(201).json(new ApiResponse(201, variant, 'Variant created'));
});

const updateVariant = asyncHandler(async (req, res) => {
  const variant = await req.models.Product.findOne({
    _id: req.params.variantId,
    parentProduct: req.params.id,
    type: 'variant',
  });
  if (!variant) throw new ApiError(404, 'Variant not found');
  Object.assign(variant, req.body);
  await variant.save();
  res.json(new ApiResponse(200, variant, 'Variant updated'));
});

const deleteVariant = asyncHandler(async (req, res) => {
  const variant = await req.models.Product.findOne({
    _id: req.params.variantId,
    parentProduct: req.params.id,
    type: 'variant',
  });
  if (!variant) throw new ApiError(404, 'Variant not found');
  await variant.softDelete();
  res.json(new ApiResponse(200, null, 'Variant deleted'));
});

const addImages = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  const { images } = req.body; // [{ url, isPrimary, sortOrder, altText }]
  if (!Array.isArray(images)) throw new ApiError(400, 'images array required');
  product.images.push(...images);
  await product.save();
  res.json(new ApiResponse(200, product.images, 'Images added'));
});

const removeImage = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  product.images = product.images.filter((img) => img._id.toString() !== req.params.imageId);
  await product.save();
  res.json(new ApiResponse(200, null, 'Image removed'));
});

const reorderImages = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  const { order } = req.body; // [{ imageId, sortOrder }]
  if (!Array.isArray(order)) throw new ApiError(400, 'order array required');
  order.forEach(({ imageId, sortOrder }) => {
    const img = product.images.id(imageId);
    if (img) img.sortOrder = sortOrder;
  });
  await product.save();
  res.json(new ApiResponse(200, product.images, 'Images reordered'));
});

const getProductStock = asyncHandler(async (req, res) => {
  const stocks = await req.models.ProductStock.find({ product: req.params.id })
    .populate('warehouse', 'name code');
  res.json(new ApiResponse(200, stocks));
});

/**
 * GET /admin/products/stock-summary
 * Returns { productId: { total, warehouses: [{ warehouseId, warehouseName, quantity, reserved }] } }
 */
const stockSummary = asyncHandler(async (req, res) => {
  const stocks = await req.models.ProductStock.find()
    .populate('warehouse', 'name code')
    .populate({ path: 'product', select: 'type parentProduct name' })
    .lean();

  const summary = {};
  for (const s of stocks) {
    if (!s.product) continue;
    const pid = s.product._id.toString();
    if (!summary[pid]) summary[pid] = { total: 0, warehouses: [] };
    const qty = s.quantity ?? 0;
    const reserved = s.reserved ?? 0;
    summary[pid].total += qty;
    summary[pid].warehouses.push({
      warehouseId: s.warehouse?._id,
      warehouseName: s.warehouse?.name || 'Unknown',
      warehouseCode: s.warehouse?.code || '',
      quantity: qty,
      reserved,
    });

    // Aggregate variant stock under its parent product too (for parent badge display)
    if (s.product.type === 'variant' && s.product.parentProduct) {
      const parentId = s.product.parentProduct.toString();
      if (!summary[parentId]) summary[parentId] = { total: 0, warehouses: [] };
      summary[parentId].total += qty;
    }
  }

  res.json(new ApiResponse(200, summary));
});

const getProductMovements = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const [movements, total] = await Promise.all([
    req.models.StockMovement.find({ product: req.params.id })
      .populate('warehouse', 'name code')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.StockMovement.countDocuments({ product: req.params.id }),
  ]);
  res.json(new ApiResponse(200, { movements, pagination: paginationMeta(total, pg, lim) }));
});

module.exports = {
  list, create, getById, update, remove,
  addVariant, updateVariant, deleteVariant,
  addImages, removeImage, reorderImages,
  getProductStock, getProductMovements, stockSummary,
};
