/**
 * cleanup_parent_stock.js
 * Deletes all ProductStock records that belong to `type:'parent'` products.
 * Run once: node scripts/cleanup_parent_stock.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const config = require('../src/config/config');

const MONGO_URI = config.mongoUri;
const SUPERADMIN_DB = config.superadminDb || 'superadmin_db';

async function cleanOrgDb(dbName) {
  const conn = await mongoose.createConnection(`${MONGO_URI}/${dbName}`).asPromise();

  // Minimal schemas (same field names as the real models)
  const ProductSchema = new mongoose.Schema({ type: String }, { strict: false });
  const ProductStockSchema = new mongoose.Schema({ product: mongoose.Schema.Types.ObjectId }, { strict: false });

  const Product = conn.model('Product', ProductSchema);
  const ProductStock = conn.model('ProductStock', ProductStockSchema);

  // Find all parent product IDs
  const parents = await Product.find({ type: 'parent' }).select('_id').lean();
  const parentIds = parents.map(p => p._id);

  if (parentIds.length === 0) {
    console.log(`  [${dbName}] No parent products found.`);
    await conn.close();
    return 0;
  }

  // Delete stock records for those parents
  const result = await ProductStock.deleteMany({ product: { $in: parentIds } });
  console.log(`  [${dbName}] Deleted ${result.deletedCount} stock record(s) for ${parentIds.length} parent product(s).`);

  await conn.close();
  return result.deletedCount;
}

async function main() {
  // Connect to superadmin to list all org databases
  const saConn = await mongoose.createConnection(`${MONGO_URI}/${SUPERADMIN_DB}`).asPromise();
  const OrgSchema = new mongoose.Schema({ dbName: String }, { strict: false });
  const Org = saConn.model('Organization', OrgSchema);

  const orgs = await Org.find({}).select('dbName name').lean();
  console.log(`Found ${orgs.length} organisation(s).`);

  let total = 0;
  for (const org of orgs) {
    console.log(`Processing: ${org.name || org.dbName}`);
    total += await cleanOrgDb(org.dbName);
  }

  await saConn.close();
  console.log(`\nDone. Total stock records removed: ${total}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
