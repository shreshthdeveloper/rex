const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');
const { getNextSequence } = require('../../services/counterService');
const { updateStock } = require('../../services/stockService');
const { withTransaction } = require('../../utils/transaction');

const listAllStock = asyncHandler(async (req, res) => {
  const { page, limit, warehouse, product } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (warehouse) filter.warehouse = warehouse;
  if (product) filter.product = product;
  const [stocks, total] = await Promise.all([
    req.models.ProductStock.find(filter)
      .populate('product', 'name sku type')
      .populate('warehouse', 'name code')
      .skip(skip).limit(lim),
    req.models.ProductStock.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { stocks, pagination: paginationMeta(total, pg, lim) }));
});

const setOpeningStock = asyncHandler(async (req, res) => {
  const { productId, warehouseId, quantity, warehousePrice } = req.body;

  // Opening stock is a one-time activity — block if any stock movement already exists
  const existingMovement = await req.models.StockMovement.findOne({ product: productId, warehouse: warehouseId });
  if (existingMovement) {
    throw new ApiError(400, 'Opening stock can only be set once. This SKU already has stock history in this warehouse.');
  }

  const { result: stock } = await withTransaction(req.orgConn, async (session) => {
    let stock = await req.models.ProductStock.findOne({ product: productId, warehouse: warehouseId }).session(session);
    const qtyBefore = stock ? stock.quantity : 0;
    if (!stock) {
      stock = new req.models.ProductStock({ product: productId, warehouse: warehouseId, quantity: 0, reservedQuantity: 0 });
    }
    stock.quantity = quantity;
    if (warehousePrice !== undefined) stock.warehousePrice = warehousePrice;
    await stock.save({ session });

    const movement = new req.models.StockMovement({
      product: productId, warehouse: warehouseId,
      movementType: 'opening_stock', quantityBefore: qtyBefore,
      quantityChange: quantity - qtyBefore, quantityAfter: quantity,
      referenceType: 'manual', referenceNumber: 'OPENING',
      notes: 'Opening stock set', createdBy: req.user._id,
    });
    await movement.save({ session });
    return stock;
  });
  res.json(new ApiResponse(200, stock, 'Opening stock set'));
});

const createAdjustment = asyncHandler(async (req, res) => {
  const { productId, warehouseId, adjustmentType, adjustedQuantity, reason, notes } = req.body;
  const { result: adjustment } = await withTransaction(req.orgConn, async (session) => {
    const adjNum = await getNextSequence(req.models, 'stock_adjustment', 'ADJ-');
    let stock = await req.models.ProductStock.findOne({ product: productId, warehouse: warehouseId }).session(session);
    if (!stock) {
      stock = new req.models.ProductStock({ product: productId, warehouse: warehouseId, quantity: 0, reservedQuantity: 0 });
    }
    const qtyBefore = stock.quantity;
    const change = adjustmentType === 'increase' ? Math.abs(adjustedQuantity) : -Math.abs(adjustedQuantity);
    stock.quantity += change;
    if (stock.quantity < 0) throw new ApiError(400, 'Stock cannot go below 0');
    await stock.save({ session });

    const adjustment = new req.models.StockAdjustment({
      adjustmentNumber: adjNum, warehouse: warehouseId, product: productId,
      quantityBefore: qtyBefore, adjustedQuantity: change, quantityAfter: stock.quantity,
      adjustmentType, reason, notes: notes || '', createdBy: req.user._id,
    });
    await adjustment.save({ session });

    const movement = new req.models.StockMovement({
      product: productId, warehouse: warehouseId,
      movementType: adjustmentType === 'increase' ? 'adjustment_in' : 'adjustment_out',
      quantityBefore: qtyBefore, quantityChange: change, quantityAfter: stock.quantity,
      referenceType: 'stock_adjustment', referenceId: adjustment._id,
      referenceNumber: adjNum, notes: notes || '', createdBy: req.user._id,
    });
    await movement.save({ session });
    return adjustment;
  });
  res.status(201).json(new ApiResponse(201, adjustment, 'Stock adjustment created'));
});

const listAdjustments = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const [adjustments, total] = await Promise.all([
    req.models.StockAdjustment.find()
      .populate('product', 'name sku')
      .populate('warehouse', 'name code')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.StockAdjustment.countDocuments(),
  ]);
  res.json(new ApiResponse(200, { adjustments, pagination: paginationMeta(total, pg, lim) }));
});

const getAdjustment = asyncHandler(async (req, res) => {
  const adj = await req.models.StockAdjustment.findById(req.params.id)
    .populate('product', 'name sku').populate('warehouse', 'name code').populate('createdBy', 'name');
  if (!adj) throw new ApiError(404, 'Adjustment not found');
  res.json(new ApiResponse(200, adj));
});

