# Task Log

All completed tasks are recorded here. After finishing any task or feature, append an entry below.

---

## 2025-07-14 — Modal portal fix
White space issue in modals fixed by using `createPortal` to render modals into `document.body` and applying `z-[200]`.
**Files:** `frontend/src/components/ui/index.jsx`

---

## 2025-07-14 — DataTable scrollable prop
Added `scrollable` prop to `DataTable` component. When enabled, table wraps in an `overflow-x-auto` container with `min-w-[1100px]`, `px-5`, and `whitespace-nowrap` on cells.
**Files:** `frontend/src/components/ui/index.jsx`

---

## 2025-07-14 — Parent product stock DB cleanup
Ran one-off script to delete stale `ProductStock` records for 4 parent products (3 records deleted) in the Demo Store database.
**Files:** `backend/scripts/cleanup_parent_stock.js`

---

## 2025-07-14 — Parent cost/price columns show "Variable"
In the products table, cost price and base price columns for `parent` type products now render italic grey "Variable" text instead of raw values.
**Files:** `frontend/src/pages/admin/Products.jsx`

---

## 2025-07-14 — Variant multi-image support
Each variant row in the create/edit form now holds an `images[]` array. A camera icon button with a count badge toggles an expandable image panel per row, supporting upload (via `uploadAPI`) and removal.
**Files:** `frontend/src/pages/admin/Products.jsx`

---

## 2025-07-14 — Remove warehousePrice fallback from priceResolver
Removed the deprecated `warehousePrice` fallback lookup from the price resolution service.
**Files:** `backend/src/services/priceResolver.js`

---

## 2025-07-14 — Cleanup: migrate script & unused imports
Moved `migrate_supplier_price.js` to `backend/scripts/`. Removed unused `Package` icon import and dead code.
**Files:** `backend/scripts/migrate_supplier_price.js`, `frontend/src/pages/admin/Products.jsx`

---

## 2025-07-14 — View modal redesign
Completely redesigned the product view modal:
- Size changed to 70 vw × 80 vh (new `view` size added to Modal)
- Removed tab navigation — all sections rendered inline with section headers
- Parent products: pricing and stock sections are hidden (only variants table shown)
- Variants table shows image thumbnail as first column with fallback initials avatar
- Stock section shows an "Available" column (qty − reserved)
- Removed "Add Variant" and "Add Image URL" forms from view modal
- Cleaned up legacy state: `viewTab`, `variantForm`, `imageForm`, `addingVariant`, `addingImage`
- Removed unused functions: `handleAddVariant`, `handleAddImage`
- Removed `TabList` import (no longer used in Products.jsx)

**Files:** `frontend/src/pages/admin/Products.jsx`, `frontend/src/components/ui/index.jsx`

---

## 2025-07-14 — Edit variant rows: image thumbnail first column
In the create/edit product form variant table, each variant row now shows a 32×32 image thumbnail (or letter avatar) as the first column. Column proportions rebalanced to keep 12-column grid.
**Files:** `frontend/src/pages/admin/Products.jsx`

---

## 2026-02-25 — Parent product view: stock table by variant & warehouse
Added a stock table for parent products in the view modal. Table shows variants as rows, warehouses as columns, with qty and reserved (in parentheses) per cell. Includes totals per variant and per warehouse in footer.
**Files:** `frontend/src/pages/admin/Products.jsx`

---

## 2026-02-25 — Stock table tooltips + reserved field bug fix
Added `title` tooltips to every cell in the variant×warehouse stock matrix (Qty · Reserved · Available per cell, per variant row total, per warehouse column total, and grand total corner). Fixed field-name inconsistency: raw `ProductStock` docs from the API use `reservedQuantity`, not `reserved` — all stock table reads in the view modal now use `s?.reservedQuantity ?? s?.reserved ?? 0` uniformly. Grand total footer only renders the reserved line when non-zero.
**Files:** `frontend/src/pages/admin/Products.jsx`


## 2026-02-25 - ProductSearch enhancements + Orders refactor
Variants now appear in ProductSearch dropdown when query >= 3 chars. Parent click opens variant picker modal instead of auto-adding all variants. Orders.jsx inline search removed and replaced with ProductSearch component.

**Files:** frontend/src/components/ProductSearch.jsx, frontend/src/pages/admin/Orders.jsx


## 2026-02-25 - Order history change details, Ship action, Payments modal, saleType/orderSource fix, ledger timing fix
1. History tab now shows grand total change for each edit entry (from/to) by comparing consecutive editHistory snapshots.
2. Shipping transition removed from Status tab; dedicated Truck icon button added to list for processing orders, opens ship confirmation modal with address and status flow.
3. Payments tab removed from detail modal; CreditCard icon in list opens standalone Payments modal with full payment list + record payment form.
4. saleType/orderSource/referenceNumber now saved on order edit (backend extracted them from req.body). POS and Website added to orderSource options in model enum and frontend Select.
5. Ledger invoice now posted at processing status (not at placement/draft). Edit while in processing creates debit_note (increase) or credit_note (decrease). Cancel/delete credit-note only fires if order was previously invoiced (processing+).

**Files:** backend/src/controllers/admin/orders.controller.js, backend/src/models/org/Order.js, frontend/src/pages/admin/Orders.jsx


## 2026-02-25 - Order history change details, Ship action, Payments modal, saleType/orderSource fix, ledger timing fix
1. History tab now shows grand total change for each edit entry (from/to) by comparing consecutive editHistory snapshots.
2. Status tab removed from view modal; dedicated Truck icon button added to list for all advanceable orders, opens ship/status confirmation modal.
3. Payments tab removed from view modal; CreditCard icon in list opens standalone Payments modal with full payment list + record payment form. Add Payment only shown for processing+ orders.
4. saleType/orderSource/referenceNumber now saved on order edit (backend extracted them from req.body). POS and Website added to orderSource options in model enum and frontend Select. saleType/orderSource/referenceNumber shown in Details tab.
5. Ledger invoice now posted at processing status (not at placement). Edit while in processing creates debit_note (increase) or credit_note (decrease). Cancel/delete credit-note only fires if order was previously invoiced (processing+).

