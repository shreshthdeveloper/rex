const router = require('express').Router();
const { adminAuth } = require('../../middleware/auth');
const ctrl = require('../../controllers/admin/ecomSettings.controller');

router.use(adminAuth);
router.get('/', ctrl.getSettings);
router.put('/', ctrl.updateSettings);

module.exports = router;
