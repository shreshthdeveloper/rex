const router = require('express').Router();
const catalogCtrl = require('../../controllers/store/catalog.controller');
const customerAuthCtrl = require('../../controllers/store/customerAuth.controller');
const portalCtrl = require('../../controllers/store/portal.controller');
const { resolveOrg, customerAuth } = require('../../middleware/auth');

// All store routes require org resolution from URL param
router.use('/:orgSlug', resolveOrg);

// ─── Public Settings ───
router.get('/:orgSlug/settings', catalogCtrl.getSettings);

// ─── Public Catalog ───
router.get('/:orgSlug/categories', catalogCtrl.getCategories);
router.get('/:orgSlug/brands', catalogCtrl.getBrands);
router.get('/:orgSlug/products', catalogCtrl.getProducts);
router.get('/:orgSlug/products/featured', catalogCtrl.getFeatured);
router.get('/:orgSlug/products/new-arrivals', catalogCtrl.getNewArrivals);
router.get('/:orgSlug/products/search', catalogCtrl.search);
router.get('/:orgSlug/products/slug/:slug', catalogCtrl.getProductBySlug);
router.get('/:orgSlug/products/:id', catalogCtrl.getProductById);

// ─── Customer Auth ───
router.post('/:orgSlug/auth/register', customerAuthCtrl.register);
router.post('/:orgSlug/auth/login', customerAuthCtrl.login);

// ─── Customer Portal (authenticated) ───
router.use('/:orgSlug/portal', customerAuth);

// Profile
router.get('/:orgSlug/portal/profile', customerAuthCtrl.getProfile);
router.put('/:orgSlug/portal/profile', customerAuthCtrl.updateProfile);
router.put('/:orgSlug/portal/change-password', customerAuthCtrl.changePassword);

// Addresses
router.get('/:orgSlug/portal/addresses', portalCtrl.listAddresses);
router.post('/:orgSlug/portal/addresses', portalCtrl.addAddress);
router.put('/:orgSlug/portal/addresses/:addrId', portalCtrl.updateAddress);
router.delete('/:orgSlug/portal/addresses/:addrId', portalCtrl.deleteAddress);

// Orders
router.get('/:orgSlug/portal/orders', portalCtrl.myOrders);
router.get('/:orgSlug/portal/orders/:id', portalCtrl.getOrder);
router.post('/:orgSlug/portal/orders', portalCtrl.placeOrder);
router.patch('/:orgSlug/portal/orders/:id/cancel', portalCtrl.cancelOrder);

// Returns
router.post('/:orgSlug/portal/orders/:id/return', portalCtrl.initiateReturn);
router.get('/:orgSlug/portal/orders/:id/returns', portalCtrl.myOrderReturns);
router.get('/:orgSlug/portal/returns', portalCtrl.myReturns);

// Financial
router.get('/:orgSlug/portal/ledger', portalCtrl.myLedger);
router.get('/:orgSlug/portal/balance', portalCtrl.myBalance);
router.get('/:orgSlug/portal/payments', portalCtrl.myPayments);
router.get('/:orgSlug/portal/topups', portalCtrl.myTopups);
router.get('/:orgSlug/portal/statement', portalCtrl.myStatement);

// Utilities
router.post('/:orgSlug/portal/coupon/validate', portalCtrl.validateCoupon);
router.post('/:orgSlug/portal/stock-check', portalCtrl.stockCheck);

module.exports = router;
