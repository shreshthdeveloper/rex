const router = require('express').Router();
const ctrl = require('../../controllers/admin/categories.controller');
const { adminAuth } = require('../../middleware/auth');
const { managerPlus } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/', ctrl.list);
router.post('/', managerPlus, ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', managerPlus, ctrl.update);
router.delete('/:id', managerPlus, ctrl.remove);
router.patch('/reorder', managerPlus, ctrl.reorder);

module.exports = router;