**Files:** backend/src/controllers/admin/orders.controller.js, backend/src/models/org/Order.js, frontend/src/pages/admin/Orders.jsx


## 2026-02-25 - Orders: 6 fixes
1. History tab shows grand total changes (from/to) for edits
2. Status tab removed from view modal, Truck icon in orders list for status actions
3. Payments extracted to standalone modal, CreditCard icon in list for processing+ orders
4. saleType/orderSource/referenceNumber saving/loading fixed, POS/Website options added
5. Ledger timing fixed: invoice posts at processing (not placement), adjustments on edits
6. Payment recording restricted to processing+ status, no ledger entries on order creation

**Files:** backend/src/controllers/admin/orders.controller.js, backend/src/models/org/Order.js, frontend/src/pages/admin/Orders.jsx


## 2026-02-25 - Customer balance header fix, stock reservation timing, payment cap, invoice refresh

1. Customer modal header balance now shows live value (fresh API fetch on modal open + after topup/adjust), not stale list data.
2. Stock reservation moved: `reserveStock` now runs when order status → `shipped` (not at order creation). `deductOnShipment` runs at `delivered`. `releaseReserved` on cancel only if order was in shipped/in_transit/out_for_delivery/failed_delivery. `updateOrder` no longer manipulates reserved stock.
3. Payment recording capped: backend rejects amount > balanceDue; frontend shows max in label and validates before API call.
4. Invoice tab auto-refreshes after payment is recorded via the standalone Payments modal (if detail modal is open on the invoice tab for the same order).

**Files:** frontend/src/pages/admin/Customers.jsx, frontend/src/pages/admin/Orders.jsx, backend/src/controllers/admin/orders.controller.js


## 2026-02-25 11:25 - Legacy cleanup after orders/customer refactor

1. Removed deprecated detail-modal payment/status legacy flow from Orders page (`detailPayments/detailReturns` state, `handleRecordPayment`, old payments/status render blocks, and old tab fetch branch for `payments`).
2. Simplified detail modal refresh logic to only keep active tabs (`returns`, `invoice`, `history`) and current modal-based status/payment actions.
3. Updated outdated stock service comments to match current lifecycle: reserve on shipped-flow, deduct on delivery, release on cancel/failure.

**Files:** frontend/src/pages/admin/Orders.jsx, backend/src/services/stockService.js


## 2026-02-25 12:05 - ProductSearch stock visibility + return/refund accounting overhaul

1. ProductSearch now includes individual variants in search results consistently and shows stock split as Total, Reserved, and Available.
2. Create/Edit Order line-items table now has an explicit Available Qty column per item (warehouse-aware).
3. Return UI fixed: returned items render correct product + `returnQty` (no more `Item xundefined`), and table now shows both Return Value and Refund.
4. Return valuation now uses original sale unit price × returned quantity per line item, stored in return rows (`unitPrice`, `lineAmount`) and return header (`returnValue`).
5. Refund eligibility is computed server-side using payment/due logic across cumulative returns:
	- Return value always reduces receivable via customer ledger `credit_note`.
	- Refund amount is only the overpaid part after due adjustment (never more than paid amount, and net of previously recorded refunds).
6. Order financial state is recalculated after returns (`balanceDue`, `paymentStatus`) and return stock is restored with proper stock-movement reference linkage.
7. Product list search API fixed to respect explicit `type` filters during search (variant search now returns variants correctly).

**Files:** frontend/src/components/ProductSearch.jsx, frontend/src/pages/admin/Orders.jsx, backend/src/controllers/admin/orders.controller.js, backend/src/controllers/admin/products.controller.js, backend/src/models/org/OrderReturn.js

---

## 2026-02-25 14:00 - Fix stock reservation error message + stockCache invalidation

**Root cause of user confusion:** When `reserveStock` throws (no `ProductStock` record for that product+warehouse — opening stock was never configured), the `withTransaction` aborts the whole block, so the status does NOT actually change to `shipped`. The user likely dismissed the brief `toast.error` without reading it, then saw the order in an unchanged state and concluded "shipped but not reserved."

**Fixes:**
1. `reserveStock` error message sharpened to: "No stock record found for this product in the selected warehouse. Please set opening stock first." — makes the action clear.
2. `deductOnShipment` error message similarly sharpened.
3. `handleStatusModalAction` in `Orders.jsx` now deletes affected productIds from `stockCache` after a successful status update, so the Available Qty column re-fetches fresh reserved counts immediately.

**Files:** backend/src/services/stockService.js, frontend/src/pages/admin/Orders.jsx

---

## 2026-02-25 15:30 - Fix race condition in updateStatus & manually repair ORD-00020 reservation

**Root cause (investigated via Atlas DB queries and isolation test):** `reserveStock` and session-based saves both work correctly (confirmed with a live script against Atlas). The issue was architectural: `order` was fetched **outside** the transaction with `findById`, then re-saved **inside** the transaction. A concurrent delivery of another order could race between these two steps, resetting `reservedQuantity` to 0 just before or after the commit. Because the saves weren't fully atomic with the order read, stock mutations could be undone by an overlapping transaction.

**Fixes:**
1. `updateStatus` now re-fetches the order **inside** `withTransaction` using `.session(session)` — the order read and all stock mutations are now within the same snapshot boundary. Also re-validates the transition inside the transaction to guard against race conditions changing the order status between the outer check and the inner write.
2. Replaced the dangling `order` reference with `savedOrder` in the response so the returned document reflects the actual final state.
3. Manually corrected ORD-00020's `ProductStock.reservedQuantity` from 0 → 10 via a one-time fix script (the order is legitimately shipped with 10 iPhone units at Main Warehouse).

