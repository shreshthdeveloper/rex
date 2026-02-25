const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const axios = require('axios');

/* ─── List all integrations ─── */
const list = asyncHandler(async (req, res) => {
  const integrations = await req.models.Integration.find().sort({ displayName: 1 });
  res.json(new ApiResponse(200, integrations));
});

/* ─── Get single integration by slug ─── */
const getBySlug = asyncHandler(async (req, res) => {
  const integration = await req.models.Integration.findOne({ slug: req.params.slug });
  if (!integration) throw new ApiError(404, 'Integration not found');
  res.json(new ApiResponse(200, integration));
});

/* ─── Create or update integration (upsert by slug) ─── */
const upsert = asyncHandler(async (req, res) => {
  const { slug, displayName, logo, isActive, apiKey, webhookUrl, config } = req.body;
  if (!slug) throw new ApiError(400, 'Slug is required');

  const update = {
    displayName: displayName || slug,
    logo: logo || '',
    isActive: isActive ?? false,
    apiKey: apiKey || '',
    webhookUrl: webhookUrl || '',
    config: config || {},
    updatedBy: req.user._id,
  };

  const integration = await req.models.Integration.findOneAndUpdate(
    { slug },
    { $set: update, $setOnInsert: { createdBy: req.user._id } },
    { new: true, upsert: true, runValidators: true }
  );

  res.json(new ApiResponse(200, integration, 'Integration saved'));
});

/* ─── Toggle active/inactive ─── */
const toggleActive = asyncHandler(async (req, res) => {
  const integration = await req.models.Integration.findOne({ slug: req.params.slug });
  if (!integration) throw new ApiError(404, 'Integration not found');
  integration.isActive = !integration.isActive;
  integration.updatedBy = req.user._id;
  await integration.save();
  res.json(new ApiResponse(200, integration, `Integration ${integration.isActive ? 'activated' : 'deactivated'}`));
});

/* ─── Delete integration ─── */
const remove = asyncHandler(async (req, res) => {
  const integration = await req.models.Integration.findOneAndDelete({ slug: req.params.slug });
  if (!integration) throw new ApiError(404, 'Integration not found');
  res.json(new ApiResponse(200, null, 'Integration deleted'));
});

/* ─── Send order to Dispatch webhook ─── */
const sendToDispatch = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) throw new ApiError(400, 'Order ID is required');

  const dispatch = await req.models.Integration.findOne({ slug: 'dispatch', isActive: true });
  if (!dispatch) throw new ApiError(400, 'Dispatch integration is not active');
  if (!dispatch.apiKey) throw new ApiError(400, 'Dispatch API key is not configured');

  const order = await req.models.Order.findById(orderId)
    .populate('customer', 'name phone email addresses')
    .populate('warehouse', 'name address');
  if (!order) throw new ApiError(404, 'Order not found');

  const customer = order.customer;
  const warehouse = order.warehouse;

  const payload = {
    customerName: customer?.name || '',
    customerPhone: customer?.phone || customer?.email || '',
    pickupAddress: warehouse?.address
      ? `${warehouse.address.line1 || ''} ${warehouse.address.line2 || ''} ${warehouse.address.city || ''} ${warehouse.address.state || ''} ${warehouse.address.pincode || ''}`.trim()
      : warehouse?.name || '',
    deliveryAddress: order.shippingAddress
      ? `${order.shippingAddress.line1 || ''} ${order.shippingAddress.line2 || ''} ${order.shippingAddress.city || ''} ${order.shippingAddress.state || ''} ${order.shippingAddress.pincode || ''}`.trim()
      : '',
    priority: 'normal',
    notes: order.notes || `Order #${order.orderNumber}`,
  };

  const webhookUrl = dispatch.webhookUrl || 'https://dispatch.distrx.io/api/zapier/webhook';

  try {
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': dispatch.apiKey,
      },
      timeout: 10000,
    });
    res.json(new ApiResponse(200, { dispatched: true, response: response.data }, 'Order sent to Dispatch'));
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message || 'Failed to send to Dispatch';
    throw new ApiError(502, `Dispatch webhook failed: ${errMsg}`);
  }
});

module.exports = { list, getBySlug, upsert, toggleActive, remove, sendToDispatch };
