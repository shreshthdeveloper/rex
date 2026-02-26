const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { paginate, paginationMeta } = require('../../utils/helpers');
const mongoose = require('mongoose');

/**
 * Public storefront catalog — no auth required, resolveOrg middleware provides req.models
 */

const redactProductPrice = (product) => {
  if (!product) return product;
  const cloned = { ...product };
  delete cloned.basePrice;
  delete cloned.compareAtPrice;
  delete cloned.priceRange;
  return cloned;
};

const redactVariantsPrice = (variants = []) => variants.map((variant) => {
  const cloned = { ...variant };
  delete cloned.basePrice;
  delete cloned.compareAtPrice;
  return cloned;
});

const getCategories = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  // Check if a customer is logged in (optional auth on store routes)
  const isGuest = !req.customer;
  if (isGuest) {
    filter.hideFromGuests = { $ne: true };
  } else {
    filter.hideFromCustomers = { $ne: true };
  }
  const categories = await req.models.Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
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
  const isGuest = !req.customer;
  const hiddenBrandIds = await req.models.Brand.find(
    isGuest ? { hideFromGuests: true } : { hideFromCustomers: true },
  ).distinct('_id');

  // Return brands that have at least one active product (regardless of brand.isActive)
  const activeBrandIds = await req.models.Product.distinct('brand', { isActive: true, brand: { $ne: null } });
  const brandFilter = {
    $or: [
      { _id: { $in: activeBrandIds } },
      { isActive: true },
    ],
  };
  if (hiddenBrandIds.length > 0) brandFilter._id = { $nin: hiddenBrandIds };

  const brands = await req.models.Brand.find(brandFilter).sort({ name: 1 }).lean();
  res.json(new ApiResponse(200, brands));
});

const getProducts = asyncHandler(async (req, res) => {
  const { page, limit, category, brand, search, sort, minPrice, maxPrice, featured, tag } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);

  // Only show single and parent products in listing (variants are shown via their parent)
  const filter = { isActive: true, type: { $in: ['single', 'parent'] } };

  // Filter out products belonging to hidden categories
  const isGuest = !req.customer;
  const hiddenCats = await req.models.Category.find(
    isGuest ? { hideFromGuests: true } : { hideFromCustomers: true },
  ).distinct('_id');

  // Build category query conditions — combine user-requested category with hidden-cat exclusion
  const catConditions = [];
  if (hiddenCats.length > 0) catConditions.push({ categories: { $nin: hiddenCats } });
  if (category) catConditions.push({ categories: category });
  if (catConditions.length === 1) Object.assign(filter, catConditions[0]);
  else if (catConditions.length > 1) filter.$and = catConditions;

  // Brand visibility enforcement
  const hiddenBrands = await req.models.Brand.find(
    isGuest ? { hideFromGuests: true } : { hideFromCustomers: true },
  ).distinct('_id');
  if (brand) {
    if (hiddenBrands.some((id) => id.toString() === brand.toString())) {
      return res.json(new ApiResponse(200, { products: [], pagination: paginationMeta(0, pg, lim) }));
    }
    filter.brand = brand;
  } else if (hiddenBrands.length > 0) {
    filter.brand = { $nin: hiddenBrands };
  }

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

  const responseProducts = isGuest ? enriched.map(redactProductPrice) : enriched;
  res.json(new ApiResponse(200, { products: responseProducts, pagination: paginationMeta(total, pg, lim) }));
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findOne({ slug: req.params.slug, isActive: true })
    .populate('categories', 'name slug')
    .populate('brand', 'name slug image')
    .populate('parentProduct', 'name sku slug')
    .populate('unit', 'name shortName')
    .populate('taxSlab', 'name rate');
  if (!product) throw new ApiError(404, 'Product not found');

  // Guard: block access if product belongs to a hidden category
  const isGuest = !req.customer;
  const productCategoryIds = (product.categories || []).map((c) => c._id || c);
  if (productCategoryIds.length > 0) {
    const hiddenCat = await req.models.Category.findOne({
      _id: { $in: productCategoryIds },
      ...(isGuest ? { hideFromGuests: true } : { hideFromCustomers: true }),
    });
    if (hiddenCat) throw new ApiError(404, 'Product not found');
  }

  // Guard: block access if product's brand is hidden
  if (product.brand) {
    const brandId = product.brand._id || product.brand;
    const hiddenBrand = await req.models.Brand.findOne({
      _id: brandId,
      ...(isGuest ? { hideFromGuests: true } : { hideFromCustomers: true }),
    });
    if (hiddenBrand) throw new ApiError(404, 'Product not found');
  }

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

  const responseProduct = isGuest ? redactProductPrice(product.toObject ? product.toObject() : product) : product;
  const responseVariants = isGuest ? redactVariantsPrice(variants) : variants;

  res.json(new ApiResponse(200, { product: responseProduct, variants: responseVariants, availability }));
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await req.models.Product.findOne({ _id: req.params.id, isActive: true })
    .populate('categories', 'name slug')
    .populate('brand', 'name slug image')
    .populate('unit', 'name shortName')
    .populate('taxSlab', 'name rate');
  if (!product) throw new ApiError(404, 'Product not found');

  // Guard: block access if product belongs to a hidden category
  const isGuest = !req.customer;
  const productCategoryIds = (product.categories || []).map((c) => c._id || c);
  if (productCategoryIds.length > 0) {
    const hiddenCat = await req.models.Category.findOne({
      _id: { $in: productCategoryIds },
      ...(isGuest ? { hideFromGuests: true } : { hideFromCustomers: true }),
    });
    if (hiddenCat) throw new ApiError(404, 'Product not found');
  }

  // Guard: block access if product's brand is hidden
  if (product.brand) {
    const brandId = product.brand._id || product.brand;
    const hiddenBrand = await req.models.Brand.findOne({
      _id: brandId,
      ...(isGuest ? { hideFromGuests: true } : { hideFromCustomers: true }),
    });
    if (hiddenBrand) throw new ApiError(404, 'Product not found');
  }

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

  const responseProduct = isGuest ? redactProductPrice(product.toObject ? product.toObject() : product) : product;
  const responseVariants = isGuest ? redactVariantsPrice(variants) : variants;

  res.json(new ApiResponse(200, { product: responseProduct, variants: responseVariants, availability }));
});

