const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');
const { resolvePrice } = require('../../services/priceResolver');
const { getNextSequence } = require('../../services/counterService');
const { releaseReserved, receiveReturnStock } = require('../../services/stockService');
const { createCustomerLedgerEntry } = require('../../services/ledgerService');
const { withTransaction } = require('../../utils/transaction');

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Customer portal — requires customerAuth middleware
 * All handlers receive req.customer, req.models, req.orgConn
 */

// ─── Orders ────────────────────────────────────────────────────────────────────

const myOrders = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { customer: req.customer._id };
  if (status) filter.status = status;
  const [orders, total] = await Promise.all([
    req.models.Order.find(filter)
      .populate('warehouse', 'name')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.Order.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { orders, pagination: paginationMeta(total, pg, lim) }));
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await req.models.Order.findOne({ _id: req.params.id, customer: req.customer._id })
    .populate('warehouse', 'name');
  if (!order) throw new ApiError(404, 'Order not found');

  // Include payments and returns
  const [payments, returns] = await Promise.all([
    req.models.OrderPayment.find({ order: order._id }).sort({ createdAt: -1 }),
    req.models.OrderReturn.find({ order: order._id }).sort({ createdAt: -1 }),
  ]);

  res.json(new ApiResponse(200, { order, payments, returns }));
});

/**
 * Place order — aligned with admin flow.
 *
 * IMPORTANT: Does NOT reserve stock or post ledger entries.
 * Stock reservation happens when admin moves order to "shipped".
 * Ledger entries (invoice + payment) are posted when admin moves order to "processing".
 * This prevents double-reservation and duplicate ledger entries.
 *
 * If customer uses wallet balance, we record an OrderPayment (same as admin advance payment).
 * The wallet debit will happen through ledger when order moves to processing.
 */