**Files:** backend/src/controllers/admin/orders.controller.js

---

## 2026-02-25 17:00 - Complete return flow overhaul (two-phase pending → approved)

Rewrote the entire return system to match proper accounting and ERP-grade patterns:

**What changed:**
- **Order model**: Added `sellReturn` (cumulative returned value) and `returnDue` (what we owe customer back) fields.
- **OrderReturn model**: Removed `refundMethod`, changed status enum from `['initiated','approved','completed']` to `['pending','approved']`, added `approvedAt`/`approvedBy` fields.
- **Stock service**: Added `receiveReturnStock` (pending: qty + reserved both increase, available unchanged — quarantine) and `releaseReturnStock` (approved: reserved decreases, available increases).
- **initiateReturn**: Now only creates a pending return, quarantines stock, no ledger entries, no financial changes.
- **approveReturn** (new): Single function that handles all side-effects — releases quarantined stock, updates line item statuses, recalculates `sellReturn`/`balanceDue`/`returnDue` with the core formula (`effectiveOwed = grandTotal - sellReturn`), posts credit_note ledger entry, updates order status.
- **Frontend**: Added `Sell Return` and `Return Due` columns to orders table, approve button (CheckCircle) on pending returns, updated detail view summary.
- **Removed**: All legacy `refundMethod` handling, auto-approve logic, inline `require()` for stockService, incorrect tax-exclusive return value calculation (now uses proportional `lineTotal` which is tax-inclusive).

**Ledger accounting:** On approval, a single `credit_note` (credit) is posted for the return value, reducing the customer's receivable. The running ledger balance naturally reflects overpayments.

**Files:** backend/src/models/org/Order.js, backend/src/models/org/OrderReturn.js, backend/src/services/stockService.js, backend/src/controllers/admin/orders.controller.js, backend/src/routes/admin/orders.routes.js, frontend/src/api.js, frontend/src/pages/admin/Orders.jsx

---

## 2025-07-25 — Return flow: refundMethod re-added + E2E test suite

### refundMethod restored to approval flow
`refundMethod` was added back as an optional schema field (enum of 6 values: cash, bank_transfer, card, online, wallet, ledger_credit). Approval is blocked server-side if the field is missing or invalid. The UI shows an inline select per pending return row; the approve button is visually disabled until a method is selected. Schema-level `required` is intentionally absent — the manual check in `approveReturn` is the enforcement gate (so that `initiateReturn` can save the pending document without a method).

**Files:** backend/src/models/org/OrderReturn.js, backend/src/controllers/admin/orders.controller.js, frontend/src/api.js, frontend/src/pages/admin/Orders.jsx

### StockMovement enum extended
`return_in_pending` and `return_in_approved` movement types added to the `StockMovement.movementType` enum to match the values written by `stockService.receiveReturnStock` and `stockService.releaseReturnStock`.

**Files:** backend/src/models/org/StockMovement.js

### E2E test suite for return flow (95/95 passing)
Created `backend/tests/returns_e2e.js` — a standalone Node.js test script covering all return cases:
- Case 1a: No payment, both items returned → sellReturn=grandTotal, balanceDue=0, returnDue=0
- Case 1b: No payment, item B returned → sellReturn=ltB, balanceDue=ltA, returnDue=0
- Case 2a: Payment=300, item B returned → balanceDue=ltA-300, returnDue=0
- Case 2b: Payment=300, item A returned → balanceDue=ltB-300, returnDue=0
- Case 3a: Payment=700, item B returned → balanceDue=0, returnDue=70
- Case 3b: Payment=700, item A returned → balanceDue=0, returnDue=280
- Case 4: No payment, all returned → sellReturn=grandTotal, due=0, returnDue=0
- Case 5: Full payment, all returned → returnDue=amountPaid, ledger invoice+payment+credit_note verified
- Guard: Approve without/with-invalid refundMethod → 400
Also verifies: stock quarantine on initiate (qty+1, reserved+1, available unchanged), stock release on approve (reserved restored), and ledger entries (invoice, payment, credit_note).

**Files:** backend/tests/returns_e2e.js

---

## 2026-02-25 15:45 - Fix customer ledger not showing recent entries + legacy cleanup

### Bug fix: ledger entries invisible after new orders/returns
**Root cause:** `getLedger` was sorting `createdAt: 1` (oldest-first) with a default limit of 20. Any customer with more than 20 historical ledger entries would show only the oldest 20 — new invoice and credit_note entries from recent orders/returns were silently on a later page never visible in the modal.

**Fixes:**
1. Backend `getLedger`: changed `sort({ createdAt: 1 })` → `sort({ createdAt: -1 })` so the most recent entries appear first in every response.
2. Frontend `Customers.jsx`: passes `{ limit: 200 }` to the ledger API call so up to 200 entries are loaded into the modal, giving full visibility of recent activity without requiring pagination.

### Legacy cleanup
- `docs/return_function.md` (stale planning doc from pre-overhaul that described the old `updateStock 'return_in'` approach — superseded by `receiveReturnStock`/`releaseReturnStock`) — already removed.
- Confirmed no other deprecated return-related code remains in backend controllers, models, or frontend after the two-phase overhaul.

**Files:** backend/src/controllers/admin/customers.controller.js, frontend/src/pages/admin/Customers.jsx

---

## 2026-02-25 16:35 - Fix misleading credit_note narration (goods credit vs cash refund) + duplicate index cleanup