const createTransfer = asyncHandler(async (req, res) => {
  const { fromWarehouse, toWarehouse, items, notes } = req.body;
  if (fromWarehouse === toWarehouse) throw new ApiError(400, 'From and To warehouse must be different');
  const transferNumber = await getNextSequence(req.models, 'stock_transfer', 'TRF-');
  const transfer = await req.models.StockTransfer.create({
    transferNumber, fromWarehouse, toWarehouse,
    items: items.map((i) => ({ product: i.productId || i.product, requestedQty: i.requestedQty || i.quantity, notes: i.notes || '' })),
    notes: notes || '', createdBy: req.user._id, status: 'in_transit',
  });
  res.status(201).json(new ApiResponse(201, transfer, 'Stock transfer created'));
});

const listTransfers = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (status) filter.status = status;
  const [transfers, total] = await Promise.all([
    req.models.StockTransfer.find(filter)
      .populate('fromWarehouse', 'name code')
      .populate('toWarehouse', 'name code')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.StockTransfer.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { transfers, pagination: paginationMeta(total, pg, lim) }));
});

const getTransfer = asyncHandler(async (req, res) => {
  const transfer = await req.models.StockTransfer.findById(req.params.id)
    .populate('fromWarehouse', 'name code')
    .populate('toWarehouse', 'name code')
    .populate('items.product', 'name sku');
  if (!transfer) throw new ApiError(404, 'Transfer not found');
  res.json(new ApiResponse(200, transfer));
});

const completeTransfer = asyncHandler(async (req, res) => {
  const transfer = await req.models.StockTransfer.findById(req.params.id);
  if (!transfer) throw new ApiError(404, 'Transfer not found');
  if (transfer.status === 'completed') throw new ApiError(400, 'Transfer already completed');
  if (transfer.status === 'cancelled') throw new ApiError(400, 'Transfer is cancelled');

  await withTransaction(req.orgConn, async (session) => {
    for (const item of transfer.items) {
      const qty = item.requestedQty;
      await updateStock(req.models, req.orgConn, {
        productId: item.product, warehouseId: transfer.fromWarehouse,
        quantityChange: -qty, movementType: 'transfer_out',
        referenceType: 'stock_transfer', referenceId: transfer._id,
        referenceNumber: transfer.transferNumber,
        fromWarehouse: transfer.fromWarehouse, toWarehouse: transfer.toWarehouse,
        notes: `Transfer to ${transfer.toWarehouse}`, userId: req.user._id,
      }, session);
      await updateStock(req.models, req.orgConn, {
        productId: item.product, warehouseId: transfer.toWarehouse,
        quantityChange: qty, movementType: 'transfer_in',
        referenceType: 'stock_transfer', referenceId: transfer._id,
        referenceNumber: transfer.transferNumber,
        fromWarehouse: transfer.fromWarehouse, toWarehouse: transfer.toWarehouse,
        notes: `Transfer from ${transfer.fromWarehouse}`, userId: req.user._id,
      }, session);
      item.transferredQty = qty;
    }
    transfer.status = 'completed';
    transfer.completedBy = req.user._id;
    transfer.completedAt = new Date();
    await transfer.save({ session });
  });
  res.json(new ApiResponse(200, transfer, 'Transfer completed'));
});

const cancelTransfer = asyncHandler(async (req, res) => {
  const transfer = await req.models.StockTransfer.findById(req.params.id);
  if (!transfer) throw new ApiError(404, 'Transfer not found');
  if (transfer.status === 'completed') throw new ApiError(400, 'Cannot cancel completed transfer');
  transfer.status = 'cancelled';
  await transfer.save();
  res.json(new ApiResponse(200, null, 'Transfer cancelled'));
});

const listMovements = asyncHandler(async (req, res) => {
  const { page, limit, product, warehouse, movementType, startDate, endDate } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (product) filter.product = product;
  if (warehouse) filter.warehouse = warehouse;
  if (movementType) filter.movementType = movementType;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  const [movements, total] = await Promise.all([
    req.models.StockMovement.find(filter)
      .populate('product', 'name sku')
      .populate('warehouse', 'name code')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.StockMovement.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { movements, pagination: paginationMeta(total, pg, lim) }));
});

const getProductMovements = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { product: req.params.productId };
  const [movements, total] = await Promise.all([
    req.models.StockMovement.find(filter)
      .populate('warehouse', 'name code')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.StockMovement.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { movements, pagination: paginationMeta(total, pg, lim) }));
});

const lowStock = asyncHandler(async (req, res) => {
  const stocks = await req.models.ProductStock.find({
    $expr: { $lt: ['$quantity', '$lowStockThreshold'] },
  }).populate('product', 'name sku type').populate('warehouse', 'name code');
  res.json(new ApiResponse(200, stocks));
});

