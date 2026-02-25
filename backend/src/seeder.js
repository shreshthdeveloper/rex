/**
 * Comprehensive Database Seeder
 * Seeds all collections with realistic data for the Multi-Tenant E-Commerce Platform.
 *
 * Usage:
 *   node src/seeder.js          — seed data
 *   node src/seeder.js --drop   — drop all org data first then seed
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config/config');
const { connectSuperAdminDB, getOrgConnection, closeAllConnections } = require('./config/database');
const { registerSuperAdminModels } = require('./models/superadmin');
const { registerOrgModels } = require('./models/org');

const SEED_ORG_SLUG = 'demo-store';
const SEED_ORG_NAME = 'Demo Store';
const SEED_ORG_DB = 'org_demo_store';

const shouldDrop = process.argv.includes('--drop');

async function seed() {
  console.log('🌱 Starting seeder...');
  const hashedPassword = await bcrypt.hash(config.superadminPassword || 'Password@123', 10);

  // ─── SuperAdmin DB ───
  const saConn = await connectSuperAdminDB();
  const { SuperAdmin, Organization } = registerSuperAdminModels(saConn);

  if (shouldDrop) {
    console.log('🗑  Dropping ALL superadmin collections...');
    try {
      // Drop the entire superadmin database
      await saConn.dropDatabase();
      console.log('   Dropped entire superadmin database');
    } catch (err) {
      console.log('   Error dropping superadmin database:', err.message);
    }
  }

  // Create SuperAdmin
  let superAdmin = await SuperAdmin.findOne({ email: config.superadminEmail });
  if (!superAdmin) {
    superAdmin = await SuperAdmin.create({
      name: 'Platform Super Admin',
      email: config.superadminEmail,
      password: hashedPassword,
      role: 'superadmin',
      isActive: true,
    });
    console.log('✅ SuperAdmin created:', superAdmin.email);
  } else {
    console.log('⏭  SuperAdmin already exists');
  }

  // Create Organization
  let org = await Organization.findOne({ slug: SEED_ORG_SLUG });
  if (!org) {
    org = await Organization.create({
      name: SEED_ORG_NAME,
      slug: SEED_ORG_SLUG,
      dbName: SEED_ORG_DB,
      plan: 'enterprise',
      isActive: true,
      createdBy: superAdmin._id,
    });
    console.log('✅ Organization created:', org.name);
  } else {
    console.log('⏭  Organization already exists');
  }

  // ─── Org DB ───
  const orgConn = await getOrgConnection(SEED_ORG_DB);
  const m = registerOrgModels(orgConn);

  if (shouldDrop) {
    console.log('🗑  Dropping ALL org collections...');
    try {
      // Drop the entire org database
      await orgConn.dropDatabase();
      console.log('   Dropped entire org database');
    } catch (err) {
      console.log('   Error dropping org database:', err.message);
    }
  }

  // ─── Counters ───
  const counters = ['purchase_order', 'grn', 'purchase_return', 'order', 'stock_transfer',
    'stock_adjustment', 'order_payment', 'order_return', 'customer_topup', 'supplier_payment', 'supplier_adjustment'];
  for (const c of counters) {
    await m.Counter.findByIdAndUpdate(c, { $setOnInsert: { seq: 0 } }, { upsert: true });
  }
  console.log('✅ Counters initialized');

  // ─── Users ───
  const usersData = [
    { name: 'Admin User', email: 'admin@demo.com', password: hashedPassword, role: 'admin', isActive: true },
    { name: 'Manager User', email: 'manager@demo.com', password: hashedPassword, role: 'manager', isActive: true },
    { name: 'Cashier User', email: 'cashier@demo.com', password: hashedPassword, role: 'cashier', isActive: true },
    { name: 'Warehouse Staff', email: 'warehouse@demo.com', password: hashedPassword, role: 'warehouse_staff', isActive: true },
    { name: 'Accountant User', email: 'accountant@demo.com', password: hashedPassword, role: 'accountant', isActive: true },
  ];
  const users = [];
  for (const u of usersData) {
    let user = await m.User.findOne({ email: u.email });
    if (!user) user = await m.User.create(u);
    users.push(user);
  }
  const [adminUser, managerUser, cashierUser, warehouseUser, accountantUser] = users;
  console.log('✅ Users created:', users.length);

  // ─── Units ───
  const unitsData = [
    { name: 'Piece', shortName: 'pcs', isActive: true },
    { name: 'Kilogram', shortName: 'kg', isActive: true },
    { name: 'Liter', shortName: 'ltr', isActive: true },
    { name: 'Meter', shortName: 'm', isActive: true },
    { name: 'Box', shortName: 'box', isActive: true },
    { name: 'Dozen', shortName: 'dz', isActive: true },
  ];
  const unitDocs = [];
  for (const u of unitsData) {
    let unit = await m.Unit.findOne({ shortName: u.shortName });
    if (!unit) unit = await m.Unit.create(u);
    unitDocs.push(unit);
  }
  console.log('✅ Units created:', unitDocs.length);

  // ─── Barcode Types ───
  const barcodeTypesData = [
    { name: 'EAN-13', description: 'European Article Number 13 digit', isActive: true },
    { name: 'UPC-A', description: 'Universal Product Code 12 digit', isActive: true },
    { name: 'Code-128', description: 'High density alphanumeric barcode', isActive: true },
    { name: 'QR Code', description: 'Quick Response code 2D', isActive: true },
  ];
  const barcodeTypeDocs = [];
  for (const bt of barcodeTypesData) {
    let doc = await m.BarcodeType.findOne({ name: bt.name });
    if (!doc) doc = await m.BarcodeType.create(bt);
    barcodeTypeDocs.push(doc);
  }
  console.log('✅ Barcode Types created:', barcodeTypeDocs.length);

  // ─── Tax Slabs ───
  const taxSlabsData = [
    { name: 'GST 0%', rate: 0, isActive: true },
    { name: 'GST 5%', rate: 5, isActive: true },
    { name: 'GST 12%', rate: 12, isActive: true },
    { name: 'GST 18%', rate: 18, isActive: true },
    { name: 'GST 28%', rate: 28, isActive: true },
  ];
  const taxSlabDocs = [];
  for (const ts of taxSlabsData) {
    let doc = await m.TaxSlab.findOne({ name: ts.name });
    if (!doc) doc = await m.TaxSlab.create(ts);
    taxSlabDocs.push(doc);
  }
  console.log('✅ Tax Slabs created:', taxSlabDocs.length);

  // ─── Warehouses ───
  const warehousesData = [
    { name: 'Main Warehouse', code: 'WH-MAIN', location: 'New York, NY', contactPerson: 'John Doe', phone: '+1-555-0101', isActive: true },
    { name: 'East Distribution', code: 'WH-EAST', location: 'Boston, MA', contactPerson: 'Jane Smith', phone: '+1-555-0102', isActive: true },
    { name: 'West Hub', code: 'WH-WEST', location: 'Los Angeles, CA', contactPerson: 'Mike Johnson', phone: '+1-555-0103', isActive: true },
  ];
  const warehouseDocs = [];
  for (const w of warehousesData) {
    let doc = await m.Warehouse.findOne({ code: w.code });
    if (!doc) doc = await m.Warehouse.create(w);
    warehouseDocs.push(doc);
  }
  console.log('✅ Warehouses created:', warehouseDocs.length);

  // ─── Categories ───
  const electronics = await upsertCategory(m, { name: 'Electronics', slug: 'electronics', sortOrder: 1 });
  const clothing = await upsertCategory(m, { name: 'Clothing', slug: 'clothing', sortOrder: 2 });
  const food = await upsertCategory(m, { name: 'Food & Beverages', slug: 'food-beverages', sortOrder: 3 });
  const phones = await upsertCategory(m, { name: 'Phones', slug: 'phones', sortOrder: 1, parentCategory: electronics._id });
  const laptops = await upsertCategory(m, { name: 'Laptops', slug: 'laptops', sortOrder: 2, parentCategory: electronics._id });
  const accessories = await upsertCategory(m, { name: 'Accessories', slug: 'accessories', sortOrder: 3, parentCategory: electronics._id });
  const menClothing = await upsertCategory(m, { name: 'Men', slug: 'men-clothing', sortOrder: 1, parentCategory: clothing._id });
  const womenClothing = await upsertCategory(m, { name: 'Women', slug: 'women-clothing', sortOrder: 2, parentCategory: clothing._id });
  console.log('✅ Categories created: 8');

  // ─── EcomSettings ───
  const ecomSettingsData = {
    /* Branding */
    storeName: 'Demo Store',
    tagline: 'Your Premium Shopping Destination',
    logo: 'https://picsum.photos/seed/logo/200/80',
    favicon: 'https://picsum.photos/seed/favicon/32/32',

    /* Colors & Theme */
    primaryColor: '#06b6d4',   // cyan-500
    secondaryColor: '#8b5cf6',  // violet-500
    accentColor: '#f59e0b',     // amber-500
    theme: 'glass',

    /* Hero / Banners */
    banners: [
      {
        title: 'Welcome to Demo Store',
        subtitle: 'Discover amazing products at great prices',
        image: 'https://picsum.photos/seed/banner1/1200/400',
        link: '/store/demo-store',
        isActive: true,
        sortOrder: 0,
      },
      {
        title: 'New Arrivals',
        subtitle: 'Check out our latest collection',
        image: 'https://picsum.photos/seed/banner2/1200/400',
        link: '/store/demo-store/categories/new-arrivals',
        isActive: true,
        sortOrder: 1,
      },
    ],

    /* Marquee / Alerts */
    marqueeText: 'Free shipping on orders over $50! 🎉',
    marqueeEnabled: true,
    saleAlertText: 'Flash Sale: 20% off on all electronics!',
    saleAlertEnabled: false,

    /* Layout */
    productsPerRow: 4,
    productsPerPage: 12,
    showFeatured: true,
    showCategories: true,

    /* Sections (dynamic homepage sections) */
    sections: [
      {
        type: 'featured',
        title: 'Featured Products',
        subtitle: 'Handpicked items just for you',
        isActive: true,
        sortOrder: 0,
        maxProducts: 8,
      },
      {
        type: 'category',
        title: 'Electronics',
        subtitle: 'Latest gadgets and tech',
        category: electronics._id,
        isActive: true,
        sortOrder: 1,
        maxProducts: 6,
      },
      {
        type: 'new_arrivals',
        title: 'New Arrivals',
        subtitle: 'Fresh products in stock',
        isActive: true,
        sortOrder: 2,
        maxProducts: 4,
      },
    ],

    /* Terms & Conditions */
    termsAndConditions: '<h2>Terms and Conditions</h2><p>By using our service, you agree to these terms...</p>',
    requireTermsOnSignup: true,
    requiredDocuments: [
      {
        name: 'ID Proof',
        description: 'Government issued ID for verification',
        required: true,
      },
    ],

    /* Footer */
    footerText: '© 2024 Demo Store. All rights reserved.',
    socialLinks: {
      facebook: 'https://facebook.com/demostore',
      instagram: 'https://instagram.com/demostore',
      twitter: 'https://twitter.com/demostore',
      youtube: 'https://youtube.com/demostore',
    },
  };

  let ecomSettings = await m.EcomSettings.findOne();
  if (!ecomSettings) {
    ecomSettings = await m.EcomSettings.create(ecomSettingsData);
    console.log('✅ EcomSettings created');
  } else {
    console.log('⏭  EcomSettings already exists');
  }

  // ─── Products (single + parent + variants) ───
  const productsData = [
    // Single products
    {
      name: 'iPhone 15 Pro', sku: 'IPHONE15PRO', type: 'single', slug: 'iphone-15-pro',
      categories: [electronics._id, phones._id], unit: unitDocs[0]._id,
      barcodeType: barcodeTypeDocs[0]._id, barcodeValue: '8901234567890',
      description: 'Apple iPhone 15 Pro with A17 Pro chip, 6.1" Liquid Retina XDR display, titanium design. 48MP main camera system with 3x optical zoom.',
      basePrice: 999, costPrice: 750, taxSlab: taxSlabDocs[3]._id,
      weight: 0.187, isActive: true, isFeatured: true, compareAtPrice: 1099,
      images: [
        { url: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=400&fit=crop', isPrimary: true, sortOrder: 0, altText: 'iPhone 15 Pro' },
        { url: 'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=400&h=400&fit=crop', isPrimary: false, sortOrder: 1, altText: 'iPhone 15 Pro Side' }
      ],
      tags: ['apple', 'smartphone', 'premium', '5g'],
    },
    {
      name: 'Samsung Galaxy S24', sku: 'GALAXYS24', type: 'single', slug: 'samsung-galaxy-s24',
      categories: [electronics._id, phones._id], unit: unitDocs[0]._id,
      barcodeType: barcodeTypeDocs[0]._id, barcodeValue: '8901234567891',
      description: 'Samsung Galaxy S24 with Snapdragon 8 Gen 3, 6.2" Dynamic AMOLED display, 50MP triple camera system.',
      basePrice: 799, costPrice: 580, taxSlab: taxSlabDocs[3]._id,
      weight: 0.168, isActive: true, isFeatured: true, compareAtPrice: 899,
      images: [
        { url: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&fit=crop', isPrimary: true, sortOrder: 0, altText: 'Galaxy S24' },
        { url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop', isPrimary: false, sortOrder: 1, altText: 'Galaxy S24 Display' }
      ],
      tags: ['samsung', 'smartphone', 'android', '5g'],
    },
    {
      name: 'MacBook Air M3', sku: 'MBA-M3', type: 'single', slug: 'macbook-air-m3',
      categories: [electronics._id, laptops._id], unit: unitDocs[0]._id,
      barcodeType: barcodeTypeDocs[0]._id, barcodeValue: '8901234567892',
      description: 'MacBook Air with M3 chip, 13.6" Liquid Retina display, 18-hour battery, 8GB RAM, 256GB SSD.',
      basePrice: 1099, costPrice: 850, taxSlab: taxSlabDocs[3]._id,
      weight: 1.24, isActive: true, isFeatured: true, compareAtPrice: 1199,
      images: [
        { url: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&h=400&fit=crop', isPrimary: true, sortOrder: 0, altText: 'MacBook Air M3' },
        { url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop', isPrimary: false, sortOrder: 1, altText: 'MacBook Air Open' }
      ],
      tags: ['apple', 'laptop', 'ultrabook', 'm3'],
    },
    {
      name: 'USB-C Cable 2m', sku: 'USBC-2M', type: 'single', slug: 'usb-c-cable-2m',
      categories: [electronics._id, accessories._id], unit: unitDocs[0]._id,
      barcodeType: barcodeTypeDocs[2]._id, barcodeValue: 'ACC001USBC',
      description: 'Fast charging USB-C to USB-C cable, 2 meters, braided nylon, supports 100W PD & USB 3.1 Gen 2.',
      basePrice: 12.99, costPrice: 3.50, taxSlab: taxSlabDocs[3]._id,
      weight: 0.05, isActive: true, isFeatured: false, compareAtPrice: 19.99,
      images: [
        { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop', isPrimary: true, sortOrder: 0, altText: 'USB-C Cable' }
      ],
      tags: ['cable', 'accessory', 'charging', 'usb-c'],
    },
    {
      name: 'Organic Green Tea', sku: 'ORG-GTEA', type: 'single', slug: 'organic-green-tea',
      categories: [food._id], unit: unitDocs[4]._id,
      barcodeType: barcodeTypeDocs[0]._id, barcodeValue: '8901234567895',
      description: 'Premium USDA-certified organic green tea. 100 biodegradable bags per box. Rich in antioxidants.',
      basePrice: 15.99, costPrice: 7.50, taxSlab: taxSlabDocs[1]._id,
      weight: 0.25, isActive: true, isFeatured: false, compareAtPrice: 0,
      images: [
        { url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=400&fit=crop', isPrimary: true, sortOrder: 0, altText: 'Organic Green Tea' }
      ],
      tags: ['tea', 'organic', 'healthy', 'beverage'],
    },
    {
      name: 'Wireless Bluetooth Headphones', sku: 'BT-HEADPHONES', type: 'single', slug: 'wireless-bluetooth-headphones',
      categories: [electronics._id, accessories._id], unit: unitDocs[0]._id,
      barcodeType: barcodeTypeDocs[0]._id, barcodeValue: '8901234567896',
      description: 'Premium wireless Bluetooth headphones with active noise cancellation, 30-hour battery life, and premium sound quality.',
      basePrice: 149.99, costPrice: 85, taxSlab: taxSlabDocs[3]._id,
      weight: 0.3, isActive: true, isFeatured: true, compareAtPrice: 199.99,
      images: [
        { url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop', isPrimary: true, sortOrder: 0, altText: 'Wireless Headphones' },
        { url: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&h=400&fit=crop', isPrimary: false, sortOrder: 1, altText: 'Headphones Detail' }
      ],
      tags: ['headphones', 'bluetooth', 'wireless', 'audio'],
    },
    {
      name: 'Gaming Mechanical Keyboard', sku: 'MECH-KEYBOARD', type: 'single', slug: 'gaming-mechanical-keyboard',
      categories: [electronics._id, accessories._id], unit: unitDocs[0]._id,
      barcodeType: barcodeTypeDocs[0]._id, barcodeValue: '8901234567897',
      description: 'RGB backlit mechanical gaming keyboard with Cherry MX switches, programmable keys, and aluminum frame.',
      basePrice: 89.99, costPrice: 45, taxSlab: taxSlabDocs[3]._id,
      weight: 0.8, isActive: true, isFeatured: false, compareAtPrice: 129.99,
      images: [
        { url: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=400&h=400&fit=crop', isPrimary: true, sortOrder: 0, altText: 'Mechanical Keyboard' }
      ],
      tags: ['keyboard', 'gaming', 'mechanical', 'rgb'],
    },
    {
      name: 'Smart Watch Series 8', sku: 'SMARTWATCH-8', type: 'single', slug: 'smart-watch-series-8',
      categories: [electronics._id, accessories._id], unit: unitDocs[0]._id,
      barcodeType: barcodeTypeDocs[0]._id, barcodeValue: '8901234567898',
      description: 'Advanced smartwatch with health monitoring, GPS, heart rate sensor, and 7-day battery life.',
      basePrice: 299.99, costPrice: 180, taxSlab: taxSlabDocs[3]._id,
      weight: 0.05, isActive: true, isFeatured: true, compareAtPrice: 349.99,
      images: [
        { url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', isPrimary: true, sortOrder: 0, altText: 'Smart Watch' }
      ],
      tags: ['smartwatch', 'fitness', 'health', 'wearable'],
    },
  ];

  // Parent product (Sneakers with color+size variants)
  const sneakersParentData = {
    name: 'Premium Running Sneakers', sku: 'SNEAKERS-PARENT', type: 'parent', slug: 'premium-running-sneakers',
    categories: [clothing._id, menClothing._id], unit: unitDocs[0]._id,
    description: 'Premium running sneakers with breathable mesh upper, cushioned sole, and lightweight design. Available in multiple colors and sizes.',
    basePrice: 89.99, costPrice: 35, taxSlab: taxSlabDocs[1]._id,
    weight: 0.4, isActive: true, isFeatured: true, compareAtPrice: 119.99,
    images: [
      { url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop', isPrimary: true, sortOrder: 0, altText: 'Premium Running Sneakers' },
      { url: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=400&fit=crop', isPrimary: false, sortOrder: 1, altText: 'Sneakers Side View' }
    ],
    tags: ['sneakers', 'running', 'sports', 'comfortable'],
  };

  const sneakersVariantsData = [
    // Black variants
    { name: 'Premium Running Sneakers - Black - Size 7', sku: 'SNEAKERS-BLK-7', variantAttribute: 'Color|Size', variantValue: 'Black|7', basePrice: 89.99, costPrice: 35 },
    { name: 'Premium Running Sneakers - Black - Size 8', sku: 'SNEAKERS-BLK-8', variantAttribute: 'Color|Size', variantValue: 'Black|8', basePrice: 89.99, costPrice: 35 },
    { name: 'Premium Running Sneakers - Black - Size 9', sku: 'SNEAKERS-BLK-9', variantAttribute: 'Color|Size', variantValue: 'Black|9', basePrice: 89.99, costPrice: 35 },
    { name: 'Premium Running Sneakers - Black - Size 10', sku: 'SNEAKERS-BLK-10', variantAttribute: 'Color|Size', variantValue: 'Black|10', basePrice: 89.99, costPrice: 35 },
    { name: 'Premium Running Sneakers - Black - Size 11', sku: 'SNEAKERS-BLK-11', variantAttribute: 'Color|Size', variantValue: 'Black|11', basePrice: 89.99, costPrice: 35 },

    // White variants
    { name: 'Premium Running Sneakers - White - Size 7', sku: 'SNEAKERS-WHT-7', variantAttribute: 'Color|Size', variantValue: 'White|7', basePrice: 89.99, costPrice: 35 },
    { name: 'Premium Running Sneakers - White - Size 8', sku: 'SNEAKERS-WHT-8', variantAttribute: 'Color|Size', variantValue: 'White|8', basePrice: 89.99, costPrice: 35 },
    { name: 'Premium Running Sneakers - White - Size 9', sku: 'SNEAKERS-WHT-9', variantAttribute: 'Color|Size', variantValue: 'White|9', basePrice: 89.99, costPrice: 35 },
    { name: 'Premium Running Sneakers - White - Size 10', sku: 'SNEAKERS-WHT-10', variantAttribute: 'Color|Size', variantValue: 'White|10', basePrice: 89.99, costPrice: 35 },
    { name: 'Premium Running Sneakers - White - Size 11', sku: 'SNEAKERS-WHT-11', variantAttribute: 'Color|Size', variantValue: 'White|11', basePrice: 89.99, costPrice: 35 },

    // Blue variants
    { name: 'Premium Running Sneakers - Blue - Size 7', sku: 'SNEAKERS-BLU-7', variantAttribute: 'Color|Size', variantValue: 'Blue|7', basePrice: 94.99, costPrice: 37 },
    { name: 'Premium Running Sneakers - Blue - Size 8', sku: 'SNEAKERS-BLU-8', variantAttribute: 'Color|Size', variantValue: 'Blue|8', basePrice: 94.99, costPrice: 37 },
    { name: 'Premium Running Sneakers - Blue - Size 9', sku: 'SNEAKERS-BLU-9', variantAttribute: 'Color|Size', variantValue: 'Blue|9', basePrice: 94.99, costPrice: 37 },
    { name: 'Premium Running Sneakers - Blue - Size 10', sku: 'SNEAKERS-BLU-10', variantAttribute: 'Color|Size', variantValue: 'Blue|10', basePrice: 94.99, costPrice: 37 },
    { name: 'Premium Running Sneakers - Blue - Size 11', sku: 'SNEAKERS-BLU-11', variantAttribute: 'Color|Size', variantValue: 'Blue|11', basePrice: 94.99, costPrice: 37 },
  ];

  // Create / update all products (upsert so images always refresh)
  const productDocs = [];
  for (const pd of productsData) {
    const prod = await m.Product.findOneAndUpdate(
      { sku: pd.sku },
      { $set: pd },
      { upsert: true, new: true }
    );
    productDocs.push(prod);
  }

  // Create / update parent
  const sneakersParent = await m.Product.findOneAndUpdate(
    { sku: sneakersParentData.sku },
    { $set: sneakersParentData },
    { upsert: true, new: true }
  );
  productDocs.push(sneakersParent);

  // Create / update variants
  const variantDocs = [];
  for (const v of sneakersVariantsData) {
    const variantData = {
      ...v, type: 'variant', parentProduct: sneakersParent._id,
      categories: sneakersParentData.categories, unit: sneakersParentData.unit,
      taxSlab: sneakersParentData.taxSlab, slug: v.sku.toLowerCase(),
      isActive: true, images: [{ url: `https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop`, isPrimary: true, sortOrder: 0 }],
      tags: ['sneakers', 'running', 'sports', 'variant'],
    };
    const variant = await m.Product.findOneAndUpdate(
      { sku: v.sku },
      { $set: variantData },
      { upsert: true, new: true }
    );
    variantDocs.push(variant);
    productDocs.push(variant);
  }
  console.log('✅ Products created:', productDocs.length, `(including ${variantDocs.length} variants)`);

  // ─── Customers ───
  const customersData = [
    {
      name: 'Alice Johnson', email: 'alice@example.com', phone: '+1-555-1001', password: hashedPassword,
      tier: 'retail', creditLimit: 5000, currentBalance: 200, isActive: true,
      addresses: [
        { label: 'Home', line1: '123 Main St', city: 'New York', state: 'NY', zip: '10001', country: 'US', isDefault: true },
        { label: 'Work', line1: '456 Business Ave', city: 'New York', state: 'NY', zip: '10002', country: 'US', isDefault: false },
      ],
    },
    {
      name: 'Bob Smith', email: 'bob@example.com', phone: '+1-555-1002', password: hashedPassword,
      tier: 'wholesale', creditLimit: 20000, currentBalance: 500, isActive: true,
      addresses: [
        { label: 'Warehouse', line1: '789 Industrial Blvd', city: 'Chicago', state: 'IL', zip: '60601', country: 'US', isDefault: true },
      ],
    },
    {
      name: 'Carol Davis', email: 'carol@example.com', phone: '+1-555-1003', password: hashedPassword,
      tier: 'vip', creditLimit: 50000, currentBalance: 1000, isActive: true,
      addresses: [
        { label: 'Home', line1: '321 Luxury Lane', city: 'Beverly Hills', state: 'CA', zip: '90210', country: 'US', isDefault: true },
      ],
    },
    {
      name: 'David Wilson', email: 'david@example.com', phone: '+1-555-1004', password: hashedPassword,
      tier: 'retail', creditLimit: 2000, currentBalance: 0, isActive: true,
      addresses: [
        { label: 'Home', line1: '555 Oak Drive', city: 'Austin', state: 'TX', zip: '73301', country: 'US', isDefault: true },
      ],
    },
  ];
  const customerDocs = [];
  for (const c of customersData) {
    let cust = await m.Customer.findOne({ email: c.email });
    if (!cust) cust = await m.Customer.create(c);
    customerDocs.push(cust);
  }
  console.log('✅ Customers created:', customerDocs.length);

  // ─── Suppliers ───
  const suppliersData = [
    {
      name: 'TechParts Global', email: 'orders@techparts.com', phone: '+1-555-2001',
      address: { line1: '100 Supply Chain Road', city: 'Shenzhen', state: 'GD', zip: '518000', country: 'CN' },
      gstNumber: 'GST-TECH-001', paymentTerms: 'Net 30', creditLimit: 100000, currentBalance: 0, isActive: true,
    },
    {
      name: 'Fashion Fabrics Inc', email: 'buy@fashionfabrics.com', phone: '+1-555-2002',
      address: { line1: '200 Textile Park', city: 'Mumbai', state: 'MH', zip: '400001', country: 'IN' },
      gstNumber: 'GST-FASH-001', paymentTerms: 'Net 15', creditLimit: 50000, currentBalance: 0, isActive: true,
    },
    {
      name: 'Organic Foods Co', email: 'supply@organicfoods.com', phone: '+1-555-2003',
      address: { line1: '300 Farm Road', city: 'Portland', state: 'OR', zip: '97201', country: 'US' },
      gstNumber: 'GST-ORGF-001', paymentTerms: 'Immediate', creditLimit: 20000, currentBalance: 0, isActive: true,
    },
  ];
  const supplierDocs = [];
  for (const s of suppliersData) {
    let sup = await m.Supplier.findOne({ email: s.email });
    if (!sup) sup = await m.Supplier.create(s);
    supplierDocs.push(sup);
  }
  console.log('✅ Suppliers created:', supplierDocs.length);

  // ─── Product Stock ───
  const allStockProducts = productDocs.filter(p => p.type !== 'parent');
  const stockEntries = [];
  for (const prod of allStockProducts) {
    for (let i = 0; i < warehouseDocs.length; i++) {
      const wh = warehouseDocs[i];
      const qty = 50 + Math.floor(Math.random() * 200);
      let existing = await m.ProductStock.findOne({ product: prod._id, warehouse: wh._id });
      if (!existing) {
        existing = await m.ProductStock.create({
          product: prod._id, warehouse: wh._id,
          quantity: qty, reservedQuantity: 0,
          supplierPrice: i === 0 ? null : Math.round(prod.basePrice * (1 + (i * 0.05)) * 100) / 100,
          lowStockThreshold: 10,
        });
      }
      stockEntries.push(existing);
    }
  }
  console.log('✅ Product Stock entries created:', stockEntries.length);

  // ─── Stock Movements (opening stock) ───
  for (const se of stockEntries) {
    const exists = await m.StockMovement.findOne({ product: se.product, warehouse: se.warehouse, movementType: 'opening_stock' });
    if (!exists) {
      await m.StockMovement.create({
        product: se.product, warehouse: se.warehouse,
        movementType: 'opening_stock', quantityBefore: 0,
        quantityChange: se.quantity, quantityAfter: se.quantity,
        referenceType: 'manual', referenceNumber: 'OPENING',
        notes: 'Initial stock seeded', createdBy: adminUser._id,
      });
    }
  }
  console.log('✅ Stock Movements (opening) created');

  // ─── Customer Tier Prices ───
  const tierPricesData = [
    { product: productDocs[0]._id, tier: 'wholesale', price: 899, minQty: 1 },
    { product: productDocs[0]._id, tier: 'wholesale', price: 849, minQty: 10 },
    { product: productDocs[0]._id, tier: 'vip', price: 879, minQty: 1 },
    { product: productDocs[1]._id, tier: 'wholesale', price: 699, minQty: 1 },
    { product: productDocs[1]._id, tier: 'vip', price: 749, minQty: 1 },
    { product: productDocs[2]._id, tier: 'wholesale', price: 999, minQty: 1 },
  ];
  let tpCreated = 0;
  for (const tp of tierPricesData) {
    const exists = await m.CustomerTierPrice.findOne({ product: tp.product, tier: tp.tier, minQty: tp.minQty });
    if (!exists) {
      await m.CustomerTierPrice.create(tp);
      tpCreated++;
    }
  }
  console.log('✅ Customer Tier Prices created:', tpCreated);

  // ─── Coupons ───
  const couponsData = [
    {
      code: 'WELCOME10', description: '10% off for new customers', discountType: 'percentage',
      discountValue: 10, maxDiscountAmount: 100, minOrderValue: 50,
      usageLimit: 500, usedCount: 0, applicableTo: 'all', isActive: true,
      validFrom: new Date('2024-01-01'), validUntil: new Date('2025-12-31'),
    },
    {
      code: 'FLAT50', description: '$50 flat discount on orders above $500', discountType: 'flat',
      discountValue: 50, maxDiscountAmount: null, minOrderValue: 500,
      usageLimit: 100, usedCount: 0, applicableTo: 'all', isActive: true,
      validFrom: new Date('2024-01-01'), validUntil: new Date('2025-12-31'),
    },
    {
      code: 'VIP20', description: '20% VIP discount', discountType: 'percentage',
      discountValue: 20, maxDiscountAmount: 500, minOrderValue: 100,
      usageLimit: null, usedCount: 5, applicableTo: 'all', isActive: true,
      validFrom: new Date('2024-06-01'), validUntil: new Date('2025-12-31'),
    },
    {
      code: 'EXPIRED01', description: 'Expired test coupon', discountType: 'flat',
      discountValue: 10, maxDiscountAmount: null, minOrderValue: 0,
      usageLimit: 10, usedCount: 10, applicableTo: 'all', isActive: false,
      validFrom: new Date('2023-01-01'), validUntil: new Date('2023-12-31'),
    },
  ];
  let couponCreated = 0;
  for (const c of couponsData) {
    const exists = await m.Coupon.findOne({ code: c.code });
    if (!exists) { await m.Coupon.create(c); couponCreated++; }
  }
  console.log('✅ Coupons created:', couponCreated);

  // ─── Purchase Orders ───
  // PO1: ordered, partially received
  const po1 = await createIfNotExists(m.PurchaseOrder, { poNumber: 'PO-00001' }, {
    poNumber: 'PO-00001', supplier: supplierDocs[0]._id, warehouse: warehouseDocs[0]._id,
    status: 'partial', orderDate: daysAgo(30), expectedDate: daysAgo(15),
    items: [
      { product: productDocs[0]._id, orderedQty: 50, receivedQty: 30, unitCost: 750, lineTotal: 37500 },
      { product: productDocs[1]._id, orderedQty: 30, receivedQty: 0, unitCost: 580, lineTotal: 17400 },
    ],
    subtotal: 54900, taxTotal: 9882, grandTotal: 64782, amountPaid: 30000, balanceDue: 34782,
    notes: 'Bulk phone order Q1', createdBy: adminUser._id,
  });

  // PO2: received fully
  const po2 = await createIfNotExists(m.PurchaseOrder, { poNumber: 'PO-00002' }, {
    poNumber: 'PO-00002', supplier: supplierDocs[1]._id, warehouse: warehouseDocs[0]._id,
    status: 'received', orderDate: daysAgo(60), expectedDate: daysAgo(45),
    items: [
      { product: productDocs[5]._id, orderedQty: 200, receivedQty: 200, unitCost: 10, lineTotal: 2000 },
    ],
    subtotal: 2000, taxTotal: 100, grandTotal: 2100, amountPaid: 2100, balanceDue: 0,
    notes: 'T-Shirt restock', createdBy: adminUser._id,
  });

  // PO3: draft
  const po3 = await createIfNotExists(m.PurchaseOrder, { poNumber: 'PO-00003' }, {
    poNumber: 'PO-00003', supplier: supplierDocs[2]._id, warehouse: warehouseDocs[1]._id,
    status: 'draft', orderDate: daysAgo(2), expectedDate: daysFromNow(14),
    items: [
      { product: productDocs[4]._id, orderedQty: 100, receivedQty: 0, unitCost: 7.5, lineTotal: 750 },
    ],
    subtotal: 750, taxTotal: 37.5, grandTotal: 787.5, amountPaid: 0, balanceDue: 787.5,
    notes: 'Green tea quarterly order', createdBy: managerUser._id,
  });

  // Update counter
  await m.Counter.findByIdAndUpdate('purchase_order', { seq: 3 }, { upsert: true });
  console.log('✅ Purchase Orders created: 3');

  // ─── GRNs ───
  const grn1 = await createIfNotExists(m.GRN, { grnNumber: 'GRN-00001' }, {
    grnNumber: 'GRN-00001', purchaseOrder: po1._id, supplier: supplierDocs[0]._id, warehouse: warehouseDocs[0]._id,
    items: [
      { product: productDocs[0]._id, receivedQty: 30, unitCost: 750, lineTotal: 22500 },
    ],
    totalValue: 22500, status: 'approved', receivedDate: daysAgo(20),
    notes: 'Partial shipment - iPhones only', approvedBy: managerUser._id, approvedAt: daysAgo(19),
    createdBy: warehouseUser._id,
  });

  const grn2 = await createIfNotExists(m.GRN, { grnNumber: 'GRN-00002' }, {
    grnNumber: 'GRN-00002', purchaseOrder: po2._id, supplier: supplierDocs[1]._id, warehouse: warehouseDocs[0]._id,
    items: [
      { product: productDocs[5]._id, receivedQty: 200, unitCost: 10, lineTotal: 2000 },
    ],
    totalValue: 2000, status: 'approved', receivedDate: daysAgo(45),
    notes: 'Full T-Shirt delivery', approvedBy: managerUser._id, approvedAt: daysAgo(44),
    createdBy: warehouseUser._id,
  });

  await m.Counter.findByIdAndUpdate('grn', { seq: 2 }, { upsert: true });
  console.log('✅ GRNs created: 2');

  // ─── Purchase Returns ───
  const pr1 = await createIfNotExists(m.PurchaseReturn, { returnNumber: 'PRR-00001' }, {
    returnNumber: 'PRR-00001', purchaseOrder: po2._id, supplier: supplierDocs[1]._id, warehouse: warehouseDocs[0]._id,
    items: [
      { product: productDocs[5]._id, returnQty: 5, reason: 'Defective stitching', unitCost: 10, lineTotal: 50 },
    ],
    totalValue: 50, status: 'approved', notes: 'QC failed items', createdBy: warehouseUser._id,
  });

  await m.Counter.findByIdAndUpdate('purchase_return', { seq: 1 }, { upsert: true });
  console.log('✅ Purchase Returns created: 1');

  // ─── Supplier Ledger Entries ───
  let slBalance = 0;
  // GRN1 approved → debit (we owe supplier)
  slBalance += 22500;
  await createIfNotExists(m.SupplierLedger, { referenceNumber: 'GRN-00001', supplier: supplierDocs[0]._id }, {
    supplier: supplierDocs[0]._id, transactionType: 'purchase_invoice',
    referenceType: 'grn', referenceId: grn1._id, referenceNumber: 'GRN-00001',
    debit: 22500, credit: 0, balanceAfter: slBalance,
    narration: 'GRN-00001 approved - goods received', createdBy: managerUser._id,
  });

  // Supplier payment
  slBalance -= 10000;
  await createIfNotExists(m.SupplierLedger, { referenceNumber: 'SP-SEED-001', supplier: supplierDocs[0]._id }, {
    supplier: supplierDocs[0]._id, transactionType: 'payment',
    referenceType: 'payment', referenceNumber: 'SP-SEED-001',
    debit: 0, credit: 10000, balanceAfter: slBalance,
    narration: 'Partial payment for GRN-00001', createdBy: accountantUser._id,
  });

  // Update supplier balance
  await m.Supplier.findByIdAndUpdate(supplierDocs[0]._id, { currentBalance: slBalance });

  // GRN2 + return for supplier[1]
  let sl2Balance = 0;
  sl2Balance += 2000;
  await createIfNotExists(m.SupplierLedger, { referenceNumber: 'GRN-00002', supplier: supplierDocs[1]._id }, {
    supplier: supplierDocs[1]._id, transactionType: 'purchase_invoice',
    referenceType: 'grn', referenceId: grn2._id, referenceNumber: 'GRN-00002',
    debit: 2000, credit: 0, balanceAfter: sl2Balance,
    narration: 'GRN-00002 approved - goods received', createdBy: managerUser._id,
  });
  // Payment
  sl2Balance -= 2000;
  await createIfNotExists(m.SupplierLedger, { referenceNumber: 'SP-SEED-002', supplier: supplierDocs[1]._id }, {
    supplier: supplierDocs[1]._id, transactionType: 'payment',
    referenceType: 'payment', referenceNumber: 'SP-SEED-002',
    debit: 0, credit: 2000, balanceAfter: sl2Balance,
    narration: 'Full payment for GRN-00002', createdBy: accountantUser._id,
  });
  // Return credit
  sl2Balance -= 50;
  await createIfNotExists(m.SupplierLedger, { referenceNumber: 'PRR-00001', supplier: supplierDocs[1]._id }, {
    supplier: supplierDocs[1]._id, transactionType: 'credit_note',
    referenceType: 'return', referenceId: pr1._id, referenceNumber: 'PRR-00001',
    debit: 0, credit: 50, balanceAfter: sl2Balance,
    narration: 'Purchase return PRR-00001', createdBy: warehouseUser._id,
  });
  await m.Supplier.findByIdAndUpdate(supplierDocs[1]._id, { currentBalance: sl2Balance });
  console.log('✅ Supplier Ledger entries created');

  // ─── Orders ───
  const order1 = await createIfNotExists(m.Order, { orderNumber: 'ORD-00001' }, {
    orderNumber: 'ORD-00001', customer: customerDocs[0]._id, warehouse: warehouseDocs[0]._id,
    status: 'delivered', orderDate: daysAgo(20),
    items: [
      {
        product: productDocs[0]._id,
        productSnapshot: { name: 'iPhone 15 Pro', sku: 'IPHONE15PRO', barcodeValue: '8901234567890', unitName: 'pcs', image: 'https://picsum.photos/seed/iphone15/400/400' },
        quantity: 1, unitPrice: 999, taxSlab: { name: 'GST 18%', rate: 18 },
        taxAmount: 179.82, lineTotal: 999,
      },
      {
        product: productDocs[3]._id,
        productSnapshot: { name: 'USB-C Cable 2m', sku: 'USBC-2M', barcodeValue: 'ACC001USBC', unitName: 'pcs', image: 'https://picsum.photos/seed/usbcable/400/400' },
        quantity: 2, unitPrice: 12.99, taxSlab: { name: 'GST 18%', rate: 18 },
        taxAmount: 4.68, lineTotal: 25.98,
      },
    ],
    subtotal: 1024.98, taxTotal: 184.50, discountAmount: 0, couponCode: null, couponDiscount: 0,
    grandTotal: 1209.48, amountPaid: 1209.48, balanceDue: 0, paymentStatus: 'paid',
    shippingAddress: { label: 'Home', line1: '123 Main St', city: 'New York', state: 'NY', zip: '10001', country: 'US' },
    statusHistory: [
      { status: 'placed', changedAt: daysAgo(20) },
      { status: 'processing', changedAt: daysAgo(19), changedBy: adminUser._id },
      { status: 'shipped', changedAt: daysAgo(18), changedBy: warehouseUser._id },
      { status: 'delivered', changedAt: daysAgo(15) },
    ],
    notes: 'Gift wrap requested', createdBy: null,
  });

  const order2 = await createIfNotExists(m.Order, { orderNumber: 'ORD-00002' }, {
    orderNumber: 'ORD-00002', customer: customerDocs[1]._id, warehouse: warehouseDocs[0]._id,
    status: 'processing', orderDate: daysAgo(3),
    items: [
      {
        product: productDocs[1]._id,
        productSnapshot: { name: 'Samsung Galaxy S24', sku: 'GALAXYS24', barcodeValue: '8901234567891', unitName: 'pcs', image: 'https://picsum.photos/seed/galaxy24/400/400' },
        quantity: 5, unitPrice: 699, taxSlab: { name: 'GST 18%', rate: 18 },
        taxAmount: 629.10, lineTotal: 3495,
      },
    ],
    subtotal: 3495, taxTotal: 629.10, discountAmount: 0, couponCode: null, couponDiscount: 0,
    grandTotal: 4124.10, amountPaid: 2000, balanceDue: 2124.10, paymentStatus: 'partial',
    shippingAddress: { label: 'Warehouse', line1: '789 Industrial Blvd', city: 'Chicago', state: 'IL', zip: '60601', country: 'US' },
    statusHistory: [
      { status: 'placed', changedAt: daysAgo(3) },
      { status: 'processing', changedAt: daysAgo(2), changedBy: adminUser._id },
    ],
    notes: 'Wholesale order - bulk pricing', createdBy: null,
  });

  const order3 = await createIfNotExists(m.Order, { orderNumber: 'ORD-00003' }, {
    orderNumber: 'ORD-00003', customer: customerDocs[2]._id, warehouse: warehouseDocs[0]._id,
    status: 'placed', orderDate: daysAgo(1),
    items: [
      {
        product: productDocs[2]._id,
        productSnapshot: { name: 'MacBook Air M3', sku: 'MBA-M3', barcodeValue: '8901234567892', unitName: 'pcs', image: 'https://picsum.photos/seed/macbookair/400/400' },
        quantity: 1, unitPrice: 1099, taxSlab: { name: 'GST 18%', rate: 18 },
        taxAmount: 197.82, lineTotal: 1099,
      },
    ],
    subtotal: 1099, taxTotal: 197.82, discountAmount: 109.90,
    couponCode: 'WELCOME10', couponDiscount: 109.90,
    grandTotal: 1186.92, amountPaid: 1000, balanceDue: 186.92, paymentStatus: 'partial',
    shippingAddress: { label: 'Home', line1: '321 Luxury Lane', city: 'Beverly Hills', state: 'CA', zip: '90210', country: 'US' },
    statusHistory: [
      { status: 'placed', changedAt: daysAgo(1) },
    ],
    notes: 'VIP customer - priority shipping', createdBy: null,
  });

  const order4 = await createIfNotExists(m.Order, { orderNumber: 'ORD-00004' }, {
    orderNumber: 'ORD-00004', customer: customerDocs[3]._id, warehouse: warehouseDocs[1]._id,
    status: 'cancelled', orderDate: daysAgo(10),
    items: [
      {
        product: productDocs[4]._id,
        productSnapshot: { name: 'Organic Green Tea', sku: 'ORG-GTEA', barcodeValue: '8901234567895', unitName: 'box', image: 'https://picsum.photos/seed/greentea1/400/400' },
        quantity: 3, unitPrice: 15.99, taxSlab: { name: 'GST 5%', rate: 5 },
        taxAmount: 2.40, lineTotal: 47.97,
      },
    ],
    subtotal: 47.97, taxTotal: 2.40, discountAmount: 0, couponCode: null, couponDiscount: 0,
    grandTotal: 50.37, amountPaid: 0, balanceDue: 50.37, paymentStatus: 'unpaid',
    shippingAddress: { label: 'Home', line1: '555 Oak Drive', city: 'Austin', state: 'TX', zip: '73301', country: 'US' },
    statusHistory: [
      { status: 'placed', changedAt: daysAgo(10) },
      { status: 'cancelled', changedAt: daysAgo(9), note: 'Cancelled by customer' },
    ],
    notes: 'Customer cancelled', createdBy: null,
  });

  await m.Counter.findByIdAndUpdate('order', { seq: 4 }, { upsert: true });
  console.log('✅ Orders created: 4');

  // ─── Order Payments ───
  await createIfNotExists(m.OrderPayment, { order: order1._id, amount: 1209.48 }, {
    order: order1._id, customer: customerDocs[0]._id, amount: 1209.48,
    method: 'card', reference: 'TXN-CC-001', paymentDate: daysAgo(20),
    notes: 'Full payment at checkout', createdBy: cashierUser._id,
  });

  await createIfNotExists(m.OrderPayment, { order: order2._id, amount: 2000 }, {
    order: order2._id, customer: customerDocs[1]._id, amount: 2000,
    method: 'bank_transfer', reference: 'BANK-TXN-001', paymentDate: daysAgo(3),
    notes: 'Partial payment - balance pending', createdBy: accountantUser._id,
  });

  await createIfNotExists(m.OrderPayment, { order: order3._id, amount: 1000 }, {
    order: order3._id, customer: customerDocs[2]._id, amount: 1000,
    method: 'split', paymentDate: daysAgo(1),
    splitMethods: [
      { method: 'credit', amount: 500, reference: 'WALLET' },
      { method: 'card', amount: 500, reference: 'TXN-CC-002' },
    ],
    notes: 'Split payment - wallet + card', createdBy: null,
  });
  console.log('✅ Order Payments created: 3');

  // ─── Customer Ledger Entries ───
  // Alice - opening balance + order paid
  let aliceBalance = 200;
  await createIfNotExists(m.CustomerLedger, { customer: customerDocs[0]._id, transactionType: 'opening_balance' }, {
    customer: customerDocs[0]._id, transactionType: 'opening_balance',
    referenceType: 'manual', referenceNumber: 'OPENING',
    debit: 0, credit: 200, balanceAfter: aliceBalance,
    narration: 'Opening balance', createdBy: accountantUser._id,
  });

  // Bob - opening balance
  let bobBalance = 500;
  await createIfNotExists(m.CustomerLedger, { customer: customerDocs[1]._id, transactionType: 'opening_balance' }, {
    customer: customerDocs[1]._id, transactionType: 'opening_balance',
    referenceType: 'manual', referenceNumber: 'OPENING',
    debit: 0, credit: 500, balanceAfter: bobBalance,
    narration: 'Opening balance', createdBy: accountantUser._id,
  });

  // Carol - opening balance + topup
  let carolBalance = 1000;
  await createIfNotExists(m.CustomerLedger, { customer: customerDocs[2]._id, transactionType: 'opening_balance' }, {
    customer: customerDocs[2]._id, transactionType: 'opening_balance',
    referenceType: 'manual', referenceNumber: 'OPENING',
    debit: 0, credit: 500, balanceAfter: 500,
    narration: 'Opening balance', createdBy: accountantUser._id,
  });
  await createIfNotExists(m.CustomerLedger, { customer: customerDocs[2]._id, transactionType: 'balance_topup' }, {
    customer: customerDocs[2]._id, transactionType: 'balance_topup',
    referenceType: 'topup', referenceNumber: 'TOPUP-SEED-001',
    debit: 0, credit: 500, balanceAfter: carolBalance,
    narration: 'VIP topup', createdBy: accountantUser._id,
  });
  console.log('✅ Customer Ledger entries created');

  // ─── Customer Topups ───
  await createIfNotExists(m.CustomerTopup, { topupNumber: 'TOPUP-SEED-001' }, {
    topupNumber: 'TOPUP-SEED-001', customer: customerDocs[2]._id, amount: 500,
    type: 'topup', method: 'bank_transfer', reference: 'BANK-TOPUP-001',
    narration: 'VIP balance topup', balanceBefore: 500, balanceAfter: 1000,
    createdBy: accountantUser._id,
  });
  await m.Counter.findByIdAndUpdate('customer_topup', { seq: 1 }, { upsert: true });
  console.log('✅ Customer Topups created: 1');

  // ─── Supplier Payments ───
  await createIfNotExists(m.SupplierPayment, { paymentNumber: 'SP-SEED-001' }, {
    paymentNumber: 'SP-SEED-001', supplier: supplierDocs[0]._id,
    amount: 10000, method: 'bank_transfer', reference: 'BANK-PAY-001',
    paymentDate: daysAgo(15), narration: 'Partial payment for PO-00001',
    balanceBefore: 22500, balanceAfter: 12500, createdBy: accountantUser._id,
  });
  await createIfNotExists(m.SupplierPayment, { paymentNumber: 'SP-SEED-002' }, {
    paymentNumber: 'SP-SEED-002', supplier: supplierDocs[1]._id,
    amount: 2000, method: 'bank_transfer', reference: 'BANK-PAY-002',
    paymentDate: daysAgo(40), narration: 'Full payment for PO-00002',
    balanceBefore: 2000, balanceAfter: 0, createdBy: accountantUser._id,
  });
  await m.Counter.findByIdAndUpdate('supplier_payment', { seq: 2 }, { upsert: true });
  console.log('✅ Supplier Payments created: 2');

  // ─── Stock Transfers ───
  await createIfNotExists(m.StockTransfer, { transferNumber: 'STR-00001' }, {
    transferNumber: 'STR-00001',
    fromWarehouse: warehouseDocs[0]._id, toWarehouse: warehouseDocs[1]._id,
    status: 'completed',
    items: [
      { product: productDocs[0]._id, requestedQty: 10, transferredQty: 10, notes: 'Boston needs stock' },
    ],
    notes: 'Transfer iPhones to East warehouse', createdBy: warehouseUser._id,
    completedBy: warehouseUser._id, completedAt: daysAgo(10),
  });
  await m.Counter.findByIdAndUpdate('stock_transfer', { seq: 1 }, { upsert: true });
  console.log('✅ Stock Transfers created: 1');

  // ─── Stock Adjustments ───
  const stockForAdj = stockEntries.find(s =>
    s.product.toString() === productDocs[3]._id.toString() && s.warehouse.toString() === warehouseDocs[0]._id.toString()
  );
  if (stockForAdj) {
    await createIfNotExists(m.StockAdjustment, { adjustmentNumber: 'ADJ-00001' }, {
      adjustmentNumber: 'ADJ-00001', warehouse: warehouseDocs[0]._id, product: productDocs[3]._id,
      quantityBefore: stockForAdj.quantity, adjustedQuantity: 5,
      quantityAfter: stockForAdj.quantity - 5, adjustmentType: 'decrease',
      reason: 'damage', notes: 'Damaged USB cables found in inspection',
      createdBy: warehouseUser._id,
    });
  }
  await m.Counter.findByIdAndUpdate('stock_adjustment', { seq: 1 }, { upsert: true });
  console.log('✅ Stock Adjustments created: 1');

  // ─── Order Returns ───
  await createIfNotExists(m.OrderReturn, { returnNumber: 'RET-00001' }, {
    returnNumber: 'RET-00001', order: order1._id, customer: customerDocs[0]._id,
    returnType: 'partial',
    items: [
      {
        lineItemId: order1.items[1]._id,
        product: productDocs[3]._id,
        returnQty: 1, reason: 'Cable too short', condition: 'good',
      },
    ],
    returnWarehouse: warehouseDocs[0]._id, refundAmount: 12.99,
    refundMethod: 'ledger_credit', status: 'completed',
    notes: 'Customer returned 1 cable', createdBy: adminUser._id,
  });
  await m.Counter.findByIdAndUpdate('order_return', { seq: 1 }, { upsert: true });
  console.log('✅ Order Returns created: 1');

  // ─── Notifications ───
  const notificationsData = [
    { user: adminUser._id, title: 'Low stock alert', message: 'USB-C Cable stock below threshold at Main Warehouse', type: 'warning', isRead: false },
    { user: adminUser._id, title: 'New order received', message: 'Order ORD-00003 placed by Carol Davis (VIP)', type: 'info', isRead: false },
    { user: managerUser._id, title: 'GRN pending approval', message: 'GRN-00001 is ready for review', type: 'info', isRead: true, readAt: daysAgo(19) },
    { user: warehouseUser._id, title: 'Stock transfer created', message: 'STR-00001: 10x iPhone 15 Pro to East Distribution', type: 'info', isRead: true, readAt: daysAgo(10) },
    { user: accountantUser._id, title: 'Payment received', message: 'Payment of $2,000 received for ORD-00002', type: 'info', isRead: false },
  ];
  let notifCreated = 0;
  for (const n of notificationsData) {
    const exists = await m.Notification.findOne({ user: n.user, title: n.title });
    if (!exists) { await m.Notification.create(n); notifCreated++; }
  }
  console.log('✅ Notifications created:', notifCreated);

  // ─── Summary ───
  console.log('\n════════════════════════════════════════');
  console.log('  🌱 SEEDING COMPLETE');
  console.log('════════════════════════════════════════');
  console.log(`  Org: ${SEED_ORG_NAME} (${SEED_ORG_SLUG})`);
  console.log('');
  console.log('  Login Credentials (all passwords: Password@123):');
  console.log(`    SuperAdmin: ${config.superadminEmail}`);
  console.log('    Admin:      admin@demo.com');
  console.log('    Manager:    manager@demo.com');
  console.log('    Cashier:    cashier@demo.com');
  console.log('    Warehouse:  warehouse@demo.com');
  console.log('    Accountant: accountant@demo.com');
  console.log('');
  console.log('  Customer Portal Logins:');
  console.log('    alice@example.com (retail, $200 balance)');
  console.log('    bob@example.com (wholesale, $500 balance)');
  console.log('    carol@example.com (VIP, $1000 balance)');
  console.log('    david@example.com (retail, $0 balance)');
  console.log('════════════════════════════════════════\n');
}

// ─── Helpers ───
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function upsertCategory(m, data) {
  const imageMap = {
    'electronics': 'https://picsum.photos/seed/electronics/400/400',
    'clothing': 'https://picsum.photos/seed/clothing/400/400',
    'food-beverages': 'https://picsum.photos/seed/foodbev/400/400',
    'phones': 'https://picsum.photos/seed/phones/400/400',
    'laptops': 'https://picsum.photos/seed/laptops/400/400',
    'accessories': 'https://picsum.photos/seed/accessories/400/400',
    'men-clothing': 'https://picsum.photos/seed/menclothing/400/400',
    'women-clothing': 'https://picsum.photos/seed/womenclothing/400/400',
  };
  const cat = await m.Category.findOneAndUpdate(
    { slug: data.slug },
    { $set: { ...data, image: data.image || imageMap[data.slug] || '', isActive: true } },
    { upsert: true, new: true }
  );
  return cat;
}

async function createIfNotExists(Model, query, data) {
  let doc = await Model.findOne(query);
  if (!doc) doc = await Model.create(data);
  return doc;
}

// ─── Run ───
seed()
  .then(() => {
    console.log('Seeder finished. Closing connections...');
    return closeAllConnections();
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Seeder failed:', err);
    process.exit(1);
  });
