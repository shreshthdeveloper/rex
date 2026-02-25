const router = require('express').Router();
const ctrl = require('../../controllers/admin/transactionLog.controller');
const { adminAuth } = require('../../middleware/auth');
const { managerPlus } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/', managerPlus, ctrl.list);
router.get('/summary', managerPlus, ctrl.summary);

module.exports = router;
