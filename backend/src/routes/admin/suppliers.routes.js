const router = require('express').Router();
const ctrl = require('../../controllers/admin/suppliers.controller');
const { adminAuth } = require('../../middleware/auth');
const { managerPlus, accountantPlus } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/', managerPlus, ctrl.list);
router.post('/', managerPlus, ctrl.create);
router.get('/:id', managerPlus, ctrl.getById);
router.put('/:id', managerPlus, ctrl.update);
router.delete('/:id', managerPlus, ctrl.remove);

// Ledger & Balance
router.get('/:id/ledger', accountantPlus, ctrl.getLedger);
router.get('/:id/balance', managerPlus, ctrl.getBalance);
router.post('/:id/payments', accountantPlus, ctrl.recordPayment);
router.post('/:id/adjust', managerPlus, ctrl.adjust);
router.get('/:id/purchase-orders', managerPlus, ctrl.getPurchaseOrders);
router.get('/:id/statement', accountantPlus, ctrl.getStatement);

module.exports = router;