### Accounting logic fix: credit_note narration
**The flaw:** When approving a return, the `credit_note` ledger entry had narration `"₹3540.00 refund via cash for ORD-00073"`. This implied 3,540 in cash was returned to the customer. In reality:
- The **credit_note of 3,540** is a *goods return credit* — it reduces the accounts receivable (reverses part of the original sale). This is correct double-entry: Dr. Sales Returns 3,540 / Cr. AR 3,540
- The **actual cash refund owed** (returnDue) was only *1,460* (amountPaid 5,000 − effectiveOwed 3,540)
- The running ledger balance going from +2,080 to −1,460 correctly shows we owe the customer 1,460

The narration was mixing up "goods credit value" with "cash refund" — causing the business owner to think 3,540 was physically handed over.

**Fix:** Narration now clearly distinguishes both:
- No-overpayment case: `"Return RTN-xxx — goods credit ₹X for ORD-xxx | no cash refund (balance still due)"`
- Overpayment case: `"Return RTN-xxx — goods credit ₹X for ORD-xxx | cash refund ₹Y due via cash"`

E2E test updated to assert narration contains `"goods credit"` and, for overpaid case, the correct cash refund amount.

### Legacy cleanup: duplicate Mongoose schema index warnings
Removed duplicate `schema.index()` calls on fields that already declare `unique: true` (which auto-creates an index). Affected fields: `Customer.email`, `Order.orderNumber`, `Product.sku`. All other composite/query indexes retained.

**Files:** backend/src/controllers/admin/orders.controller.js, backend/tests/returns_e2e.js, backend/src/models/org/Customer.js, backend/src/models/org/Order.js, backend/src/models/org/Product.js

---

## 2025-06-25 18:00 — Comprehensive Ledger Implementation Plan

Full codebase audit (32 models, 21 route files, 12 controllers, 4 services, complete frontend API layer) leading to a production-grade ledger implementation plan.

**Identified:** 11 bugs (4 critical, 7 significant) + 8 design gaps. Mapped all 10 customer financial events, 5 supplier events, and 9 stock movement types.

**Plan:** 6-phase implementation covering bug fixes → atomic balance hardening → central Transaction Log → report fixes → purchase return approval flow → redundant document cleanup. Estimated 8-12 days total effort.

**Files:** LEDGER_IMPLEMENTATION_PLAN.md

---

## 2025-07-22 14:00 — Ledger Implementation: All 6 Phases Complete

Full implementation of the 6-phase production-grade ledger system. All backend phases done, frontend updated, 98/98 E2E tests passing, frontend build clean.

### Phase 1: Critical Bug Fixes (BUG-1 through BUG-9)
- BUG-1: Advance payments now posted to ledger when order → processing
- BUG-2: Cancel now credits `grandTotal - sellReturn` (no double-credit on returns)
- BUG-3: Removed `shipped` from `placed`'s transitions (must go through `processing`)
- BUG-5: `refundAmount` now calculates per-return delta, not cumulative
- BUG-6: Supplier ledger sorted newest-first
- BUG-7: Purchase returns use `purchase_return_out` movement type
- BUG-8+9: Stock transfers & bulk adjustments wrapped in transactions

### Phase 2: Atomic Balance + Idempotency + Reconciliation
- Rewrote `ledgerService` with atomic `$inc` (eliminates race conditions)
- Added `idempotencyKey` (sparse unique index) to CustomerLedger & SupplierLedger
- Strengthened immutability guards on CustomerLedger, SupplierLedger, StockMovement
- Added reconcile endpoints for customers & suppliers (detect + auto-fix drift)
- Added reconcile-all endpoint in reports

### Phase 3: Central Transaction Log
- New `TransactionLog` model — immutable central audit trail for all financial events
- New controller + routes (`GET /admin/transaction-log`, `GET /admin/transaction-log/summary`)
- Ledger service writes to both sub-ledger + central log atomically

### Phase 4: Report Fixes
- P&L: Subtracts sell returns from revenue, uses item-level COGS
- Dashboard: Added `outstandingReceivable`, `outstandingPayable`, `todayCollected`
- Aging: Proper 0-30, 30-60, 60-90, 90+ day buckets
- New cash flow report from TransactionLog aggregation

### Phase 5: Purchase Return Approval Flow
- Returns created as `status: 'initiated'` (pending) — no stock/ledger side effects
- New `approvePurchaseReturn` endpoint deducts stock + posts supplier credit note

### Phase 6: Remove Redundant Balance Documents
- Made `balanceBefore`/`balanceAfter` optional on CustomerTopup, SupplierPayment, SupplierAdjustment
- Removed manual balance computation from controllers (ledger service is source of truth)

### Frontend Updates
- `api.js`: Added 5 new endpoints (approveReturn, cashFlow, reconcileAll, reconcile x2, transactionLog)
- `Dashboard.jsx`: Shows todayOrders, todayRevenue, cashCollectedToday, outstandingReceivable, outstandingPayable, lowStockCount, pendingPOs
- `Reports.jsx`: Added Cash Flow tab (date range + daily/weekly/monthly grouping) and Transaction Log tab (filterable central audit trail)
- `PurchaseOrders.jsx`: Returns show status badge + approve button for pending returns
- `Customers.jsx`: Added reconcile button on balance tab
- `Suppliers.jsx`: Added reconcile button on balance tab

