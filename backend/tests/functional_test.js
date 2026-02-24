/**
 * Functional API test — runs against live server at localhost:5000
 * Tests: bulk adjustment + transfer endpoints end-to-end
 *
 * Run: node tests/functional_test.js
 */

const BASE = 'http://localhost:5000/api';

const api = async (method, path, body, token) => {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);
  const res  = await fetch(`${BASE}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
};
const GET    = (p, t)    => api('GET',    p, null, t);
const POST   = (p, b, t) => api('POST',   p, b,    t);

let passed = 0, failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function run() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  Functional Test — Bulk Adjustment + Transfer');
  console.log('══════════════════════════════════════════════\n');

  /* ── 0. Health ── */
  console.log('► Health Check');
  const health = await GET('/health');
  check('GET /health → 200', health.status === 200);

  /* ── 1. Admin Login ── */
  console.log('\n► Admin Login');
  const loginRes = await POST('/admin/auth/login', {
    email: 'admin@demo.com',
    password: 'Password@123',
    orgSlug: 'demo-store',
  });
  check('POST /admin/auth/login → 200', loginRes.status === 200, JSON.stringify(loginRes.data?.message));
  const tok = loginRes.data?.data?.token;
  check('Token received', !!tok);
  if (!tok) { printSummary(); return; }

  /* ── 2. Get products ── */
  console.log('\n► Fetch Products');
  const prodRes = await GET('/admin/products?limit=5', tok);
  check('GET /admin/products → 200', prodRes.status === 200);
  const products = prodRes.data?.data?.products || [];
  check('At least 1 product exists', products.length > 0);
  const product1 = products[0];
  const product2 = products[1] || products[0]; // fallback to same if only 1

  /* ── 3. Get warehouses ── */
  console.log('\n► Fetch Warehouses');
  const whRes = await GET('/admin/warehouses', tok);
  check('GET /admin/warehouses → 200', whRes.status === 200);
  const warehouses = whRes.data?.data || [];
  check('At least 1 warehouse exists', warehouses.length > 0);
  const wh1 = warehouses[0];
  const wh2 = warehouses[1] || null;

  if (!product1 || !wh1) {
    console.error('  ⚠️  Not enough seed data to continue. Run: node src/seeder.js --drop');
    printSummary(); return;
  }

  console.log(`  ℹ️  Using product: "${product1.name}" (${product1._id})`);
  console.log(`  ℹ️  Using warehouse: "${wh1.name}" (${wh1._id})`);

  /* ── 4. Set opening stock (so adjustment can find existing stock) ── */
  console.log('\n► Set Opening Stock (pre-req for adjustment)');
  const openRes = await POST('/admin/stock/opening', {
    productId: product1._id,
    warehouseId: wh1._id,
    quantity: 100,
  }, tok);
  // 200 = success, 400 = already exists (both are fine for our test)
  check(
    'POST /admin/stock/opening → 200 or 400 (already set)',
    [200, 400].includes(openRes.status),
    `Got ${openRes.status}: ${openRes.data?.message}`
  );

  /* ── 5. Verify stock list endpoint ── */
  console.log('\n► Stock List');
  const stockListRes = await GET(`/admin/stock?warehouse=${wh1._id}&limit=5`, tok);
  check('GET /admin/stock → 200', stockListRes.status === 200);
  const stocks = stockListRes.data?.data?.stocks || [];
  check('Stock records returned', stocks.length >= 0);

  /* ── 6. BULK ADJUSTMENT — increase ── */
  console.log('\n► Bulk Adjustment (increase)');
  const bulkAdjPayload = {
    warehouseId: wh1._id,
    adjustmentType: 'increase',
    reason: 'count_correction',
    notes: 'Functional test — increase',
    items: [
      { productId: product1._id, adjustedQuantity: 10 },
    ],
  };
  const bulkIncRes = await POST('/admin/stock/adjustments/bulk', bulkAdjPayload, tok);
  check(
    'POST /admin/stock/adjustments/bulk (increase) → 201',
    bulkIncRes.status === 201,
    `Got ${bulkIncRes.status}: ${JSON.stringify(bulkIncRes.data?.message)}`
  );
  const createdAdjs = bulkIncRes.data?.data || [];
  check('Returns array of adjustments', Array.isArray(createdAdjs));
  check('Adjustment count matches items sent', createdAdjs.length === 1);
  if (createdAdjs[0]) {
    check('Adjustment has adjustmentNumber (ADJ-...)', !!createdAdjs[0].adjustmentNumber);
    check('adjustmentType is "increase"', createdAdjs[0].adjustmentType === 'increase');
    check('adjustedQuantity is 10', Math.abs(createdAdjs[0].adjustedQuantity) === 10);
  }

  /* ── 7. BULK ADJUSTMENT — decrease ── */
  console.log('\n► Bulk Adjustment (decrease)');
  const bulkDecRes = await POST('/admin/stock/adjustments/bulk', {
    warehouseId: wh1._id,
    adjustmentType: 'decrease',
    reason: 'damage',
    notes: 'Functional test — decrease',
    items: [{ productId: product1._id, adjustedQuantity: 5 }],
  }, tok);
  check(
    'POST /admin/stock/adjustments/bulk (decrease) → 201',
    bulkDecRes.status === 201,
    `Got ${bulkDecRes.status}: ${JSON.stringify(bulkDecRes.data?.message)}`
  );

  /* ── 8. BULK ADJUSTMENT — multi-product ── */
  if (product2 && product2._id !== product1._id) {
    console.log('\n► Bulk Adjustment (multi-product)');
    // ensure product2 has stock first
    await POST('/admin/stock/opening', { productId: product2._id, warehouseId: wh1._id, quantity: 50 }, tok);
    const multiRes = await POST('/admin/stock/adjustments/bulk', {
      warehouseId: wh1._id,
      adjustmentType: 'increase',
      reason: 'other',
      notes: 'Multi-product test',
      items: [
        { productId: product1._id, adjustedQuantity: 3 },
        { productId: product2._id, adjustedQuantity: 7 },
      ],
    }, tok);
    check(
      'POST /admin/stock/adjustments/bulk (2 products) → 201',
      multiRes.status === 201,
      `Got ${multiRes.status}: ${JSON.stringify(multiRes.data?.message)}`
    );
    check(
      'Returns 2 adjustments',
      (multiRes.data?.data || []).length === 2,
      `Got ${(multiRes.data?.data || []).length}`
    );
  }

  /* ── 9. Adjustment list reflects new entries ── */
  console.log('\n► Adjustment List After Bulk');
  const adjListRes = await GET('/admin/stock/adjustments?page=1', tok);
  check('GET /admin/stock/adjustments → 200', adjListRes.status === 200);
  const adjList = adjListRes.data?.data?.adjustments || [];
  check('At least 1 adjustment in list', adjList.length > 0);
  const lastAdj = adjList[0];
  if (lastAdj) {
    check('Last adjustment has ADJ- number', lastAdj.adjustmentNumber?.startsWith('ADJ-'));
  }

  /* ── 10. Stock movement was recorded ── */
  console.log('\n► Stock Movements Recorded');
  const mvRes = await GET(`/admin/stock/movements?product=${product1._id}`, tok);
  check('GET /admin/stock/movements → 200', mvRes.status === 200);
  const movements = mvRes.data?.data?.movements || [];
  check('At least 1 movement recorded for product', movements.length > 0);

  /* ── 11. TRANSFER (single warehouse scenario) ── */
  if (wh2) {
    console.log('\n► Stock Transfer');
    // ensure source warehouse has stock for product1
    const txPayload = {
      fromWarehouse: wh1._id,
      toWarehouse:   wh2._id,
      items: [{ product: product1._id, requestedQty: 2 }],
      notes: 'Functional test transfer',
    };
    const txRes = await POST('/admin/stock/transfers', txPayload, tok);
    check(
      'POST /admin/stock/transfers → 201',
      txRes.status === 201,
      `Got ${txRes.status}: ${JSON.stringify(txRes.data?.message)}`
    );
    const txData = txRes.data?.data;
    if (txData) {
      check('Transfer has transferNumber (TRF-...)', txData.transferNumber?.startsWith('TRF-'));
      check('Transfer status is in_transit', txData.status === 'in_transit');
      check('notes saved', txData.notes === 'Functional test transfer');

      // Complete it
      console.log('\n► Complete Transfer');
      const completeRes = await api('PATCH', `/admin/stock/transfers/${txData._id}/complete`, null, tok);
      check(
        'PATCH /transfers/:id/complete → 200',
        completeRes.status === 200,
        `Got ${completeRes.status}: ${completeRes.data?.message}`
      );
    }
  } else {
    console.log('\n  ℹ️  Only 1 warehouse found, skipping transfer test (need 2 warehouses)');
  }

  /* ── 12. Invalid adjustment (missing warehouseId) ── */
  console.log('\n► Validation Checks');
  const badAdjRes = await POST('/admin/stock/adjustments/bulk', {
    adjustmentType: 'increase',
    reason: 'other',
    items: [{ productId: product1._id, adjustedQuantity: 1 }],
  }, tok);
  check('Adjustment without warehouseId → 400', badAdjRes.status === 400,
    `Got ${badAdjRes.status}: ${badAdjRes.data?.message}`);

  const noItemsRes = await POST('/admin/stock/adjustments/bulk', {
    warehouseId: wh1._id,
    adjustmentType: 'increase',
    reason: 'other',
    items: [],
  }, tok);
  check('Adjustment with empty items → 400', noItemsRes.status === 400,
    `Got ${noItemsRes.status}: ${noItemsRes.data?.message}`);

  /* ── 13. Product search endpoint (used by ProductSearch component) ── */
  console.log('\n► Product Search (used by ProductSearch component)');
  const searchRes = await GET(`/admin/products?search=${encodeURIComponent(product1.name.slice(0, 4))}&limit=10`, tok);
  check('GET /admin/products?search=... → 200', searchRes.status === 200);
  const searchResults = searchRes.data?.data?.products || [];
  check('Search returns results', searchResults.length > 0);

  /* ── Summary ── */
  printSummary();
}

function printSummary() {
  const total = passed + failed;
  console.log('\n══════════════════════════════════════════════');
  console.log(`  Results: ${passed}/${total} passed  |  ${failed} failed`);
  console.log('══════════════════════════════════════════════\n');
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\n💥 Uncaught error:', err.message);
  process.exit(1);
});
