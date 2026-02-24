const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');
const { resolvePrice } = require('../../services/priceResolver');
const { getNextSequence } = require('../../services/counterService');
const { reserveStock, releaseReserved } = require('../../services/stockService');
const { createCustomerLedgerEntry } = require('../../services/ledgerService');
const { withTransaction } = require('../../utils/transaction');

/**
 * Customer portal — requires customerAuth middleware
 */

const myOrders = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { customer: req.customer._id };
  if (status) filter.status = status;
  const [orders, total] = await Promise.all([
    req.models.Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.Order.countDocuments(filter),
  ]);
  res.json(new ApiResponse(200, { orders, pagination: paginationMeta(total, pg, lim) }));
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await req.models.Order.findOne({ _id: req.params.id, customer: req.customer._id })
    .populate('warehouse', 'name');
  if (!order) throw new ApiError(404, 'Order not found');
  res.json(new ApiResponse(200, order));
});

const placeOrder = asyncHandler(async (req, res) => {
  const { result: order } = await withTransaction(req.orgConn, async (session) => {
    const { items, warehouseId: rawWarehouseId, shippingAddress, couponCode, paymentMethod, useBalance } = req.body;
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
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await req.models.Product.findById(item.productId).populate('taxSlab').session(session);
      if (!product || !product.isActive) throw new ApiError(400, `Product ${item.productId} not found or inactive`);
      const resolved = await resolvePrice(req.models, {
        productId: product._id, warehouseId, customerId: customer._id, qty: item.quantity,
      });
      const lineTotal = resolved.price * item.quantity;
      subtotal += lineTotal;

      const taxRate = (product.taxSlab && product.taxSlab.rate) ? product.taxSlab.rate : 0;
      const taxName = (product.taxSlab && product.taxSlab.name) ? product.taxSlab.name : '';
      const taxAmount = Math.round(lineTotal * taxRate / 100 * 100) / 100;

      orderItems.push({
        product: product._id,
        productSnapshot: {
          name: product.name,
          sku: product.sku,
          barcodeValue: product.barcodeValue || '',
          unitName: '',
          image: (product.images && product.images.length) ? product.images[0] : '',
        },
        quantity: item.quantity,
        unitPrice: resolved.price,
        taxSlab: { name: taxName, rate: taxRate },
        taxAmount,
        lineTotal,
      });
    }

    // Calculate total tax
    let taxTotal = orderItems.reduce((sum, oi) => sum + oi.taxAmount, 0);

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
          discountAmount = Math.round(discountAmount * 100) / 100;
          coupon.usedCount += 1;
          await coupon.save({ session });
          appliedCouponCode = coupon.code;
        }
      }
    }

    const grandTotal = Math.round((subtotal + taxTotal - discountAmount) * 100) / 100;

    // Reserve stock
    for (const oi of orderItems) {
      await reserveStock(req.models, oi.product, warehouseId, oi.quantity, session);
    }

    // Balance payment
    let amountPaid = 0;
    let balanceUsed = 0;
    if (useBalance && customer.currentBalance > 0) {
      balanceUsed = Math.min(customer.currentBalance, grandTotal);
      amountPaid = balanceUsed;
    }

    const order = new req.models.Order({
      orderNumber, customer: customer._id,
      warehouse: warehouseId, items: orderItems,
      subtotal, taxTotal, discountAmount, couponCode: appliedCouponCode,
      couponDiscount: discountAmount,
      grandTotal, amountPaid, balanceDue: grandTotal - amountPaid,
      paymentStatus: amountPaid >= grandTotal ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid',
      status: 'placed',
      shippingAddress: shippingAddress || {},
      statusHistory: [{ status: 'placed', changedAt: new Date() }],
      createdBy: null,
    });
    await order.save({ session });

    // Deduct balance and record ledger
    if (balanceUsed > 0) {
      customer.currentBalance -= balanceUsed;
      await customer.save({ session });

      await createCustomerLedgerEntry(req.models, {
        customerId: customer._id, transactionType: 'invoice',
        referenceType: 'order', referenceId: order._id, referenceNumber: orderNumber,
        debit: balanceUsed, credit: 0,
        narration: `Order ${orderNumber} - wallet payment`, userId: null,
      }, session);
    }

    // Record debit entry for the order total (amount owed)
    const onCredit = grandTotal - amountPaid;
    if (onCredit > 0) {
      await createCustomerLedgerEntry(req.models, {
        customerId: customer._id, transactionType: 'invoice',
        referenceType: 'order', referenceId: order._id, referenceNumber: orderNumber,
        debit: onCredit, credit: 0,
        narration: `Order ${orderNumber} - amount on credit`, userId: null,
      }, session);
    }
    return order;
  });
  res.status(201).json(new ApiResponse(201, order, 'Order placed successfully'));
});

const cancelOrder = asyncHandler(async (req, res) => {
  const { result: order } = await withTransaction(req.orgConn, async (session) => {
    const order = await req.models.Order.findOne({ _id: req.params.id, customer: req.customer._id }).session(session);
    if (!order) throw new ApiError(404, 'Order not found');
    if (!['placed', 'processing'].includes(order.status)) {
      throw new ApiError(400, 'Order cannot be cancelled in current status');
    }

    // Release reserved stock
    for (const item of order.items) {
      await releaseReserved(req.models, item.product, order.warehouse, item.quantity, session);
    }

    // Refund any paid amount back to balance
    if (order.amountPaid > 0) {
      const customer = await req.models.Customer.findById(req.customer._id).session(session);
      if (customer) {
        customer.currentBalance += order.amountPaid;
        await customer.save({ session });
      }

      await createCustomerLedgerEntry(req.models, {
        customerId: req.customer._id, transactionType: 'credit_note',
        referenceType: 'order', referenceId: order._id, referenceNumber: order.orderNumber,
        debit: 0, credit: order.amountPaid,
        narration: `Order ${order.orderNumber} cancelled - refund to balance`, userId: null,
      }, session);
    }

    order.status = 'cancelled';
    order.statusHistory.push({ status: 'cancelled', changedAt: new Date(), note: 'Cancelled by customer' });
    await order.save({ session });
    return order;
  });
  res.json(new ApiResponse(200, order, 'Order cancelled'));
});

const myLedger = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const [entries, total] = await Promise.all([
    req.models.CustomerLedger.find({ customer: req.customer._id }).sort({ createdAt: 1 }).skip(skip).limit(lim),
    req.models.CustomerLedger.countDocuments({ customer: req.customer._id }),
  ]);
  res.json(new ApiResponse(200, { entries, pagination: paginationMeta(total, pg, lim) }));
});

const myBalance = asyncHandler(async (req, res) => {
  const customer = await req.models.Customer.findById(req.customer._id).select('name currentBalance creditLimit');
  res.json(new ApiResponse(200, { name: customer.name, currentBalance: customer.currentBalance, creditLimit: customer.creditLimit }));
});

const myPayments = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  // Get customer's order IDs first, then find payments
  const orderIds = await req.models.Order.find({ customer: req.customer._id }).distinct('_id');
  const [payments, total] = await Promise.all([
    req.models.OrderPayment.find({ order: { $in: orderIds } })
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.OrderPayment.countDocuments({ order: { $in: orderIds } }),
  ]);
  res.json(new ApiResponse(200, { payments, pagination: paginationMeta(total, pg, lim) }));
});

module.exports = { myOrders, getOrder, placeOrder, cancelOrder, myLedger, myBalance, myPayments };