**Files:**
- **New:** backend/src/models/org/TransactionLog.js, backend/src/controllers/admin/transactionLog.controller.js, backend/src/routes/admin/transactionLog.routes.js
- **Backend modified:** backend/src/services/ledgerService.js, backend/src/models/org/CustomerLedger.js, backend/src/models/org/SupplierLedger.js, backend/src/models/org/StockMovement.js, backend/src/models/org/CustomerTopup.js, backend/src/models/org/SupplierPayment.js, backend/src/models/org/SupplierAdjustment.js, backend/src/models/org/PurchaseReturn.js, backend/src/models/org/index.js, backend/src/controllers/admin/orders.controller.js, backend/src/controllers/admin/customers.controller.js, backend/src/controllers/admin/suppliers.controller.js, backend/src/controllers/admin/purchaseOrders.controller.js, backend/src/controllers/admin/stock.controller.js, backend/src/controllers/admin/reports.controller.js, backend/src/controllers/store/portal.controller.js, backend/src/routes/admin/index.js, backend/src/routes/admin/customers.routes.js, backend/src/routes/admin/suppliers.routes.js, backend/src/routes/admin/purchaseOrders.routes.js, backend/src/routes/admin/reports.routes.js
- **Frontend modified:** frontend/src/api.js, frontend/src/pages/admin/Dashboard.jsx, frontend/src/pages/admin/Reports.jsx, frontend/src/pages/admin/PurchaseOrders.jsx, frontend/src/pages/admin/Customers.jsx, frontend/src/pages/admin/Suppliers.jsx

---

## 2025-07-16 � Ledger datetime display + reference numbers

**Date & Time display:** All ledger-related tables now show full date + time (time rendered in smaller text below the date) instead of date-only.

**Reference numbers:** Added `Ref #` column to every ledger/statement table. Customer topups now show their auto-generated `topupNumber` (e.g. `TOP-00001`). Customer payments now surface the linked order number via a newly added `.populate('order', 'orderNumber')` in `getPayments`.

**Bug fixes in Suppliers.jsx:** Ledger and Statement columns were silently blank because they used `r.type` (should be `r.transactionType`) and `r.description` (should be `r.narration`). Also fixed `LEDGER_COLORS` key names to match actual `transactionType` enum values.

**Files:**
- `backend/src/controllers/admin/customers.controller.js` � added `.populate('order', 'orderNumber')` to `getPayments`
- `frontend/src/pages/admin/Customers.jsx` � fmtDateTime helper; Ref # column in Ledger & Statement; Order # + datetime in Payments; topupNumber + type badge + datetime in Topups
- `frontend/src/pages/admin/Suppliers.jsx` � fmtDateTime helper; fixed LEDGER_COLORS; fixed r.transactionType / r.narration field names; Ref # column in Ledger & Statement
---

## 2026-02-25 23:20 — Integrations, Settings, Login & Sidebar overhaul

**1. Integrations module (full-stack)**
- New backend model `Integration` (slug, displayName, logo, isActive, apiKey, webhookUrl, config)
- CRUD controller + routes for integrations at `/admin/integrations`
- Dispatch webhook endpoint: `POST /admin/integrations/dispatch/send` sends order details (customerName, customerPhone, pickupAddress, deliveryAddress, priority, notes) to `https://dispatch.distrx.io/api/zapier/webhook` with `x-api-key` header
- Frontend Integrations page with activate/deactivate toggle, API key management, and Dispatch card
- Added `integrationsAPI` to frontend api.js

**2. Login & branding**
- Login page now uses `/logo.jpeg` instead of Store icon
- Favicon changed from `vite.svg` to `/favicon.jpeg`
- Sidebar logo updated to use `/logo.jpeg`

**3. Default Dashboard on login**
- AdminLayout auto-opens Dashboard tab when no tabs are open (on first load)

**4. Sidebar reorganization**
- Removed "Master Data" and "Storefront" sections
- Users & Access moved under "Main"
- Added "Integrations" section with Integrations page
- Added "Settings" section replacing Storefront
- Settings page has tabbed layout: Locations (Warehouses, Business Locations), Product Features (Categories, Brands, Units, Barcode Types), Ecom Features, Finance (Tax Slabs), Shipping Settings, Advance Settings, Email Settings

**Files:**
- `backend/src/models/org/Integration.js` (new)
- `backend/src/models/org/index.js`
- `backend/src/controllers/admin/integrations.controller.js` (new)
- `backend/src/routes/admin/integrations.routes.js` (new)
- `backend/src/routes/admin/index.js`
- `frontend/src/api.js`
- `frontend/src/pages/admin/Integrations.jsx` (new)
- `frontend/src/pages/admin/Settings.jsx` (new)
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/layouts/AdminLayout.jsx`
- `frontend/src/pages/auth/AdminLogin.jsx`
- `frontend/index.html`
- `frontend/public/logo.jpeg` (new)
- `frontend/public/favicon.jpeg` (new)

---

## 2026-02-25 23:45 — Settings sidebar expansion, cyan removal, Orders order# fix

**1. Settings sidebar** — "Settings" section now lists all 8 sub-items directly (each opens as its own tab): Ecom Settings, Users & Access, Categories, Brands, Units, Barcode Types, Tax Slabs, Warehouses. Removed the combined Settings.jsx page from sidebar. Users & Access removed from Main section.

**2. Cyan color removal** — Replaced all visible `cyan-*` Tailwind classes with violet/slate equivalents across admin pages:
- App.jsx: loading spinner `text-cyan-400` → `text-violet-500`
- PurchaseOrders.jsx: status stepper circles/lines `bg-cyan-500/20 ring-cyan-500/40` → `bg-violet-100 ring-violet-300`
- Products.jsx: new variant row bg `bg-cyan-500/[0.04] border-cyan-500/[0.1]` → `bg-slate-50 border-slate-200`
- Pricing.jsx: resolve result box `border-cyan-500/20 bg-cyan-500/5` → `border-violet-200 bg-violet-50/50`

**3. Orders page** — Order # column changed from `text-violet-600` to `text-slate-700`

**Files:**
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/App.jsx`
- `frontend/src/pages/admin/Orders.jsx`
- `frontend/src/pages/admin/PurchaseOrders.jsx`
- `frontend/src/pages/admin/Products.jsx`
- `frontend/src/pages/admin/Pricing.jsx`

---

## 2026-02-26 — Google Maps address autocomplete, dispatch on order, cleanup

