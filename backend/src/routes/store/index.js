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
router.get('/:orgSlug/products', catalogCtrl.getProducts);
router.get('/:orgSlug/products/featured', catalogCtrl.getFeatured);
router.get('/:orgSlug/products/search', catalogCtrl.search);
router.get('/:orgSlug/products/slug/:slug', catalogCtrl.getProductBySlug);
router.get('/:orgSlug/products/:id', catalogCtrl.getProductById);

// ─── Customer Auth ───
router.post('/:orgSlug/auth/register', customerAuthCtrl.register);
router.post('/:orgSlug/auth/login', customerAuthCtrl.login);

// ─── Customer Portal (authenticated) ───
router.use('/:orgSlug/portal', customerAuth);
router.get('/:orgSlug/portal/profile', customerAuthCtrl.getProfile);
router.put('/:orgSlug/portal/profile', customerAuthCtrl.updateProfile);
router.put('/:orgSlug/portal/change-password', customerAuthCtrl.changePassword);
router.get('/:orgSlug/portal/orders', portalCtrl.myOrders);
router.get('/:orgSlug/portal/orders/:id', portalCtrl.getOrder);
router.post('/:orgSlug/portal/orders', portalCtrl.placeOrder);
router.patch('/:orgSlug/portal/orders/:id/cancel', portalCtrl.cancelOrder);
router.get('/:orgSlug/portal/ledger', portalCtrl.myLedger);
router.get('/:orgSlug/portal/balance', portalCtrl.myBalance);
router.get('/:orgSlug/portal/payments', portalCtrl.myPayments);

module.exports = router;
