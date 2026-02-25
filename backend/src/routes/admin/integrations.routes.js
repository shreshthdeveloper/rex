const router = require('express').Router();
const { adminAuth } = require('../../middleware/auth');
const ctrl = require('../../controllers/admin/integrations.controller');

router.use(adminAuth);

router.get('/', ctrl.list);
router.get('/:slug', ctrl.getBySlug);
router.put('/', ctrl.upsert);
router.patch('/:slug/toggle', ctrl.toggleActive);
router.delete('/:slug', ctrl.remove);
router.post('/dispatch/send', ctrl.sendToDispatch);

module.exports = router;
