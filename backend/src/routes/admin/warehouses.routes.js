const router = require('express').Router();
const ctrl = require('../../controllers/admin/warehouses.controller');
const { adminAuth } = require('../../middleware/auth');
const { managerPlus, warehousePlus } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/', ctrl.list);
router.post('/', managerPlus, ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', managerPlus, ctrl.update);
router.delete('/:id', managerPlus, ctrl.remove);
router.get('/:id/stock', warehousePlus, ctrl.getStock);
router.get('/:id/movements', warehousePlus, ctrl.getMovements);

module.exports = router;
