const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');
const { getNextSequence } = require('../../services/counterService');
const { resolvePrice } = require('../../services/priceResolver');
const { reserveStock, releaseReserved, deductOnShipment } = require('../../services/stockService');
const { createCustomerLedgerEntry } = require('../../services/ledgerService');
const { withTransaction } = require('../../utils/transaction');

/**
 * Calculate line item totals
 */
const calcLineItem = (item) => {
  let discount = 0;
  if (item.discountType === 'flat') discount = item.discountValue || 0;
  else if (item.discountType === 'percentage') discount = (item.unitPrice * (item.discountValue || 0)) / 100;
  const afterDiscount = Math.max(0, item.unitPrice - discount);
  const taxRate = item.taxSlab?.rate || 0;
  const taxAmount = (afterDiscount * item.quantity * taxRate) / 100;
  const lineTotal = afterDiscount * item.quantity + taxAmount;
  return { discountAmount: discount, taxAmount: Math.round(taxAmount * 100) / 100, lineTotal: Math.round(lineTotal * 100) / 100 };
};

const list = asyncHandler(async (req, res) => {
  const { page, limit, status, customer, warehouse, startDate, endDate } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};
  if (status) filter.status = status;
  if (customer) filter.customer = customer;
  if (warehouse) filter.warehouse = warehouse;
  if (startDate || endDate) {
    filter.orderDate = {};
    if (startDate) filter.orderDate.$gte = new Date(startDate);
    if (endDate) filter.orderDate.$lte = new Date(endDate);
  }
  const [orders, total] = await Promise.all([
    req.models.Order.find(filter)
      .populate('customer', 'name email phone')
      .populate('warehouse', 'name code')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.Order.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { orders, pagination: paginationMeta(total, pg, lim) }));
});

