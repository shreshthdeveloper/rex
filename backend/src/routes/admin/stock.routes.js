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

// Adjustments (batch-based, pending→approved/cancelled)
router.get('/adjustments', warehousePlus, ctrl.listAdjustmentBatches);
router.post('/adjustments/bulk', warehousePlus, ctrl.bulkCreateAdjustment);
router.get('/adjustments/:id', warehousePlus, ctrl.getAdjustmentBatch);
router.put('/adjustments/:id', warehousePlus, ctrl.updateAdjustmentBatch);
router.patch('/adjustments/:id/approve', warehousePlus, ctrl.approveAdjustmentBatch);
router.patch('/adjustments/:id/cancel', warehousePlus, ctrl.cancelAdjustmentBatch);

// Transfers
router.get('/transfers', warehousePlus, ctrl.listTransfers);
router.post('/transfers', warehousePlus, ctrl.createTransfer);
router.get('/transfers/:id', warehousePlus, ctrl.getTransfer);
router.put('/transfers/:id', warehousePlus, ctrl.updateTransfer);
router.patch('/transfers/:id/complete', warehousePlus, ctrl.completeTransfer);
router.patch('/transfers/:id/cancel', warehousePlus, ctrl.cancelTransfer);

module.exports = router;
