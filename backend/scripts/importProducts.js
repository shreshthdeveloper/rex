/**
 * One-time script to import products from CSV into the org database.
 *
 * Usage:  node scripts/importProducts.js
 *
 * CSV:    "product-export-core-2026-02-17 22.03.54.289970 (1).csv" (at project root)
 * Target: org_puff-stuff → products + productStocks collections
 *
 * Split rule: FIRST occurrence of /-+/ (with optional surrounding spaces/dashes) divides parent from variant.
 *   Handles:  "Name-Flavor"  "Name - Flavor"  "Name- Flavor"  "Name --Flavor"  "Name- -Flavor"
 *
 * Column mapping (0-indexed):
 *   0  Product ID (CSV id)
 *   1  Product Name   → full variant name; parent = left of first dash
 *   2  SKU            → variant SKU (parent SKU = "P-" + csvId)
 *   4  Category Name  → categories (find or create)
 *   8  UPC 1          → barcodeValue on variant
 *  13  Brand Name     → brand (find or create)
 *  21  Status         → isActive (Active = true)
 *  25  Featured       → isFeatured (Y = true)
 *  29  Base Cost Price (ignored)
 *  30  Net Cost Price → costPrice  on variant
 *  31  Sale Price     → basePrice  on variant
 *  32  Curr. Available Quantity → stock quantity in main warehouse
 *  34  Image URL 1    → images[0] (primary)
 *  35  Image URL 2    → images[1]
 *  36  Image URL 3    → images[2]
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { getOrgConnection } = require('../src/config/database');
const { registerOrgModels } = require('../src/models/org');

const ORG_DB    = 'org_puff-stuff';
const CSV_PATH  = path.resolve(__dirname, '..', '..', 'product-export-core-2026-02-17 22.03.54.289970 (1).csv');
const VARIANT_ATTR = 'Flavor';

// ── Generate URL-safe slug from a name ─────────────────────────────────
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'item';
}

// ── CSV line parser (handles quoted fields with commas) ─────────────────
function parseCsvLine(line) {
  const fields = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function clean(v) {
  const t = (v || '').trim();
  return t.toLowerCase() === 'null' ? '' : t;
}

// ── Split product name on FIRST dash occurrence ─────────────────────────
// Handles: -, --, - -, and any combination of dashes + spaces
function splitName(name) {
  // Match the FIRST occurrence of:  optional-spaces + one-or-more-dashes + optional-[spaces/dashes]
  const match = name.match(/^(.*?)\s*-+[\s-]*(.*?)$/);
  if (!match) return null;
  const parent  = match[1].trim();
  const variant = match[2].trim();
  if (!parent || !variant) return null;
  return { parent, variant };
}

// ── Ensure brand exists, return _id ────────────────────────────────────
async function ensureBrand(models, name) {
  if (!name) return null;
  let brand = await models.Brand.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  if (!brand) {
    let slug = toSlug(name);
    // ensure slug uniqueness within brands
    const existing = await models.Brand.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;
    brand = await models.Brand.create({ name, slug, isActive: true });
  }
  return brand._id;
}

// ── Ensure category exists, return _id ────────────────────────────────
async function ensureCategory(models, name) {
  if (!name) return null;
  let cat = await models.Category.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  if (!cat) {
    let slug = toSlug(name);
    const existing = await models.Category.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;
    cat = await models.Category.create({ name, slug, isActive: true });
  }
  return cat._id;
}

// ── MAIN ───────────────────────────────────────────────────────────────
async function main() {
  // 1. Read & parse CSV
  const raw   = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  // First line is the header; skip it
  const dataLines = lines.slice(1);
  console.log(`CSV data rows: ${dataLines.length}`);

  // 2. Connect
  const orgConn = await getOrgConnection(ORG_DB);
  const models  = registerOrgModels(orgConn);

  // 3. Find main warehouse
  const warehouse = await models.Warehouse.findOne({ name: /main/i });
  if (!warehouse) {
    console.error('❌  Could not find a warehouse matching "main". Aborting.');
    process.exit(1);
  }
  console.log(`Warehouse: ${warehouse.name} (${warehouse._id})`);

  // 4. Parse all rows
  const rows = dataLines.map((line) => parseCsvLine(line));

  // 5. Group rows: parentName → [row, row, ...]
  //    Rows with no dash → singles array
  const parentMap = new Map(); // parentName → { rows: [], brandName, categoryName, ... }
  const singleRows = [];

  for (const cols of rows) {
    if (cols.length < 5) continue;
    const fullName = clean(cols[1]);
    if (!fullName) continue;

    const split = splitName(fullName);
    if (!split) {
      singleRows.push(cols);
    } else {
      const key = split.parent;
      if (!parentMap.has(key)) {
        parentMap.set(key, { parentName: key, rows: [] });
      }
      parentMap.get(key).rows.push({ cols, variant: split.variant });
    }
  }

  console.log(`Parent product groups: ${parentMap.size}`);
  console.log(`Single (no-dash) rows: ${singleRows.length}`);

  // ── Brand / Category cache ────────────────────────────────────────────
  const brandCache    = new Map();
  const categoryCache = new Map();

  async function getBrand(name) {
    if (!name) return null;
    if (brandCache.has(name)) return brandCache.get(name);
    const id = await ensureBrand(models, name);
    brandCache.set(name, id);
    return id;
  }

  async function getCategory(name) {
    if (!name) return null;
    if (categoryCache.has(name)) return categoryCache.get(name);
    const id = await ensureCategory(models, name);
    categoryCache.set(name, id);
    return id;
  }

  // ── SKU uniqueness tracker (avoid conflicts within import) ───────────
  const usedSkus = new Set();
  async function uniqueSku(raw) {
    let sku = raw;
    let i = 1;
    while (usedSkus.has(sku) || await models.Product.findOne({ sku })) {
      sku = `${raw}_${i++}`;
    }
    usedSkus.add(sku);
    return sku;
  }

  let insertedParents  = 0;
  let insertedVariants = 0;
  let insertedSingles  = 0;
  let stockRecords     = 0;
  let errors           = 0;

  // ── Helper: build images array from 3 URL cols ───────────────────────
  function buildImages(cols) {
    const urls = [clean(cols[34]), clean(cols[35]), clean(cols[36])].filter(Boolean);
    return urls.map((url, i) => ({ url, isPrimary: i === 0, sortOrder: i }));
  }

  // ── Helper: insert stock if qty > 0 ─────────────────────────────────
  async function insertStock(productId, qty) {
    if (!qty || qty <= 0) return;
    try {
      await models.ProductStock.findOneAndUpdate(
        { product: productId, warehouse: warehouse._id },
        { $set: { quantity: qty } },
        { upsert: true, new: true }
      );
      stockRecords++;
    } catch (e) {
      console.warn(`  Stock insert failed for ${productId}: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. Insert PARENT groups
  // ═══════════════════════════════════════════════════════════════════════
  for (const [parentName, group] of parentMap) {
    try {
      // Use first row for parent-level data (brand, category)
      const firstCols    = group.rows[0].cols;
      const brandId      = await getBrand(clean(firstCols[13]));
      const categoryId   = await getCategory(clean(firstCols[4]));
      const parentSku    = await uniqueSku(`P-${clean(firstCols[0]) || parentName.slice(0, 10).replace(/\s+/g, '-')}`);
      const parentImages = buildImages(firstCols); // use first variant's images as placeholder

      // Create parent product
      const parent = await models.Product.create({
        name:       parentName,
        sku:        parentSku,
        type:       'parent',
        brand:      brandId,
        categories: categoryId ? [categoryId] : [],
        images:     parentImages,
        isActive:   clean(firstCols[21]).toLowerCase() === 'active',
        isFeatured: clean(firstCols[25]).toUpperCase() === 'Y',
        basePrice:  0,
        costPrice:  0,
      });
      insertedParents++;

      // Create each variant
      for (const { cols, variant: variantValue } of group.rows) {
        try {
          const vBrandId    = await getBrand(clean(cols[13]));
          const vCategoryId = await getCategory(clean(cols[4]));
          const vSku        = await uniqueSku(clean(cols[2]) || `${parentSku}-${variantValue.slice(0, 8).replace(/\s+/g, '-')}`);
          const qty         = parseInt(clean(cols[32]), 10) || 0;

          const variantDoc = await models.Product.create({
            name:             clean(cols[1]),
            sku:              vSku,
            type:             'variant',
            parentProduct:    parent._id,
            variantAttribute: VARIANT_ATTR,
            variantValue,
            brand:            vBrandId,
            categories:       vCategoryId ? [vCategoryId] : [],
            barcodeValue:     clean(cols[8]),
            images:           buildImages(cols),
            basePrice:        parseFloat(clean(cols[31])) || 0,
            costPrice:        parseFloat(clean(cols[30])) || 0,
            weight:           parseFloat(clean(cols[17])) || 0,
            isActive:         clean(cols[21]).toLowerCase() === 'active',
            isFeatured:       clean(cols[25]).toUpperCase() === 'Y',
          });
          insertedVariants++;

          await insertStock(variantDoc._id, qty);
        } catch (ve) {
          console.error(`  ❌ Variant "${variantValue}" of "${parentName}": ${ve.message}`);
          errors++;
        }
      }
    } catch (pe) {
      console.error(`❌ Parent "${parentName}": ${pe.message}`);
      errors++;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7. Insert SINGLE products (no dash in name)
  // ═══════════════════════════════════════════════════════════════════════
  for (const cols of singleRows) {
    try {
      const name       = clean(cols[1]);
      const brandId    = await getBrand(clean(cols[13]));
      const categoryId = await getCategory(clean(cols[4]));
      const sku        = await uniqueSku(clean(cols[2]) || name.slice(0, 12).replace(/\s+/g, '-'));
      const qty        = parseInt(clean(cols[32]), 10) || 0;

      const prod = await models.Product.create({
        name,
        sku,
        type:         'single',
        brand:        brandId,
        categories:   categoryId ? [categoryId] : [],
        barcodeValue: clean(cols[8]),
        images:       buildImages(cols),
        basePrice:    parseFloat(clean(cols[31])) || 0,
        costPrice:    parseFloat(clean(cols[30])) || 0,
        weight:       parseFloat(clean(cols[17])) || 0,
        isActive:     clean(cols[21]).toLowerCase() === 'active',
        isFeatured:   clean(cols[25]).toUpperCase() === 'Y',
      });
      insertedSingles++;

      await insertStock(prod._id, qty);
    } catch (e) {
      console.error(`❌ Single "${clean(cols[1])}": ${e.message}`);
      errors++;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║        IMPORT SUMMARY           ║');
  console.log('╠══════════════════════════════════╣');
  console.log(`║  Parent products : ${String(insertedParents).padEnd(13)}║`);
  console.log(`║  Variant products: ${String(insertedVariants).padEnd(13)}║`);
  console.log(`║  Single products : ${String(insertedSingles).padEnd(13)}║`);
  console.log(`║  Stock records   : ${String(stockRecords).padEnd(13)}║`);
  console.log(`║  Errors skipped  : ${String(errors).padEnd(13)}║`);
  console.log('╚══════════════════════════════════╝');

  await orgConn.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