const createOrder = asyncHandler(async (req, res) => {
  const {
    customerId, warehouseId, items, discountType, discountValue,
    couponCode, shippingCharge, shippingAddress, notes, paymentMethod, paymentAmount,
  } = req.body;

  const { result: order } = await withTransaction(req.orgConn, async (session) => {
    const customer = await req.models.Customer.findById(customerId).session(session);
    if (!customer) throw new ApiError(404, 'Customer not found');

    const orderNumber = await getNextSequence(req.models, 'order', 'ORD-');
    const invoiceNumber = await getNextSequence(req.models, 'invoice', 'INV-');

    // Build line items with price resolution and product snapshot
    const orderItems = [];
    for (const item of items) {
      const product = await req.models.Product.findById(item.productId)
        .populate('unit', 'name shortName').populate('taxSlab', 'name rate').session(session);
      if (!product) throw new ApiError(404, `Product not found: ${item.productId}`);

      // Resolve price
      const priceResult = await resolvePrice(req.models, {
        productId: product._id, warehouseId, customerId, qty: item.quantity,
      });
      const unitPrice = item.unitPrice || priceResult.price;

      // Tax snapshot
      const taxSlab = product.taxSlab ? { name: product.taxSlab.name, rate: product.taxSlab.rate } : { name: 'Exempt', rate: 0 };

      const lineItem = {
        product: product._id,
        productSnapshot: {
          name: product.name, sku: product.sku,
          barcodeValue: product.barcodeValue,
          unitName: product.unit?.shortName || '',
          image: product.images?.[0]?.url || '',
        },
        quantity: item.quantity, unitPrice,
        discountType: item.discountType || null,
        discountValue: item.discountValue || 0,
        taxSlab,
        status: 'active', returnedQty: 0,
      };
      const calcs = calcLineItem(lineItem);
      lineItem.discountAmount = calcs.discountAmount;
      lineItem.taxAmount = calcs.taxAmount;
      lineItem.lineTotal = calcs.lineTotal;
      orderItems.push(lineItem);

      // Reserve stock
      await reserveStock(req.models, product._id, warehouseId, item.quantity, session);
    }

    // Calculate subtotal
    const subtotal = orderItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const taxTotal = orderItems.reduce((sum, i) => sum + i.taxAmount, 0);

    // Order-level discount
    let orderDiscountAmount = 0;
    if (discountType === 'flat') orderDiscountAmount = discountValue || 0;
    else if (discountType === 'percentage') orderDiscountAmount = (subtotal * (discountValue || 0)) / 100;

    // Coupon discount
    let couponDiscount = 0;
    if (couponCode) {
      const coupon = await req.models.Coupon.findOne({ code: couponCode, isActive: true }).session(session);
      if (coupon) {
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new ApiError(400, 'Coupon usage limit reached');
        if (coupon.minOrderValue && subtotal < coupon.minOrderValue) throw new ApiError(400, 'Order does not meet minimum value for coupon');
        if (coupon.validFrom && new Date() < coupon.validFrom) throw new ApiError(400, 'Coupon not yet valid');
        if (coupon.validUntil && new Date() > coupon.validUntil) throw new ApiError(400, 'Coupon expired');
        if (coupon.discountType === 'flat') couponDiscount = coupon.discountValue;
        else couponDiscount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount && couponDiscount > coupon.maxDiscountAmount) couponDiscount = coupon.maxDiscountAmount;
        coupon.usedCount += 1;
        await coupon.save({ session });
      }
    }

    const grandTotal = Math.max(0, Math.round((subtotal - orderDiscountAmount - couponDiscount + (shippingCharge || 0)) * 100) / 100);

    // Handle payment
    let amountPaid = 0;
    if (paymentAmount && paymentAmount > 0) amountPaid = paymentAmount;
    const balanceDue = Math.round((grandTotal - amountPaid) * 100) / 100;
    let paymentStatus = 'unpaid';
    if (amountPaid >= grandTotal) paymentStatus = 'paid';
    else if (amountPaid > 0) paymentStatus = 'partial';

    const defaultAddr = customer.addresses?.find((a) => a.isDefault) || customer.addresses?.[0];

    const order = new req.models.Order({
      orderNumber, customer: customer._id, warehouse: warehouseId,
      status: 'placed', orderDate: new Date(), items: orderItems,
      subtotal: Math.round(subtotal * 100) / 100, discountType: discountType || null,
      discountValue: discountValue || 0, discountAmount: Math.round(orderDiscountAmount * 100) / 100,
      couponCode: couponCode || null, couponDiscount: Math.round(couponDiscount * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100, shippingCharge: shippingCharge || 0,
      grandTotal, amountPaid, balanceDue, paymentStatus,
      shippingAddress: shippingAddress || (defaultAddr ? defaultAddr.toObject() : {}),
      notes: notes || '', invoiceNumber, createdBy: req.user._id,
      statusHistory: [{ status: 'placed', changedAt: new Date(), changedBy: req.user._id }],
    });
    await order.save({ session });

    // Create ledger debit entry (invoice)
    await createCustomerLedgerEntry(req.models, {
      customerId: customer._id, transactionType: 'invoice',
      referenceType: 'order', referenceId: order._id, referenceNumber: orderNumber,
      debit: grandTotal, credit: 0, narration: `Order ${orderNumber} — Sale invoice`,
      userId: req.user._id,
    }, session);

    // If payment made, record it
    if (amountPaid > 0) {
      const payment = new req.models.OrderPayment({
        order: order._id, customer: customer._id, amount: amountPaid,
        method: paymentMethod || 'cash', paymentDate: new Date(),
        createdBy: req.user._id,
      });
      await payment.save({ session });

      await createCustomerLedgerEntry(req.models, {
        customerId: customer._id, transactionType: 'payment',
        referenceType: 'payment', referenceId: payment._id,
        referenceNumber: orderNumber,
        debit: 0, credit: amountPaid,
        narration: `Payment received for ${orderNumber}`,
        userId: req.user._id,
      }, session);
    }

    return order;
  });
  res.status(201).json(new ApiResponse(201, order, 'Order created'));
});

const getById = asyncHandler(async (req, res) => {
  const order = await req.models.Order.findById(req.params.id)
    .populate('customer', 'name email phone')
    .populate('warehouse', 'name code')
    .populate('createdBy', 'name');
  if (!order) throw new ApiError(404, 'Order not found');
  const payments = await req.models.OrderPayment.find({ order: order._id });
  const returns = await req.models.OrderReturn.find({ order: order._id });
  res.json(new ApiResponse(200, { order, payments, returns }));
});

