/**
 * One-time migration: copy legacy `warehousePrice` → `supplierPrice`
 * on all ProductStock documents across all org databases.
 *
 * Run: node src/migrate_supplier_price.js
 */

'use strict';

const mongoose = require('mongoose');
const config = require('./config/config');

const SUPERADMIN_CONN_STR = `${config.mongoUri}/${config.superadminDb}`;

const orgStockSchema = new mongoose.Schema({}, { strict: false, collection: 'productstocks' });

async function migrateOrg(dbName) {
  const conn = mongoose.createConnection(`${config.mongoUri}/${dbName}`);
  await new Promise((resolve, reject) => {
    conn.once('open', resolve);
    conn.once('error', reject);
  });

  const ProductStock = conn.model('ProductStock', orgStockSchema);

  // Step 1: For docs that have warehousePrice but no supplierPrice yet, promote the value
  const step1 = await ProductStock.updateMany(
    { warehousePrice: { $exists: true, $ne: null }, $or: [{ supplierPrice: null }, { supplierPrice: { $exists: false } }] },
    { $rename: { warehousePrice: 'supplierPrice' } }
  );

  // Step 2: For any remaining docs that still have warehousePrice (already had supplierPrice), just remove the old field
  const step2 = await ProductStock.updateMany(
    { warehousePrice: { $exists: true } },
    { $unset: { warehousePrice: '' } }
  );

  await conn.close();
  return step1.modifiedCount + step2.modifiedCount;
}

async function main() {
  console.log('[Migration] Connecting to super-admin DB…');
  const adminConn = mongoose.createConnection(SUPERADMIN_CONN_STR);
  await new Promise((resolve, reject) => {
    adminConn.once('open', resolve);
    adminConn.once('error', reject);
  });

  const Organization = adminConn.model(
    'Organization',
    new mongoose.Schema({ dbName: String, name: String, isActive: Boolean, deletedAt: Date }, { strict: false })
  );

  const orgs = await Organization.find({ deletedAt: null }).lean();
  console.log(`[Migration] Found ${orgs.length} org(s). Starting migration…\n`);

  let totalUpdated = 0;

  for (const org of orgs) {
    try {
      process.stdout.write(`  → ${org.name} (${org.dbName}) … `);
      const modified = await migrateOrg(org.dbName);
      console.log(`${modified} doc(s) updated`);
      totalUpdated += modified;
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  await adminConn.close();

  console.log(`\n[Migration] Done. Total documents updated: ${totalUpdated}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[Migration] Fatal:', err);
  process.exit(1);
});
