const router = require('express').Router();

router.use('/superadmin', require('./superadmin.routes'));
router.use('/admin', require('./admin'));
router.use('/store', require('./store'));

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