const getFeatured = asyncHandler(async (req, res) => {
  const isGuest = !req.customer;
  const hiddenCats = await req.models.Category.find(
    isGuest ? { hideFromGuests: true } : { hideFromCustomers: true },
  ).distinct('_id');

  const baseFilter = { isActive: true, isFeatured: true, type: { $in: ['single', 'parent'] } };
  if (hiddenCats.length > 0) baseFilter.categories = { $nin: hiddenCats };

  const hiddenBrandsFeatured = await req.models.Brand.find(
    isGuest ? { hideFromGuests: true } : { hideFromCustomers: true },
  ).distinct('_id');
  if (hiddenBrandsFeatured.length > 0) baseFilter.brand = { $nin: hiddenBrandsFeatured };

  const products = await req.models.Product.find(baseFilter)
    .select('name sku slug basePrice compareAtPrice images brand categories type')
    .populate('brand', 'name slug')
    .populate('categories', 'name slug')
    .limit(20)
    .lean();

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
  let variantStockMap = {};
  if (parentIds.length > 0) {
    const priceAgg = await req.models.Product.aggregate([
      { $match: { parentProduct: { $in: parentIds }, isActive: true, type: 'variant' } },
      { $group: { _id: '$parentProduct', minPrice: { $min: '$basePrice' }, maxPrice: { $max: '$basePrice' } } },
    ]);
    priceAgg.forEach(p => { variantPriceMap[p._id.toString()] = { min: p.minPrice, max: p.maxPrice }; });

    const variantIds = await req.models.Product.find({ parentProduct: { $in: parentIds }, isActive: true, type: 'variant' }).distinct('_id');
    if (variantIds.length > 0) {
      const vStockAgg = await req.models.ProductStock.aggregate([
        { $match: { product: { $in: variantIds } } },
        { $lookup: { from: req.models.Product.collection.name, localField: 'product', foreignField: '_id', as: 'prod' } },
        { $unwind: '$prod' },
        { $group: { _id: '$prod.parentProduct', totalStock: { $sum: '$quantity' }, totalReserved: { $sum: '$reservedQuantity' } } },
      ]);
      vStockAgg.forEach(s => { variantStockMap[s._id.toString()] = Math.max(0, s.totalStock - s.totalReserved); });
    }
  }

  const enriched = products.map(p => {
    const id = p._id.toString();
    if (p.type === 'parent') {
      return { ...p, priceRange: variantPriceMap[id] || null, availableQty: variantStockMap[id] || 0, inStock: (variantStockMap[id] || 0) > 0 };
    }
    return { ...p, availableQty: stockMap[id] || 0, inStock: (stockMap[id] || 0) > 0 };
  });

  const responseProducts = isGuest ? enriched.map(redactProductPrice) : enriched;
  res.json(new ApiResponse(200, responseProducts));
});