const placeOrder = asyncHandler(async (req, res) => {
  const { result: order } = await withTransaction(req.orgConn, async (session) => {
    const { items, warehouseId: rawWarehouseId, shippingAddress, couponCode, paymentMethod, useBalance, notes } = req.body;
    if (!items || !items.length) throw new ApiError(400, 'Items are required');

    // Auto-select first active warehouse if not provided or 'auto'
    let warehouseId = rawWarehouseId;
    if (!warehouseId || warehouseId === 'auto') {
      const defaultWh = await req.models.Warehouse.findOne({ isActive: true }).session(session);
      if (!defaultWh) throw new ApiError(400, 'No active warehouse available');
      warehouseId = defaultWh._id;
    }

    const customer = await req.models.Customer.findById(req.customer._id).session(session);
    if (!customer) throw new ApiError(404, 'Customer not found');

    const orderNumber = await getNextSequence(req.models, 'order', 'ORD-');
    const invoiceNumber = await getNextSequence(req.models, 'invoice', 'INV-');
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await req.models.Product.findById(item.productId)
        .populate('taxSlab', 'name rate')
        .populate('unit', 'name shortName')
        .session(session);
      if (!product || !product.isActive) throw new ApiError(400, `Product ${item.productId} not found or inactive`);
      if (product.type === 'parent') throw new ApiError(400, `Cannot order a parent product directly. Choose a variant of "${product.name}".`);

      // Validate stock availability (soft check — not reserved yet)
      const stockAgg = await req.models.ProductStock.aggregate([
        { $match: { product: product._id, ...(warehouseId ? { warehouse: warehouseId } : {}) } },
        { $group: { _id: null, total: { $sum: '$quantity' }, reserved: { $sum: '$reservedQuantity' } } },
      ]);
      const available = stockAgg[0] ? Math.max(0, stockAgg[0].total - stockAgg[0].reserved) : 0;
      if (available < item.quantity) {
        throw new ApiError(400, `Insufficient stock for "${product.name}". Available: ${available}, Requested: ${item.quantity}`);
      }

      const resolved = await resolvePrice(req.models, {
        productId: product._id, warehouseId, customerId: customer._id, qty: item.quantity,
      });
      const unitPrice = resolved.price;
      const taxRate = product.taxSlab?.rate || 0;
      const taxName = product.taxSlab?.name || '';
      const afterTax = unitPrice * item.quantity;
      const taxAmount = round2(afterTax * taxRate / 100);
      const lineTotal = round2(afterTax + taxAmount);
      subtotal += lineTotal;

      orderItems.push({
        product: product._id,
        productSnapshot: {
          name: product.name,
          sku: product.sku,
          barcodeValue: product.barcodeValue || '',
          unitName: product.unit?.shortName || '',
          image: product.images?.[0]?.url || '',
        },
        quantity: item.quantity,
        unitPrice,
        taxSlab: { name: taxName, rate: taxRate },
        taxAmount,
        lineTotal,
      });
    }

    subtotal = round2(subtotal);
    const taxTotal = round2(orderItems.reduce((sum, oi) => sum + oi.taxAmount, 0));

    // Coupon
    let discountAmount = 0;
    let appliedCouponCode = null;
    if (couponCode) {
      const coupon = await req.models.Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true }).session(session);
      if (coupon) {
        const now = new Date();
        const valid = (!coupon.validFrom || now >= coupon.validFrom) &&
          (!coupon.validUntil || now <= coupon.validUntil) &&
          (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) &&
          (!coupon.minOrderValue || subtotal >= coupon.minOrderValue);
        if (valid) {
          if (coupon.discountType === 'percentage') {
            discountAmount = (subtotal * coupon.discountValue) / 100;
            if (coupon.maxDiscountAmount) discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
          } else {
            discountAmount = Math.min(coupon.discountValue, subtotal);
          }
          discountAmount = round2(discountAmount);
          coupon.usedCount += 1;
          await coupon.save({ session });
          appliedCouponCode = coupon.code;
        }
      }
    }

    const grandTotal = round2(Math.max(0, subtotal - discountAmount));

    // Balance payment (records intent only — actual ledger debit at processing)
    let amountPaid = 0;
    if (useBalance && customer.currentBalance > 0) {
      // currentBalance > 0 means customer owes us money
      // No wallet credit to use — skip
    } else if (useBalance && customer.currentBalance < 0) {
      // Negative balance = customer has credit (we owe them). They can use |balance|.
      amountPaid = Math.min(Math.abs(customer.currentBalance), grandTotal);
    }

    // Use customer's default shipping address if not provided
    const defaultAddr = customer.addresses?.find((a) => a.isDefault) || customer.addresses?.[0];

    const order = new req.models.Order({
      orderNumber, invoiceNumber,
      customer: customer._id,
      warehouse: warehouseId,
      items: orderItems,
      subtotal, taxTotal,
      discountAmount, couponCode: appliedCouponCode,
      couponDiscount: discountAmount,
      grandTotal, amountPaid, balanceDue: round2(grandTotal - amountPaid),
      paymentStatus: amountPaid >= grandTotal ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid',
      status: 'placed',
      orderSource: 'website',
      saleType: 'online',
      shippingAddress: shippingAddress || (defaultAddr ? defaultAddr.toObject() : {}),
      notes: notes || '',
      statusHistory: [{ status: 'placed', changedAt: new Date() }],
      createdBy: null,
    });
    await order.save({ session });

    // Record advance payment (wallet usage) as OrderPayment — ledger posted at processing
    if (amountPaid > 0) {
      const payment = new req.models.OrderPayment({
        order: order._id, customer: customer._id, amount: amountPaid,
        method: paymentMethod || 'credit',
        notes: 'Wallet balance used at checkout',
        paymentDate: new Date(), createdBy: null,
      });
      await payment.save({ session });
    }

    return order;
  });
  res.status(201).json(new ApiResponse(201, order, 'Order placed successfully'));
});

/**
 * Cancel order — aligned with admin flow.
 *
 * Only releases reserved stock if order was in a reserved state (shipped+).
 * Only posts credit_note if order was invoiced (processing+).
 * For `placed` orders, no stock or ledger side-effects since nothing was posted yet.
 */
const cancelOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const { result: order } = await withTransaction(req.orgConn, async (session) => {
    const order = await req.models.Order.findOne({ _id: req.params.id, customer: req.customer._id }).session(session);
    if (!order) throw new ApiError(404, 'Order not found');
    if (!['placed', 'processing'].includes(order.status)) {
      throw new ApiError(400, 'Order cannot be cancelled in its current status');
    }

    // Release reserved stock only if order was in a reserved state (shipped+)
    // For placed/processing, stock was never reserved, so nothing to release
    const reservedStatuses = ['shipped', 'in_transit', 'out_for_delivery', 'failed_delivery'];
    if (reservedStatuses.includes(order.status)) {
      for (const item of order.items) {
        if (item.status === 'active') {
          await releaseReserved(req.models, item.product, order.warehouse, item.quantity, session);
        }
      }
    }

    // Ledger credit note only if order was invoiced (not in 'placed' status)
    const wasInvoiced = order.status !== 'placed';
    const creditableAmount = round2(order.grandTotal - (order.sellReturn || 0));
    if (wasInvoiced && creditableAmount > 0) {
      await createCustomerLedgerEntry(req.models, {
        customerId: req.customer._id, transactionType: 'credit_note',
        referenceType: 'order', referenceId: order._id, referenceNumber: order.orderNumber,
        debit: 0, credit: creditableAmount,
        narration: `Order ${order.orderNumber} cancelled by customer`,
        userId: null,
        idempotencyKey: `order:${order._id}:cancel`,
      }, session);
    }

    order.status = 'cancelled';
    order.statusHistory.push({ status: 'cancelled', changedAt: new Date(), note: reason || 'Cancelled by customer' });
    await order.save({ session });
    return order;
  });
  res.json(new ApiResponse(200, order, 'Order cancelled'));
});

// ─── Returns ───────────────────────────────────────────────────────────────────

/**
 * Customer-initiated return request.
 * Only on delivered/partial_return orders. Creates a pending return that admin can approve.
 */
const initiateReturn = asyncHandler(async (req, res) => {
  const { items, reason, notes } = req.body;
  if (!Array.isArray(items) || !items.length) throw new ApiError(400, 'At least one return item is required');

  const { result: returnDoc } = await withTransaction(req.orgConn, async (session) => {
    const order = await req.models.Order.findOne({ _id: req.params.id, customer: req.customer._id }).session(session);
    if (!order) throw new ApiError(404, 'Order not found');
    if (!['delivered', 'partial_return'].includes(order.status)) {
      throw new ApiError(400, 'Returns can only be requested on delivered orders');
    }

    const returnNumber = await getNextSequence(req.models, 'order_return', 'RTN-');
    const returnDocId = new req.models.OrderReturn({})._id;

    const normalizedItems = [];
    let returnValue = 0;

    for (const retItem of items) {
      const lineItem = order.items.id(retItem.lineItemId);
      if (!lineItem) throw new ApiError(400, `Invalid line item: ${retItem.lineItemId}`);

      const availableToReturn = lineItem.quantity - lineItem.returnedQty;
      if (!retItem.returnQty || retItem.returnQty < 1 || retItem.returnQty > availableToReturn) {
        throw new ApiError(400, `Cannot return ${retItem.returnQty} units of "${lineItem.productSnapshot.name}". Available: ${availableToReturn}`);
      }

      const returnValuePerUnit = round2(lineItem.lineTotal / lineItem.quantity);
      const lineAmount = round2(returnValuePerUnit * retItem.returnQty);
      returnValue = round2(returnValue + lineAmount);

      normalizedItems.push({
        lineItemId: retItem.lineItemId,
        product: lineItem.product,
        returnQty: Number(retItem.returnQty),
        unitPrice: returnValuePerUnit,
        lineAmount,
        reason: retItem.reason || reason || '',
      });

      // Receive stock as quarantined
      await receiveReturnStock(req.models, req.orgConn, {
        productId: lineItem.product,
        warehouseId: order.warehouse,
        qty: Number(retItem.returnQty),
        returnId: returnDocId,
        returnNumber,
        userId: null,
      }, session);
    }

    const returnType = order.items.every((li) => {
      const retItem = normalizedItems.find((ri) => ri.lineItemId.toString() === li._id.toString());
      if (retItem) return retItem.returnQty >= (li.quantity - li.returnedQty);
      return li.status === 'returned' || li.status === 'cancelled';
    }) ? 'full' : 'partial';

    const returnDoc = new req.models.OrderReturn({
      _id: returnDocId,
      returnNumber, order: order._id, customer: req.customer._id,
      returnType, items: normalizedItems,
      returnWarehouse: order.warehouse,
      returnValue,
      refundAmount: 0,
      status: 'pending',
      notes: notes || '', createdBy: null,
    });
    await returnDoc.save({ session });

    return returnDoc;
  });
  res.status(201).json(new ApiResponse(201, returnDoc, 'Return request submitted (pending approval)'));
});

