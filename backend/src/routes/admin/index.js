const router = require('express').Router();

// Mount all admin sub-routes
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/categories', require('./categories.routes'));
router.use('/brands', require('./brands.routes'));
router.use('/units', require('./units.routes'));
router.use('/barcode-types', require('./barcodeTypes.routes'));
router.use('/tax-slabs', require('./taxSlabs.routes'));
router.use('/warehouses', require('./warehouses.routes'));
router.use('/products', require('./products.routes'));
router.use('/stock', require('./stock.routes'));
router.use('/customers', require('./customers.routes'));
router.use('/orders', require('./orders.routes'));
router.use('/suppliers', require('./suppliers.routes'));
router.use('/purchase-orders', require('./purchaseOrders.routes'));
router.use('/coupons', require('./coupons.routes'));
router.use('/pricing', require('./pricing.routes'));
router.use('/reports', require('./reports.routes'));
router.use('/notifications', require('./notifications.routes'));
router.use('/ecom-settings', require('./ecomSettings.routes'));
router.use('/ecom-queries', require('./ecomQueries.routes'));
router.use('/upload', require('./upload.routes'));
router.use('/transaction-log', require('./transactionLog.routes'));
router.use('/integrations', require('./integrations.routes'));

module.exports = router;
