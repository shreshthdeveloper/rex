const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { paginate, paginationMeta } = require('../../utils/helpers');

/**
 * Public storefront catalog — no auth required, resolveOrg middleware provides req.models
 */

const getCategories = asyncHandler(async (req, res) => {
  const categories = await req.models.Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
  // Build tree
  const map = {};
  const roots = [];
  categories.forEach(c => { map[c._id.toString()] = { ...c, children: [] }; });
  categories.forEach(c => {
    if (c.parentCategory) {
      const parent = map[c.parentCategory.toString()];
      if (parent) parent.children.push(map[c._id.toString()]);
    } else {
      roots.push(map[c._id.toString()]);
    }
  });
  res.json(new ApiResponse(200, roots));
});

const getProducts = asyncHandler(async (req, res) => {
  const { page, limit, category, search, sort, minPrice, maxPrice, featured } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { isActive: true };
  if (category) filter.categories = category;
  if (featured === 'true') filter.isFeatured = true;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }
  if (minPrice || maxPrice) {
    filter.basePrice = {};
    if (minPrice) filter.basePrice.$gte = Number(minPrice);
    if (maxPrice) filter.basePrice.$lte = Number(maxPrice);
  }

  let sortObj = { createdAt: -1 };
  if (sort === 'price_asc') sortObj = { basePrice: 1 };
  else if (sort === 'price_desc') sortObj = { basePrice: -1 };
  else if (sort === 'name_asc') sortObj = { name: 1 };
  else if (sort === 'name_desc') sortObj = { name: -1 };
  else if (sort === 'newest') sortObj = { createdAt: -1 };

  const [products, total] = await Promise.all([
    req.models.Product.find(filter)
      .select('name sku slug basePrice compareAtPrice images categories isFeatured description')
      .populate('categories', 'name slug')
      .sort(sortObj).skip(skip).limit(lim),
    req.models.Product.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { products, pagination: paginationMeta(total, pg, lim) }));
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findOne({ slug: req.params.slug, isActive: true })
    .populate('categories', 'name slug')
    .populate('parentProduct', 'name sku')
    .populate('taxSlab', 'name rate');
  if (!product) throw new ApiError(404, 'Product not found');

  // Get variants
  let variants = [];
  if (product.type === 'parent') {
    variants = await req.models.Product.find({ parentProduct: product._id, isActive: true })
      .select('name sku slug basePrice compareAtPrice images variantAttribute variantValue');
  }

  // Get stock availability (sum across warehouses)
  const stockAgg = await req.models.ProductStock.aggregate([
    { $match: { product: product._id } },
    { $group: { _id: null, totalStock: { $sum: '$quantity' }, totalReserved: { $sum: '$reservedQuantity' } } },
  ]);
  const stock = stockAgg[0] || { totalStock: 0, totalReserved: 0 };
  const available = Math.max(0, stock.totalStock - stock.totalReserved);

  res.json(new ApiResponse(200, {
    product,
    variants,
    availability: { inStock: available > 0, availableQty: available },
  }));
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findOne({ _id: req.params.id, isActive: true })
    .populate('categories', 'name slug')
    .populate('unit', 'name shortName')
    .populate('taxSlab', 'name rate');
  if (!product) throw new ApiError(404, 'Product not found');

  let variants = [];
  if (product.type === 'parent') {
    variants = await req.models.Product.find({ parentProduct: product._id, isActive: true })
      .select('name sku slug basePrice compareAtPrice images variantAttribute variantValue');
  }

  const stockAgg = await req.models.ProductStock.aggregate([
    { $match: { product: product._id } },
    { $group: { _id: null, totalStock: { $sum: '$quantity' }, totalReserved: { $sum: '$reservedQuantity' } } },
  ]);
  const stock = stockAgg[0] || { totalStock: 0, totalReserved: 0 };
  const available = Math.max(0, stock.totalStock - stock.totalReserved);

  res.json(new ApiResponse(200, {
    product,
    variants,
    availability: { inStock: available > 0, availableQty: available },
  }));
});

const getFeatured = asyncHandler(async (req, res) => {
  const products = await req.models.Product.find({ isActive: true, isFeatured: true })
    .select('name sku slug basePrice compareAtPrice images')
    .limit(20);
  res.json(new ApiResponse(200, products));
});

const getSettings = asyncHandler(async (req, res) => {
  let settings = await req.models.EcomSettings.findOne().lean();
  if (!settings) settings = {};
  res.json(new ApiResponse(200, settings));
});

const search = asyncHandler(async (req, res) => {
  const { q, page, limit } = req.query;
  if (!q) return res.json(new ApiResponse(200, { products: [], pagination: paginationMeta(0, 1, 20) }));
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {
    isActive: true,
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { sku: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { tags: { $regex: q, $options: 'i' } },
    ],
  };
  const [products, total] = await Promise.all([
    req.models.Product.find(filter)
      .select('name sku slug basePrice compareAtPrice images')
      .sort({ name: 1 }).skip(skip).limit(lim),
    req.models.Product.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { products, pagination: paginationMeta(total, pg, lim) }));
});

module.exports = { getCategories, getProducts, getProductBySlug, getProductById, getFeatured, search, getSettings };
