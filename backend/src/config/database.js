const mongoose = require('mongoose');
const config = require('./config');

// Connection pool for org databases
const orgConnections = {};

// Super Admin DB connection
let superAdminConnection = null;

const buildUri = (baseUri, dbName) => {
  const url = new URL(baseUri);
  const basePath = (url.pathname || '/').replace(/\/+$/, '');
  const pathParts = basePath.split('/').filter(Boolean);

  // If URI already has a DB in path (e.g. /rex), replace it with target dbName.
  // If it has no DB path, append target dbName.
  if (pathParts.length > 0) {
    pathParts[pathParts.length - 1] = dbName;
  } else {
    pathParts.push(dbName);
  }

  url.pathname = `/${pathParts.join('/')}`;
  return url.toString();
};

/**
 * Connect to super admin database
 */
const connectSuperAdminDB = async () => {
  if (superAdminConnection) return superAdminConnection;
  superAdminConnection = mongoose.createConnection(buildUri(config.mongoUri, config.superadminDb));
  superAdminConnection.on('connected', () => console.log(`[DB] SuperAdmin DB connected`));
  superAdminConnection.on('error', (err) => console.error(`[DB] SuperAdmin DB error:`, err));
  return superAdminConnection;
};

/**
 * Get or create connection for an org database
 */
const getOrgConnection = async (dbName) => {
  if (orgConnections[dbName]) return orgConnections[dbName];
  orgConnections[dbName] = mongoose.createConnection(buildUri(config.mongoUri, dbName));
  orgConnections[dbName].on('connected', () => console.log(`[DB] Org DB connected: ${dbName}`));
  orgConnections[dbName].on('error', (err) => console.error(`[DB] Org DB error (${dbName}):`, err));
  return orgConnections[dbName];
};

/**
 * Close all connections (graceful shutdown)
 */
const closeAllConnections = async () => {
  if (superAdminConnection) await superAdminConnection.close();
  for (const key of Object.keys(orgConnections)) {
    await orgConnections[key].close();
  }
};

module.exports = {
  connectSuperAdminDB,
  getOrgConnection,
  closeAllConnections,
};