**1. Google Maps address autocomplete on Customer create/edit**
- New `AddressAutocomplete` component loads Google Places JS API dynamically
- Address line input has live place suggestions; selecting a suggestion auto-fills City, State, Zip, Country
- "Map" button opens an inline map picker — click anywhere on the map to drop a pin and reverse-geocode all address fields
- Added `VITE_GOOGLE_MAPS_API_KEY` to `frontend/.env`

**2. Dispatch webhook on order placed**
- `orders.controller.js` now calls `fireDispatch()` (fire-and-forget) after every `createOrder`
- Checks if `dispatch` integration is enabled & has an API key
- Sends: `customerName`, `customerPhone`, `pickupAddress` (warehouse location), `deliveryAddress` (shipping address), `priority`, `notes`
- Errors are swallowed — dispatch failure never breaks the order response

**3. Cleanup**
- Deleted unused `frontend/src/pages/admin/Settings.jsx` (orphaned after sidebar was reorganised into individual items)

**Files:**
- `frontend/.env`
- `frontend/src/components/AddressAutocomplete.jsx` (new)
- `frontend/src/pages/admin/Customers.jsx`
- `backend/src/controllers/admin/orders.controller.js`
- `frontend/src/pages/admin/Settings.jsx` (deleted)



---

## 2026-02-26 � Move Dispatch webhook trigger to placedprocessing transition

`fireDispatch` is now called when an order transitions to `processing` status (not on initial order creation). Also removed test artifacts (hardcoded addresses, `console.table`, `console.log`) from `fireDispatch`.

**Files:**
- `backend/src/controllers/admin/orders.controller.js`

---

## 2026-02-26 � Google Maps location picker on Warehouse create/edit

Replaced the plain location Input in the Warehouse modal with `AddressAutocomplete`, giving users autocomplete suggestions and a pin-on-map picker. Selected address is stored as a formatted string in the `location` field.

**Files:**
- `frontend/src/pages/admin/Warehouses.jsx`
---

## 2026-02-26 22:00 — Ecommerce Storefront Website (Ecom/)

Built a complete customer-facing ecommerce website in `Ecom/` using React 18 + Vite + Tailwind CSS with a dark theme (CSS variables theme system). Connects to the existing backend store APIs on port 5000 via Vite proxy.

**Pages & Features:**
- **Home**: Hero banner slider (from EcomSettings), marquee, brand carousel, Trending Now & New Arrivals product sections
- **Products listing**: Sidebar filters (categories, brands), sort, pagination, search, active filter chips
- **Product detail**: Image gallery, variant selector, quantity picker, add to cart, wishlist, breadcrumbs, trust badges, description, tags
- **Cart**: Items list with quantity controls, order summary, proceed to checkout
- **Wishlist**: Product grid with quick add/remove
- **Checkout**: Address selection/creation, coupon code validation, wallet balance usage, order notes, place order
- **Login / Register**: Forms with terms acceptance (conditional on EcomSettings)
- **Account**: Tabbed page with Orders (list + detail modal), Ledger (balance summary + entries table), Addresses (CRUD), Payments (table), Profile (edit + change password)
- **Layout**: Sticky header with search (debounced API), user dropdown, cart/wishlist badges, theme toggle (dark/light), category nav bar, trust bar footer

**Files:**
- `Ecom/package.json`, `Ecom/vite.config.js`, `Ecom/tailwind.config.js`, `Ecom/postcss.config.js`, `Ecom/index.html`
- `Ecom/src/index.css`, `Ecom/src/main.jsx`, `Ecom/src/App.jsx`
- `Ecom/src/config/constants.js`
- `Ecom/src/services/api.js`, `Ecom/src/services/catalogService.js`, `Ecom/src/services/customerService.js`
- `Ecom/src/context/AuthContext.jsx`, `Ecom/src/context/CartContext.jsx`, `Ecom/src/context/WishlistContext.jsx`
- `Ecom/src/components/layout/Header.jsx`, `Ecom/src/components/layout/CategoryNav.jsx`, `Ecom/src/components/layout/Footer.jsx`
- `Ecom/src/components/home/HeroBanner.jsx`, `Ecom/src/components/home/BrandCarousel.jsx`, `Ecom/src/components/home/ProductSection.jsx`
- `Ecom/src/components/product/ProductCard.jsx`
- `Ecom/src/pages/HomePage.jsx`, `Ecom/src/pages/ProductsPage.jsx`, `Ecom/src/pages/ProductDetailPage.jsx`
- `Ecom/src/pages/CartPage.jsx`, `Ecom/src/pages/WishlistPage.jsx`, `Ecom/src/pages/CheckoutPage.jsx`
- `Ecom/src/pages/LoginPage.jsx`, `Ecom/src/pages/RegisterPage.jsx`, `Ecom/src/pages/AccountPage.jsx`
- `Ecom/src/components/account/OrdersTab.jsx`, `Ecom/src/components/account/LedgerTab.jsx`, `Ecom/src/components/account/AddressesTab.jsx`, `Ecom/src/components/account/PaymentsTab.jsx`, `Ecom/src/components/account/ProfileTab.jsx`
## 2026-02-26 08:55 � Ecom Bug Fixes + Modal Settings + Age Verification
### Bug Fixes
- **Brands not loading**: Fixed catalog.controller.js getBrands to query brands linked to active products via Product.distinct('brand', { isActive: true }) with \ union.
- **Pagination broken**: Fixed ProductsPage.jsx to use pagination.pages (API field) instead of pagination.totalPages (undefined). Added numbered page buttons with ellipsis.
- **Cart page broken**: Rewrote CartPage.jsx items and summary sections to use flat CartContext structure (item.id, item.quantity, item.price, item.name, item.sku, item.image).
- **Checkout page broken**: Fixed CheckoutPage.jsx items map (productId: item.productId || item.id, quantity: item.quantity) and items preview to use flat CartContext structure.

