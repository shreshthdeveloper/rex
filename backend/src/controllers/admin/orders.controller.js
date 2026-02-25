const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');
const { getNextSequence } = require('../../services/counterService');
const { resolvePrice } = require('../../services/priceResolver');
const { reserveStock, releaseReserved, deductOnShipment, receiveReturnStock, releaseReturnStock } = require('../../services/stockService');
const { createCustomerLedgerEntry } = require('../../services/ledgerService');
const { withTransaction } = require('../../utils/transaction');
const axios = require('axios');

/**
 * Fire-and-forget: send order to Dispatch integration if active
 */
async function fireDispatch(models, order) {
  try {
    const dispatch = await models.Integration.findOne({ slug: 'dispatch', isActive: true });
    if (!dispatch || !dispatch.apiKey) return;

    const populated = await models.Order.findById(order._id)
      .populate('customer', 'name phone email')
      .populate('warehouse', 'name location address');
    if (!populated) return;

    const customer = populated.customer;
    const warehouse = populated.warehouse;
    const addr = (a) => a ? [a.line1, a.line2, a.city, a.state, a.zip, a.country].filter(Boolean).join(', ') : '';

    const payload = {
      customerName: customer?.name || '',
      customerPhone: customer?.phone || customer?.email || '',
      pickupAddress: warehouse?.location || warehouse?.name || '',
      deliveryAddress: addr(populated.shippingAddress),
      priority: 'high',
      notes: populated.notes || `Order #${populated.orderNumber}`,
    };

    const webhookUrl = dispatch.webhookUrl || 'https://dispatch.distrx.io/api/zapier/webhook';
    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json', 'x-api-key': dispatch.apiKey },
      timeout: 8000,
    });
  } catch (err) {
    // Dispatch failure must never break the order — but log full details for debugging
    const status = err.response?.status;
    const responseData = err.response?.data;
    console.error('[Dispatch] Failed to send order', order._id);
    console.error('[Dispatch] Status:', status || 'no response');
    console.error('[Dispatch] Response body:', responseData ? JSON.stringify(responseData) : err.message);
    if (err.response?.config) {
      console.error('[Dispatch] Request URL:', err.response.config.url);
      console.error('[Dispatch] Request headers:', JSON.stringify(err.response.config.headers));
    }
  }
}

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

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

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

    // Save advance payment (ledger entry is posted when order moves to processing)
    if (amountPaid > 0) {
      const payment = new req.models.OrderPayment({
        order: order._id, customer: customer._id, amount: amountPaid,
        method: paymentMethod || 'cash', paymentDate: new Date(),
        createdBy: req.user._id,
      });
      await payment.save({ session });
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

  const { customerId, warehouseId, items, shippingCharge, notes, shippingAddress, referenceNumber, saleType, orderSource } = req.body;
  const oldGrandTotal = order.grandTotal;

  // Simple fields
  if (notes !== undefined) order.notes = notes;
  if (shippingAddress !== undefined) order.shippingAddress = shippingAddress;
  if (shippingCharge !== undefined) order.shippingCharge = Number(shippingCharge) || 0;
  if (referenceNumber !== undefined) order.referenceNumber = referenceNumber;
  if (saleType !== undefined) order.saleType = saleType;
  if (orderSource !== undefined) order.orderSource = orderSource;

  // Customer & warehouse
  if (customerId) order.customer = customerId;
  const warehouseChanged = warehouseId && warehouseId.toString() !== order.warehouse.toString();
  const newWarehouseId = warehouseId || order.warehouse;

  // Items update
  if (items && Array.isArray(items) && items.length > 0) {
    await withTransaction(req.orgConn, async (session) => {
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
      // Ledger adjustment if order was already invoiced (processing status)
      if (order.status === 'processing') {
        const diff = order.grandTotal - oldGrandTotal;
        if (Math.abs(diff) > 0.001) {
          if (diff > 0) {
            await createCustomerLedgerEntry(req.models, {
              customerId: order.customer, transactionType: 'debit_note',
              referenceType: 'order', referenceId: order._id, referenceNumber: order.orderNumber,
              debit: diff, credit: 0,
              narration: `Order ${order.orderNumber} revised — amount increased by ₹${diff.toFixed(2)}`,
              userId: req.user._id,
            }, session);
          } else {
            await createCustomerLedgerEntry(req.models, {
              customerId: order.customer, transactionType: 'credit_note',
              referenceType: 'order', referenceId: order._id, referenceNumber: order.orderNumber,
              debit: 0, credit: Math.abs(diff),
              narration: `Order ${order.orderNumber} revised — amount decreased by ₹${Math.abs(diff).toFixed(2)}`,
              userId: req.user._id,
            }, session);
          }
        }
      }
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
    // Ledger adjustment if order was already invoiced (processing status)
    if (order.status === 'processing') {
      const diff = order.grandTotal - oldGrandTotal;
      if (Math.abs(diff) > 0.001) {
        if (diff > 0) {
          await createCustomerLedgerEntry(req.models, {
            customerId: order.customer, transactionType: 'debit_note',
            referenceType: 'order', referenceId: order._id, referenceNumber: order.orderNumber,
            debit: diff, credit: 0,
            narration: `Order ${order.orderNumber} revised — amount increased by ₹${diff.toFixed(2)}`,
            userId: req.user._id,
          });
        } else {
          await createCustomerLedgerEntry(req.models, {
            customerId: order.customer, transactionType: 'credit_note',
            referenceType: 'order', referenceId: order._id, referenceNumber: order.orderNumber,
            debit: 0, credit: Math.abs(diff),
            narration: `Order ${order.orderNumber} revised — amount decreased by ₹${Math.abs(diff).toFixed(2)}`,
            userId: req.user._id,
          });
        }
      }
    }
  }
  res.json(new ApiResponse(200, order, 'Order updated'));
});

const deleteOrder = asyncHandler(async (req, res) => {
  const order = await req.models.Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  const reservedStatuses = ['shipped', 'in_transit', 'out_for_delivery', 'failed_delivery'];
  await withTransaction(req.orgConn, async (session) => {
    // Release reserved stock only if items were reserved (shipped+)
    if (reservedStatuses.includes(order.status)) {
      for (const item of order.items) {
        if (item.status === 'active') {
          await releaseReserved(req.models, item.product, order.warehouse, item.quantity, session);
        }
      }
    }
    // Ledger credit note — only if the order was previously invoiced (processing+)
    // Credit only the unreturned portion to avoid double-crediting already-returned amounts
    const wasInvoiced = !['placed'].includes(order.status);
    const creditableAmount = round2(order.grandTotal - (order.sellReturn || 0));
    if (wasInvoiced && creditableAmount > 0) {
      await createCustomerLedgerEntry(req.models, {
        customerId: order.customer, transactionType: 'credit_note',
        referenceType: 'order', referenceId: order._id, referenceNumber: order.orderNumber,
        debit: 0, credit: creditableAmount, narration: `Order ${order.orderNumber} cancelled/deleted`,
        userId: req.user._id,
        idempotencyKey: `order:${order._id}:cancel`,
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

  // Pre-validate order existence and transition before starting a session
  const orderCheck = await req.models.Order.findById(req.params.id);
  if (!orderCheck) throw new ApiError(404, 'Order not found');

  const validTransitions = {
    placed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['in_transit', 'delivered', 'failed_delivery'],
    in_transit: ['out_for_delivery', 'delivered', 'failed_delivery'],
    out_for_delivery: ['delivered', 'failed_delivery'],
    delivered: ['return', 'partial_return'],
    failed_delivery: ['shipped', 'cancelled'],
  };

  const allowed = validTransitions[orderCheck.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Cannot transition from ${orderCheck.status} to ${status}`);
  }

  let savedOrder;
  await withTransaction(req.orgConn, async (session) => {
    // Re-fetch order INSIDE the transaction for snapshot consistency
    const order = await req.models.Order.findById(req.params.id).session(session);
    if (!order) throw new ApiError(404, 'Order not found');

    // Re-validate inside transaction (guard against race where status changed between checks)
    const allowedInner = validTransitions[order.status] || [];
    if (!allowedInner.includes(status)) {
      throw new ApiError(400, `Cannot transition from ${order.status} to ${status}`);
    }

    // On PROCESSING: post sale invoice + any pre-existing payments to customer ledger
    if (status === 'processing') {
      await createCustomerLedgerEntry(req.models, {
        customerId: order.customer, transactionType: 'invoice',
        referenceType: 'order', referenceId: order._id, referenceNumber: order.orderNumber,
        debit: order.grandTotal, credit: 0,
        narration: `Order ${order.orderNumber} — Sale invoice (confirmed)`,
        userId: req.user._id,
        idempotencyKey: `order:${order._id}:invoice`,
      }, session);

      // Post ledger entries for any payments recorded at order creation
      const existingPayments = await req.models.OrderPayment.find({ order: order._id }).session(session);
      for (const pmt of existingPayments) {
        await createCustomerLedgerEntry(req.models, {
          customerId: order.customer, transactionType: 'payment',
          referenceType: 'payment', referenceId: pmt._id,
          referenceNumber: order.orderNumber,
          debit: 0, credit: pmt.amount,
          narration: `Payment received — ${pmt.method || 'cash'} for ${order.orderNumber}`,
          userId: req.user._id,
          idempotencyKey: `payment:${pmt._id}:posted`,
        }, session);
      }
    }

    // On SHIPPED: reserve stock
    if (status === 'shipped') {
      for (const item of order.items) {
        if (item.status === 'active') {
          await reserveStock(req.models, item.product, order.warehouse, item.quantity, session);
        }
      }
    }

    // On DELIVERED: deduct reserved stock from actual inventory
    if (status === 'delivered') {
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

    // On CANCELLED: release reserved stock only if items were already reserved (shipped+)
    const reservedStatuses = ['shipped', 'in_transit', 'out_for_delivery', 'failed_delivery'];
    if (status === 'cancelled') {
      if (reservedStatuses.includes(order.status)) {
        for (const item of order.items) {
          if (item.status === 'active') {
            await releaseReserved(req.models, item.product, order.warehouse, item.quantity, session);
          }
        }
      }
      const wasInvoiced = !['placed'].includes(order.status);
      const creditableAmount = round2(order.grandTotal - (order.sellReturn || 0));
      if (wasInvoiced && creditableAmount > 0) {
        await createCustomerLedgerEntry(req.models, {
          customerId: order.customer, transactionType: 'credit_note',
          referenceType: 'order', referenceId: order._id, referenceNumber: order.orderNumber,
          debit: 0, credit: creditableAmount, narration: `Order ${order.orderNumber} cancelled`,
          userId: req.user._id,
          idempotencyKey: `order:${order._id}:cancel`,
        }, session);
      }
    }

    order.status = status;
    order.statusHistory.push({ status, changedAt: new Date(), changedBy: req.user._id, note: note || '' });
    await order.save({ session });
    savedOrder = order;
  });
  res.json(new ApiResponse(200, savedOrder, `Status updated to ${status}`));
  // Fire Dispatch webhook when order moves to processing (non-blocking)
  if (status === 'processing') {
    fireDispatch(req.models, savedOrder).catch(() => {});
  }
});

const recordPayment = asyncHandler(async (req, res) => {
  const { amount, method, reference, splitMethods, notes } = req.body;
  const order = await req.models.Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (amount <= 0) throw new ApiError(400, 'Amount must be positive');
  if (order.status === 'placed') throw new ApiError(400, 'Cannot record payment on placed orders. Advance to processing first.');
  if (amount > order.balanceDue + 0.001) throw new ApiError(400, `Amount ₹${amount} exceeds balance due ₹${order.balanceDue}`);

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
      idempotencyKey: `payment:${payment._id}:posted`,
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
  const { returnType, items, returnWarehouse, notes } = req.body;
  if (!Array.isArray(items) || !items.length) throw new ApiError(400, 'At least one return item is required');
  for (const it of items) {
    if (!it.lineItemId) throw new ApiError(400, 'Each return item must have a lineItemId');
    if (!it.product) throw new ApiError(400, 'Each return item must have a product');
    if (!it.returnQty || it.returnQty < 1) throw new ApiError(400, 'Each return item must have a valid returnQty');
  }

  const { result: returnDoc } = await withTransaction(req.orgConn, async (session) => {
    const order = await req.models.Order.findById(req.params.id).session(session);
    if (!order) throw new ApiError(404, 'Order not found');
    if (!['delivered', 'partial_return'].includes(order.status)) {
      throw new ApiError(400, 'Returns can only be initiated on delivered orders');
    }

    const returnNumber = await getNextSequence(req.models, 'order_return', 'RTN-');
    const returnDocId = new req.models.OrderReturn({})._id;

    const normalizedItems = [];
    let currentReturnValue = 0;

    for (const retItem of items) {
      const lineItem = order.items.id(retItem.lineItemId);
      if (!lineItem) throw new ApiError(400, 'Invalid line item selected for return');

      const availableToReturn = lineItem.quantity - lineItem.returnedQty;
      if (retItem.returnQty > availableToReturn) {
        throw new ApiError(400, `Cannot return ${retItem.returnQty} units. Only ${availableToReturn} available.`);
      }

      // Return value = proportional lineTotal (tax-inclusive)
      const returnValuePerUnit = round2(lineItem.lineTotal / lineItem.quantity);
      const lineAmount = round2(returnValuePerUnit * Number(retItem.returnQty));
      currentReturnValue = round2(currentReturnValue + lineAmount);

      normalizedItems.push({
        lineItemId: retItem.lineItemId,
        product: retItem.product,
        returnQty: Number(retItem.returnQty),
        unitPrice: returnValuePerUnit,
        lineAmount,
        reason: retItem.reason || '',
      });

      // Receive stock as quarantined (qty + reserved both increase, available unchanged)
      await receiveReturnStock(req.models, req.orgConn, {
        productId: retItem.product,
        warehouseId: returnWarehouse || order.warehouse,
        qty: Number(retItem.returnQty),
        returnId: returnDocId,
        returnNumber,
        userId: req.user._id,
      }, session);
    }

    const returnDoc = new req.models.OrderReturn({
      _id: returnDocId,
      returnNumber, order: order._id, customer: order.customer,
      returnType, items: normalizedItems, returnWarehouse: returnWarehouse || order.warehouse,
      returnValue: currentReturnValue,
      refundAmount: 0,
      status: 'pending',
      notes: notes || '', createdBy: req.user._id,
    });
    await returnDoc.save({ session });

    return returnDoc;
  });
  res.status(201).json(new ApiResponse(201, returnDoc, 'Return created (pending approval)'));
});

/**
 * Approve a pending return — single function handling all financial + stock side-effects.
 *
 * Ledger accounting:
 *   credit_note (credit) for returnValue — reduces customer receivable.
 *   The customer's running ledger balance naturally reflects whether we owe them.
 *
 * Order fields updated:
 *   sellReturn  += returnValue
 *   effectiveOwed = grandTotal - sellReturn
 *   balanceDue  = max(0, effectiveOwed - amountPaid)
 *   returnDue   = max(0, amountPaid - effectiveOwed)
 */
const approveReturn = asyncHandler(async (req, res) => {
  const { returnId } = req.params;
  const { refundMethod } = req.body;

  const VALID_REFUND_METHODS = ['cash', 'bank_transfer', 'card', 'online', 'wallet', 'ledger_credit'];
  if (!refundMethod || !VALID_REFUND_METHODS.includes(refundMethod)) {
    throw new ApiError(400, 'A valid refund method is required to approve a return');
  }

  const { result: returnDoc } = await withTransaction(req.orgConn, async (session) => {
    const returnDoc = await req.models.OrderReturn.findById(returnId).session(session);
    if (!returnDoc) throw new ApiError(404, 'Return not found');
    if (returnDoc.status !== 'pending') throw new ApiError(400, 'Only pending returns can be approved');

    const order = await req.models.Order.findById(returnDoc.order).session(session);
    if (!order) throw new ApiError(404, 'Order not found');

    // 1. Update line item statuses
    for (const retItem of returnDoc.items) {
      const lineItem = order.items.id(retItem.lineItemId);
      if (!lineItem) continue;
      lineItem.returnedQty += retItem.returnQty;
      if (lineItem.returnedQty >= lineItem.quantity) lineItem.status = 'returned';
      else lineItem.status = 'partial_returned';
    }

    // 2. Release quarantined stock → available
    for (const retItem of returnDoc.items) {
      await releaseReturnStock(req.models, req.orgConn, {
        productId: retItem.product,
        warehouseId: returnDoc.returnWarehouse,
        qty: retItem.returnQty,
        returnId: returnDoc._id,
        returnNumber: returnDoc.returnNumber,
        userId: req.user._id,
      }, session);
    }

    // 3. Financial recalculation
    order.sellReturn = round2((order.sellReturn || 0) + returnDoc.returnValue);
    const effectiveOwed = round2(order.grandTotal - order.sellReturn);

    if (order.amountPaid <= effectiveOwed) {
      order.balanceDue = round2(effectiveOwed - order.amountPaid);
      order.returnDue = 0;
    } else {
      order.balanceDue = 0;
      order.returnDue = round2(order.amountPaid - effectiveOwed);
    }

    // Compute refund amount for this specific return (the delta in returnDue caused by this approval)
    const previousReturnDue = round2(Math.max(0, order.amountPaid - round2(order.grandTotal - (order.sellReturn - returnDoc.returnValue))));
    returnDoc.refundAmount = round2(order.returnDue - previousReturnDue);

    // 4. Payment status
    if (order.balanceDue <= 0 && effectiveOwed <= 0) {
      order.paymentStatus = order.amountPaid > 0 ? 'paid' : 'unpaid';
    } else if (order.balanceDue <= 0) {
      order.paymentStatus = 'paid';
    } else if (order.amountPaid > 0) {
      order.paymentStatus = 'partial';
    } else {
      order.paymentStatus = 'unpaid';
    }

    // 5. Order status
    const allReturned = order.items.every((i) => i.status === 'returned' || i.status === 'cancelled');
    order.status = allReturned ? 'return' : 'partial_return';
    order.statusHistory.push({
      status: order.status, changedAt: new Date(), changedBy: req.user._id,
      note: `Return ${returnDoc.returnNumber} approved`,
    });
    await order.save({ session });

    // 6. Ledger: credit note reduces receivable (goods return — reverses part of the sale)
    if (returnDoc.returnValue > 0) {
      const cashRefundNote = order.returnDue > 0
        ? ` | cash refund ₹${order.returnDue.toFixed(2)} due via ${refundMethod}`
        : ` | no cash refund (customer balance still due)`;
      await createCustomerLedgerEntry(req.models, {
        customerId: order.customer, transactionType: 'credit_note',
        referenceType: 'return', referenceId: returnDoc._id,
        referenceNumber: returnDoc.returnNumber,
        debit: 0, credit: returnDoc.returnValue,
        narration: `Return ${returnDoc.returnNumber} — goods credit ₹${returnDoc.returnValue.toFixed(2)} for ${order.orderNumber}${cashRefundNote}`,
        userId: req.user._id,
        idempotencyKey: `return:${returnDoc._id}:credit_note`,
      }, session);
    }

    // 7. Mark return approved
    returnDoc.refundMethod = refundMethod;
    returnDoc.status = 'approved';
    returnDoc.approvedAt = new Date();
    returnDoc.approvedBy = req.user._id;
    await returnDoc.save({ session });

    return returnDoc;
  });
  res.json(new ApiResponse(200, returnDoc, 'Return approved'));
});

const listReturns = asyncHandler(async (req, res) => {
  const returns = await req.models.OrderReturn.find({ order: req.params.id })
    .populate('items.product', 'name sku')
    .populate('approvedBy', 'name');
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
    .select('editHistory statusHistory orderNumber grandTotal')
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
  (order.editHistory || []).forEach((eh, idx) => {
    const fromTotal = eh.snapshot?.grandTotal;
    // The 'to' value: the next snapshot's grandTotal, or the current order's grandTotal for the last edit
    const toTotal = (order.editHistory[idx + 1]?.snapshot?.grandTotal) ?? order.grandTotal;
    timeline.push({
      type: 'edit',
      message: 'Order was edited',
      fromTotal,
      toTotal,
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
  initiateReturn, approveReturn, listReturns, getInvoice, posOrder, getEditHistory,
};
