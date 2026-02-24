const router = require('express').Router();
const ctrl = require('../../controllers/admin/purchaseOrders.controller');
const { adminAuth } = require('../../middleware/auth');
const { managerPlus, warehousePlus } = require('../../middleware/rbac');

router.use(adminAuth);

// Purchase Orders
router.get('/', managerPlus, ctrl.listPO);
router.post('/', managerPlus, ctrl.createPO);
router.get('/:id', managerPlus, ctrl.getPO);
router.put('/:id', managerPlus, ctrl.updatePO);
router.delete('/:id', managerPlus, ctrl.deletePO);
router.patch('/:id/status', managerPlus, ctrl.updatePOStatus);

// GRN
router.get('/grn/list', warehousePlus, ctrl.listGRN);
router.post('/grn', warehousePlus, ctrl.createGRN);
router.get('/grn/:id', warehousePlus, ctrl.getGRN);
router.patch('/grn/:id/approve', managerPlus, ctrl.approveGRN);
router.patch('/grn/:id/reject', managerPlus, ctrl.rejectGRN);

// Purchase Returns
router.get('/returns/list', managerPlus, ctrl.listPurchaseReturns);
router.post('/returns', managerPlus, ctrl.createPurchaseReturn);

module.exports = router;