const getNewArrivals = asyncHandler(async (req, res) => {
  const lim = Math.min(Number(req.query.limit) || 12, 40);
  const isGuest = !req.customer;
  const hiddenCats = await req.models.Category.find(
    isGuest ? { hideFromGuests: true } : { hideFromCustomers: true },
  ).distinct('_id');

  const baseFilter = { isActive: true, type: { $in: ['single', 'parent'] } };
  if (hiddenCats.length > 0) baseFilter.categories = { $nin: hiddenCats };

  const hiddenBrandsNew = await req.models.Brand.find(
    isGuest ? { hideFromGuests: true } : { hideFromCustomers: true },
  ).distinct('_id');
  if (hiddenBrandsNew.length > 0) baseFilter.brand = { $nin: hiddenBrandsNew };

  const products = await req.models.Product.find(baseFilter)
    .select('name sku slug basePrice compareAtPrice images brand categories type')
    .populate('brand', 'name slug')
    .populate('categories', 'name slug')
    .sort({ createdAt: -1 })
    .limit(lim)
    .lean();

  const singleIds = products.filter(p => p.type === 'single').map(p => p._id);
  const parentIds = products.filter(p => p.type === 'parent').map(p => p._id);
  let stockMap = {};
  let varPriceMap = {};
  let varStockMap = {};
  if (singleIds.length > 0) {
    const agg = await req.models.ProductStock.aggregate([
      { $match: { product: { $in: singleIds } } },
      { $group: { _id: '$product', total: { $sum: '$quantity' }, reserved: { $sum: '$reservedQuantity' } } },
    ]);
    agg.forEach(s => { stockMap[s._id.toString()] = Math.max(0, s.total - s.reserved); });
  }
  if (parentIds.length > 0) {
    const priceAgg = await req.models.Product.aggregate([
      { $match: { parentProduct: { $in: parentIds }, isActive: true, type: 'variant' } },
      { $group: { _id: '$parentProduct', minPrice: { $min: '$basePrice' }, maxPrice: { $max: '$basePrice' } } },
    ]);
    priceAgg.forEach(p => { varPriceMap[p._id.toString()] = { min: p.minPrice, max: p.maxPrice }; });

    const variantIds = await req.models.Product.find({ parentProduct: { $in: parentIds }, isActive: true, type: 'variant' }).distinct('_id');
    if (variantIds.length > 0) {
      const stockAgg = await req.models.ProductStock.aggregate([
        { $match: { product: { $in: variantIds } } },
        { $lookup: { from: req.models.Product.collection.name, localField: 'product', foreignField: '_id', as: 'prod' } },
        { $unwind: '$prod' },
        { $group: { _id: '$prod.parentProduct', totalStock: { $sum: '$quantity' }, totalReserved: { $sum: '$reservedQuantity' } } },
      ]);
      stockAgg.forEach(s => { varStockMap[s._id.toString()] = Math.max(0, s.totalStock - s.totalReserved); });
    }
  }

  const enriched = products.map(p => {
    const id = p._id.toString();
    if (p.type === 'parent') {
      return { ...p, priceRange: varPriceMap[id] || null, availableQty: varStockMap[id] || 0, inStock: (varStockMap[id] || 0) > 0 };
    }
    return { ...p, availableQty: stockMap[id] || 0, inStock: (stockMap[id] || 0) > 0 };
  });

  const responseProducts = isGuest ? enriched.map(redactProductPrice) : enriched;
  res.json(new ApiResponse(200, responseProducts));
});