/**
 * List returns for a specific order (customer's own order)
 */
const myOrderReturns = asyncHandler(async (req, res) => {
  const order = await req.models.Order.findOne({ _id: req.params.id, customer: req.customer._id });
  if (!order) throw new ApiError(404, 'Order not found');
  const returns = await req.models.OrderReturn.find({ order: order._id })
    .populate('items.product', 'name sku images')
    .sort({ createdAt: -1 });
  res.json(new ApiResponse(200, returns));
});

/**
 * List all returns across all orders for this customer
 */
const myReturns = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { customer: req.customer._id };
  if (status) filter.status = status;
  const [returns, total] = await Promise.all([
    req.models.OrderReturn.find(filter)
      .populate('order', 'orderNumber')
      .populate('items.product', 'name sku images')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.OrderReturn.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { returns, pagination: paginationMeta(total, pg, lim) }));
});

// ─── Ledger / Balance / Payments / Topups / Statement ──────────────────────────

const myLedger = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const [entries, total] = await Promise.all([
    req.models.CustomerLedger.find({ customer: req.customer._id }).sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.CustomerLedger.countDocuments({ customer: req.customer._id }),
  ]);
  res.json(new ApiResponse(200, { entries, pagination: paginationMeta(total, pg, lim) }));
});

const myBalance = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.customer._id).select('name currentBalance creditLimit');
  res.json(new ApiResponse(200, {
    name: customer.name,
    currentBalance: customer.currentBalance,
    creditLimit: customer.creditLimit,
  }));
});

const myPayments = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const [payments, total] = await Promise.all([
    req.models.OrderPayment.find({ customer: req.customer._id })
      .populate('order', 'orderNumber grandTotal')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.OrderPayment.countDocuments({ customer: req.customer._id }),
  ]);
  res.json(new ApiResponse(200, { payments, pagination: paginationMeta(total, pg, lim) }));
});

const myTopups = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const [topups, total] = await Promise.all([
    req.models.CustomerTopup.find({ customer: req.customer._id }).sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.CustomerTopup.countDocuments({ customer: req.customer._id }),
  ]);
  res.json(new ApiResponse(200, { topups, pagination: paginationMeta(total, pg, lim) }));
});

const myStatement = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.customer._id).select('-password');
  if (!customer) throw new ApiError(404, 'Customer not found');
  const entries = await req.models.CustomerLedger.find({ customer: req.customer._id }).sort({ createdAt: 1 }).lean();
  res.json(new ApiResponse(200, { customer, entries }));
});

// ─── Addresses ─────────────────────────────────────────────────────────────────

const listAddresses = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.customer._id).select('addresses');
  res.json(new ApiResponse(200, customer.addresses || []));
});

const addAddress = asyncHandler(async (req, res) => {
  const { label, line1, city, state, zip, country, isDefault } = req.body;
  if (!line1) throw new ApiError(400, 'Address line1 is required');

  const customer = await req.models.Customer.findById(req.customer._id);
  if (!customer) throw new ApiError(404, 'Customer not found');

  // If marking as default, unset other defaults
  if (isDefault) {
    customer.addresses.forEach((a) => { a.isDefault = false; });
  }

  customer.addresses.push({
    label: label || 'Default', line1, city: city || '', state: state || '',
    zip: zip || '', country: country || '', isDefault: isDefault || customer.addresses.length === 0,
  });
  await customer.save();

  res.status(201).json(new ApiResponse(201, customer.addresses, 'Address added'));
});

