const router = require('express').Router();
const ctrl = require('../../controllers/admin/stock.controller');
const { adminAuth } = require('../../middleware/auth');
const { warehousePlus, managerPlus } = require('../../middleware/rbac');

router.use(adminAuth);

// Stock overview
router.get('/', warehousePlus, ctrl.listAllStock);
router.get('/low', warehousePlus, ctrl.lowStock);
router.get('/movements', warehousePlus, ctrl.listMovements);
router.get('/movements/product/:productId', warehousePlus, ctrl.getProductMovements);

// Opening stock
router.post('/opening', managerPlus, ctrl.setOpeningStock);
router.post('/opening/bulk-by-warehouse', managerPlus, ctrl.bulkOpeningByWarehouse);
router.post('/opening/bulk-by-product', managerPlus, ctrl.bulkOpeningByProduct);

// Adjustments
router.get('/adjustments', warehousePlus, ctrl.listAdjustments);
router.post('/adjustments', warehousePlus, ctrl.createAdjustment);
router.get('/adjustments/:id', warehousePlus, ctrl.getAdjustment);

// Transfers
router.get('/transfers', warehousePlus, ctrl.listTransfers);
router.post('/transfers', warehousePlus, ctrl.createTransfer);
router.get('/transfers/:id', warehousePlus, ctrl.getTransfer);
router.patch('/transfers/:id/complete', warehousePlus, ctrl.completeTransfer);
router.patch('/transfers/:id/cancel', warehousePlus, ctrl.cancelTransfer);

module.exports = router;
