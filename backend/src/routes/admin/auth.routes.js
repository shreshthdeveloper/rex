const router = require('express').Router();
const authCtrl = require('../../controllers/admin/auth.controller');
const { adminAuth } = require('../../middleware/auth');

// POST /api/admin/auth/login
router.post('/login', authCtrl.login);

// Protected
router.use(adminAuth);
router.get('/me', authCtrl.getMe);
router.put('/change-password', authCtrl.changePassword);

module.exports = router;
