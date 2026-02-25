const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { paginate, paginationMeta } = require('../../utils/helpers');
const mongoose = require('mongoose');

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

const getBrands = asyncHandler(async (req, res) => {
  const brands = await req.models.Brand.find({ isActive: true }).sort({ name: 1 }).lean();
  res.json(new ApiResponse(200, brands));
});

const getProducts = asyncHandler(async (req, res) => {
  const { page, limit, category, brand, search, sort, minPrice, maxPrice, featured, tag } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);

  // Only show single and parent products in listing (variants are shown via their parent)
  const filter = { isActive: true, type: { $in: ['single', 'parent'] } };
  if (category) filter.categories = category;
  if (brand) filter.brand = brand;
  if (featured === 'true') filter.isFeatured = true;
  if (tag) filter.tags = { $regex: tag, $options: 'i' };
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
      .select('name sku slug basePrice compareAtPrice images categories brand isFeatured description tags type')
      .populate('categories', 'name slug')
      .populate('brand', 'name slug image')
      .sort(sortObj).skip(skip).limit(lim)
      .lean(),
    req.models.Product.countDocuments(filter),
  ]);

  // For parent products, fetch their cheapest variant price and total variant stock
  const parentIds = products.filter(p => p.type === 'parent').map(p => p._id);
  let variantPriceMap = {};
  let variantStockMap = {};

  if (parentIds.length > 0) {
    // Get min variant price for each parent
    const priceAgg = await req.models.Product.aggregate([
      { $match: { parentProduct: { $in: parentIds }, isActive: true, type: 'variant' } },
      { $group: { _id: '$parentProduct', minPrice: { $min: '$basePrice' }, maxPrice: { $max: '$basePrice' }, variantCount: { $sum: 1 } } },
    ]);
    priceAgg.forEach(p => { variantPriceMap[p._id.toString()] = { minPrice: p.minPrice, maxPrice: p.maxPrice, variantCount: p.variantCount }; });

    // Get total stock across all variants per parent
    const variantIds = await req.models.Product.find({
      parentProduct: { $in: parentIds }, isActive: true, type: 'variant',
    }).distinct('_id');

    if (variantIds.length > 0) {
      const stockAgg = await req.models.ProductStock.aggregate([
        { $match: { product: { $in: variantIds } } },
        {
          $lookup: {
            from: req.models.Product.collection.name,
            localField: 'product',
            foreignField: '_id',
            as: 'prod',
          },
        },
        { $unwind: '$prod' },
        {
          $group: {
            _id: '$prod.parentProduct',
            totalStock: { $sum: '$quantity' },
            totalReserved: { $sum: '$reservedQuantity' },
          },
        },
      ]);
      stockAgg.forEach(s => {
        variantStockMap[s._id.toString()] = Math.max(0, s.totalStock - s.totalReserved);
      });
    }
  }

  // For single products, get stock
  const singleIds = products.filter(p => p.type === 'single').map(p => p._id);
  let singleStockMap = {};
  if (singleIds.length > 0) {
    const stockAgg = await req.models.ProductStock.aggregate([
      { $match: { product: { $in: singleIds } } },
      { $group: { _id: '$product', totalStock: { $sum: '$quantity' }, totalReserved: { $sum: '$reservedQuantity' } } },
    ]);
    stockAgg.forEach(s => {
      singleStockMap[s._id.toString()] = Math.max(0, s.totalStock - s.totalReserved);
    });
  }

  // Enrich products
  const enriched = products.map(p => {
    const id = p._id.toString();
    if (p.type === 'parent') {
      const vp = variantPriceMap[id];
      return {
        ...p,
        priceRange: vp ? { min: vp.minPrice, max: vp.maxPrice } : null,
        variantCount: vp?.variantCount || 0,
        availableQty: variantStockMap[id] || 0,
        inStock: (variantStockMap[id] || 0) > 0,
      };
    }
    return {
      ...p,
      availableQty: singleStockMap[id] || 0,
      inStock: (singleStockMap[id] || 0) > 0,
    };
  });

  res.json(new ApiResponse(200, { products: enriched, pagination: paginationMeta(total, pg, lim) }));
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findOne({ slug: req.params.slug, isActive: true })
    .populate('categories', 'name slug')
    .populate('brand', 'name slug image')
    .populate('parentProduct', 'name sku slug')
    .populate('unit', 'name shortName')
    .populate('taxSlab', 'name rate');
  if (!product) throw new ApiError(404, 'Product not found');

  let variants = [];
  let availability = { inStock: false, availableQty: 0 };

  if (product.type === 'parent') {
    // For parent products, get all variant details with individual stock
    variants = await req.models.Product.find({ parentProduct: product._id, isActive: true })
      .select('name sku slug basePrice compareAtPrice images variantAttribute variantValue')
      .lean();

    // Get stock per variant
    const variantIds = variants.map(v => v._id);
    if (variantIds.length > 0) {
      const stockAgg = await req.models.ProductStock.aggregate([
        { $match: { product: { $in: variantIds } } },
        { $group: { _id: '$product', totalStock: { $sum: '$quantity' }, totalReserved: { $sum: '$reservedQuantity' } } },
      ]);
      const stockMap = {};
      stockAgg.forEach(s => { stockMap[s._id.toString()] = Math.max(0, s.totalStock - s.totalReserved); });

      variants = variants.map(v => ({
        ...v,
        availableQty: stockMap[v._id.toString()] || 0,
        inStock: (stockMap[v._id.toString()] || 0) > 0,
      }));

      const totalAvailable = variants.reduce((sum, v) => sum + v.availableQty, 0);
      availability = { inStock: totalAvailable > 0, availableQty: totalAvailable };
    }
  } else {
    // Single or variant product — get aggregate stock
    const stockAgg = await req.models.ProductStock.aggregate([
      { $match: { product: product._id } },
      { $group: { _id: null, totalStock: { $sum: '$quantity' }, totalReserved: { $sum: '$reservedQuantity' } } },
    ]);
    const stock = stockAgg[0] || { totalStock: 0, totalReserved: 0 };
    const available = Math.max(0, stock.totalStock - stock.totalReserved);
    availability = { inStock: available > 0, availableQty: available };
  }

  res.json(new ApiResponse(200, { product, variants, availability }));
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findOne({ _id: req.params.id, isActive: true })
    .populate('categories', 'name slug')
    .populate('brand', 'name slug image')
    .populate('unit', 'name shortName')
    .populate('taxSlab', 'name rate');
  if (!product) throw new ApiError(404, 'Product not found');

  let variants = [];
  let availability = { inStock: false, availableQty: 0 };

  if (product.type === 'parent') {
    variants = await req.models.Product.find({ parentProduct: product._id, isActive: true })
      .select('name sku slug basePrice compareAtPrice images variantAttribute variantValue')
      .lean();

    const variantIds = variants.map(v => v._id);
    if (variantIds.length > 0) {
      const stockAgg = await req.models.ProductStock.aggregate([
        { $match: { product: { $in: variantIds } } },
        { $group: { _id: '$product', totalStock: { $sum: '$quantity' }, totalReserved: { $sum: '$reservedQuantity' } } },
      ]);
      const stockMap = {};
      stockAgg.forEach(s => { stockMap[s._id.toString()] = Math.max(0, s.totalStock - s.totalReserved); });

      variants = variants.map(v => ({
        ...v,
        availableQty: stockMap[v._id.toString()] || 0,
        inStock: (stockMap[v._id.toString()] || 0) > 0,
      }));

      const totalAvailable = variants.reduce((sum, v) => sum + v.availableQty, 0);
      availability = { inStock: totalAvailable > 0, availableQty: totalAvailable };
    }
  } else {
    const stockAgg = await req.models.ProductStock.aggregate([
      { $match: { product: product._id } },
      { $group: { _id: null, totalStock: { $sum: '$quantity' }, totalReserved: { $sum: '$reservedQuantity' } } },
    ]);
    const stock = stockAgg[0] || { totalStock: 0, totalReserved: 0 };
    const available = Math.max(0, stock.totalStock - stock.totalReserved);
    availability = { inStock: available > 0, availableQty: available };
  }

  res.json(new ApiResponse(200, { product, variants, availability }));
});

