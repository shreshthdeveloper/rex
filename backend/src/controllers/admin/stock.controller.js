const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');
const { getNextSequence } = require('../../services/counterService');
const { updateStock } = require('../../services/stockService');
const { withTransaction } = require('../../utils/transaction');

const listAllStock = asyncHandler(async (req, res) => {
  const { page, limit, warehouse, product, search } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (warehouse) filter.warehouse = warehouse;
  if (product) filter.product = product;
  if (search) {
    const matchingProducts = await req.models.Product.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { sku:  { $regex: search, $options: 'i' } },
      ],
    }).select('_id');
    filter.product = { $in: matchingProducts.map((p) => p._id) };
  }
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
  const { productId, warehouseId, quantity, supplierPrice } = req.body;

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
    if (supplierPrice !== undefined) stock.supplierPrice = supplierPrice;
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

/**
 * Bulk Stock Adjustment (Batch) — creates an AdjustmentBatch in PENDING status.
 * Stock does NOT change until the batch is approved.
 * Body: { warehouseId, adjustmentType, reason, notes, items: [{ productId, adjustedQuantity }] }
 */
const bulkCreateAdjustment = asyncHandler(async (req, res) => {
  const { warehouseId, adjustmentType, reason, notes, items } = req.body;
  if (!warehouseId) throw new ApiError(400, 'warehouseId is required');
  if (!items || !items.length) throw new ApiError(400, 'items array is required');
  if (!['increase', 'decrease'].includes(adjustmentType)) throw new ApiError(400, 'Invalid adjustmentType');

  const batchNumber = await getNextSequence(req.models, 'stock_adjustment_batch', 'ADJ-');
  const batch = await req.models.AdjustmentBatch.create({
    batchNumber,
    warehouse: warehouseId,
    adjustmentType,
    reason,
    notes: notes || '',
    status: 'pending',
    items: items
      .filter((i) => i.productId && i.adjustedQuantity)
      .map((i) => ({ product: i.productId, requestedQty: i.adjustedQuantity })),
    createdBy: req.user._id,
  });

  // Reserve stock immediately for decrease adjustments (released on approve or cancel)
  if (adjustmentType === 'decrease') {
    for (const item of batch.items) {
      await req.models.ProductStock.updateOne(
        { product: item.product, warehouse: warehouseId },
        { $inc: { reservedQuantity: Number(item.requestedQty) } }
      );
    }
  }

  res.status(201).json(new ApiResponse(201, batch, 'Adjustment batch created (pending approval)'));
});

const listAdjustmentBatches = asyncHandler(async (req, res) => {
  const { page, limit, status, search } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.batchNumber = { $regex: search, $options: 'i' };
  const [batches, total] = await Promise.all([
    req.models.AdjustmentBatch.find(filter)
      .populate('warehouse', 'name code')
      .populate('items.product', 'name sku')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.AdjustmentBatch.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { adjustments: batches, pagination: paginationMeta(total, pg, lim) }));
});

const getAdjustmentBatch = asyncHandler(async (req, res) => {
  const batch = await req.models.AdjustmentBatch.findById(req.params.id)
    .populate('warehouse', 'name code')
    .populate('items.product', 'name sku')
    .populate('createdBy', 'name email')
    .populate('approvedBy', 'name email');
  if (!batch) throw new ApiError(404, 'Adjustment batch not found');
  res.json(new ApiResponse(200, batch));
});

const updateAdjustmentBatch = asyncHandler(async (req, res) => {
  const batch = await req.models.AdjustmentBatch.findById(req.params.id);
  if (!batch) throw new ApiError(404, 'Adjustment batch not found');
  if (batch.status !== 'pending') throw new ApiError(400, 'Only pending adjustments can be edited');

  const { warehouseId, adjustmentType, reason, notes, items } = req.body;
  if (warehouseId) batch.warehouse = warehouseId;
  if (adjustmentType) batch.adjustmentType = adjustmentType;
  if (reason) batch.reason = reason;
  if (notes !== undefined) batch.notes = notes;
  if (Array.isArray(items) && items.length) {
    batch.items = items
      .filter((i) => (i.productId || i.product) && i.adjustedQuantity)
      .map((i) => ({ product: i.productId || i.product, requestedQty: i.adjustedQuantity }));
  }
  await batch.save();
  const populated = await req.models.AdjustmentBatch.findById(batch._id)
    .populate('warehouse', 'name code')
    .populate('items.product', 'name sku');
  res.json(new ApiResponse(200, populated, 'Adjustment batch updated'));
});

