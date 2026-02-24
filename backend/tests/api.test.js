/**
 * Comprehensive API Test Suite for Multi-Tenant E-Commerce Platform
 *
 * Prerequisites:
 *   1. MongoDB running on localhost:27017
 *   2. Server running on http://localhost:5000
 *   3. Seeder has been run: node src/seeder.js --drop
 *
 * Run: npx jest tests/api.test.js --forceExit --detectOpenHandles --verbose
 */

const BASE = 'http://localhost:5000/api';
const ORG_SLUG = 'demo-store';
const PASSWORD = 'Password@123';

/* ───────────── Helpers ───────────── */

const api = async (method, path, body, token) => {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
};

const GET    = (p, t) => api('GET', p, null, t);
const POST   = (p, b, t) => api('POST', p, b, t);
const PUT    = (p, b, t) => api('PUT', p, b, t);
const PATCH  = (p, b, t) => api('PATCH', p, b, t);
const DELETE = (p, t) => api('DELETE', p, null, t);

/* ───────────── Shared State ───────────── */
const ids = {};
let superadminToken, adminToken, customerToken;

/* ═══════════════════════════════════════════════════
   0.  HEALTH CHECK
   ═══════════════════════════════════════════════════ */
describe('Health', () => {
  test('GET /health', async () => {
    const r = await GET('/health');
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   1.  SUPER-ADMIN
   ═══════════════════════════════════════════════════ */
describe('SuperAdmin', () => {
  test('POST /superadmin/login', async () => {
    const r = await POST('/superadmin/login', {
      email: 'superadmin@platform.com',
      password: PASSWORD,
    });
    expect(r.status).toBe(200);
    expect(r.data.data.token).toBeDefined();
    superadminToken = r.data.data.token;
  });

  test('GET /superadmin/organizations', async () => {
    const r = await GET('/superadmin/organizations', superadminToken);
    expect(r.status).toBe(200);
    const orgs = r.data.data.organizations || r.data.data;
    expect(Array.isArray(orgs)).toBe(true);
    const demo = orgs.find(o => o.slug === ORG_SLUG);
    if (demo) ids.orgId = demo._id;
  });

  test('POST /superadmin/organizations (create)', async () => {
    const r = await POST('/superadmin/organizations', {
      name: `Test Org ${Date.now()}`,
      plan: 'basic',
    }, superadminToken);
    expect([200, 201]).toContain(r.status);
    const orgData = r.data.data;
    ids.newOrgId = orgData._id;
    ids.newOrgSlug = orgData.slug;
  });

  test('GET /superadmin/organizations/:id', async () => {
    const r = await GET(`/superadmin/organizations/${ids.newOrgId}`, superadminToken);
    expect(r.status).toBe(200);
  });

  test('PUT /superadmin/organizations/:id', async () => {
    const r = await PUT(`/superadmin/organizations/${ids.newOrgId}`, {
      plan: 'pro',
    }, superadminToken);
    expect(r.status).toBe(200);
  });

  test('POST /superadmin/organizations/:id/admins', async () => {
    const uniqueEmail = `testadmin_${Date.now()}@neworg.com`;
    const r = await POST(`/superadmin/organizations/${ids.newOrgId}/admins`, {
      name: 'Test Admin',
      email: uniqueEmail,
      password: 'Test@12345',
      role: 'admin',
    }, superadminToken);
    expect([200, 201]).toContain(r.status);
  });

  test('GET /superadmin/organizations/:id/admins', async () => {
    const r = await GET(`/superadmin/organizations/${ids.newOrgId}/admins`, superadminToken);
    expect(r.status).toBe(200);
  });

  test('DELETE /superadmin/organizations/:id', async () => {
    const r = await DELETE(`/superadmin/organizations/${ids.newOrgId}`, superadminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   2.  ADMIN AUTH
   ═══════════════════════════════════════════════════ */
describe('Admin Auth', () => {
  test('POST /admin/auth/login', async () => {
    const r = await POST('/admin/auth/login', {
      email: 'admin@demo.com',
      password: PASSWORD,
      orgSlug: ORG_SLUG,
    });
    expect(r.status).toBe(200);
    expect(r.data.data.token).toBeDefined();
    adminToken = r.data.data.token;
  });

  test('GET /admin/auth/me', async () => {
    const r = await GET('/admin/auth/me', adminToken);
    expect(r.status).toBe(200);
    expect(r.data.data.email).toBe('admin@demo.com');
  });

  /* skip change-password to keep idempotent */
});

/* ═══════════════════════════════════════════════════
   3.  USERS
   ═══════════════════════════════════════════════════ */
describe('Users', () => {
  test('GET /admin/users', async () => {
    const r = await GET('/admin/users', adminToken);
    expect(r.status).toBe(200);
  });

  test('POST /admin/users', async () => {
    const r = await POST('/admin/users', {
      name: 'Test Cashier',
      email: `testcashier_${Date.now()}@demo.com`,
      password: PASSWORD,
      role: 'cashier',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.newUserId = r.data.data._id;
  });

  test('GET /admin/users/:id', async () => {
    const r = await GET(`/admin/users/${ids.newUserId}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('PUT /admin/users/:id', async () => {
    const r = await PUT(`/admin/users/${ids.newUserId}`, {
      name: 'Updated Cashier',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('PATCH /admin/users/:id/toggle-active', async () => {
    const r = await PATCH(`/admin/users/${ids.newUserId}/toggle-active`, {}, adminToken);
    expect(r.status).toBe(200);
  });

  test('DELETE /admin/users/:id', async () => {
    const r = await DELETE(`/admin/users/${ids.newUserId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   4.  CATEGORIES
   ═══════════════════════════════════════════════════ */
describe('Categories', () => {
  test('GET /admin/categories', async () => {
    const r = await GET('/admin/categories', adminToken);
    expect(r.status).toBe(200);
    const cats = r.data.data.categories || r.data.data;
    if (Array.isArray(cats) && cats.length > 0) {
      ids.categoryId = cats[0]._id;
    }
  });

  test('POST /admin/categories', async () => {
    const r = await POST('/admin/categories', {
      name: `Test Category ${Date.now()}`,
      description: 'Automated test category',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.newCategoryId = r.data.data._id;
  });

  test('GET /admin/categories/:id', async () => {
    const r = await GET(`/admin/categories/${ids.newCategoryId}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('PUT /admin/categories/:id', async () => {
    const r = await PUT(`/admin/categories/${ids.newCategoryId}`, {
      name: 'Updated Category',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('PATCH /admin/categories/reorder', async () => {
    const r = await PATCH('/admin/categories/reorder', {
      items: [{ id: ids.newCategoryId, sortOrder: 99 }],
    }, adminToken);
    expect([200, 204]).toContain(r.status);
  });

  test('DELETE /admin/categories/:id', async () => {
    const r = await DELETE(`/admin/categories/${ids.newCategoryId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   5.  UNITS
   ═══════════════════════════════════════════════════ */
describe('Units', () => {
  test('GET /admin/units', async () => {
    const r = await GET('/admin/units', adminToken);
    expect(r.status).toBe(200);
    const units = r.data.data.units || r.data.data;
    if (Array.isArray(units) && units.length) ids.unitId = units[0]._id;
  });

  test('POST /admin/units', async () => {
    const r = await POST('/admin/units', {
      name: `TestUnit${Date.now()}`,
      shortName: 'tu',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.newUnitId = r.data.data._id;
  });

  test('PUT /admin/units/:id', async () => {
    const r = await PUT(`/admin/units/${ids.newUnitId}`, {
      name: 'UpdatedUnit',
      shortName: 'uu',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('DELETE /admin/units/:id', async () => {
    const r = await DELETE(`/admin/units/${ids.newUnitId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   6.  BARCODE TYPES
   ═══════════════════════════════════════════════════ */
describe('BarcodeTypes', () => {
  test('GET /admin/barcode-types', async () => {
    const r = await GET('/admin/barcode-types', adminToken);
    expect(r.status).toBe(200);
    const bts = r.data.data.barcodeTypes || r.data.data;
    if (Array.isArray(bts) && bts.length) ids.barcodeTypeId = bts[0]._id;
  });

  test('POST /admin/barcode-types', async () => {
    const r = await POST('/admin/barcode-types', {
      name: `TestBT${Date.now()}`,
      format: 'custom',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.newBarcodeTypeId = r.data.data._id;
  });

  test('PUT /admin/barcode-types/:id', async () => {
    const r = await PUT(`/admin/barcode-types/${ids.newBarcodeTypeId}`, {
      name: 'UpdatedBT',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('DELETE /admin/barcode-types/:id', async () => {
    const r = await DELETE(`/admin/barcode-types/${ids.newBarcodeTypeId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   7.  TAX SLABS
   ═══════════════════════════════════════════════════ */
describe('TaxSlabs', () => {
  test('GET /admin/tax-slabs', async () => {
    const r = await GET('/admin/tax-slabs', adminToken);
    expect(r.status).toBe(200);
    const slabs = r.data.data.taxSlabs || r.data.data;
    if (Array.isArray(slabs) && slabs.length) ids.taxSlabId = slabs[0]._id;
  });

  test('POST /admin/tax-slabs', async () => {
    const r = await POST('/admin/tax-slabs', {
      name: `Tax ${Date.now()}`,
      rate: 15,
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.newTaxSlabId = r.data.data._id;
  });

  test('PUT /admin/tax-slabs/:id', async () => {
    const r = await PUT(`/admin/tax-slabs/${ids.newTaxSlabId}`, {
      name: 'Updated Tax',
      rate: 12,
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('DELETE /admin/tax-slabs/:id', async () => {
    const r = await DELETE(`/admin/tax-slabs/${ids.newTaxSlabId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   8.  WAREHOUSES
   ═══════════════════════════════════════════════════ */
describe('Warehouses', () => {
  test('GET /admin/warehouses', async () => {
    const r = await GET('/admin/warehouses', adminToken);
    expect(r.status).toBe(200);
    const whs = r.data.data.warehouses || r.data.data;
    if (Array.isArray(whs) && whs.length) {
      ids.warehouseId = whs[0]._id;
      if (whs.length > 1) ids.warehouseId2 = whs[1]._id;
    }
  });

  test('POST /admin/warehouses', async () => {
    const r = await POST('/admin/warehouses', {
      name: `TestWH${Date.now()}`,
      code: `TWH${Date.now()}`,
      address: { street: '1 Test St', city: 'TestCity', state: 'TS', zip: '00000', country: 'Testland' },
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.newWarehouseId = r.data.data._id;
  });

  test('GET /admin/warehouses/:id', async () => {
    const r = await GET(`/admin/warehouses/${ids.warehouseId}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('PUT /admin/warehouses/:id', async () => {
    const r = await PUT(`/admin/warehouses/${ids.newWarehouseId}`, {
      name: 'Updated WH',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/warehouses/:id/stock', async () => {
    const r = await GET(`/admin/warehouses/${ids.warehouseId}/stock`, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/warehouses/:id/movements', async () => {
    const r = await GET(`/admin/warehouses/${ids.warehouseId}/movements`, adminToken);
    expect(r.status).toBe(200);
  });

  test('DELETE /admin/warehouses/:id', async () => {
    const r = await DELETE(`/admin/warehouses/${ids.newWarehouseId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   9.  PRODUCTS
   ═══════════════════════════════════════════════════ */
describe('Products', () => {
  test('GET /admin/products', async () => {
    const r = await GET('/admin/products', adminToken);
    expect(r.status).toBe(200);
    const prods = r.data.data.products || r.data.data;
    if (Array.isArray(prods) && prods.length) {
      // pick a single product for subsequent tests
      const single = prods.find(p => p.type === 'single') || prods[0];
      ids.productId = single._id;
      // pick a parent product if exists
      const parent = prods.find(p => p.type === 'parent');
      if (parent) ids.parentProductId = parent._id;
    }
  });

  test('POST /admin/products', async () => {
    const r = await POST('/admin/products', {
      name: `TestProduct${Date.now()}`,
      sku: `TP-${Date.now()}`,
      type: 'single',
      basePrice: 100,
      costPrice: 60,
      description: 'test product',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.newProductId = r.data.data._id;
  });

  test('GET /admin/products/:id', async () => {
    const r = await GET(`/admin/products/${ids.productId}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('PUT /admin/products/:id', async () => {
    const r = await PUT(`/admin/products/${ids.newProductId}`, {
      name: 'Updated Product',
      basePrice: 120,
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('POST /admin/products/:id/variants (add variant)', async () => {
    // Create a parent product first
    const parent = await POST('/admin/products', {
      name: `ParentProd${Date.now()}`,
      sku: `PP-${Date.now()}`,
      type: 'parent',
      basePrice: 200,
      costPrice: 100,
    }, adminToken);
    expect([200, 201]).toContain(parent.status);
    const parentId = parent.data.data._id;
    ids.testParentId = parentId;

    const r = await POST(`/admin/products/${parentId}/variants`, {
      name: `Variant-${Date.now()}`,
      sku: `VAR-${Date.now()}`,
      variantAttribute: 'color',
      basePrice: 210,
    }, adminToken);
    expect([200, 201]).toContain(r.status);
  });

  test('POST /admin/products/:id/images', async () => {
    const r = await POST(`/admin/products/${ids.newProductId}/images`, {
      images: [{ url: 'https://example.com/test.jpg', isPrimary: true, altText: 'test' }],
    }, adminToken);
    expect([200, 201]).toContain(r.status);
  });

  test('GET /admin/products/:id/stock', async () => {
    const r = await GET(`/admin/products/${ids.productId}/stock`, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/products/:id/movements', async () => {
    const r = await GET(`/admin/products/${ids.productId}/movements`, adminToken);
    expect(r.status).toBe(200);
  });

  test('DELETE /admin/products/:id', async () => {
    const r = await DELETE(`/admin/products/${ids.newProductId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   10. STOCK MANAGEMENT
   ═══════════════════════════════════════════════════ */
describe('Stock', () => {
  test('GET /admin/stock', async () => {
    const r = await GET('/admin/stock', adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/stock/low', async () => {
    const r = await GET('/admin/stock/low', adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/stock/movements', async () => {
    const r = await GET('/admin/stock/movements', adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/stock/movements/product/:productId', async () => {
    const r = await GET(`/admin/stock/movements/product/${ids.productId}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('POST /admin/stock/opening', async () => {
    // Use the test parent id or a new product
    const prod = await POST('/admin/products', {
      name: `StockTestProd${Date.now()}`,
      sku: `STP-${Date.now()}`,
      type: 'single',
      basePrice: 50,
      costPrice: 30,
    }, adminToken);
    ids.stockTestProductId = prod.data.data._id;

    const r = await POST('/admin/stock/opening', {
      productId: ids.stockTestProductId,
      warehouseId: ids.warehouseId,
      quantity: 100,
      lowStockThreshold: 10,
    }, adminToken);
    expect([200, 201]).toContain(r.status);
  });

  test('POST /admin/stock/adjustments', async () => {
    const r = await POST('/admin/stock/adjustments', {
      productId: ids.stockTestProductId,
      warehouseId: ids.warehouseId,
      adjustmentType: 'decrease',
      adjustedQuantity: 5,
      reason: 'damage',
      notes: 'Automated test adjustment',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.adjustmentId = r.data.data?._id;
  });

  test('GET /admin/stock/adjustments', async () => {
    const r = await GET('/admin/stock/adjustments', adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/stock/adjustments/:id', async () => {
    if (!ids.adjustmentId) return;
    const r = await GET(`/admin/stock/adjustments/${ids.adjustmentId}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('POST /admin/stock/transfers', async () => {
    if (!ids.warehouseId2) return;
    const r = await POST('/admin/stock/transfers', {
      fromWarehouse: ids.warehouseId,
      toWarehouse: ids.warehouseId2,
      items: [{ productId: ids.stockTestProductId, requestedQty: 5 }],
      notes: 'Test transfer',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.transferId = r.data.data?._id;
  });

  test('GET /admin/stock/transfers', async () => {
    const r = await GET('/admin/stock/transfers', adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/stock/transfers/:id', async () => {
    if (!ids.transferId) return;
    const r = await GET(`/admin/stock/transfers/${ids.transferId}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('PATCH /admin/stock/transfers/:id/complete', async () => {
    if (!ids.transferId) return;
    const r = await PATCH(`/admin/stock/transfers/${ids.transferId}/complete`, {}, adminToken);
    expect(r.status).toBe(200);
  });

  /* cancel on a new transfer */
  test('PATCH /admin/stock/transfers/:id/cancel', async () => {
    if (!ids.warehouseId2) return;
    const t = await POST('/admin/stock/transfers', {
      productId: ids.stockTestProductId,
      fromWarehouse: ids.warehouseId,
      toWarehouse: ids.warehouseId2,
      quantity: 2,
      notes: 'To be cancelled',
    }, adminToken);
    if (t.data.data?._id) {
      const r = await PATCH(`/admin/stock/transfers/${t.data.data._id}/cancel`, {}, adminToken);
      expect(r.status).toBe(200);
    }
  });
});

/* ═══════════════════════════════════════════════════
   11. CUSTOMERS
   ═══════════════════════════════════════════════════ */
describe('Customers', () => {
  test('GET /admin/customers', async () => {
    const r = await GET('/admin/customers', adminToken);
    expect(r.status).toBe(200);
    const custs = r.data.data.customers || r.data.data;
    if (Array.isArray(custs) && custs.length) {
      ids.customerId = custs[0]._id;
    }
  });

  test('POST /admin/customers', async () => {
    const r = await POST('/admin/customers', {
      name: `TestCust${Date.now()}`,
      email: `testcust_${Date.now()}@example.com`,
      phone: '+1-555-9999',
      creditLimit: 5000,
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.newCustomerId = r.data.data._id;
  });

  test('GET /admin/customers/:id', async () => {
    const r = await GET(`/admin/customers/${ids.customerId}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('PUT /admin/customers/:id', async () => {
    const r = await PUT(`/admin/customers/${ids.newCustomerId}`, {
      name: 'Updated Cust',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/customers/:id/ledger', async () => {
    const r = await GET(`/admin/customers/${ids.customerId}/ledger`, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/customers/:id/balance', async () => {
    const r = await GET(`/admin/customers/${ids.customerId}/balance`, adminToken);
    expect(r.status).toBe(200);
  });

  test('POST /admin/customers/:id/topup', async () => {
    const r = await POST(`/admin/customers/${ids.newCustomerId}/topup`, {
      amount: 500,
      method: 'cash',
      narration: 'Test topup',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
  });

test('POST /admin/customers/:id/adjust', async () => {
      const r = await POST(`/admin/customers/${ids.newCustomerId}/adjust`, {
        amount: 100,
        type: 'credit_adjustment',
        narration: 'Test adjustment',
      }, adminToken);
      expect([200, 201]).toContain(r.status);
  });

  test('GET /admin/customers/:id/statement', async () => {
    const r = await GET(`/admin/customers/${ids.customerId}/statement`, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/customers/:id/orders', async () => {
    const r = await GET(`/admin/customers/${ids.customerId}/orders`, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/customers/:id/payments', async () => {
    const r = await GET(`/admin/customers/${ids.customerId}/payments`, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/customers/:id/topups', async () => {
    const r = await GET(`/admin/customers/${ids.customerId}/topups`, adminToken);
    expect(r.status).toBe(200);
  });

  test('DELETE /admin/customers/:id', async () => {
    const r = await DELETE(`/admin/customers/${ids.newCustomerId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   12. ORDERS
   ═══════════════════════════════════════════════════ */
describe('Orders', () => {
  test('GET /admin/orders (list)', async () => {
    const r = await GET('/admin/orders', adminToken);
    expect(r.status).toBe(200);
    const orders = r.data.data.orders || r.data.data;
    if (Array.isArray(orders) && orders.length) {
      // pick a "placed" order for status test, otherwise first one
      const placed = orders.find(o => o.status === 'placed');
      ids.orderId = (placed || orders[0])._id;
      ids.orderStatus = (placed || orders[0]).status;
      // pick a delivered order for return test
      const delivered = orders.find(o => o.status === 'delivered');
      if (delivered) ids.deliveredOrderId = delivered._id;
    }
  });

  test('POST /admin/orders (create)', async () => {
    if (!ids.customerId || !ids.warehouseId || !ids.productId) return;
    const r = await POST('/admin/orders', {
      customerId: ids.customerId,
      warehouseId: ids.warehouseId,
      items: [{ productId: ids.productId, quantity: 1 }],
      paymentMethod: 'cash',
      paymentAmount: 0,
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    if (r.data.data) {
      ids.newOrderId = r.data.data._id;
    }
  });

  test('GET /admin/orders/:id', async () => {
    const oid = ids.newOrderId || ids.orderId;
    if (!oid) return;
    const r = await GET(`/admin/orders/${oid}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('PUT /admin/orders/:id (edit)', async () => {
    if (!ids.newOrderId) return;
    const r = await PUT(`/admin/orders/${ids.newOrderId}`, {
      notes: 'Updated via test',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('PATCH /admin/orders/:id/status (processing)', async () => {
    if (!ids.newOrderId) return;
    const r = await PATCH(`/admin/orders/${ids.newOrderId}/status`, {
      status: 'processing',
      note: 'Testing status update',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('PATCH /admin/orders/:id/status (shipped)', async () => {
    if (!ids.newOrderId) return;
    const r = await PATCH(`/admin/orders/${ids.newOrderId}/status`, {
      status: 'shipped',
      note: 'Shipped via test',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('PATCH /admin/orders/:id/status (delivered)', async () => {
    if (!ids.newOrderId) return;
    const r = await PATCH(`/admin/orders/${ids.newOrderId}/status`, {
      status: 'delivered',
      note: 'Delivered via test',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('POST /admin/orders/:id/payments (record)', async () => {
    if (!ids.newOrderId) return;
    const r = await POST(`/admin/orders/${ids.newOrderId}/payments`, {
      amount: 50,
      method: 'cash',
      reference: 'test-ref',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
  });

  test('GET /admin/orders/:id/payments', async () => {
    if (!ids.newOrderId) return;
    const r = await GET(`/admin/orders/${ids.newOrderId}/payments`, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/orders/:id/invoice', async () => {
    if (!ids.newOrderId) return;
    const r = await GET(`/admin/orders/${ids.newOrderId}/invoice`, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/orders/:id/history', async () => {
    if (!ids.newOrderId) return;
    const r = await GET(`/admin/orders/${ids.newOrderId}/history`, adminToken);
    expect(r.status).toBe(200);
  });

  test('POST /admin/orders/:id/returns (initiate)', async () => {
    if (!ids.newOrderId) return;
    // order has been marked delivered above, so returns are OK
    const orderDet = await GET(`/admin/orders/${ids.newOrderId}`, adminToken);
    const order = orderDet.data.data?.order || orderDet.data.data;
    if (!order || !order.items || order.items.length === 0) return;

    const firstItem = order.items[0];
    const r = await POST(`/admin/orders/${ids.newOrderId}/returns`, {
      returnType: 'full',
      items: [{
        lineItemId: firstItem._id,
        product: firstItem.product,
        returnQty: 1,
        reason: 'Test return',
      }],
      refundAmount: 50,
      refundMethod: 'ledger_credit',
      notes: 'Automated test return',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
  });

  test('GET /admin/orders/:id/returns', async () => {
    if (!ids.newOrderId) return;
    const r = await GET(`/admin/orders/${ids.newOrderId}/returns`, adminToken);
    expect(r.status).toBe(200);
  });

  test('POST /admin/orders/pos', async () => {
    if (!ids.customerId || !ids.warehouseId || !ids.productId) return;
    const r = await POST('/admin/orders/pos', {
      customerId: ids.customerId,
      warehouseId: ids.warehouseId,
      items: [{ productId: ids.productId, quantity: 1 }],
      paymentMethod: 'cash',
      paymentAmount: 10,
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    if (r.data.data) ids.posOrderId = r.data.data._id;
  });

  // delete/cancel an order at the end
  test('DELETE /admin/orders/:id', async () => {
    if (!ids.posOrderId) return;
    const r = await DELETE(`/admin/orders/${ids.posOrderId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   13. SUPPLIERS
   ═══════════════════════════════════════════════════ */
describe('Suppliers', () => {
  test('GET /admin/suppliers', async () => {
    const r = await GET('/admin/suppliers', adminToken);
    expect(r.status).toBe(200);
    const sups = r.data.data.suppliers || r.data.data;
    if (Array.isArray(sups) && sups.length) ids.supplierId = sups[0]._id;
  });

  test('POST /admin/suppliers', async () => {
    const r = await POST('/admin/suppliers', {
      name: `TestSupplier${Date.now()}`,
      email: `supplier_${Date.now()}@example.com`,
      phone: '+1-555-8888',
      creditLimit: 50000,
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.newSupplierId = r.data.data._id;
  });

  test('GET /admin/suppliers/:id', async () => {
    const r = await GET(`/admin/suppliers/${ids.supplierId}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('PUT /admin/suppliers/:id', async () => {
    const r = await PUT(`/admin/suppliers/${ids.newSupplierId}`, {
      creditLimit: 75000,
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/suppliers/:id/ledger', async () => {
    const r = await GET(`/admin/suppliers/${ids.supplierId}/ledger`, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/suppliers/:id/balance', async () => {
    const r = await GET(`/admin/suppliers/${ids.supplierId}/balance`, adminToken);
    expect(r.status).toBe(200);
  });

  test('POST /admin/suppliers/:id/payments', async () => {
    const r = await POST(`/admin/suppliers/${ids.newSupplierId}/payments`, {
      amount: 1000,
      method: 'bank_transfer',
      reference: 'TXN-TEST',
      narration: 'Test payment',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
  });

  test('POST /admin/suppliers/:id/adjust', async () => {
    const r = await POST(`/admin/suppliers/${ids.newSupplierId}/adjust`, {
      amount: 100,
      type: 'debit_adjustment',
      narration: 'Test adjustment',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
  });

  test('GET /admin/suppliers/:id/purchase-orders', async () => {
    const r = await GET(`/admin/suppliers/${ids.supplierId}/purchase-orders`, adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/suppliers/:id/statement', async () => {
    const r = await GET(`/admin/suppliers/${ids.supplierId}/statement`, adminToken);
    expect(r.status).toBe(200);
  });

  test('DELETE /admin/suppliers/:id', async () => {
    const r = await DELETE(`/admin/suppliers/${ids.newSupplierId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   14. PURCHASE ORDERS (PO / GRN / Returns)
   ═══════════════════════════════════════════════════ */
describe('PurchaseOrders', () => {
  test('GET /admin/purchase-orders', async () => {
    const r = await GET('/admin/purchase-orders', adminToken);
    expect(r.status).toBe(200);
    const pos = r.data.data.purchaseOrders || r.data.data;
    if (Array.isArray(pos) && pos.length) ids.poId = pos[0]._id;
  });

  test('POST /admin/purchase-orders', async () => {
    if (!ids.supplierId || !ids.warehouseId || !ids.productId) return;
    const r = await POST('/admin/purchase-orders', {
      supplier: ids.supplierId,
      warehouse: ids.warehouseId,
      items: [{
        product: ids.productId,
        orderedQty: 20,
        unitCost: 50,
      }],
      expectedDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      notes: 'Test PO',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    if (r.data.data) {
      ids.newPoId = r.data.data._id;
    }
  });

  test('GET /admin/purchase-orders/:id', async () => {
    const pid = ids.newPoId || ids.poId;
    if (!pid) return;
    const r = await GET(`/admin/purchase-orders/${pid}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('PUT /admin/purchase-orders/:id', async () => {
    if (!ids.newPoId) return;
    const r = await PUT(`/admin/purchase-orders/${ids.newPoId}`, {
      notes: 'Updated PO notes',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('PATCH /admin/purchase-orders/:id/status (ordered)', async () => {
    if (!ids.newPoId) return;
    const r = await PATCH(`/admin/purchase-orders/${ids.newPoId}/status`, {
      status: 'ordered',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  // GRN Tests
  test('POST /admin/purchase-orders/grn (create)', async () => {
    if (!ids.newPoId || !ids.productId) return;
    const r = await POST('/admin/purchase-orders/grn', {
      purchaseOrder: ids.newPoId,
      items: [{
        product: ids.productId,
        receivedQty: 20,
        unitCost: 50,
      }],
      notes: 'Test GRN',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    if (r.data.data) ids.grnId = r.data.data._id;
  });

  test('GET /admin/purchase-orders/grn/list', async () => {
    const r = await GET('/admin/purchase-orders/grn/list', adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/purchase-orders/grn/:id', async () => {
    if (!ids.grnId) return;
    const r = await GET(`/admin/purchase-orders/grn/${ids.grnId}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('PATCH /admin/purchase-orders/grn/:id/approve', async () => {
    if (!ids.grnId) return;
    const r = await PATCH(`/admin/purchase-orders/grn/${ids.grnId}/approve`, {}, adminToken);
    expect(r.status).toBe(200);
  });

  // Create another GRN to reject
  test('PATCH /admin/purchase-orders/grn/:id/reject', async () => {
    if (!ids.newPoId || !ids.productId) return;
    // Create a new PO for reject test
    const pores = await POST('/admin/purchase-orders', {
      supplier: ids.supplierId,
      warehouse: ids.warehouseId,
      items: [{ product: ids.productId, orderedQty: 5, unitCost: 50 }],
      expectedDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    }, adminToken);
    if (!pores.data.data) return;
    const rejectPoId = pores.data.data._id;
    await PATCH(`/admin/purchase-orders/${rejectPoId}/status`, { status: 'ordered' }, adminToken);

    const grnRes = await POST('/admin/purchase-orders/grn', {
      purchaseOrder: rejectPoId,
      items: [{ product: ids.productId, receivedQty: 5, unitCost: 50 }],
    }, adminToken);
    if (!grnRes.data.data) return;
    const r = await PATCH(`/admin/purchase-orders/grn/${grnRes.data.data._id}/reject`, {
      reason: 'Quality issues',
    }, adminToken);
    expect(r.status).toBe(200);
  });

  // Purchase Returns
  test('GET /admin/purchase-orders/returns/list', async () => {
    const r = await GET('/admin/purchase-orders/returns/list', adminToken);
    expect(r.status).toBe(200);
  });

  test('POST /admin/purchase-orders/returns', async () => {
    if (!ids.supplierId || !ids.warehouseId || !ids.productId) return;
    const r = await POST('/admin/purchase-orders/returns', {
      supplier: ids.supplierId,
      warehouse: ids.warehouseId,
      purchaseOrder: ids.newPoId || ids.poId,
      items: [{
        product: ids.productId,
        returnQty: 2,
        unitCost: 50,
        reason: 'Test return',
      }],
    }, adminToken);
    expect([200, 201]).toContain(r.status);
  });

  test('DELETE /admin/purchase-orders/:id', async () => {
    // Create a draft PO to delete
    const pores = await POST('/admin/purchase-orders', {
      supplier: ids.supplierId,
      warehouse: ids.warehouseId,
      items: [{ product: ids.productId, orderedQty: 1, unitCost: 50 }],
    }, adminToken);
    if (!pores.data.data) return;
    const r = await DELETE(`/admin/purchase-orders/${pores.data.data._id}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   15. COUPONS
   ═══════════════════════════════════════════════════ */
describe('Coupons', () => {
  test('GET /admin/coupons', async () => {
    const r = await GET('/admin/coupons', adminToken);
    expect(r.status).toBe(200);
    const coupons = r.data.data.coupons || r.data.data;
    if (Array.isArray(coupons) && coupons.length) ids.couponId = coupons[0]._id;
  });

  test('POST /admin/coupons', async () => {
    const r = await POST('/admin/coupons', {
      code: `TEST${Date.now()}`,
      discountType: 'percentage',
      discountValue: 10,
      maxDiscountAmount: 500,
      minOrderValue: 100,
      usageLimit: 50,
      isActive: true,
      validFrom: '2024-01-01T00:00:00Z',
      validUntil: '2028-12-31T23:59:59Z',
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.newCouponId = r.data.data._id;
  });

  test('GET /admin/coupons/:id', async () => {
    const cid = ids.newCouponId || ids.couponId;
    if (!cid) return;
    const r = await GET(`/admin/coupons/${cid}`, adminToken);
    expect(r.status).toBe(200);
  });

  test('PUT /admin/coupons/:id', async () => {
    if (!ids.newCouponId) return;
    const r = await PUT(`/admin/coupons/${ids.newCouponId}`, {
      discountValue: 15,
      isActive: true,
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('POST /admin/coupons/validate', async () => {
    if (!ids.newCouponId) return;
    // Get the coupon code
    const cdet = await GET(`/admin/coupons/${ids.newCouponId}`, adminToken);
    const code = cdet.data.data?.code;
    if (!code) return;
    const r = await POST('/admin/coupons/validate', {
      code,
      cartTotal: 1500,
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('DELETE /admin/coupons/:id', async () => {
    if (!ids.newCouponId) return;
    const r = await DELETE(`/admin/coupons/${ids.newCouponId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   16. PRICING (Tier Prices)
   ═══════════════════════════════════════════════════ */
describe('Pricing', () => {
  test('GET /admin/pricing/tier-prices', async () => {
    const r = await GET('/admin/pricing/tier-prices', adminToken);
    expect(r.status).toBe(200);
    const prices = r.data.data.tierPrices || r.data.data;
    if (Array.isArray(prices) && prices.length) ids.tierPriceId = prices[0]._id;
  });

  test('POST /admin/pricing/tier-prices', async () => {
    if (!ids.productId) return;
    const r = await POST('/admin/pricing/tier-prices', {
      product: ids.productId,
      tier: 'wholesale',
      price: 85,
      minQty: 10,
    }, adminToken);
    expect([200, 201]).toContain(r.status);
    ids.newTierPriceId = r.data.data._id;
  });

  test('PUT /admin/pricing/tier-prices/:id', async () => {
    if (!ids.newTierPriceId) return;
    const r = await PUT(`/admin/pricing/tier-prices/${ids.newTierPriceId}`, {
      price: 80,
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('POST /admin/pricing/resolve', async () => {
    if (!ids.productId || !ids.warehouseId) return;
    const r = await POST('/admin/pricing/resolve', {
      productId: ids.productId,
      warehouseId: ids.warehouseId,
      customerId: ids.customerId,
      qty: 1,
    }, adminToken);
    expect(r.status).toBe(200);
  });

  test('DELETE /admin/pricing/tier-prices/:id', async () => {
    if (!ids.newTierPriceId) return;
    const r = await DELETE(`/admin/pricing/tier-prices/${ids.newTierPriceId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   17. REPORTS
   ═══════════════════════════════════════════════════ */
describe('Reports', () => {
  test('GET /admin/reports/dashboard', async () => {
    const r = await GET('/admin/reports/dashboard', adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/reports/sales', async () => {
    const r = await GET('/admin/reports/sales?startDate=2024-01-01&endDate=2028-12-31&groupBy=monthly', adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/reports/stock', async () => {
    const r = await GET('/admin/reports/stock', adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/reports/customer-aging', async () => {
    const r = await GET('/admin/reports/customer-aging', adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/reports/supplier-aging', async () => {
    const r = await GET('/admin/reports/supplier-aging', adminToken);
    expect(r.status).toBe(200);
  });

  test('GET /admin/reports/profit-loss', async () => {
    const r = await GET('/admin/reports/profit-loss?startDate=2024-01-01&endDate=2028-12-31', adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   18. NOTIFICATIONS
   ═══════════════════════════════════════════════════ */
describe('Notifications', () => {
  test('GET /admin/notifications', async () => {
    const r = await GET('/admin/notifications', adminToken);
    expect(r.status).toBe(200);
    const notifs = r.data.data.notifications || r.data.data;
    if (Array.isArray(notifs) && notifs.length) ids.notificationId = notifs[0]._id;
  });

  test('PATCH /admin/notifications/:id/read', async () => {
    if (!ids.notificationId) return;
    const r = await PATCH(`/admin/notifications/${ids.notificationId}/read`, {}, adminToken);
    expect(r.status).toBe(200);
  });

  test('PATCH /admin/notifications/read-all', async () => {
    const r = await PATCH('/admin/notifications/read-all', {}, adminToken);
    expect(r.status).toBe(200);
  });

  test('DELETE /admin/notifications/:id', async () => {
    if (!ids.notificationId) return;
    const r = await DELETE(`/admin/notifications/${ids.notificationId}`, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   19. STORE — PUBLIC CATALOG
   ═══════════════════════════════════════════════════ */
describe('Store Catalog', () => {
  test('GET /store/:orgSlug/categories', async () => {
    const r = await GET(`/store/${ORG_SLUG}/categories`);
    expect(r.status).toBe(200);
  });

  test('GET /store/:orgSlug/products', async () => {
    const r = await GET(`/store/${ORG_SLUG}/products`);
    expect(r.status).toBe(200);
    const prods = r.data.data?.products || r.data.data;
    if (Array.isArray(prods) && prods.length) {
      ids.storeProductId = prods[0]._id;
      ids.storeProductSlug = prods[0].slug;
    }
  });

  test('GET /store/:orgSlug/products/featured', async () => {
    const r = await GET(`/store/${ORG_SLUG}/products/featured`);
    expect(r.status).toBe(200);
  });

  test('GET /store/:orgSlug/products/search', async () => {
    const r = await GET(`/store/${ORG_SLUG}/products/search?q=laptop`);
    expect(r.status).toBe(200);
  });

  test('GET /store/:orgSlug/products/slug/:slug', async () => {
    if (!ids.storeProductSlug) return;
    const r = await GET(`/store/${ORG_SLUG}/products/slug/${ids.storeProductSlug}`);
    expect(r.status).toBe(200);
  });

  test('GET /store/:orgSlug/products/:id', async () => {
    if (!ids.storeProductId) return;
    const r = await GET(`/store/${ORG_SLUG}/products/${ids.storeProductId}`);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   20. STORE — CUSTOMER AUTH
   ═══════════════════════════════════════════════════ */
describe('Store Customer Auth', () => {
  test('POST /store/:orgSlug/auth/register', async () => {
    const r = await POST(`/store/${ORG_SLUG}/auth/register`, {
      name: 'Test Customer',
      email: `testcust_${Date.now()}@example.com`,
      phone: '+1-555-7777',
      password: PASSWORD,
    });
    expect([200, 201]).toContain(r.status);
    if (r.data.data?.token) customerToken = r.data.data.token;
  });

  test('POST /store/:orgSlug/auth/login', async () => {
    const r = await POST(`/store/${ORG_SLUG}/auth/login`, {
      email: 'alice@example.com',
      password: PASSWORD,
    });
    expect(r.status).toBe(200);
    if (r.data.data?.token) customerToken = r.data.data.token;
  });
});

/* ═══════════════════════════════════════════════════
   21. STORE — CUSTOMER PORTAL
   ═══════════════════════════════════════════════════ */
describe('Store Customer Portal', () => {
  test('GET /store/:orgSlug/portal/profile', async () => {
    if (!customerToken) return;
    const r = await GET(`/store/${ORG_SLUG}/portal/profile`, customerToken);
    expect(r.status).toBe(200);
  });

  test('PUT /store/:orgSlug/portal/profile', async () => {
    if (!customerToken) return;
    const r = await PUT(`/store/${ORG_SLUG}/portal/profile`, {
      name: 'Alice Updated',
      phone: '+1-555-0001',
    }, customerToken);
    expect(r.status).toBe(200);
  });

  /* skip change-password to keep tests idempotent */

  test('GET /store/:orgSlug/portal/orders', async () => {
    if (!customerToken) return;
    const r = await GET(`/store/${ORG_SLUG}/portal/orders`, customerToken);
    expect(r.status).toBe(200);
    const orders = r.data.data?.orders || r.data.data;
    if (Array.isArray(orders) && orders.length) ids.customerOrderId = orders[0]._id;
  });

  test('GET /store/:orgSlug/portal/orders/:id', async () => {
    if (!customerToken || !ids.customerOrderId) return;
    const r = await GET(`/store/${ORG_SLUG}/portal/orders/${ids.customerOrderId}`, customerToken);
    expect(r.status).toBe(200);
  });

  test('POST /store/:orgSlug/portal/orders (place order)', async () => {
    if (!customerToken || !ids.warehouseId || !ids.storeProductId) return;
    const r = await POST(`/store/${ORG_SLUG}/portal/orders`, {
      items: [{ productId: ids.storeProductId, quantity: 1 }],
      warehouseId: ids.warehouseId,
      shippingAddress: {
        street: '789 Test Ave',
        city: 'TestCity',
        state: 'TC',
        zip: '12345',
        country: 'Testland',
      },
      paymentMethod: 'cod',
    }, customerToken);
    expect([200, 201]).toContain(r.status);
    if (r.data.data) ids.portalOrderId = r.data.data._id;
  });

  test('PATCH /store/:orgSlug/portal/orders/:id/cancel', async () => {
    if (!customerToken || !ids.portalOrderId) return;
    const r = await PATCH(`/store/${ORG_SLUG}/portal/orders/${ids.portalOrderId}/cancel`, {}, customerToken);
    expect(r.status).toBe(200);
  });

  test('GET /store/:orgSlug/portal/ledger', async () => {
    if (!customerToken) return;
    const r = await GET(`/store/${ORG_SLUG}/portal/ledger`, customerToken);
    expect(r.status).toBe(200);
  });

  test('GET /store/:orgSlug/portal/balance', async () => {
    if (!customerToken) return;
    const r = await GET(`/store/${ORG_SLUG}/portal/balance`, customerToken);
    expect(r.status).toBe(200);
  });

  test('GET /store/:orgSlug/portal/payments', async () => {
    if (!customerToken) return;
    const r = await GET(`/store/${ORG_SLUG}/portal/payments`, customerToken);
    expect(r.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   22. AUTH — NEGATIVE TESTS
   ═══════════════════════════════════════════════════ */
describe('Auth Negative Tests', () => {
  test('GET /admin/auth/me without token → 401', async () => {
    const r = await GET('/admin/auth/me');
    expect(r.status).toBe(401);
  });

  test('POST /superadmin/login wrong password → 401', async () => {
    const r = await POST('/superadmin/login', {
      email: 'superadmin@platform.com',
      password: 'wrongpassword',
    });
    expect(r.status).toBe(401);
  });

  test('POST /admin/auth/login wrong credentials → 401', async () => {
    const r = await POST('/admin/auth/login', {
      email: 'admin@demo.com',
      password: 'wrongpassword',
      orgSlug: ORG_SLUG,
    });
    expect(r.status).toBe(401);
  });

  test('GET non-existent route → 404', async () => {
    const r = await GET('/nonexistent');
    expect(r.status).toBe(404);
  });
});