### Modal Settings (Admin)
- Added modalButtonSchema, modalFormFieldSchema, modalSchema to EcomSettings.js model.
- Added modals array + geVerificationEnabled/Title/Message/MinAge/LockMessage fields to backend model.
- Updated ecomSettings.controller.js allowed fields to include modals and age verification fields.
- Added "Modal Settings" tab to admin EcomSettings.jsx with: age verification toggle + config, custom modal CRUD (title, body, showOn pages, trigger, frequency, buttons sub-CRUD, form fields sub-CRUD).

### Age Verification Gate (Ecom)
- Created Ecom/src/components/AgeVerificationModal.jsx: fetches settings, shows blurred overlay modal per session, "Yes" ? sessionStorage verified, "No" ? locked + navigate /locked.
- Created Ecom/src/pages/LockedPage.jsx: full-screen lockout page with no navigation.
- Updated Ecom/src/App.jsx: integrated AgeVerificationModal, added /locked route (renders without layout).

**Files changed:**
- ackend/src/controllers/store/catalog.controller.js
- ackend/src/models/org/EcomSettings.js
- ackend/src/controllers/admin/ecomSettings.controller.js
- rontend/src/pages/admin/EcomSettings.jsx
- Ecom/src/pages/ProductsPage.jsx
- Ecom/src/pages/CartPage.jsx
- Ecom/src/pages/CheckoutPage.jsx
- Ecom/src/App.jsx
- Ecom/src/components/AgeVerificationModal.jsx (new)
- Ecom/src/pages/LockedPage.jsx (new)

---

## 2025-07-18 16:00 — Ecom Store UX Overhaul (14 Features/Fixes)

### Bug Fixes
1. **Age verification toggle fix** — Removed wrapping `<label>` element that swallowed `<button>` click events in admin EcomSettings Modal Settings tab.
2. **Back button logout fix** — OrdersTab now pushes history state when modal opens and listens for `popstate` to close modal on browser back. LoginPage redirect moved from render-time to `useEffect`.

### UI Improvements
3. **Logo + store name from settings** — Header and Footer now fetch ecom settings and display the `logo` image + `storeName` dynamically instead of hardcoded constants.
4. **Age verification modal redesign** — Complete rewrite with gradient header, logo overlay at 10% opacity, 18+ badge, ShieldCheck icon, and smooth fade-in animation.
5. **Banner hover zoom** — HeroBanner images now zoom 5% on hover with `transition-transform duration-500 ease-out` inside `overflow-hidden` wrapper.
6. **Variant table product page** — ProductDetailPage now shows variants in a table with columns: thumbnail, name, SKU, price, stock badge, qty (+/- input), cart button per row. Includes "Add All to Cart" button.
7. **Quick view product modal** — New `QuickViewModal.jsx` component with product image, variant selector, qty picker, add-to-cart, wishlist toggle, and "View full details" link. Uses `createPortal`.
8. **Product card redesign** — ProductCard now shows brand badge, product name, SKU, category link, stock badge, price, and always-visible cart button. Hover actions (wishlist, quick view) appear on image hover.
9. **Order view modal redesign** — Compact centered modal with `max-w-lg`, sticky header with order number + status badge, 3-column summary cards, card-based item rows with thumbnails, and compact price breakdown.

### Backend Enhancements
10. **Category visibility** — Added `hideFromCustomers`/`hideFromGuests` Boolean fields to Category model. Admin can toggle these in create/edit form. Store API filters categories and their products based on auth state using new `optionalCustomerAuth` middleware.
11. **API enrichment** — `getNewArrivals` now returns stock info, price ranges, and category/brand populates. `search` results enriched with stock data. `getFeatured` parent products now have real stock instead of hardcoded `inStock: true`.
12. **Product visibility by category** — `getProducts` now filters out products belonging to hidden categories based on customer/guest status.
13. **Warehouse location API** — New public `GET /warehouses` endpoint. Stock-check API now accepts optional `warehouseId` for location-specific availability.

**Files changed:**
- frontend/src/pages/admin/EcomSettings.jsx
- frontend/src/pages/admin/Categories.jsx
- backend/src/models/org/Category.js
- backend/src/controllers/admin/categories.controller.js
- backend/src/controllers/store/catalog.controller.js
- backend/src/controllers/store/portal.controller.js
- backend/src/middleware/auth.js
- backend/src/routes/store/index.js
- Ecom/src/components/layout/Header.jsx
- Ecom/src/components/layout/Footer.jsx
- Ecom/src/components/home/HeroBanner.jsx
- Ecom/src/components/AgeVerificationModal.jsx
- Ecom/src/pages/ProductDetailPage.jsx
- Ecom/src/components/product/ProductCard.jsx
- Ecom/src/components/product/QuickViewModal.jsx (new)
- Ecom/src/components/account/OrdersTab.jsx
- Ecom/src/pages/LoginPage.jsx
- Ecom/src/services/catalogService.js

---

## 2026-02-26 10:12 — Ecom black screen hotfix (Footer runtime error)

- Fixed runtime crash in footer by removing leftover `STORE_NAME` fallback reference after constants import cleanup.
- Updated footer heading fallback to `settings?.storeName || 'Store'` to prevent `ReferenceError`.
- Verified app boot: Vite dev server starts successfully on `http://localhost:5173`.

**Files changed:**
- Ecom/src/components/layout/Footer.jsx

---

## 2026-02-26 10:22 — Category dropdown layering + guest price lock

