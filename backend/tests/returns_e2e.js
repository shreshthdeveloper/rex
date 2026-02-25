/**
 * E2E Return Flow Test — verifies all 5 case/subcases
 *
 * Tests:
 *  Case 1a — delivered, no payment, both items returned
 *  Case 1b — delivered, no payment, one item (B) returned
 *  Case 2a — delivered, partial payment (300), item B returned  → due > 0, returnDue = 0
 *  Case 2b — delivered, partial payment (300), item A returned  → due > 0, returnDue = 0
 *  Case 3a — delivered, overpay (700), item B returned          → due = 0, returnDue > 0
 *  Case 3b — delivered, overpay (700), item A returned          → due = 0, returnDue > 0
 *  Case 4  — no payment, all items returned                     → due=0, returnDue=0
 *  Case 5  — full payment, all items returned                   → due=0, returnDue=amountPaid
 *
 * Also verifies: ledger entries, stock movements
 *
 * Run: node tests/returns_e2e.js
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE    = 'http://localhost:5000/api';
const ORG     = 'demo-store';
const PASS    = 'Password@123';

let PASS_SP   = 'SuperAdmin@123';

const r2      = v => Math.round((Number(v) || 0) * 100) / 100;

/* ─── HTTP helpers ─── */
const api = async (method, path, body, token) => {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);
  const res  = await fetch(`${BASE}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
};
const GET    = (p, t)    => api('GET',    p, null, t);
const POST   = (p, b, t) => api('POST',   p, b, t);
const PATCH  = (p, b, t) => api('PATCH',  p, b, t);

/* ─── Logging helpers ─── */
let passed = 0, failed = 0;
const assert = (label, condition, got, expected) => {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} → got: ${JSON.stringify(got)}, expected: ${JSON.stringify(expected)}`);
    failed++;
  }
};
const section = (name) => console.log(`\n${'═'.repeat(60)}\n  ${name}\n${'═'.repeat(60)}`);
const info    = (msg) => console.log(`  ℹ  ${msg}`);

/* ─── Advance order through status pipeline ─── */
async function advanceTo(orderId, targetStatus, token) {
  // Minimal path: placed → processing → shipped → delivered
  const pipeline = {
    placed:     'processing',
    processing: 'shipped',
    shipped:    'delivered',
  };
  let r = await GET(`/admin/orders/${orderId}`, token);
  let current = r.data?.data?.order?.status;
  const visited = new Set();
  while (current !== targetStatus) {
    if (visited.has(current)) { console.error(`  ❌ Cycle detected at ${current}`); break; }
    visited.add(current);
    const next = pipeline[current];
    if (!next) { console.error(`  ❌ No path from ${current} to ${targetStatus}`); break; }
    r = await PATCH(`/admin/orders/${orderId}/status`, { status: next }, token);
    if (r.status !== 200) { console.error(`  ❌ Failed to advance to ${next}: ${JSON.stringify(r.data?.message)}`); break; }
    current = next;
  }
}

/* ─── Fetch ledger entries for order ─── */
async function getLedgerForOrder(customerId, orderNumber, token) {
  const r = await GET(`/admin/customers/${customerId}/ledger?limit=50`, token);
  const entries = r.data?.data?.entries || r.data?.data || [];
  return entries.filter(e => e.referenceNumber === orderNumber || (e.narration || '').includes(orderNumber));
}

/* ─── Fetch stock for product at warehouse ─── */
async function getStock(productId, warehouseId, token) {
  const r = await GET(`/admin/stock?product=${productId}&warehouse=${warehouseId}`, token);
  const list = r.data?.data?.stocks || r.data?.data || [];
  return list.find(s => String(s.product?._id || s.product) === String(productId)) || null;
}