const updateOrder = asyncHandler(async (req, res) => {
  const order = await req.models.Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (!['placed', 'processing'].includes(order.status)) {
    throw new ApiError(400, 'Order can only be edited in placed/processing status');
  }
  // Save edit history
  order.editHistory.push({ snapshot: order.toObject(), editedAt: new Date(), editedBy: req.user._id });

  const { customerId, warehouseId, items, shippingCharge, notes, shippingAddress } = req.body;

  // Simple fields
  if (notes !== undefined) order.notes = notes;
  if (shippingAddress !== undefined) order.shippingAddress = shippingAddress;
  if (shippingCharge !== undefined) order.shippingCharge = Number(shippingCharge) || 0;

  // Customer & warehouse
  if (customerId) order.customer = customerId;
  const warehouseChanged = warehouseId && warehouseId.toString() !== order.warehouse.toString();
  const newWarehouseId = warehouseId || order.warehouse;

  // Items update (with stock adjustments)
  if (items && Array.isArray(items) && items.length > 0) {
    await withTransaction(req.orgConn, async (session) => {
      // Release reserved stock for old items
      for (const oldItem of order.items) {
        if (oldItem.status === 'active') {
          await releaseReserved(req.models, oldItem.product, order.warehouse, oldItem.quantity, session);
        }
      }
      // Build new line items
      const orderItems = [];
      for (const item of items) {
        const productId = item.productId || item.product;
        const product = await req.models.Product.findById(productId)
          .populate('unit', 'name shortName').populate('taxSlab', 'name rate').session(session);
        if (!product) throw new ApiError(404, `Product not found: ${productId}`);
        const unitPrice = item.unitPrice || product.basePrice || 0;
        const taxSlab = product.taxSlab ? { name: product.taxSlab.name, rate: product.taxSlab.rate } : { name: 'Exempt', rate: 0 };
        const lineItem = {
          product: product._id,
          productSnapshot: {
            name: product.name, sku: product.sku,
            barcodeValue: product.barcodeValue,
            unitName: product.unit?.shortName || '',
            image: product.images?.[0]?.url || '',
          },
          quantity: Number(item.quantity), unitPrice,
          discountType: item.discountType || null,
          discountValue: item.discountValue || 0,
          taxSlab,
          status: 'active', returnedQty: 0,
        };
        const calcs = calcLineItem(lineItem);
        lineItem.discountAmount = calcs.discountAmount;
        lineItem.taxAmount = calcs.taxAmount;
        lineItem.lineTotal = calcs.lineTotal;
        orderItems.push(lineItem);
        // Reserve stock in new warehouse
        await reserveStock(req.models, product._id, newWarehouseId, Number(item.quantity), session);
      }
      order.items = orderItems;
      if (warehouseChanged) order.warehouse = newWarehouseId;
      // Recalculate totals
      const subtotal = orderItems.reduce((sum, i) => sum + i.lineTotal, 0);
      const taxTotal = orderItems.reduce((sum, i) => sum + i.taxAmount, 0);
      order.subtotal = Math.round(subtotal * 100) / 100;
      order.taxTotal = Math.round(taxTotal * 100) / 100;
      const grandTotal = Math.max(0, Math.round((subtotal - (order.discountAmount || 0) - (order.couponDiscount || 0) + (order.shippingCharge || 0)) * 100) / 100);
      order.grandTotal = grandTotal;
      order.balanceDue = Math.round((grandTotal - (order.amountPaid || 0)) * 100) / 100;
      if (order.amountPaid >= grandTotal) order.paymentStatus = 'paid';
      else if (order.amountPaid > 0) order.paymentStatus = 'partial';
      else order.paymentStatus = 'unpaid';
      await order.save({ session });
    });
  } else {
    // Recalculate if only shippingCharge changed
    if (shippingCharge !== undefined) {
      const subtotal = order.items.reduce((sum, i) => sum + i.lineTotal, 0);
      const grandTotal = Math.max(0, Math.round((subtotal - (order.discountAmount || 0) - (order.couponDiscount || 0) + (order.shippingCharge || 0)) * 100) / 100);
      order.grandTotal = grandTotal;
      order.balanceDue = Math.round((grandTotal - (order.amountPaid || 0)) * 100) / 100;
    }
    await order.save();
  }
  res.json(new ApiResponse(200, order, 'Order updated'));
});