const approveAdjustmentBatch = asyncHandler(async (req, res) => {
  const batch = await req.models.AdjustmentBatch.findById(req.params.id);
  if (!batch) throw new ApiError(404, 'Adjustment batch not found');
  if (batch.status === 'approved') throw new ApiError(400, 'Already approved');
  if (batch.status === 'cancelled') throw new ApiError(400, 'Cannot approve a cancelled batch');

  await withTransaction(req.orgConn, async (session) => {
    for (const item of batch.items) {
      const adjNum = await getNextSequence(req.models, 'stock_adjustment', 'ADJ-');
      let stock = await req.models.ProductStock
        .findOne({ product: item.product, warehouse: batch.warehouse })
        .session(session);
      if (!stock) {
        stock = new req.models.ProductStock({
          product: item.product, warehouse: batch.warehouse, quantity: 0, reservedQuantity: 0,
        });
      }
      const qtyBefore = stock.quantity;
      const change = batch.adjustmentType === 'increase'
        ? Math.abs(item.requestedQty)
        : -Math.abs(item.requestedQty);
      stock.quantity += change;
      if (stock.quantity < 0) throw new ApiError(400, `Stock cannot go below 0 (product: ${item.product})`);
      // Release reservation for decrease adjustments
      if (batch.adjustmentType === 'decrease') {
        stock.reservedQuantity = Math.max(0, (stock.reservedQuantity || 0) - Math.abs(item.requestedQty));
      }
      await stock.save({ session });

      const adj = new req.models.StockAdjustment({
        adjustmentNumber: adjNum,
        warehouse: batch.warehouse,
        product: item.product,
        quantityBefore: qtyBefore,
        adjustedQuantity: change,
        quantityAfter: stock.quantity,
        adjustmentType: batch.adjustmentType,
        reason: batch.reason,
        notes: batch.notes,
        createdBy: req.user._id,
      });
      await adj.save({ session });

      await req.models.StockMovement.create([{
        product: item.product,
        warehouse: batch.warehouse,
        movementType: batch.adjustmentType === 'increase' ? 'adjustment_in' : 'adjustment_out',
        quantityBefore: qtyBefore,
        quantityChange: change,
        quantityAfter: stock.quantity,
        referenceType: 'stock_adjustment',
        referenceId: adj._id,
        referenceNumber: adjNum,
        notes: batch.notes,
        createdBy: req.user._id,
      }], { session });
    }
    batch.status = 'approved';
    batch.approvedBy = req.user._id;
    batch.approvedAt = new Date();
    await batch.save({ session });
  });

  res.json(new ApiResponse(200, batch, 'Adjustment approved — stock updated'));
});

const cancelAdjustmentBatch = asyncHandler(async (req, res) => {
  const batch = await req.models.AdjustmentBatch.findById(req.params.id);
  if (!batch) throw new ApiError(404, 'Adjustment batch not found');
  if (batch.status === 'approved') throw new ApiError(400, 'Cannot cancel an approved adjustment');
  if (batch.status === 'cancelled') throw new ApiError(400, 'Already cancelled');
  // Release any reservations held for pending decrease adjustments
  if (batch.adjustmentType === 'decrease') {
    for (const item of batch.items) {
      await req.models.ProductStock.updateOne(
        { product: item.product, warehouse: batch.warehouse },
        { $inc: { reservedQuantity: -Number(item.requestedQty) } }
      );
    }
  }
  batch.status = 'cancelled';
  await batch.save();
  res.json(new ApiResponse(200, null, 'Adjustment cancelled'));
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
  // Reserve stock at source warehouse for each item
  for (const item of transfer.items) {
    await req.models.ProductStock.updateOne(
      { product: item.product, warehouse: fromWarehouse },
      { $inc: { reservedQuantity: Number(item.requestedQty) } }
    );
  }
  res.status(201).json(new ApiResponse(201, transfer, 'Stock transfer created'));
});

