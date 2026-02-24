const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const config = require('./src/config/config');
const { connectSuperAdminDB, closeAllConnections } = require('./src/config/database');
const { registerSuperAdminModels } = require('./src/models/superadmin');
const errorHandler = require('./src/middleware/errorHandler');
const routes = require('./src/routes');
const bcrypt = require('bcryptjs');

const app = express();

// ─── Global Middleware ───
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Serve uploaded files ───
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───
app.use('/api', routes);

// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Error Handler ───
app.use(errorHandler);

// ─── Start Server ───
const startServer = async () => {
  try {
    // Connect superadmin DB
    const superAdminConn = await connectSuperAdminDB();
    const superAdminModels = registerSuperAdminModels(superAdminConn);

    // Make superadmin models available globally for the superadmin routes
    app.locals.superAdminConn = superAdminConn;
    app.locals.superAdminModels = superAdminModels;

    // Seed default superadmin if not exists
    const existingAdmin = await superAdminModels.SuperAdmin.findOne({ email: config.superadminEmail });
    if (!existingAdmin) {
      const hashed = await bcrypt.hash(config.superadminPassword, 12);
      await superAdminModels.SuperAdmin.create({
        name: 'Super Admin',
        email: config.superadminEmail,
        password: hashed,
      });
      console.log(`[Seed] SuperAdmin created: ${config.superadminEmail}`);
    }

    app.listen(config.port, () => {
      console.log(`\n🚀 Server running on port ${config.port}`);
      console.log(`   Environment: ${config.nodeEnv}`);
      console.log(`   SuperAdmin DB: ${config.superadminDb}`);
      console.log(`   Health: http://localhost:${config.port}/api/health\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await closeAllConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await closeAllConnections();
  process.exit(0);
});

startServer();

module.exports = app;