const getFeatured = asyncHandler(async (req, res) => {
  const products = await req.models.Product.find({ isActive: true, isFeatured: true, type: { $in: ['single', 'parent'] } })
    .select('name sku slug basePrice compareAtPrice images brand type')
    .populate('brand', 'name slug')
    .limit(20)
    .lean();

  // Enrich with stock info
  const productIds = products.map(p => p._id);
  const singleIds = products.filter(p => p.type === 'single').map(p => p._id);
  const parentIds = products.filter(p => p.type === 'parent').map(p => p._id);

  let stockMap = {};
  if (singleIds.length > 0) {
    const agg = await req.models.ProductStock.aggregate([
      { $match: { product: { $in: singleIds } } },
      { $group: { _id: '$product', total: { $sum: '$quantity' }, reserved: { $sum: '$reservedQuantity' } } },
    ]);
    agg.forEach(s => { stockMap[s._id.toString()] = Math.max(0, s.total - s.reserved); });
  }

  let variantPriceMap = {};
  if (parentIds.length > 0) {
    const priceAgg = await req.models.Product.aggregate([
      { $match: { parentProduct: { $in: parentIds }, isActive: true, type: 'variant' } },
      { $group: { _id: '$parentProduct', minPrice: { $min: '$basePrice' }, maxPrice: { $max: '$basePrice' } } },
    ]);
    priceAgg.forEach(p => { variantPriceMap[p._id.toString()] = { min: p.minPrice, max: p.maxPrice }; });
  }

  const enriched = products.map(p => {
    const id = p._id.toString();
    if (p.type === 'parent') {
      return { ...p, priceRange: variantPriceMap[id] || null, inStock: true };
    }
    return { ...p, availableQty: stockMap[id] || 0, inStock: (stockMap[id] || 0) > 0 };
  });

  res.json(new ApiResponse(200, enriched));
});

const getNewArrivals = asyncHandler(async (req, res) => {
  const lim = Math.min(Number(req.query.limit) || 12, 40);
  const products = await req.models.Product.find({ isActive: true, type: { $in: ['single', 'parent'] } })
    .select('name sku slug basePrice compareAtPrice images brand type')
    .populate('brand', 'name slug')
    .sort({ createdAt: -1 })
    .limit(lim)
    .lean();
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
    type: { $in: ['single', 'parent'] },
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { sku: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { tags: { $regex: q, $options: 'i' } },
    ],
  };
  const [products, total] = await Promise.all([
    req.models.Product.find(filter)
      .select('name sku slug basePrice compareAtPrice images brand type')
      .populate('brand', 'name slug')
      .sort({ name: 1 }).skip(skip).limit(lim),
    req.models.Product.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { products, pagination: paginationMeta(total, pg, lim) }));
});

module.exports = {
  getCategories, getBrands, getProducts, getProductBySlug, getProductById,
  getFeatured, getNewArrivals, search, getSettings,
};
