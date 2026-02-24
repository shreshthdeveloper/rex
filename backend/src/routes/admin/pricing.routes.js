const router = require('express').Router();
const ctrl = require('../../controllers/admin/pricing.controller');
const { adminAuth } = require('../../middleware/auth');
const { managerPlus } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/tier-prices', managerPlus, ctrl.listTierPrices);
router.post('/tier-prices', managerPlus, ctrl.createTierPrice);
router.put('/tier-prices/:id', managerPlus, ctrl.updateTierPrice);
router.delete('/tier-prices/:id', managerPlus, ctrl.removeTierPrice);
router.post('/resolve', ctrl.resolve);

module.exports = router;
