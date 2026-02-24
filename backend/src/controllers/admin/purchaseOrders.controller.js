const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');
const { getNextSequence } = require('../../services/counterService');
const { updateStock } = require('../../services/stockService');
const { createSupplierLedgerEntry } = require('../../services/ledgerService');
const { withTransaction } = require('../../utils/transaction');

// ─── Purchase Orders ───
const listPO = asyncHandler(async (req, res) => {
  const { page, limit, status, supplier } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (status) filter.status = status;
  if (supplier) filter.supplier = supplier;
  const [pos, total] = await Promise.all([
    req.models.PurchaseOrder.find(filter).populate('supplier', 'name').populate('warehouse', 'name').sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.PurchaseOrder.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { purchaseOrders: pos, pagination: paginationMeta(total, pg, lim) }));
});

const createPO = asyncHandler(async (req, res) => {
  const poNumber = await getNextSequence(req.models, 'purchase_order', 'PO-');
  const items = req.body.items || [];
  let subtotal = 0;
  const poItems = items.map(item => {
    const lineTotal = (item.orderedQty || item.quantity) * item.unitCost;
    subtotal += lineTotal;
    return { product: item.product, orderedQty: item.orderedQty || item.quantity, unitCost: item.unitCost, receivedQty: 0, lineTotal };
  });
  const taxTotal = req.body.taxTotal || req.body.taxAmount || 0;
  const discount = req.body.discount || 0;
  const shippingCost = req.body.shippingCost || 0;
  const grandTotal = subtotal + taxTotal + shippingCost - discount;

  const po = await req.models.PurchaseOrder.create({
    poNumber, supplier: req.body.supplier, warehouse: req.body.warehouse,
    items: poItems, subtotal, taxTotal, discount, shippingCost, grandTotal,
    balanceDue: grandTotal, amountPaid: 0,
    expectedDate: req.body.expectedDate || req.body.expectedDeliveryDate || null,
    notes: req.body.notes || '', status: 'draft', createdBy: req.user._id,
  });
  res.status(201).json(new ApiResponse(201, po, 'Purchase order created'));
});

const getPO = asyncHandler(async (req, res) => {
  const po = await req.models.PurchaseOrder.findById(req.params.id)
    .populate('supplier', 'name email phone').populate('warehouse', 'name');
  if (!po) throw new ApiError(404, 'Purchase order not found');
  res.json(new ApiResponse(200, po));
});

const updatePO = asyncHandler(async (req, res) => {
  const po = await req.models.PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, 'Purchase order not found');
  if (!['draft', 'ordered'].includes(po.status)) throw new ApiError(400, 'Cannot edit PO in current status');
  const allowed = ['supplier', 'warehouse', 'items', 'expectedDate', 'notes', 'taxTotal', 'discount', 'shippingCost'];
  allowed.forEach(k => { if (req.body[k] !== undefined) po[k] = req.body[k]; });
  // Recalculate
  if (req.body.items) {
    let subtotal = 0;
    po.items = req.body.items.map(item => {
      const lineTotal = (item.orderedQty || item.quantity) * item.unitCost;
      subtotal += lineTotal;
      return { product: item.product, orderedQty: item.orderedQty || item.quantity, unitCost: item.unitCost, receivedQty: 0, lineTotal };
    });
    po.subtotal = subtotal;
    po.grandTotal = subtotal + (po.taxTotal || 0) + (po.shippingCost || 0) - (po.discount || 0);
    po.balanceDue = po.grandTotal - po.amountPaid;
  }
  await po.save();
  res.json(new ApiResponse(200, po, 'Purchase order updated'));
});

const deletePO = asyncHandler(async (req, res) => {
  const po = await req.models.PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, 'Purchase order not found');
  if (!['draft'].includes(po.status)) throw new ApiError(400, 'Only draft POs can be deleted');
  await po.softDelete();
  res.json(new ApiResponse(200, null, 'Purchase order deleted'));
});