const updateAddress = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.customer._id);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const address = customer.addresses.id(req.params.addrId);
  if (!address) throw new ApiError(404, 'Address not found');

  const { label, line1, city, state, zip, country, isDefault } = req.body;
  if (label !== undefined) address.label = label;
  if (line1 !== undefined) address.line1 = line1;
  if (city !== undefined) address.city = city;
  if (state !== undefined) address.state = state;
  if (zip !== undefined) address.zip = zip;
  if (country !== undefined) address.country = country;
  if (isDefault) {
    customer.addresses.forEach((a) => { a.isDefault = false; });
    address.isDefault = true;
  }

  await customer.save();
  res.json(new ApiResponse(200, customer.addresses, 'Address updated'));
});

const deleteAddress = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.customer._id);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const address = customer.addresses.id(req.params.addrId);
  if (!address) throw new ApiError(404, 'Address not found');

  address.deleteOne();
  await customer.save();
  res.json(new ApiResponse(200, customer.addresses, 'Address removed'));
});

// ─── Coupon Validation ─────────────────────────────────────────────────────────

const validateCoupon = asyncHandler(async (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) throw new ApiError(400, 'Coupon code is required');

  const coupon = await req.models.Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) throw new ApiError(404, 'Coupon not found or inactive');

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) throw new ApiError(400, 'Coupon is not yet valid');
  if (coupon.validUntil && now > coupon.validUntil) throw new ApiError(400, 'Coupon has expired');
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new ApiError(400, 'Coupon usage limit reached');
  if (coupon.minOrderValue && (subtotal || 0) < coupon.minOrderValue) {
    throw new ApiError(400, `Minimum order value of ₹${coupon.minOrderValue} required`);
  }

  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = ((subtotal || 0) * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount) discount = Math.min(discount, coupon.maxDiscountAmount);
  } else {
    discount = Math.min(coupon.discountValue, subtotal || coupon.discountValue);
  }

  res.json(new ApiResponse(200, {
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscountAmount: coupon.maxDiscountAmount,
    calculatedDiscount: round2(discount),
    description: coupon.description,
  }, 'Coupon is valid'));
});

// ─── Stock Check (Cart Validation) ─────────────────────────────────────────────

const stockCheck = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) throw new ApiError(400, 'Items array is required');

  const results = [];
  for (const item of items) {
    const product = await req.models.Product.findById(item.productId).select('name sku isActive type');
    if (!product || !product.isActive) {
      results.push({ productId: item.productId, available: false, reason: 'Product not found or inactive', availableQty: 0 });
      continue;
    }
    if (product.type === 'parent') {
      results.push({ productId: item.productId, available: false, reason: 'Cannot order parent product directly', availableQty: 0 });
      continue;
    }

    const stockAgg = await req.models.ProductStock.aggregate([
      { $match: { product: product._id } },
      { $group: { _id: null, total: { $sum: '$quantity' }, reserved: { $sum: '$reservedQuantity' } } },
    ]);
    const availableQty = stockAgg[0] ? Math.max(0, stockAgg[0].total - stockAgg[0].reserved) : 0;
    const requestedQty = item.quantity || 1;

    results.push({
      productId: item.productId,
      name: product.name,
      sku: product.sku,
      requestedQty,
      availableQty,
      available: availableQty >= requestedQty,
      reason: availableQty >= requestedQty ? 'In stock' : `Only ${availableQty} available`,
    });
  }
  res.json(new ApiResponse(200, results));
});

module.exports = {
  myOrders, getOrder, placeOrder, cancelOrder,
  initiateReturn, myOrderReturns, myReturns,
  myLedger, myBalance, myPayments, myTopups, myStatement,
  listAddresses, addAddress, updateAddress, deleteAddress,
  validateCoupon, stockCheck,
};