/* ─── Main test runner ─── */
async function run() {
  console.log('\n🧪  Returns E2E Test Suite\n');

  /* ── 1. Auth ── */
  section('Setup: Auth');

  let r = await POST('/admin/auth/login', { email: 'admin@demo.com', password: PASS, orgSlug: ORG });
  assert('Admin login 200', r.status === 200, r.status, 200);
  const token = r.data?.data?.token;
  if (!token) { console.error('Cannot continue without admin token'); process.exit(1); }

  /* ── 2. Seed: warehouse, customer, products ── */
  section('Setup: Seed data');

  // Get warehouse
  r = await GET('/admin/warehouses', token);
  const warehouses = r.data?.data?.warehouses || r.data?.data || [];
  const wh = warehouses[0];
  assert('Warehouse found', !!wh, !!wh, true);
  info(`Using warehouse: ${wh?.name} (${wh?._id})`);

  // Create a fresh test customer (zero balance always)
  const custEmail = `test_returns_${Date.now()}@test.com`;
  r = await POST('/admin/customers', {
    name: 'Returns Test Customer', email: custEmail, phone: '9999999900',
  }, token);
  assert('Customer created', [200, 201].includes(r.status), r.status, '200/201');
  const customer = r.data?.data;
  info(`Customer: ${customer?.name} (${customer?._id})`);

  // Create product A: price 600, GST 5% → lineTotal = 630
  // Create product B: price 400, GST 5% → lineTotal = 420, grandTotal = 1050
  // Get GST 5% tax slab
  r = await GET('/admin/tax-slabs', token);
  const taxSlabs = r.data?.data?.taxSlabs || r.data?.data || [];
  const gst5 = taxSlabs.find(t => t.rate === 5);
  assert('GST 5% slab found', !!gst5, !!gst5, true);
  info(`Tax slab: ${gst5?.name} (rate: ${gst5?.rate}%)`);

  // Get a unit
  r = await GET('/admin/units', token);
  const units = r.data?.data?.units || r.data?.data || [];
  const unit = units[0];
  assert('Unit found', !!unit, !!unit, true);

  // Create product A
  r = await POST('/admin/products', {
    name: 'Return Test Product A', sku: `RET-A-${Date.now()}`, type: 'single',
    basePrice: 600, costPrice: 400, taxSlab: gst5._id, unit: unit._id, isActive: true,
  }, token);
  assert('Product A created', [200, 201].includes(r.status), r.status, '200/201');
  const productA = r.data?.data;
  info(`Product A: ${productA?.name} price=600 → lineTotal=630`);

  // Create product B
  r = await POST('/admin/products', {
    name: 'Return Test Product B', sku: `RET-B-${Date.now()}`, type: 'single',
    basePrice: 400, costPrice: 250, taxSlab: gst5._id, unit: unit._id, isActive: true,
  }, token);
  assert('Product B created', [200, 201].includes(r.status), r.status, '200/201');
  const productB = r.data?.data;
  info(`Product B: ${productB?.name} price=400 → lineTotal=420`);

  // Set stock for both products at warehouse
  for (const [prod, qty] of [[productA, 200], [productB, 200]]) {
    r = await POST('/admin/stock/opening', {
      productId: prod._id, warehouseId: wh._id, quantity: qty,
    }, token);
    assert(`Stock set for ${prod.name}`, [200, 201].includes(r.status), r.status, '200/201');
  }

  // Compute expected line totals
  const taxRate = gst5.rate; // 5
  const priceA  = 600, priceB  = 400;
  const ltA     = r2(priceA + (priceA * taxRate / 100)); // 630
  const ltB     = r2(priceB + (priceB * taxRate / 100)); // 420
  const grandTotal = r2(ltA + ltB);                       // 1050
  info(`Expected: grandTotal=${grandTotal}, ltA=${ltA}(A), ltB=${ltB}(B)`);

  /* ─── Helper: create order + advance to delivered ─── */
  async function makeDeliveredOrder() {
    r = await POST('/admin/orders', {
      customerId: customer._id, warehouseId: wh._id,
      items: [
        { productId: productA._id, quantity: 1, unitPrice: priceA },
        { productId: productB._id, quantity: 1, unitPrice: priceB },
      ],
    }, token);
    assert('Order created', [200, 201].includes(r.status), r.status, '200/201');
    const orderId = r.data?.data?._id;
    await advanceTo(orderId, 'delivered', token);
    r = await GET(`/admin/orders/${orderId}`, token);
    const order = r.data?.data?.order;
    assert(`Order ${order?.orderNumber} delivered`, order?.status === 'delivered', order?.status, 'delivered');
    return order;
  }

  /* ─── Helper: initiate return ─── */
  async function initiateReturn(order, lineItems) {
    const items = lineItems.map(({ lineItemId, product, qty }) => ({
      lineItemId, product, returnQty: qty, reason: 'Test return',
    }));
    r = await POST(`/admin/orders/${order._id}/returns`, {
      returnType: items.length >= order.items.length ? 'full' : 'partial',
      items,
      returnWarehouse: wh._id,
    }, token);
    if (![200, 201].includes(r.status)) {
      info(`initiateReturn failed ${r.status}: ${r.data?.message || JSON.stringify(r.data)}`);
      info(`  items sent: ${JSON.stringify(items)}`);
      info(`  order._id: ${order._id}, order.items[0]: ${JSON.stringify(order.items?.[0])}`);
    }
    assert('Return initiated', [200, 201].includes(r.status), r.status, '200/201');
    return r.data?.data?._id;
  }

  /* ─── Helper: approve return ─── */
  async function approveReturn(order, returnId) {
    r = await PATCH(`/admin/orders/${order._id}/returns/${returnId}/approve`, {
      refundMethod: 'cash',
    }, token);
    assert('Return approved', r.status === 200, r.status, 200);
    // Reload order
    const ro = await GET(`/admin/orders/${order._id}`, token);
    return ro.data?.data?.order;
  }

  /* ─── Helper: record payment ─── */
  async function payOrder(orderId, amount) {
    // First advance to processing if still in placed
    r = await GET(`/admin/orders/${orderId}`, token);
    const st = r.data?.data?.order?.status;
    if (st === 'placed') {
      await PATCH(`/admin/orders/${orderId}/status`, { status: 'processing' }, token);
    }
    r = await POST(`/admin/orders/${orderId}/payments`, {
      amount, method: 'cash',
    }, token);
    assert(`Payment ${amount} recorded`, r.status === 200, r.status, 200);
  }

  /*************************************************************
   * CASE 1a — no payment, both items returned
   *   expected: sellReturn=1050, balanceDue=0, returnDue=0
   *************************************************************/
  section('Case 1a: No payment — both items returned');
  {
    const order = await makeDeliveredOrder();
    const lineA = order.items.find(i => String(i.product) === String(productA._id) || i.productSnapshot?.sku === productA.sku);
    const lineB = order.items.find(i => String(i.product) === String(productB._id) || i.productSnapshot?.sku === productB.sku);

    // Get stock pre-return
    const stockABefore = await getStock(String(productA._id), String(wh._id), token);
    const stockBBefore = await getStock(String(productB._id), String(wh._id), token);

    const returnId = await initiateReturn(order, [
      { lineItemId: lineA._id, product: String(lineA.product), qty: 1 },
      { lineItemId: lineB._id, product: String(lineB.product), qty: 1 },
    ]);

    // After initiate: order should NOT have sellReturn yet
    r = await GET(`/admin/orders/${order._id}`, token);
    const postInitiate = r.data?.data?.order;
    assert('After initiate: sellReturn still 0', (postInitiate.sellReturn || 0) === 0, postInitiate.sellReturn, 0);
    assert('After initiate: balanceDue unchanged', r2(postInitiate.balanceDue) === r2(order.balanceDue), postInitiate.balanceDue, order.balanceDue);

    // Stock quarantine check: qty went up, available unchanged (reserved also went up)
    const stockAMid = await getStock(String(productA._id), String(wh._id), token);
    if (stockAMid) {
      const qtyUp = (stockAMid.quantity || 0) === (stockABefore?.quantity || 0) + 1;
      const reserveUp = (stockAMid.reservedQuantity || 0) === (stockABefore?.reservedQuantity || 0) + 1;
      const availSame = (stockAMid.quantity - stockAMid.reservedQuantity) === (stockABefore.quantity - stockABefore.reservedQuantity);
      assert('Stock A quarantined: qty+1', qtyUp, stockAMid.quantity, (stockABefore?.quantity || 0) + 1);
      assert('Stock A quarantined: reserved+1', reserveUp, stockAMid.reservedQuantity, (stockABefore?.reservedQuantity || 0) + 1);
      assert('Stock A quarantined: available unchanged', availSame, stockAMid.quantity - stockAMid.reservedQuantity, stockABefore.quantity - stockABefore.reservedQuantity);
    }

    const finalOrder = await approveReturn(order, returnId);
    assert('Case 1a: sellReturn = grandTotal', r2(finalOrder.sellReturn) === r2(grandTotal), finalOrder.sellReturn, grandTotal);
    assert('Case 1a: balanceDue = 0', r2(finalOrder.balanceDue) === 0, finalOrder.balanceDue, 0);
    assert('Case 1a: returnDue = 0', r2(finalOrder.returnDue || 0) === 0, finalOrder.returnDue, 0);
    assert('Case 1a: paymentStatus = unpaid', finalOrder.paymentStatus === 'unpaid', finalOrder.paymentStatus, 'unpaid');
    assert('Case 1a: order status = return', finalOrder.status === 'return', finalOrder.status, 'return');

    // Stock after approve: reserved went back down, available increased
    const stockAAfter = await getStock(String(productA._id), String(wh._id), token);
    if (stockAAfter && stockAMid) {
      assert('Stock A after approve: reserved restored', (stockAAfter.reservedQuantity || 0) === (stockABefore?.reservedQuantity || 0), stockAAfter.reservedQuantity, stockABefore?.reservedQuantity);
      assert('Stock A after approve: qty still+1', stockAAfter.quantity === stockAMid.quantity, stockAAfter.quantity, stockAMid.quantity);
    }

    // Ledger: should have invoice (debit) when moved to processing + credit_note (credit) on approval
    const ledger = await getLedgerForOrder(customer._id, order.orderNumber, token);
    const invoice = ledger.find(e => e.transactionType === 'invoice');
    const creditNote = ledger.find(e => e.transactionType === 'credit_note');
    assert('Case 1a: ledger has invoice', !!invoice, !!invoice, true);
    assert('Case 1a: ledger credit_note = grandTotal', creditNote && r2(creditNote.credit) === r2(grandTotal), creditNote?.credit, grandTotal);
    assert('Case 1a: credit_note narration says goods credit (not refund)', creditNote?.narration?.includes('goods credit'), creditNote?.narration, 'goods credit …');
    info(`Case 1a ✔ Total=${finalOrder.grandTotal}, Paid=${finalOrder.amountPaid}, Due=${finalOrder.balanceDue}, SellReturn=${finalOrder.sellReturn}, ReturnDue=${finalOrder.returnDue}`);
  }

  /*************************************************************
   * CASE 1b — no payment, only item B returned
   *   expected: sellReturn=420, balanceDue=630, returnDue=0
   *************************************************************/
  section('Case 1b: No payment — item B returned only');
  {
    const order = await makeDeliveredOrder();
    const lineB = order.items.find(i => String(i.product) === String(productB._id) || i.productSnapshot?.sku === productB.sku);
    const returnId = await initiateReturn(order, [
      { lineItemId: lineB._id, product: String(lineB.product), qty: 1 },
    ]);
    const finalOrder = await approveReturn(order, returnId);
    assert('Case 1b: sellReturn = ltB', r2(finalOrder.sellReturn) === r2(ltB), finalOrder.sellReturn, ltB);
    assert('Case 1b: balanceDue = ltA', r2(finalOrder.balanceDue) === r2(ltA), finalOrder.balanceDue, ltA);
    assert('Case 1b: returnDue = 0', r2(finalOrder.returnDue || 0) === 0, finalOrder.returnDue, 0);
    assert('Case 1b: paymentStatus = unpaid', finalOrder.paymentStatus === 'unpaid', finalOrder.paymentStatus, 'unpaid');
    assert('Case 1b: order status = partial_return', finalOrder.status === 'partial_return', finalOrder.status, 'partial_return');
    info(`Case 1b ✔ Total=${finalOrder.grandTotal}, Paid=${finalOrder.amountPaid}, Due=${finalOrder.balanceDue}, SellReturn=${finalOrder.sellReturn}, ReturnDue=${finalOrder.returnDue}`);
  }

  /*************************************************************
   * CASE 2a — partial payment 300, item B returned
   *   effectiveOwed = grandTotal - ltB = ltA = 630
   *   due = 630 - 300 = 330, returnDue = 0
   *************************************************************/
  section('Case 2a: Payment=300, item B returned');
  {
    const order = await makeDeliveredOrder();
    await payOrder(order._id, 300);
    const refreshed = (await GET(`/admin/orders/${order._id}`, token)).data?.data?.order;
    const lineB = refreshed.items.find(i => String(i.product) === String(productB._id) || i.productSnapshot?.sku === productB.sku);
    const returnId = await initiateReturn(refreshed, [
      { lineItemId: lineB._id, product: String(lineB.product), qty: 1 },
    ]);
    const finalOrder = await approveReturn(refreshed, returnId);
    const expectedDue = r2(ltA - 300); // 330
    assert('Case 2a: sellReturn = ltB', r2(finalOrder.sellReturn) === r2(ltB), finalOrder.sellReturn, ltB);
    assert('Case 2a: balanceDue = ltA - 300', r2(finalOrder.balanceDue) === r2(expectedDue), finalOrder.balanceDue, expectedDue);
    assert('Case 2a: returnDue = 0', r2(finalOrder.returnDue || 0) === 0, finalOrder.returnDue, 0);
    assert('Case 2a: paymentStatus = partial', finalOrder.paymentStatus === 'partial', finalOrder.paymentStatus, 'partial');
    info(`Case 2a ✔ Total=${finalOrder.grandTotal}, Paid=${finalOrder.amountPaid}, Due=${finalOrder.balanceDue}, SellReturn=${finalOrder.sellReturn}, ReturnDue=${finalOrder.returnDue}`);
  }

  /*************************************************************
   * CASE 2b — partial payment 300, item A returned
   *   effectiveOwed = grandTotal - ltA = ltB = 420
   *   due = 420 - 300 = 120, returnDue = 0
   *************************************************************/
  section('Case 2b: Payment=300, item A returned');
  {
    const order = await makeDeliveredOrder();
    await payOrder(order._id, 300);
    const refreshed = (await GET(`/admin/orders/${order._id}`, token)).data?.data?.order;
    const lineA = refreshed.items.find(i => String(i.product) === String(productA._id) || i.productSnapshot?.sku === productA.sku);
    const returnId = await initiateReturn(refreshed, [
      { lineItemId: lineA._id, product: String(lineA.product), qty: 1 },
    ]);
    const finalOrder = await approveReturn(refreshed, returnId);
    const expectedDue = r2(ltB - 300); // 120
    assert('Case 2b: sellReturn = ltA', r2(finalOrder.sellReturn) === r2(ltA), finalOrder.sellReturn, ltA);
    assert('Case 2b: balanceDue = ltB - 300', r2(finalOrder.balanceDue) === r2(expectedDue), finalOrder.balanceDue, expectedDue);
    assert('Case 2b: returnDue = 0', r2(finalOrder.returnDue || 0) === 0, finalOrder.returnDue, 0);
    info(`Case 2b ✔ Total=${finalOrder.grandTotal}, Paid=${finalOrder.amountPaid}, Due=${finalOrder.balanceDue}, SellReturn=${finalOrder.sellReturn}, ReturnDue=${finalOrder.returnDue}`);
  }

  /*************************************************************
   * CASE 3a — payment 700, item B returned
   *   effectiveOwed = grandTotal - ltB = ltA = 630
   *   paid(700) > effectiveOwed(630) → due=0, returnDue=70
   *************************************************************/
  section('Case 3a: Payment=700, item B returned → returnDue');
  {
    const order = await makeDeliveredOrder();
    await payOrder(order._id, 700);
    const refreshed = (await GET(`/admin/orders/${order._id}`, token)).data?.data?.order;
    const lineB = refreshed.items.find(i => String(i.product) === String(productB._id) || i.productSnapshot?.sku === productB.sku);
    const returnId = await initiateReturn(refreshed, [
      { lineItemId: lineB._id, product: String(lineB.product), qty: 1 },
    ]);
    const finalOrder = await approveReturn(refreshed, returnId);
    const expectedReturnDue = r2(700 - ltA); // 700-630=70
    assert('Case 3a: sellReturn = ltB', r2(finalOrder.sellReturn) === r2(ltB), finalOrder.sellReturn, ltB);
    assert('Case 3a: balanceDue = 0', r2(finalOrder.balanceDue) === 0, finalOrder.balanceDue, 0);
    assert('Case 3a: returnDue = 700 - ltA', r2(finalOrder.returnDue || 0) === r2(expectedReturnDue), finalOrder.returnDue, expectedReturnDue);
    assert('Case 3a: paymentStatus = paid', finalOrder.paymentStatus === 'paid', finalOrder.paymentStatus, 'paid');
    info(`Case 3a ✔ Total=${finalOrder.grandTotal}, Paid=${finalOrder.amountPaid}, Due=${finalOrder.balanceDue}, SellReturn=${finalOrder.sellReturn}, ReturnDue=${finalOrder.returnDue}`);
  }

  /*************************************************************
   * CASE 3b — payment 700, item A returned
   *   effectiveOwed = grandTotal - ltA = ltB = 420
   *   paid(700) > effectiveOwed(420) → due=0, returnDue=280
   *************************************************************/
  section('Case 3b: Payment=700, item A returned → returnDue');
  {
    const order = await makeDeliveredOrder();
    await payOrder(order._id, 700);
    const refreshed = (await GET(`/admin/orders/${order._id}`, token)).data?.data?.order;
    const lineA = refreshed.items.find(i => String(i.product) === String(productA._id) || i.productSnapshot?.sku === productA.sku);
    const returnId = await initiateReturn(refreshed, [
      { lineItemId: lineA._id, product: String(lineA.product), qty: 1 },
    ]);
    const finalOrder = await approveReturn(refreshed, returnId);
    const expectedReturnDue = r2(700 - ltB); // 700-420=280
    assert('Case 3b: sellReturn = ltA', r2(finalOrder.sellReturn) === r2(ltA), finalOrder.sellReturn, ltA);
    assert('Case 3b: balanceDue = 0', r2(finalOrder.balanceDue) === 0, finalOrder.balanceDue, 0);
    assert('Case 3b: returnDue = 700 - ltB', r2(finalOrder.returnDue || 0) === r2(expectedReturnDue), finalOrder.returnDue, expectedReturnDue);
    info(`Case 3b ✔ Total=${finalOrder.grandTotal}, Paid=${finalOrder.amountPaid}, Due=${finalOrder.balanceDue}, SellReturn=${finalOrder.sellReturn}, ReturnDue=${finalOrder.returnDue}`);
  }

  /*************************************************************
   * CASE 4 — no payment, all items returned
   *   sellReturn=1050, balanceDue=0, returnDue=0
   *   (same math as 1a, different because user listed separately)
   *************************************************************/
  section('Case 4: No payment — all returned (no refund owed)');
  {
    const order = await makeDeliveredOrder();
    const lineA = order.items.find(i => String(i.product) === String(productA._id) || i.productSnapshot?.sku === productA.sku);
    const lineB = order.items.find(i => String(i.product) === String(productB._id) || i.productSnapshot?.sku === productB.sku);
    const returnId = await initiateReturn(order, [
      { lineItemId: lineA._id, product: String(lineA.product), qty: 1 },
      { lineItemId: lineB._id, product: String(lineB.product), qty: 1 },
    ]);
    const finalOrder = await approveReturn(order, returnId);
    assert('Case 4: sellReturn = grandTotal', r2(finalOrder.sellReturn) === r2(grandTotal), finalOrder.sellReturn, grandTotal);
    assert('Case 4: balanceDue = 0', r2(finalOrder.balanceDue) === 0, finalOrder.balanceDue, 0);
    assert('Case 4: returnDue = 0', r2(finalOrder.returnDue || 0) === 0, finalOrder.returnDue, 0);
    assert('Case 4: paymentStatus = unpaid', finalOrder.paymentStatus === 'unpaid', finalOrder.paymentStatus, 'unpaid');
    info(`Case 4 ✔ Total=${finalOrder.grandTotal}, Paid=${finalOrder.amountPaid}, Due=${finalOrder.balanceDue}, SellReturn=${finalOrder.sellReturn}, ReturnDue=${finalOrder.returnDue}`);
  }

  /*************************************************************
   * CASE 5 — full payment, all items returned
   *   paid=grandTotal, sellReturn=grandTotal, balanceDue=0,
   *   returnDue=grandTotal (full refund owed)
   *************************************************************/
  section('Case 5: Full payment — all items returned → full refund due');
  {
    const order = await makeDeliveredOrder();
    await payOrder(order._id, grandTotal);
    const refreshed = (await GET(`/admin/orders/${order._id}`, token)).data?.data?.order;
    const lineA = refreshed.items.find(i => String(i.product) === String(productA._id) || i.productSnapshot?.sku === productA.sku);
    const lineB = refreshed.items.find(i => String(i.product) === String(productB._id) || i.productSnapshot?.sku === productB.sku);
    const returnId = await initiateReturn(refreshed, [
      { lineItemId: lineA._id, product: String(lineA.product), qty: 1 },
      { lineItemId: lineB._id, product: String(lineB.product), qty: 1 },
    ]);
    const finalOrder = await approveReturn(refreshed, returnId);
    assert('Case 5: sellReturn = grandTotal', r2(finalOrder.sellReturn) === r2(grandTotal), finalOrder.sellReturn, grandTotal);
    assert('Case 5: balanceDue = 0', r2(finalOrder.balanceDue) === 0, finalOrder.balanceDue, 0);
    assert('Case 5: returnDue = amountPaid', r2(finalOrder.returnDue || 0) === r2(grandTotal), finalOrder.returnDue, grandTotal);
    assert('Case 5: paymentStatus = paid', finalOrder.paymentStatus === 'paid', finalOrder.paymentStatus, 'paid');

    // Ledger: should have invoice + payment + credit_note
    const ledger = await getLedgerForOrder(customer._id, refreshed.orderNumber, token);
    const invoice = ledger.find(e => e.transactionType === 'invoice');
    const payment = ledger.find(e => e.transactionType === 'payment');
    const creditNote = ledger.find(e => e.transactionType === 'credit_note');
    assert('Case 5: ledger has invoice', !!invoice, !!invoice, true);
    assert('Case 5: ledger has payment', !!payment, !!payment, true);
    assert('Case 5: ledger credit_note = grandTotal', creditNote && r2(creditNote.credit) === r2(grandTotal), creditNote?.credit, grandTotal);
    assert('Case 5: credit_note narration says goods credit', creditNote?.narration?.includes('goods credit'), creditNote?.narration, 'goods credit …');
    assert('Case 5: credit_note narration shows cash refund amount', creditNote?.narration?.includes(`cash refund ₹${grandTotal.toFixed(2)}`), creditNote?.narration, `cash refund ₹${grandTotal.toFixed(2)} …`);
    info(`Case 5 ✔ Total=${finalOrder.grandTotal}, Paid=${finalOrder.amountPaid}, Due=${finalOrder.balanceDue}, SellReturn=${finalOrder.sellReturn}, ReturnDue=${finalOrder.returnDue}`);
  }

  /*************************************************************
   * GUARD: approve without refundMethod must fail
   *************************************************************/
  section('Guard: Approve without refundMethod → 400');
  {
    const order = await makeDeliveredOrder();
    const lineA = order.items.find(i => String(i.product) === String(productA._id) || i.productSnapshot?.sku === productA.sku);
    const returnId = await initiateReturn(order, [
      { lineItemId: lineA._id, product: String(lineA.product), qty: 1 },
    ]);
    r = await PATCH(`/admin/orders/${order._id}/returns/${returnId}/approve`, {}, token);
    assert('Guard: missing method → 400', r.status === 400, r.status, 400);
    r = await PATCH(`/admin/orders/${order._id}/returns/${returnId}/approve`, { refundMethod: 'bitcoin' }, token);
    assert('Guard: invalid method → 400', r.status === 400, r.status, 400);
    info('Guards ✔ Both invalid approve attempts correctly rejected');
  }

  /* ─── Summary ─── */
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(60)}\n`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
