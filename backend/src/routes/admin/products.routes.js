const router = require('express').Router();
const ctrl = require('../../controllers/admin/products.controller');
const { adminAuth } = require('../../middleware/auth');
const { managerPlus, warehousePlus } = require('../../middleware/rbac');

router.use(adminAuth);

router.get('/', ctrl.list);
router.get('/stock-summary', ctrl.stockSummary);
router.post('/', managerPlus, ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', managerPlus, ctrl.update);
router.delete('/:id', managerPlus, ctrl.remove);

// Variants
router.post('/:id/variants', managerPlus, ctrl.addVariant);
router.put('/:id/variants/:variantId', managerPlus, ctrl.updateVariant);
router.delete('/:id/variants/:variantId', managerPlus, ctrl.deleteVariant);

// Images
router.post('/:id/images', managerPlus, ctrl.addImages);
router.delete('/:id/images/:imageId', managerPlus, ctrl.removeImage);
router.patch('/:id/images/reorder', managerPlus, ctrl.reorderImages);

// Stock info
router.get('/:id/stock', warehousePlus, ctrl.getProductStock);
router.get('/:id/movements', warehousePlus, ctrl.getProductMovements);

module.exports = router;
