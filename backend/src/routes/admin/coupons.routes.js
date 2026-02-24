const router = require('express').Router();
const ctrl = require('../../controllers/admin/coupons.controller');
const { adminAuth } = require('../../middleware/auth');
const { managerPlus } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/', managerPlus, ctrl.list);
router.post('/', managerPlus, ctrl.create);
router.get('/:id', managerPlus, ctrl.getById);
router.put('/:id', managerPlus, ctrl.update);
router.delete('/:id', managerPlus, ctrl.remove);
router.post('/validate', managerPlus, ctrl.validate);

module.exports = router;
