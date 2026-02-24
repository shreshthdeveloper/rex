const router = require('express').Router();
const ctrl = require('../controllers/superadmin.controller');
const { superAdminAuth } = require('../middleware/auth');

// POST /api/superadmin/login
router.post('/login', ctrl.superAdminLogin);

// All routes below require superadmin auth
router.use(superAdminAuth);

// Organizations
router.get('/organizations', ctrl.listOrgs);
router.post('/organizations', ctrl.createOrg);
router.get('/organizations/:id', ctrl.getOrg);
router.put('/organizations/:id', ctrl.updateOrg);
router.delete('/organizations/:id', ctrl.deleteOrg);

// Org admins
router.post('/organizations/:id/admins', ctrl.createOrgAdmin);
router.get('/organizations/:id/admins', ctrl.listOrgAdmins);

module.exports = router;