/**
 * Bulk opening stock by warehouse — select a warehouse and set opening stock for multiple SKUs at once
 * POST /admin/stock/opening/bulk-by-warehouse
 * Body: { warehouseId, items: [{ productId, quantity, warehousePrice? }] }
 */
const bulkOpeningByWarehouse = asyncHandler(async (req, res) => {
  const { warehouseId, items } = req.body;
  if (!warehouseId) throw new ApiError(400, 'Warehouse is required');
  if (!Array.isArray(items) || !items.length) throw new ApiError(400, 'At least one item is required');

  const results = { success: [], skipped: [] };

  for (const item of items) {
    const { productId, quantity, warehousePrice } = item;
    if (!productId || quantity === undefined) { results.skipped.push({ productId, reason: 'Missing productId or quantity' }); continue; }

    // Check if already has stock history
    const existing = await req.models.StockMovement.findOne({ product: productId, warehouse: warehouseId });
    if (existing) {
      results.skipped.push({ productId, reason: 'Already has stock history in this warehouse' });
      continue;
    }

    await withTransaction(req.orgConn, async (session) => {
      let stock = await req.models.ProductStock.findOne({ product: productId, warehouse: warehouseId }).session(session);
      if (!stock) {
        stock = new req.models.ProductStock({ product: productId, warehouse: warehouseId, quantity: 0, reservedQuantity: 0 });
      }
      const qtyBefore = stock.quantity;
      stock.quantity = quantity;
      if (warehousePrice !== undefined) stock.warehousePrice = warehousePrice;
      await stock.save({ session });

      const movement = new req.models.StockMovement({
        product: productId, warehouse: warehouseId,
        movementType: 'opening_stock', quantityBefore: qtyBefore,
        quantityChange: quantity - qtyBefore, quantityAfter: quantity,
        referenceType: 'manual', referenceNumber: 'OPENING',
        notes: 'Bulk opening stock set', createdBy: req.user._id,
      });
      await movement.save({ session });
    });
    results.success.push({ productId, quantity });
  }

  res.json(new ApiResponse(200, results, `Set opening stock for ${results.success.length} SKU(s), ${results.skipped.length} skipped`));
});

/**
 * Bulk opening stock by product — select a product and set opening stock across multiple warehouses
 * POST /admin/stock/opening/bulk-by-product
 * Body: { productId, warehouses: [{ warehouseId, quantity, warehousePrice? }] }
 */
const bulkOpeningByProduct = asyncHandler(async (req, res) => {
  const { productId, warehouses } = req.body;
  if (!productId) throw new ApiError(400, 'Product is required');
  if (!Array.isArray(warehouses) || !warehouses.length) throw new ApiError(400, 'At least one warehouse is required');

  const results = { success: [], skipped: [] };

  for (const wh of warehouses) {
    const { warehouseId, quantity, warehousePrice } = wh;
    if (!warehouseId || quantity === undefined) { results.skipped.push({ warehouseId, reason: 'Missing warehouseId or quantity' }); continue; }

    const existing = await req.models.StockMovement.findOne({ product: productId, warehouse: warehouseId });
    if (existing) {
      results.skipped.push({ warehouseId, reason: 'Already has stock history in this warehouse' });
      continue;
    }

    await withTransaction(req.orgConn, async (session) => {
      let stock = await req.models.ProductStock.findOne({ product: productId, warehouse: warehouseId }).session(session);
      if (!stock) {
        stock = new req.models.ProductStock({ product: productId, warehouse: warehouseId, quantity: 0, reservedQuantity: 0 });
      }
      const qtyBefore = stock.quantity;
      stock.quantity = quantity;
      if (warehousePrice !== undefined) stock.warehousePrice = warehousePrice;
      await stock.save({ session });

      const movement = new req.models.StockMovement({
        product: productId, warehouse: warehouseId,
        movementType: 'opening_stock', quantityBefore: qtyBefore,
        quantityChange: quantity - qtyBefore, quantityAfter: quantity,
        referenceType: 'manual', referenceNumber: 'OPENING',
        notes: 'Bulk opening stock set', createdBy: req.user._id,
      });
      await movement.save({ session });
    });
    results.success.push({ warehouseId, quantity });
  }

  res.json(new ApiResponse(200, results, `Set opening stock for ${results.success.length} warehouse(s), ${results.skipped.length} skipped`));
});

module.exports = {
  listAllStock, setOpeningStock, createAdjustment, listAdjustments, getAdjustment,
  createTransfer, listTransfers, getTransfer, completeTransfer, cancelTransfer,
  listMovements, getProductMovements, lowStock,
  bulkOpeningByWarehouse, bulkOpeningByProduct,
};
