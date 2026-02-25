/**
 * Store API Test Script
 * Run: node tests/store-api-test.js
 *
 * Tests all public catalog + authenticated portal endpoints.
 */

const http = require('http');

const BASE = 'http://localhost:5000/api/store/demo-store';
let customerToken = null;
let testCustomerId = null;
let testOrderId = null;
let testAddressId = null;
let testProductId = null;
let testProductSlug = null;
let passed = 0;
let failed = 0;
const failures = [];

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${BASE}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function assert(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}` + (detail ? ` — ${detail}` : ''));
  }
}

async function run() {
  console.log('\n═══════════════════════════════════════');
  console.log('  STORE API TESTS');
  console.log('═══════════════════════════════════════\n');

  // ─── PUBLIC CATALOG ─────────────────────────────────────────
  console.log('─── Public Catalog ───');

  // Settings
  const settings = await req('GET', '/settings');
  assert('GET /settings → 200', settings.status === 200);

  // Categories
  const cats = await req('GET', '/categories');
  assert('GET /categories → 200', cats.status === 200);
  assert('Categories is array', Array.isArray(cats.body.data));

  // Brands
  const brands = await req('GET', '/brands');
  assert('GET /brands → 200', brands.status === 200);
  assert('Brands is array', Array.isArray(brands.body.data));

  // Products
  const prods = await req('GET', '/products');
  assert('GET /products → 200', prods.status === 200);
  assert('Products has pagination', !!prods.body.data?.pagination);
  assert('Products array exists', Array.isArray(prods.body.data?.products));
  if (prods.body.data?.products?.length > 0) {
    const p = prods.body.data.products[0];
    assert('Products exclude variants', p.type !== 'variant', `type=${p.type}`);
    assert('Product has inStock field', p.inStock !== undefined);
    // Save for later tests
    if (p.type === 'single') {
      testProductId = p._id;
      testProductSlug = p.slug;
    }
  }

  // Find a single (orderable) product for order testing
  if (!testProductId) {
    const allProds = await req('GET', '/products?limit=50');
    const single = allProds.body.data?.products?.find(p => p.type === 'single');
    if (single) {
      testProductId = single._id;
      testProductSlug = single.slug;
    } else {
      // Try to get a variant from a parent
      const parent = allProds.body.data?.products?.find(p => p.type === 'parent');
      if (parent) {
        const detail = await req('GET', `/products/${parent._id}`);
        if (detail.body.data?.variants?.length > 0) {
          testProductId = detail.body.data.variants[0]._id;
          testProductSlug = detail.body.data.variants[0].slug;
        }
      }
    }
  }

  // Products with filters
  const prodsFiltered = await req('GET', '/products?sort=name_asc&limit=5');
  assert('GET /products?sort=name_asc → 200', prodsFiltered.status === 200);

  // Featured
  const feat = await req('GET', '/products/featured');
  assert('GET /products/featured → 200', feat.status === 200);
  assert('Featured is array', Array.isArray(feat.body.data));

  // New arrivals
  const newArr = await req('GET', '/products/new-arrivals');
  assert('GET /products/new-arrivals → 200', newArr.status === 200);
  assert('New arrivals is array', Array.isArray(newArr.body.data));

  // Search
  const search = await req('GET', '/products/search?q=test');
  assert('GET /products/search → 200', search.status === 200);

  // Product by slug
  if (testProductSlug) {
    const bySlug = await req('GET', `/products/slug/${testProductSlug}`);
    assert('GET /products/slug/:slug → 200', bySlug.status === 200);
    assert('Product detail has availability', !!bySlug.body.data?.availability);
  }

  // Product by ID
  if (testProductId) {
    const byId = await req('GET', `/products/${testProductId}`);
    assert('GET /products/:id → 200', byId.status === 200);
    assert('Product by ID has availability', !!byId.body.data?.availability);
  }

  // ─── CUSTOMER AUTH ──────────────────────────────────────────
  console.log('\n─── Customer Auth ───');

  const timestamp = Date.now();
  const testEmail = `storetest${timestamp}@test.com`;

  const reg = await req('POST', '/auth/register', {
    name: 'Store Test User', email: testEmail, password: 'Test@1234', termsAccepted: true,
  });
  assert('POST /auth/register → 201', reg.status === 201, `got ${reg.status}: ${reg.body?.message}`);
  if (reg.body?.data?.token) {
    customerToken = reg.body.data.token;
    testCustomerId = reg.body.data.customer?._id;
  }

  const login = await req('POST', '/auth/login', { email: testEmail, password: 'Test@1234' });
  assert('POST /auth/login → 200', login.status === 200);
  if (login.body?.data?.token) customerToken = login.body.data.token;

  // Wrong password
  const badLogin = await req('POST', '/auth/login', { email: testEmail, password: 'wrong' });
  assert('Login wrong password → 401', badLogin.status === 401);

  // Duplicate registration
  const dupReg = await req('POST', '/auth/register', {
    name: 'Dup User', email: testEmail, password: 'Test@1234', termsAccepted: true,
  });
  assert('Duplicate register → 409', dupReg.status === 409);

  if (!customerToken) {
    console.log('\n  ✗ NO CUSTOMER TOKEN — skipping portal tests\n');
    printSummary();
    return;
  }

  // ─── PROFILE ────────────────────────────────────────────────
  console.log('\n─── Profile ───');

  const profile = await req('GET', '/portal/profile', null, customerToken);
  assert('GET /portal/profile → 200', profile.status === 200);
  assert('Profile has name', profile.body.data?.name === 'Store Test User');

  const updated = await req('PUT', '/portal/profile', { name: 'Updated User', phone: '9876543210' }, customerToken);
  assert('PUT /portal/profile → 200', updated.status === 200);
  assert('Name updated', updated.body.data?.name === 'Updated User');

  const pwChange = await req('PUT', '/portal/change-password', {
    currentPassword: 'Test@1234', newPassword: 'NewPass@1234',
  }, customerToken);
  assert('PUT /portal/change-password → 200', pwChange.status === 200);

  // Login with new password
  const newLogin = await req('POST', '/auth/login', { email: testEmail, password: 'NewPass@1234' });
  assert('Login with new password → 200', newLogin.status === 200);
  if (newLogin.body?.data?.token) customerToken = newLogin.body.data.token;

  // ─── ADDRESSES ──────────────────────────────────────────────
  console.log('\n─── Addresses ───');

  const addAddr = await req('POST', '/portal/addresses', {
    label: 'Home', line1: '123 Test St', city: 'Mumbai', state: 'MH', zip: '400001', country: 'India', isDefault: true,
  }, customerToken);
  assert('POST /portal/addresses → 201', addAddr.status === 201);
  if (addAddr.body.data?.length > 0) testAddressId = addAddr.body.data[0]._id;

  const addAddr2 = await req('POST', '/portal/addresses', {
    label: 'Office', line1: '456 Work Ave', city: 'Delhi', state: 'DL', zip: '110001',
  }, customerToken);
  assert('Add second address → 201', addAddr2.status === 201);
  assert('Now has 2 addresses', addAddr2.body.data?.length === 2);

  const listAddr = await req('GET', '/portal/addresses', null, customerToken);
  assert('GET /portal/addresses → 200', listAddr.status === 200);
  assert('Addresses list returned', Array.isArray(listAddr.body.data));

  if (testAddressId) {
    const upAddr = await req('PUT', `/portal/addresses/${testAddressId}`, { label: 'Home Updated' }, customerToken);
    assert('PUT /portal/addresses/:id → 200', upAddr.status === 200);
  }

  // Delete second address
  if (addAddr2.body.data?.length > 1) {
    const secondId = addAddr2.body.data[1]._id;
    const delAddr = await req('DELETE', `/portal/addresses/${secondId}`, null, customerToken);
    assert('DELETE /portal/addresses/:id → 200', delAddr.status === 200);
    assert('After delete has 1 address', delAddr.body.data?.length === 1);
  }

  // ─── COUPON VALIDATION ──────────────────────────────────────
  console.log('\n─── Coupon Validation ───');

  const badCoupon = await req('POST', '/portal/coupon/validate', {
    code: 'NONEXISTENT', subtotal: 1000,
  }, customerToken);
  assert('Invalid coupon → 404', badCoupon.status === 404);

  const noCoupon = await req('POST', '/portal/coupon/validate', {}, customerToken);
  assert('No code → 400', noCoupon.status === 400);

  // ─── STOCK CHECK ────────────────────────────────────────────
  console.log('\n─── Stock Check ───');

  if (testProductId) {
    const stockChk = await req('POST', '/portal/stock-check', {
      items: [{ productId: testProductId, quantity: 1 }],
    }, customerToken);
    assert('POST /portal/stock-check → 200', stockChk.status === 200);
    assert('Stock check returns array', Array.isArray(stockChk.body.data));
    if (stockChk.body.data?.length > 0) {
      assert('Stock check has availableQty', stockChk.body.data[0].availableQty !== undefined);
    }
  }

  const emptyStockChk = await req('POST', '/portal/stock-check', { items: [] }, customerToken);
  assert('Empty stock check → 400', emptyStockChk.status === 400);

  // ─── PLACE ORDER ────────────────────────────────────────────
  console.log('\n─── Orders ───');

  if (testProductId) {
    const order = await req('POST', '/portal/orders', {
      items: [{ productId: testProductId, quantity: 1 }],
      shippingAddress: { label: 'Home', line1: '123 Test St', city: 'Mumbai', state: 'MH', zip: '400001' },
    }, customerToken);
    assert('POST /portal/orders (place) → 201', order.status === 201, `got ${order.status}: ${order.body?.message}`);
    if (order.body.data?._id) testOrderId = order.body.data._id;
    if (order.body.data) {
      assert('Order has orderNumber', !!order.body.data.orderNumber);
      assert('Order has invoiceNumber', !!order.body.data.invoiceNumber);
      assert('Order source is website', order.body.data.orderSource === 'website');
      assert('Order status is placed', order.body.data.status === 'placed');
    }
  }

  // List orders
  const myOrders = await req('GET', '/portal/orders', null, customerToken);
  assert('GET /portal/orders → 200', myOrders.status === 200);
  assert('Orders has pagination', !!myOrders.body.data?.pagination);

  // Get single order
  if (testOrderId) {
    const orderDetail = await req('GET', `/portal/orders/${testOrderId}`, null, customerToken);
    assert('GET /portal/orders/:id → 200', orderDetail.status === 200);
    assert('Order detail has payments', Array.isArray(orderDetail.body.data?.payments));
    assert('Order detail has returns', Array.isArray(orderDetail.body.data?.returns));
  }

  // Filter orders by status
  const placedOrders = await req('GET', '/portal/orders?status=placed', null, customerToken);
  assert('GET /portal/orders?status=placed → 200', placedOrders.status === 200);

  // Cancel order
  if (testOrderId) {
    const cancel = await req('PATCH', `/portal/orders/${testOrderId}/cancel`, { reason: 'Testing cancellation' }, customerToken);
    assert('PATCH /portal/orders/:id/cancel → 200', cancel.status === 200, `got ${cancel.status}: ${cancel.body?.message}`);
    if (cancel.body.data) {
      assert('Order status is cancelled', cancel.body.data.status === 'cancelled');
    }

    // Try to cancel again
    const reCancel = await req('PATCH', `/portal/orders/${testOrderId}/cancel`, {}, customerToken);
    assert('Double cancel → 400', reCancel.status === 400);
  }

  // Place another order for returns test (won't test return since it requires delivered status)
  console.log('\n─── Returns ───');

  const myReturns = await req('GET', '/portal/returns', null, customerToken);
  assert('GET /portal/returns → 200', myReturns.status === 200);
  assert('Returns has pagination', !!myReturns.body.data?.pagination);

  // Try return on non-delivered order
  if (testOrderId) {
    const retBad = await req('POST', `/portal/orders/${testOrderId}/return`, {
      items: [{ lineItemId: 'fake', returnQty: 1 }],
    }, customerToken);
    assert('Return on cancelled order → 400', retBad.status === 400);
  }

  // ─── FINANCIAL ──────────────────────────────────────────────
  console.log('\n─── Financial ───');

  const ledger = await req('GET', '/portal/ledger', null, customerToken);
  assert('GET /portal/ledger → 200', ledger.status === 200);
  assert('Ledger has entries', Array.isArray(ledger.body.data?.entries));

  const balance = await req('GET', '/portal/balance', null, customerToken);
  assert('GET /portal/balance → 200', balance.status === 200);
  assert('Balance has currentBalance', balance.body.data?.currentBalance !== undefined);
  assert('Balance has creditLimit', balance.body.data?.creditLimit !== undefined);

  const payments = await req('GET', '/portal/payments', null, customerToken);
  assert('GET /portal/payments → 200', payments.status === 200);
  assert('Payments has pagination', !!payments.body.data?.pagination);

  const topups = await req('GET', '/portal/topups', null, customerToken);
  assert('GET /portal/topups → 200', topups.status === 200);
  assert('Topups has pagination', !!topups.body.data?.pagination);

  const statement = await req('GET', '/portal/statement', null, customerToken);
  assert('GET /portal/statement → 200', statement.status === 200);
  assert('Statement has customer', !!statement.body.data?.customer);
  assert('Statement has entries', Array.isArray(statement.body.data?.entries));

  // ─── AUTH GUARDS ────────────────────────────────────────────
  console.log('\n─── Auth Guards ───');

  const noAuth = await req('GET', '/portal/profile');
  assert('No token → 401', noAuth.status === 401);

  const badToken = await req('GET', '/portal/profile', null, 'invalidtoken');
  assert('Bad token → 401', badToken.status === 401);

  // ─── DONE ───────────────────────────────────────────────────
  printSummary();
}

function printSummary() {
  console.log('\n═══════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('  FAILURES:');
    failures.forEach(f => console.log(`    - ${f}`));
  }
  console.log('═══════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