const listTransfers = asyncHandler(async (req, res) => {
  const { page, limit, status, search } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.transferNumber = { $regex: search, $options: 'i' };
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
      // Release reservation at source warehouse
      await req.models.ProductStock.findOneAndUpdate(
        { product: item.product, warehouse: transfer.fromWarehouse },
        { $inc: { reservedQuantity: -qty } },
        { session }
      );
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

const updateTransfer = asyncHandler(async (req, res) => {
  const transfer = await req.models.StockTransfer.findById(req.params.id);
  if (!transfer) throw new ApiError(404, 'Transfer not found');
  if (transfer.status !== 'in_transit') throw new ApiError(400, 'Only in-transit transfers can be edited');

  const { fromWarehouse, toWarehouse, notes, items } = req.body;
  const from = fromWarehouse || transfer.fromWarehouse.toString();
  const to   = toWarehouse   || transfer.toWarehouse.toString();
  if (from === to) throw new ApiError(400, 'From and To warehouse must be different');

  if (fromWarehouse) transfer.fromWarehouse = fromWarehouse;
  if (toWarehouse)   transfer.toWarehouse   = toWarehouse;
  if (notes !== undefined) transfer.notes = notes;
  if (Array.isArray(items) && items.length) {
    transfer.items = items.map((i) => ({
      product:      i.productId || i.product,
      requestedQty: i.requestedQty || i.quantity,
      notes:        i.notes || '',
    }));
  }
  await transfer.save();
  const populated = await req.models.StockTransfer.findById(transfer._id)
    .populate('fromWarehouse', 'name code')
    .populate('toWarehouse', 'name code')
    .populate('items.product', 'name sku');
  res.json(new ApiResponse(200, populated, 'Transfer updated'));
});

const cancelTransfer = asyncHandler(async (req, res) => {
  const transfer = await req.models.StockTransfer.findById(req.params.id);
  if (!transfer) throw new ApiError(404, 'Transfer not found');
  if (transfer.status === 'completed') throw new ApiError(400, 'Cannot cancel completed transfer');
  // Release reservations at source warehouse
  for (const item of transfer.items) {
    await req.models.ProductStock.updateOne(
      { product: item.product, warehouse: transfer.fromWarehouse },
      { $inc: { reservedQuantity: -Number(item.requestedQty) } }
    );
  }
  transfer.status = 'cancelled';
  await transfer.save();
  res.json(new ApiResponse(200, null, 'Transfer cancelled'));
});

const listMovements = asyncHandler(async (req, res) => {
  const { page, limit, product, warehouse, movementType, startDate, endDate, search } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (product) filter.product = product;
  if (warehouse) filter.warehouse = warehouse;
  if (movementType) filter.movementType = movementType;
  if (search) {
    const matchingProducts = await req.models.Product.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { sku:  { $regex: search, $options: 'i' } },
      ],
    }).select('_id');
    filter.product = { $in: matchingProducts.map((p) => p._id) };
  }
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  const [movements, total] = await Promise.all([
    req.models.StockMovement.find(filter)
      .populate('product', 'name sku')
      .populate('warehouse', 'name code')
      .populate('fromWarehouse', 'name code')
      .populate('toWarehouse', 'name code')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.StockMovement.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { movements, pagination: paginationMeta(total, pg, lim) }));
});

const getProductMovements = asyncHandler(async (req, res) => {
  const { page, limit, warehouse } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { product: req.params.productId };
  if (warehouse) filter.warehouse = warehouse;
  const [movements, total] = await Promise.all([
    req.models.StockMovement.find(filter)
      .populate('warehouse', 'name code')
      .populate('fromWarehouse', 'name code')
      .populate('toWarehouse', 'name code')
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
 * Body: { warehouseId, items: [{ productId, quantity, supplierPrice? }] }
 */
const bulkOpeningByWarehouse = asyncHandler(async (req, res) => {
  const { warehouseId, items } = req.body;
  if (!warehouseId) throw new ApiError(400, 'Warehouse is required');
  if (!Array.isArray(items) || !items.length) throw new ApiError(400, 'At least one item is required');

  const results = { success: [], skipped: [] };

  for (const item of items) {
    const { productId, quantity, supplierPrice } = item;
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
      if (supplierPrice !== undefined) stock.supplierPrice = supplierPrice;
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

module.exports = {
  listAllStock, setOpeningStock,
  bulkCreateAdjustment, listAdjustmentBatches, getAdjustmentBatch,
  updateAdjustmentBatch, approveAdjustmentBatch, cancelAdjustmentBatch,
  createTransfer, updateTransfer, listTransfers, getTransfer, completeTransfer, cancelTransfer,
  listMovements, getProductMovements, lowStock,
  bulkOpeningByWarehouse,
};