const deleteOrder = asyncHandler(async (req, res) => {
  const order = await req.models.Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  await withTransaction(req.orgConn, async (session) => {
    // Release reserved stock
    for (const item of order.items) {
      if (item.status === 'active') {
        await releaseReserved(req.models, item.product, order.warehouse, item.quantity, session);
      }
    }
    // Ledger credit note
    if (order.grandTotal > 0) {
      await createCustomerLedgerEntry(req.models, {
        customerId: order.customer, transactionType: 'credit_note',
        referenceType: 'order', referenceId: order._id, referenceNumber: order.orderNumber,
        debit: 0, credit: order.grandTotal, narration: `Order ${order.orderNumber} cancelled/deleted`,
        userId: req.user._id,
      }, session);
    }
    order.status = 'cancelled';
    order.deletedAt = new Date();
    order.statusHistory.push({ status: 'cancelled', changedAt: new Date(), changedBy: req.user._id });
    await order.save({ session });
  });
  res.json(new ApiResponse(200, null, 'Order deleted'));
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const order = await req.models.Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  const validTransitions = {
    placed: ['processing', 'shipped', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['in_transit', 'delivered', 'failed_delivery'],
    in_transit: ['out_for_delivery', 'delivered', 'failed_delivery'],
    out_for_delivery: ['delivered', 'failed_delivery'],
    delivered: ['return', 'partial_return'],
    failed_delivery: ['shipped', 'cancelled'],
  };

  const allowed = validTransitions[order.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Cannot transition from ${order.status} to ${status}`);
  }

  await withTransaction(req.orgConn, async (session) => {
    // On SHIPPED: deduct stock
    if (status === 'shipped') {
      for (const item of order.items) {
        if (item.status === 'active') {
          await deductOnShipment(req.models, req.orgConn, {
            productId: item.product, warehouseId: order.warehouse,
            qty: item.quantity, orderId: order._id, orderNumber: order.orderNumber,
            userId: req.user._id,
          }, session);
        }
      }
    }

    // On CANCELLED: release reserved stock + ledger credit note
    if (status === 'cancelled') {
      for (const item of order.items) {
        if (item.status === 'active') {
          await releaseReserved(req.models, item.product, order.warehouse, item.quantity, session);
        }
      }
      if (order.grandTotal > 0) {
        await createCustomerLedgerEntry(req.models, {
          customerId: order.customer, transactionType: 'credit_note',
          referenceType: 'order', referenceId: order._id, referenceNumber: order.orderNumber,
          debit: 0, credit: order.grandTotal, narration: `Order ${order.orderNumber} cancelled`,
          userId: req.user._id,
        }, session);
      }
    }

    order.status = status;
    order.statusHistory.push({ status, changedAt: new Date(), changedBy: req.user._id, note: note || '' });
    await order.save({ session });
  });
  res.json(new ApiResponse(200, order, `Status updated to ${status}`));
});

const recordPayment = asyncHandler(async (req, res) => {
  const { amount, method, reference, splitMethods, notes } = req.body;
  const order = await req.models.Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (amount <= 0) throw new ApiError(400, 'Amount must be positive');

  const { result: payment } = await withTransaction(req.orgConn, async (session) => {
    const payment = new req.models.OrderPayment({
      order: order._id, customer: order.customer, amount,
      method: method || 'cash', reference: reference || '',
      splitMethods: splitMethods || [], notes: notes || '',
      paymentDate: new Date(), createdBy: req.user._id,
    });
    await payment.save({ session });

    order.amountPaid += amount;
    order.balanceDue = Math.max(0, order.grandTotal - order.amountPaid);
    if (order.amountPaid >= order.grandTotal) order.paymentStatus = 'paid';
    else if (order.amountPaid > 0) order.paymentStatus = 'partial';
    await order.save({ session });

    // Ledger credit entry
    await createCustomerLedgerEntry(req.models, {
      customerId: order.customer, transactionType: 'payment',
      referenceType: 'payment', referenceId: payment._id,
      referenceNumber: order.orderNumber,
      debit: 0, credit: amount,
      narration: `Payment received — ${method || 'cash'} for ${order.orderNumber}`,
      userId: req.user._id,
    }, session);
    return payment;
  });
  res.json(new ApiResponse(200, payment, 'Payment recorded'));
});

const listPayments = asyncHandler(async (req, res) => {
  const payments = await req.models.OrderPayment.find({ order: req.params.id }).sort({ createdAt: -1 });
  res.json(new ApiResponse(200, payments));
});

const initiateReturn = asyncHandler(async (req, res) => {
  const { returnType, items, returnWarehouse, refundAmount, refundMethod, notes } = req.body;
  if (!Array.isArray(items) || !items.length) throw new ApiError(400, 'At least one return item is required');
  // Validate each item has required fields
  for (const it of items) {
    if (!it.lineItemId) throw new ApiError(400, 'Each return item must have a lineItemId');
    if (!it.product) throw new ApiError(400, 'Each return item must have a product');
    if (!it.returnQty || it.returnQty < 1) throw new ApiError(400, 'Each return item must have a valid returnQty');
  }
  const order = await req.models.Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (!['delivered', 'partial_return'].includes(order.status)) {
    throw new ApiError(400, 'Returns can only be initiated on delivered orders');
  }

  const returnNumber = await getNextSequence(req.models, 'order_return', 'RTN-');

  const { result: returnDoc } = await withTransaction(req.orgConn, async (session) => {
    const returnDoc = new req.models.OrderReturn({
      returnNumber, order: order._id, customer: order.customer,
      returnType, items, returnWarehouse: returnWarehouse || order.warehouse,
      refundAmount: refundAmount || 0, refundMethod: refundMethod || 'ledger_credit',
      status: 'approved', // Auto-approve for simplicity
      notes: notes || '', createdBy: req.user._id,
    });
    await returnDoc.save({ session });

    // Process return: update line items, restore stock, ledger credit
    for (const retItem of items) {
      const lineItem = order.items.id(retItem.lineItemId);
      if (!lineItem) continue;

      // Validate return quantity doesn't exceed available quantity
      const availableToReturn = lineItem.quantity - lineItem.returnedQty;
      if (retItem.returnQty > availableToReturn) {
        throw new ApiError(400, `Cannot return ${retItem.returnQty} units. Only ${availableToReturn} units available for return on this line item.`);
      }

      lineItem.returnedQty += retItem.returnQty;
      if (lineItem.returnedQty >= lineItem.quantity) lineItem.status = 'returned';
      else lineItem.status = 'partial_returned';

      // Restore stock
      const { updateStock } = require('../../services/stockService');
      await updateStock(req.models, req.orgConn, {
        productId: retItem.product,
        warehouseId: returnWarehouse || order.warehouse,
        quantityChange: retItem.returnQty,
        movementType: 'return_in',
        referenceType: 'return',
        referenceId: returnDoc._id,
        referenceNumber: returnNumber,
        notes: `Return from order ${order.orderNumber}`,
        userId: req.user._id,
      }, session);
    }

    // Update order status
    const allReturned = order.items.every((i) => i.status === 'returned' || i.status === 'cancelled');
    order.status = allReturned ? 'return' : 'partial_return';
    order.statusHistory.push({ status: order.status, changedAt: new Date(), changedBy: req.user._id, note: `Return ${returnNumber}` });
    await order.save({ session });

    // Ledger credit note
    if (refundAmount && refundAmount > 0) {
      await createCustomerLedgerEntry(req.models, {
        customerId: order.customer, transactionType: 'credit_note',
        referenceType: 'return', referenceId: returnDoc._id, referenceNumber: returnNumber,
        debit: 0, credit: refundAmount,
        narration: `Return ${returnNumber} — credit for ${order.orderNumber}`,
        userId: req.user._id,
      }, session);
    }
    return returnDoc;
  });
  res.status(201).json(new ApiResponse(201, returnDoc, 'Return processed'));
});

const listReturns = asyncHandler(async (req, res) => {
  const returns = await req.models.OrderReturn.find({ order: req.params.id });
  res.json(new ApiResponse(200, returns));
});

const getInvoice = asyncHandler(async (req, res) => {
  const order = await req.models.Order.findById(req.params.id)
    .populate('customer', 'name email phone addresses')
    .populate('warehouse', 'name code location');
  if (!order) throw new ApiError(404, 'Order not found');
  // Return invoice data (PDF generation would be a separate concern)
  res.json(new ApiResponse(200, {
    invoiceNumber: order.invoiceNumber,
    orderNumber: order.orderNumber,
    orderDate: order.orderDate,
    customer: order.customer,
    warehouse: order.warehouse,
    items: order.items,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    couponDiscount: order.couponDiscount,
    taxTotal: order.taxTotal,
    shippingCharge: order.shippingCharge,
    grandTotal: order.grandTotal,
    amountPaid: order.amountPaid,
    balanceDue: order.balanceDue,
    shippingAddress: order.shippingAddress,
  }));
});

const posOrder = asyncHandler(async (req, res) => {
  // POS order reuses createOrder logic but with defaults
  req.body.shippingCharge = req.body.shippingCharge || 0;
  return createOrder(req, res);
});

const getEditHistory = asyncHandler(async (req, res) => {
  const order = await req.models.Order.findById(req.params.id)
    .select('editHistory statusHistory orderNumber')
    .populate('statusHistory.changedBy', 'name email');
  if (!order) throw new ApiError(404, 'Order not found');

  /* Merge statusHistory (structured) + editHistory (snapshots) into a unified timeline */
  const timeline = [];
  (order.statusHistory || []).forEach((sh) => {
    timeline.push({
      type: 'status',
      message: `Status changed to ${sh.status}`,
      status: sh.status,
      note: sh.note || '',
      date: sh.changedAt,
      user: sh.changedBy,
    });
  });
  (order.editHistory || []).forEach((eh) => {
    timeline.push({
      type: 'edit',
      message: 'Order was edited',
      date: eh.editedAt || eh.createdAt,
      user: eh.editedBy,
    });
  });
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json(new ApiResponse(200, timeline));
});

module.exports = {
  list, createOrder, getById, updateOrder, deleteOrder,
  updateStatus, recordPayment, listPayments,
  initiateReturn, listReturns, getInvoice, posOrder, getEditHistory,
};
