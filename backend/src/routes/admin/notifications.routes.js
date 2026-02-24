const router = require('express').Router();
const ctrl = require('../../controllers/admin/notifications.controller');
const { adminAuth } = require('../../middleware/auth');

router.use(adminAuth);

router.get('/', ctrl.list);
router.patch('/:id/read', ctrl.markRead);
router.patch('/read-all', ctrl.markAllRead);
router.delete('/:id', ctrl.remove);

module.exports = router;