const updatePOStatus = asyncHandler(async (req, res) => {
  const po = await req.models.PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, 'Purchase order not found');
  const validTransitions = {
    draft: ['ordered', 'cancelled'],
    ordered: ['partial', 'received', 'cancelled'],
    partial: ['received', 'cancelled'],
  };
  const next = req.body.status;
  if (!validTransitions[po.status] || !validTransitions[po.status].includes(next)) {
    throw new ApiError(400, `Cannot transition from ${po.status} to ${next}`);
  }
  po.status = next;
  if (next === 'cancelled') po.cancelledAt = new Date();
  await po.save();
  res.json(new ApiResponse(200, po, `PO status updated to ${next}`));
});

// ─── GRN (Goods Received Note) ───
const listGRN = asyncHandler(async (req, res) => {
  const { page, limit, purchaseOrder } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (purchaseOrder) filter.purchaseOrder = purchaseOrder;
  const [grns, total] = await Promise.all([
    req.models.GRN.find(filter).populate('purchaseOrder', 'poNumber').populate('warehouse', 'name').sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.GRN.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { grns, pagination: paginationMeta(total, pg, lim) }));
});

const createGRN = asyncHandler(async (req, res) => {
  const po = await req.models.PurchaseOrder.findById(req.body.purchaseOrder);
  if (!po) throw new ApiError(404, 'Purchase order not found');
  if (['cancelled', 'received'].includes(po.status)) throw new ApiError(400, `Cannot create GRN for ${po.status} PO`);

  const grnNumber = await getNextSequence(req.models, 'grn', 'GRN-');
  const items = req.body.items || [];
  const grnItems = items.map(item => ({
    product: item.product,
    receivedQty: item.receivedQty || item.quantityReceived || 0,
    unitCost: item.unitCost,
    lineTotal: (item.receivedQty || item.quantityReceived || 0) * item.unitCost,
  }));

  const totalValue = grnItems.reduce((sum, i) => sum + i.lineTotal, 0);

  const grn = new req.models.GRN({
    grnNumber, purchaseOrder: po._id, supplier: po.supplier, warehouse: po.warehouse,
    items: grnItems, totalValue, receivedDate: req.body.receivedDate || new Date(),
    status: 'draft', notes: req.body.notes || '', createdBy: req.user._id,
  });
  await grn.save();
  res.status(201).json(new ApiResponse(201, grn, 'GRN created (pending approval)'));
});

const getGRN = asyncHandler(async (req, res) => {
  const grn = await req.models.GRN.findById(req.params.id)
    .populate('purchaseOrder', 'poNumber supplier').populate('warehouse', 'name');
  if (!grn) throw new ApiError(404, 'GRN not found');
  res.json(new ApiResponse(200, grn));
});

const approveGRN = asyncHandler(async (req, res) => {
  const { result: grn } = await withTransaction(req.orgConn, async (session) => {
    const grn = await req.models.GRN.findById(req.params.id).session(session);
    if (!grn) throw new ApiError(404, 'GRN not found');
    if (grn.status !== 'draft') throw new ApiError(400, 'GRN already processed');

    const po = await req.models.PurchaseOrder.findById(grn.purchaseOrder).session(session);

    // Update stock for each received item
    for (const item of grn.items) {
      const received = item.receivedQty || 0;
      if (received > 0) {
        await updateStock(req.models, req.orgConn, {
          productId: item.product, warehouseId: grn.warehouse,
          quantityChange: received, movementType: 'purchase_in',
          referenceType: 'grn', referenceId: grn._id, referenceNumber: grn.grnNumber,
          notes: `GRN ${grn.grnNumber} - received stock`, userId: req.user._id,
        }, session);
      }
      // Update PO received qty
      if (po) {
        const poItem = po.items.find(i => i.product.toString() === item.product.toString());
        if (poItem) poItem.receivedQty = (poItem.receivedQty || 0) + received;
      }
    }

    // Add GRN total to supplier ledger (we owe them)
    const grnTotal = grn.items.reduce((sum, i) => sum + (i.lineTotal || 0), 0);
    if (grnTotal > 0) {
      await createSupplierLedgerEntry(req.models, {
        supplierId: grn.supplier, transactionType: 'purchase_invoice',
        referenceType: 'grn', referenceId: grn._id, referenceNumber: grn.grnNumber,
        debit: grnTotal, credit: 0, narration: `GRN ${grn.grnNumber} approved - goods received`,
        userId: req.user._id,
      }, session);
    }

    // Update PO status
    if (po) {
      const allReceived = po.items.every(i => i.receivedQty >= i.orderedQty);
      po.status = allReceived ? 'received' : 'partial';
      await po.save({ session });
    }

    grn.status = 'approved';
    grn.approvedBy = req.user._id;
    grn.approvedAt = new Date();
    await grn.save({ session });
    return grn;
  });
  res.json(new ApiResponse(200, grn, 'GRN approved – stock updated, ledger entry created'));
});

