const router = require('express').Router();
const ctrl = require('../../controllers/admin/customers.controller');
const { adminAuth } = require('../../middleware/auth');
const { cashierPlus, managerPlus, accountantPlus } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/', cashierPlus, ctrl.list);
router.post('/', cashierPlus, ctrl.create);
router.get('/:id', cashierPlus, ctrl.getById);
router.put('/:id', managerPlus, ctrl.update);
router.delete('/:id', managerPlus, ctrl.remove);

// Ledger & Balance
router.get('/:id/ledger', accountantPlus, ctrl.getLedger);
router.get('/:id/balance', cashierPlus, ctrl.getBalance);
router.post('/:id/topup', cashierPlus, ctrl.topup);
router.post('/:id/adjust', managerPlus, ctrl.adjust);
router.get('/:id/statement', accountantPlus, ctrl.getStatement);

// Linked data
router.get('/:id/orders', cashierPlus, ctrl.getOrders);
router.get('/:id/payments', accountantPlus, ctrl.getPayments);
router.get('/:id/topups', accountantPlus, ctrl.getTopups);

module.exports = router;
