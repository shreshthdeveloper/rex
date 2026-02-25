const router = require('express').Router();
const ctrl = require('../../controllers/admin/orders.controller');
const { adminAuth } = require('../../middleware/auth');
const { cashierPlus, managerPlus, accountantPlus } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/', cashierPlus, ctrl.list);
router.post('/', cashierPlus, ctrl.createOrder);
router.get('/:id', cashierPlus, ctrl.getById);
router.put('/:id', managerPlus, ctrl.updateOrder);
router.delete('/:id', managerPlus, ctrl.deleteOrder);

// Status & payments
router.patch('/:id/status', managerPlus, ctrl.updateStatus);
router.post('/:id/payments', cashierPlus, ctrl.recordPayment);
router.get('/:id/payments', accountantPlus, ctrl.listPayments);
router.get('/:id/invoice', cashierPlus, ctrl.getInvoice);

// Returns
router.post('/:id/returns', managerPlus, ctrl.initiateReturn);
router.get('/:id/returns', cashierPlus, ctrl.listReturns);
router.patch('/:id/returns/:returnId/approve', managerPlus, ctrl.approveReturn);

// POS
router.post('/pos', cashierPlus, ctrl.posOrder);

// Edit history
router.get('/:id/history', managerPlus, ctrl.getEditHistory);

module.exports = router;