const rejectGRN = asyncHandler(async (req, res) => {
  const grn = await req.models.GRN.findById(req.params.id);
  if (!grn) throw new ApiError(404, 'GRN not found');
  if (grn.status !== 'draft') throw new ApiError(400, 'GRN already processed');
  grn.status = 'rejected';
  grn.notes = (grn.notes || '') + `\nRejected: ${req.body.reason || 'No reason'}`;
  await grn.save();
  res.json(new ApiResponse(200, grn, 'GRN rejected'));
});

// ─── Purchase Returns ───
const listPurchaseReturns = asyncHandler(async (req, res) => {
  const { page, limit, purchaseOrder } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (purchaseOrder) filter.purchaseOrder = purchaseOrder;
  const [returns, total] = await Promise.all([
    req.models.PurchaseReturn.find(filter).populate('supplier', 'name').sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.PurchaseReturn.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { purchaseReturns: returns, pagination: paginationMeta(total, pg, lim) }));
});

const createPurchaseReturn = asyncHandler(async (req, res) => {
  const { result: pr } = await withTransaction(req.orgConn, async (session) => {
    const returnNumber = await getNextSequence(req.models, 'purchase_return', 'PRR-');
    const items = req.body.items || [];
    let totalValue = 0;
    const returnItems = items.map(item => {
      const qty = item.returnQty || item.quantity;
      const lineTotal = qty * item.unitCost;
      totalValue += lineTotal;
      return { product: item.product, returnQty: qty, unitCost: item.unitCost, lineTotal, reason: item.reason || '' };
    });

    const pr = new req.models.PurchaseReturn({
      returnNumber, purchaseOrder: req.body.purchaseOrder,
      supplier: req.body.supplier, warehouse: req.body.warehouse,
      items: returnItems, totalValue, status: 'approved',
      notes: req.body.notes || '', createdBy: req.user._id,
    });
    await pr.save({ session });

    // Deduct stock
    for (const item of returnItems) {
      await updateStock(req.models, req.orgConn, {
        productId: item.product, warehouseId: req.body.warehouse,
        quantityChange: -item.returnQty, movementType: 'adjustment_out',
        referenceType: 'return', referenceId: pr._id, referenceNumber: returnNumber,
        notes: `Purchase return ${returnNumber}`, userId: req.user._id,
      }, session);
    }

    // Credit supplier ledger (they owe us / reduces our payable)
    if (totalValue > 0) {
      await createSupplierLedgerEntry(req.models, {
        supplierId: req.body.supplier, transactionType: 'credit_note',
        referenceType: 'return', referenceId: pr._id, referenceNumber: returnNumber,
        debit: 0, credit: totalValue, narration: `Purchase return ${returnNumber}`,
        userId: req.user._id,
      }, session);
    }
    return pr;
  });
  res.status(201).json(new ApiResponse(201, pr, 'Purchase return created – stock deducted, ledger updated'));
});

module.exports = {
  listPO, createPO, getPO, updatePO, deletePO, updatePOStatus,
  listGRN, createGRN, getGRN, approveGRN, rejectGRN,
  listPurchaseReturns, createPurchaseReturn,
};
