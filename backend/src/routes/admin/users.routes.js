const router = require('express').Router();
const ctrl = require('../../controllers/admin/users.controller');
const { adminAuth } = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/', ctrl.list);
router.post('/', adminOnly, ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', adminOnly, ctrl.update);
router.delete('/:id', adminOnly, ctrl.remove);
router.patch('/:id/toggle-active', adminOnly, ctrl.toggleActive);

module.exports = router;
