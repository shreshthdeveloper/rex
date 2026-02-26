const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/shipmentMethods.controller');
const { adminAuth } = require('../../middleware/auth');
const { managerPlus } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', managerPlus, controller.create);
router.put('/:id', managerPlus, controller.update);
router.delete('/:id', managerPlus, controller.remove);

module.exports = router;