- Fixed category/subcategory dropdown stacking so submenu is no longer hidden behind the hero banner (`CategoryNav` z-index increased).
- Enforced backend price protection for guests by redacting price fields (`basePrice`, `compareAtPrice`, `priceRange`) from catalog/detail/search/featured/new-arrivals API responses when not authenticated.
- Applied `optionalCustomerAuth` to all storefront product endpoints so logged-in users still receive pricing while guests do not.
- Updated storefront UI (`ProductCard`, `ProductDetailPage`, `QuickViewModal`) to show **“Login to see prices”** and block add-to-cart actions for guests.

**Files changed:**
- Ecom/src/components/layout/CategoryNav.jsx
- Ecom/src/components/product/ProductCard.jsx
- Ecom/src/pages/ProductDetailPage.jsx
- Ecom/src/components/product/QuickViewModal.jsx
- backend/src/routes/store/index.js
- backend/src/controllers/store/catalog.controller.js

## 2026-02-26 22:xx � Ledger/Orders/Payments: filters, pagination, balance column
- Added type + date range filters to LedgerTab (with running balanceAfter per row)
- Added date range filter and improved pagination to OrdersTab
- Added method + date range filter, page subtotal row to PaymentsTab
- Backend: myLedger supports type/startDate/endDate; myPayments supports method/startDate/endDate; myOrders supports startDate/endDate
- Pagination bar now shows Showing X�Y of Z with first/last/prev/next controls
- Files: Ecom/src/components/account/LedgerTab.jsx, OrdersTab.jsx, PaymentsTab.jsx, backend/src/controllers/store/portal.controller.js

## 2026-02-26 11:57 � Bug fixes: search visibility, category nav, wishlists, admin subcategories, portal search

- **Issue 1 (search hidden cats):** catalog.controller.js search() now queries hiddenCats (same as getProducts) and excludes products from hidden categories for guests/customers.
- **Issue 2 (getProductBySlug/ById guard):** After fetching a product, both endpoints check if any of the product's categories are hidden for the current visitor and return 404 if so.
- **Issue 3 (CategoryNav re-fetch):** CategoryNav now imports useAuth, adds isAuthenticated as a useEffect dependency, and resets openId � categories re-fetch (with correct visibility) on every login/logout.
- **Issue 4 (dropdown clipped by overflow-x-auto):** Moved the subcategory dropdown to render at <nav> level instead of inside the overflow-x-auto scroll container. Position is computed via getBoundingClientRect so it aligns with the hovered button.
- **Issue 5 (admin subcategories not showing):** dmin/categories.controller.list changed from returning a tree (roots only) to a flat list with parentCategory populated (
ame) � all subcategories now appear in the DataTable.
- **Issue 6 (WishlistContext price fields):** 	oggle now stores asePrice, compareAtPrice, priceRange, 	ype, images, rand, categories, sku, inStock so ProductCard can correctly show prices when logged in and hide them when logged out.
- **Issue 7 (portal tab search):** Added q query param to myOrders (filters by orderNumber), myLedger (filters by 
eferenceNumber), and myPayments (filters by 
eferenceNumber or exact mount). Frontend tabs have a new text search input that passes q to the API.

**Files changed:**
- backend/src/controllers/store/catalog.controller.js
- backend/src/controllers/admin/categories.controller.js
- backend/src/controllers/store/portal.controller.js
- Ecom/src/components/layout/CategoryNav.jsx
- Ecom/src/context/WishlistContext.jsx
- Ecom/src/components/account/LedgerTab.jsx
- Ecom/src/components/account/OrdersTab.jsx
- Ecom/src/components/account/PaymentsTab.jsx

## 2026-02-26 — Fix: hidden-category bypass + full cleanup run

**Bug fixes (backend was running stale code — restarted with updated build):**
- `getFeatured` and `getNewArrivals` now filter hidden categories — products from hidden categories no longer appear in homepage featured/new-arrivals sections.
- `getProducts` category+hiddenCats filter collision fixed: previously `filter.categories = category` overwrote the `$nin: hiddenCats` guard. Replaced with a `catConditions` array merged via `$and` so both the requested category and the hidden-category exclusion are enforced simultaneously. This also closed a security bypass where passing a hidden category ID as a query param could reveal hidden products.

**Dead code removed:**
- `getFeatured`: removed dead `const productIds = products.map(p => p._id)` (computed but never used anywhere).
- `WishlistPage.jsx`: removed unused `toggle` destructured variable; removed unused `ShoppingBag` lucide import.
- `getProducts`: removed stale conditional `filter.categories ? { $in: [...], $nin: ... }` expression (was unreachable — filter.categories was never set before that block).

**Files changed:**
- backend/src/controllers/store/catalog.controller.js
- Ecom/src/pages/WishlistPage.jsx

## 2026-02-26 12:20 — Cart price leak fix after logout
- Fixed a major auth leak where cart prices remained visible after logout.
- CartContext now reads auth state and sanitizes persisted cart items on logout by nulling price fields.
- CartPage now gates all unit price, line total, summary item total, and subtotal rendering behind isAuthenticated, showing Login to see prices for guests.
- Checkout CTA now routes guests to login (/login) instead of showing a checkout action.

Files changed:
- Ecom/src/context/CartContext.jsx
- Ecom/src/pages/CartPage.jsx

## 2026-02-26 12:35 � Hard reload home-state stabilization
- Fixed homepage hard-reload behavior where the app could show a blank/fallback "Welcome to the Store" state before real data returned.
- HomePage now uses Promise.allSettled (instead of Promise.all) so one transient API failure does not collapse all home sections.
- Added cancellation guard in HomePage effect to prevent stale state writes during rapid navigation/reload.
- HeroBanner now accepts loading and renders a loading skeleton while home API calls are in flight; fallback banner only appears after loading completes and no banners exist.
- Added banner index reset when banner data changes to avoid stale index on refresh.

Files changed:
- Ecom/src/pages/HomePage.jsx
- Ecom/src/components/home/HeroBanner.jsx
