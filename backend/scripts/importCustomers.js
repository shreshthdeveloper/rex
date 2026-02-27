/**
 * One-time script to import customers from CSV into the org database.
 *
 * Usage:  node scripts/importCustomers.js
 *
 * CSV:    "Customer Export - 2026-02-16.csv" (at project root)
 * Target: org_demo_store  →  customers collection
 *
 * Column mapping (0-indexed in parsed row):
 *   0  ID
 *   1  No
 *   2  Name                → fallback name source #1
 *   3  Email               → email (generate placeholder when empty)
 *   4  Phone No            → (ignored, using Business Phone No instead)
 *   5  Business No
 *   6  Business Name *     → companyName  AND  fallback name source #2
 *   7  Business Phone No   → phone
 *   8  Whatsapp Phone No
 *   9  Business City
 *  10  Business State
 *  11  Address
 *  12  Ecom Allowed
 *  13  Promotion Acceptance
 *  14  Class of Trade      → tier
 *  15  Shipping Name       → fallback name source #3
 *  16  Shipping Company
 *  17  Shipping Telephone
 *  18  Shipping Address    → addresses[0].line1
 *  19  Shipping Country    → addresses[0].country
 *  20  Shipping State      → addresses[0].state
 *  21  Shipping City       → addresses[0].city
 *  22  Shipping Zip        → addresses[0].zip
 *  …  (rest ignored)
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// ── helpers ────────────────────────────────────────────────────────────────
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const config = require('../src/config/config');
const { getOrgConnection } = require('../src/config/database');
const { registerOrgModels } = require('../src/models/org');

const ORG_DB = 'org_puff-stuff';
const CSV_PATH = path.resolve(__dirname, '..', '..', 'Customer Export - 2026-02-16.csv');

// ── Proper CSV line parser (handles quoted fields with commas) ─────────
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // look-ahead: escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current); // last field
  return fields;
}

// ── Sanitise value (trim, turn "null" / "Not Assigned" into '') ────────
function clean(val) {
  if (!val) return '';
  const trimmed = val.trim();
  if (['null', 'not assigned', 'n/a', ''].includes(trimmed.toLowerCase())) return '';
  return trimmed;
}

// ── Map "Class of Trade" to tier enum value ────────────────────────────
function mapTier(raw) {
  const lower = (raw || '').trim().toLowerCase();
  if (lower.includes('distributor')) return 'wholesale';
  if (lower.includes('wholesale')) return 'wholesale';
  if (lower.includes('vip')) return 'vip';
  return 'retail'; // default / "Retailer"
}

// ── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  // 1. Read & parse CSV
  const rawCsv = fs.readFileSync(CSV_PATH, 'utf-8');
  const allLines = rawCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // Skip header rows (first two lines)
  const dataLines = allLines.slice(2);
  console.log(`Total data rows in CSV: ${dataLines.length}`);

  // 2. Connect to org DB
  const orgConn = await getOrgConnection(ORG_DB);
  const models = registerOrgModels(orgConn);
  const Customer = models.Customer;

  // 3. Parse each row into a customer doc
  const customers = [];
  const emailSet = new Set(); // track uniqueness within CSV

  for (let i = 0; i < dataLines.length; i++) {
    const cols = parseCsvLine(dataLines[i]);
    const csvId = clean(cols[0]) || String(i + 1);

    // ── Name resolution: Name col → Business Name → Shipping Name ──
    let name = clean(cols[2]);
    if (!name) name = clean(cols[6]); // Business Name
    if (!name) name = clean(cols[15]); // Shipping Name
    if (!name) name = `Customer ${csvId}`;

    // ── Company Name = Business Name ──
    const companyName = clean(cols[6]) || '';

    // ── Email: use CSV email or generate placeholder ──
    let email = clean(cols[3]).toLowerCase();
    if (!email) {
      email = `noemail-${csvId}@import.placeholder`;
    }
    // Guarantee uniqueness within this import batch
    if (emailSet.has(email)) {
      email = `dup-${csvId}-${Date.now()}@import.placeholder`;
    }
    emailSet.add(email);

    // ── Phone = Business Phone No ──
    const phone = clean(cols[7]) || '';

    // ── Tier ──
    const tier = mapTier(cols[14]);

    // ── Address from shipping details ──
    const addrLine1 = clean(cols[18]);
    const addrCountry = clean(cols[19]);
    const addrState = clean(cols[20]);
    const addrCity = clean(cols[21]);
    const addrZip = clean(cols[22]);

    const addresses = [];
    if (addrLine1 || addrCity || addrState || addrZip) {
      addresses.push({
        label: 'Default',
        line1: addrLine1,
        city: addrCity,
        state: addrState,
        zip: addrZip,
        country: addrCountry || 'United States',
        isDefault: true,
      });
    }

    customers.push({
      name,
      companyName,
      email,
      phone,
      tier,
      addresses,
      isActive: true,
      creditLimit: 0,
      currentBalance: 0,
    });
  }

  console.log(`Parsed ${customers.length} customer objects from CSV`);

  // 4. Clear existing customers (optional safety — remove if you want to keep old data)
  //    Uncomment the next line ONLY if the client wants a clean slate:
  // await Customer.deleteMany({});

  // 5. Insert via insertMany (ordered: false to continue on dup-key errors)
  try {
    const result = await Customer.insertMany(customers, { ordered: false });
    console.log(`✅ Successfully inserted: ${result.length} customers`);
  } catch (err) {
    if (err.name === 'MongoBulkWriteError' || err.code === 11000) {
      const inserted = err.insertedDocs ? err.insertedDocs.length : (err.result ? err.result.insertedCount : '?');
      console.log(`⚠️  Bulk insert finished with some duplicates.`);
      console.log(`   Inserted: ${inserted}`);
      console.log(`   Errors  : ${err.writeErrors ? err.writeErrors.length : '?'}`);
    } else {
      throw err;
    }
  }

  // 6. Verify count
  const finalCount = await Customer.countDocuments({ isDeleted: { $ne: true } });
  console.log(`📊 Total customers in DB now: ${finalCount}`);

  // Done
  await orgConn.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
