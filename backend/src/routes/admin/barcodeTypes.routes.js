const router = require('express').Router();
const ctrl = require('../../controllers/admin/barcodeTypes.controller');
const { adminAuth } = require('../../middleware/auth');
const { managerPlus } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/', ctrl.list);
router.post('/', managerPlus, ctrl.create);
router.put('/:id', managerPlus, ctrl.update);
router.delete('/:id', managerPlus, ctrl.remove);

module.exports = router;
