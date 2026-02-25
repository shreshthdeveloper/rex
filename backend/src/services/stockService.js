/**
 * Stock Service — handles all stock mutations with movement logging.
 * All operations use MongoDB transactions.
 */

const ApiError = require('../utils/ApiError');

/**
 * Update stock and create movement record within a session transaction
 */
const updateStock = async (models, connection, {
  productId, warehouseId, quantityChange, movementType,
  referenceType, referenceId, referenceNumber,
  fromWarehouse, toWarehouse, notes, userId,
}, session) => {
  const ProductStock = models.ProductStock;
  const StockMovement = models.StockMovement;

  // Get or create stock record
  let stock = await ProductStock.findOne({ product: productId, warehouse: warehouseId }).session(session);
  if (!stock) {
    stock = new ProductStock({
      product: productId,
      warehouse: warehouseId,
      quantity: 0,
      reservedQuantity: 0,
    });
  }

  const quantityBefore = stock.quantity;
  stock.quantity += quantityChange;

  if (stock.quantity < 0) {
    throw new ApiError(400, `Insufficient stock. Available: ${quantityBefore}, Requested change: ${quantityChange}`);
  }

  const quantityAfter = stock.quantity;
  await stock.save({ session });

  // Create immutable movement record
  const movement = new StockMovement({
    product: productId,
    warehouse: warehouseId,
    movementType,
    quantityBefore,
    quantityChange,
    quantityAfter,
    referenceType,
    referenceId,
    referenceNumber: referenceNumber || '',
    fromWarehouse: fromWarehouse || null,
    toWarehouse: toWarehouse || null,
    notes: notes || '',
    createdBy: userId,
  });
  await movement.save({ session });

  return { stock, movement };
};

/**
 * Reserve stock (when order enters shipped flow)
 */
const reserveStock = async (models, productId, warehouseId, qty, session) => {
  const stock = await models.ProductStock.findOne({
    product: productId,
    warehouse: warehouseId,
  }).session(session);

  if (!stock) throw new ApiError(400, 'No stock record found for this product in the selected warehouse. Please set opening stock first.');
  const available = stock.quantity - stock.reservedQuantity;
  if (available < qty) {
    throw new ApiError(400, `Insufficient available stock. Available: ${available}, Requested: ${qty}`);
  }
  stock.reservedQuantity += qty;
  await stock.save({ session });
  return stock;
};

/**
 * Release reserved stock (on cancel/failure before delivery)
 */
const releaseReserved = async (models, productId, warehouseId, qty, session) => {
  const stock = await models.ProductStock.findOne({
    product: productId,
    warehouse: warehouseId,
  }).session(session);
  if (!stock) return;
  stock.reservedQuantity = Math.max(0, stock.reservedQuantity - qty);
  await stock.save({ session });
  return stock;
};

/**
 * Deduct stock from inventory when the shipment is completed (delivery)
 * (quantity-- and reservedQuantity--)
 */
const deductOnShipment = async (models, connection, {
  productId, warehouseId, qty, orderId, orderNumber, userId,
}, session) => {
  const stock = await models.ProductStock.findOne({
    product: productId,
    warehouse: warehouseId,
  }).session(session);
  if (!stock) throw new ApiError(400, 'No stock record found for this product in the selected warehouse.');

  const quantityBefore = stock.quantity;
  stock.quantity -= qty;
  stock.reservedQuantity = Math.max(0, stock.reservedQuantity - qty);
  if (stock.quantity < 0) throw new ApiError(400, 'Insufficient stock for shipment');
  await stock.save({ session });

  const movement = new models.StockMovement({
    product: productId,
    warehouse: warehouseId,
    movementType: 'sale_out',
    quantityBefore,
    quantityChange: -qty,
    quantityAfter: stock.quantity,
    referenceType: 'order',
    referenceId: orderId,
    referenceNumber: orderNumber,
    createdBy: userId,
  });
  await movement.save({ session });
  return stock;
};

/**
 * Receive return stock (pending return): items are physically back but quarantined.
 * Increments both quantity and reservedQuantity so net available stays the same.
 */
const receiveReturnStock = async (models, connection, {
  productId, warehouseId, qty, returnId, returnNumber, userId,
}, session) => {
  const stock = await models.ProductStock.findOne({
    product: productId, warehouse: warehouseId,
  }).session(session);
  if (!stock) throw new ApiError(400, 'No stock record found for this product in the selected warehouse.');

  const quantityBefore = stock.quantity;
  stock.quantity += qty;
  stock.reservedQuantity += qty;
  await stock.save({ session });

  const movement = new models.StockMovement({
    product: productId, warehouse: warehouseId,
    movementType: 'return_in_pending',
    quantityBefore, quantityChange: qty, quantityAfter: stock.quantity,
    referenceType: 'return', referenceId: returnId,
    referenceNumber: returnNumber,
    notes: `Pending return received — quarantined`,
    createdBy: userId,
  });
  await movement.save({ session });
  return stock;
};

/**
 * Release return stock (approved return): items cleared for sale.
 * Decrements reservedQuantity so available increases.
 */
const releaseReturnStock = async (models, connection, {
  productId, warehouseId, qty, returnId, returnNumber, userId,
}, session) => {
  const stock = await models.ProductStock.findOne({
    product: productId, warehouse: warehouseId,
  }).session(session);
  if (!stock) throw new ApiError(400, 'No stock record found for this product in the selected warehouse.');

  stock.reservedQuantity = Math.max(0, stock.reservedQuantity - qty);
  await stock.save({ session });

  const movement = new models.StockMovement({
    product: productId, warehouse: warehouseId,
    movementType: 'return_in_approved',
    quantityBefore: stock.quantity, quantityChange: 0, quantityAfter: stock.quantity,
    referenceType: 'return', referenceId: returnId,
    referenceNumber: returnNumber,
    notes: `Return approved — stock released to available`,
    createdBy: userId,
  });
  await movement.save({ session });
  return stock;
};

module.exports = { updateStock, reserveStock, releaseReserved, deductOnShipment, receiveReturnStock, releaseReturnStock };
