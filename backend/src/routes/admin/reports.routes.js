const router = require('express').Router();
const ctrl = require('../../controllers/admin/reports.controller');
const { adminAuth } = require('../../middleware/auth');
const { managerPlus, accountantPlus } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/dashboard', ctrl.dashboardStats);
router.get('/sales', managerPlus, ctrl.salesReport);
router.get('/stock', managerPlus, ctrl.stockReport);
router.get('/customer-aging', accountantPlus, ctrl.customerAgingReport);
router.get('/supplier-aging', accountantPlus, ctrl.supplierAgingReport);
router.get('/profit-loss', managerPlus, ctrl.profitAndLoss);
router.get('/cash-flow', managerPlus, ctrl.cashFlowReport);
router.get('/reconcile-all', managerPlus, ctrl.reconcileAll);

module.exports = router;