const getSettings = asyncHandler(async (req, res) => {
  let settings = await req.models.EcomSettings.findOne().lean();
  if (!settings) settings = {};
  res.json(new ApiResponse(200, settings));
});

const getWarehouses = asyncHandler(async (req, res) => {
  const warehouses = await req.models.Warehouse.find({ isActive: true })
    .select('name code city state')
    .sort({ name: 1 })
    .lean();
  res.json(new ApiResponse(200, warehouses));
});

const submitContactQuery = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message, sourcePage } = req.body || {};

  if (!name || !email || !message) {
    throw new ApiError(400, 'Name, email and message are required');
  }

  const query = await req.models.ContactQuery.create({
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    phone: phone ? String(phone).trim() : '',
    subject: subject ? String(subject).trim() : '',
    message: String(message).trim(),
    sourcePage: sourcePage ? String(sourcePage).trim() : 'contact',
    meta: {
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    },
  });

  res.status(201).json(new ApiResponse(201, { id: query._id }, 'Query submitted successfully'));
});

const search = asyncHandler(async (req, res) => {
  const { q, page, limit } = req.query;
  if (!q) return res.json(new ApiResponse(200, { products: [], pagination: paginationMeta(0, 1, 20) }));
  const { skip, limit: lim, page: pg } = paginate(page, limit);

  // Exclude products from hidden categories (same logic as getProducts)
  const isGuest = !req.customer;
  const hiddenCats = await req.models.Category.find(
    isGuest ? { hideFromGuests: true } : { hideFromCustomers: true },
  ).distinct('_id');

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
  if (hiddenCats.length > 0) {
    filter.categories = { $nin: hiddenCats };
  }
  const hiddenBrandsSearch = await req.models.Brand.find(
    isGuest ? { hideFromGuests: true } : { hideFromCustomers: true },
  ).distinct('_id');
  if (hiddenBrandsSearch.length > 0) filter.brand = { $nin: hiddenBrandsSearch };
  const [products, total] = await Promise.all([
    req.models.Product.find(filter)
      .select('name sku slug basePrice compareAtPrice images brand categories type')
      .populate('brand', 'name slug')
      .populate('categories', 'name slug')
      .sort({ name: 1 }).skip(skip).limit(lim)
      .lean(),
    req.models.Product.countDocuments(filter),
  ]);

  // Enrich with stock
  const singleIds = products.filter(p => p.type === 'single').map(p => p._id);
  const parentIds = products.filter(p => p.type === 'parent').map(p => p._id);
  let stockMap = {}, varPriceMap = {};
  if (singleIds.length > 0) {
    const agg = await req.models.ProductStock.aggregate([
      { $match: { product: { $in: singleIds } } },
      { $group: { _id: '$product', total: { $sum: '$quantity' }, reserved: { $sum: '$reservedQuantity' } } },
    ]);
    agg.forEach(s => { stockMap[s._id.toString()] = Math.max(0, s.total - s.reserved); });
  }
  if (parentIds.length > 0) {
    const priceAgg = await req.models.Product.aggregate([
      { $match: { parentProduct: { $in: parentIds }, isActive: true, type: 'variant' } },
      { $group: { _id: '$parentProduct', minPrice: { $min: '$basePrice' }, maxPrice: { $max: '$basePrice' } } },
    ]);
    priceAgg.forEach(p => { varPriceMap[p._id.toString()] = { min: p.minPrice, max: p.maxPrice }; });
  }
  const enriched = products.map(p => {
    const id = p._id.toString();
    if (p.type === 'parent') return { ...p, priceRange: varPriceMap[id] || null, inStock: true };
    return { ...p, availableQty: stockMap[id] || 0, inStock: (stockMap[id] || 0) > 0 };
  });

  const responseProducts = isGuest ? enriched.map(redactProductPrice) : enriched;

  res.json(new ApiResponse(200, { products: responseProducts, pagination: paginationMeta(total, pg, lim) }));
});

module.exports = {
  getCategories, getBrands, getProducts, getProductBySlug, getProductById,
  getFeatured, getNewArrivals, search, getSettings, getWarehouses, submitContactQuery,
};
