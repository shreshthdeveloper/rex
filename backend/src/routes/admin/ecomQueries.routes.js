const router = require('express').Router();
const { adminAuth } = require('../../middleware/auth');
const ctrl = require('../../controllers/admin/ecomQueries.controller');

router.use(adminAuth);
router.get('/', ctrl.list);
router.patch('/:id/status', ctrl.updateStatus);

module.exports = router;
