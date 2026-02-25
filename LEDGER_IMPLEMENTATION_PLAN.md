# Ledger System — Production-Grade Implementation Plan

> **Audience:** Dev team building a wholesale e-commerce SaaS
> **Status:** Living document — update after each phase is shipped
> **Date:** 2025-06-25

---

## Table of Contents

1. [Current System Audit](#1-current-system-audit)
2. [Complete Bug/Gap Catalog](#2-complete-buggap-catalog)
3. [Complete Financial Event Map](#3-complete-financial-event-map)
4. [Proposed Ledger Architecture](#4-proposed-ledger-architecture)
5. [Implementation Phases](#5-implementation-phases)
6. [Schema Designs](#6-schema-designs)
7. [Migration Strategy](#7-migration-strategy)

---

## 1. Current System Audit

### What Exists Today

| Component | Model | Purpose |
|---|---|---|
| Customer sub-ledger | `CustomerLedger` | Tracks debit/credit per customer |
| Supplier sub-ledger | `SupplierLedger` | Tracks debit/credit per supplier |
| Customer balance | `Customer.currentBalance` | Denormalized running balance |
| Supplier balance | `Supplier.currentBalance` | Denormalized running balance |
| Customer topup docs | `CustomerTopup` | Standalone topup/adjustment records |
| Supplier adjustment docs | `SupplierAdjustment` | Standalone supplier adjustment records |
| Order payments | `OrderPayment` | Payment records linked to orders |
| Supplier payments | `SupplierPayment` | Payment records linked to suppliers |
| Stock movements | `StockMovement` | Immutable stock change log |

### How Money Flows Today

```
Order Created (placed)
  └── OrderPayment saved (if advance paid) — NO ledger entry

Order → Processing
  └── Customer Ledger: DEBIT grandTotal (invoice)
  ⚠ Payment from creation is NEVER posted to ledger

Order → Shipped
  └── Stock: reserveStock (reservedQty++)

Order → Delivered
  └── Stock: deductOnShipment (qty--, reservedQty--, StockMovement 'sale_out')

recordPayment (after processing)
  └── Order amountPaid++, balanceDue--
  └── Customer Ledger: CREDIT amount (payment)

initiateReturn (pending)
  └── Stock: receiveReturnStock (qty++, reservedQty++ — quarantine)
  └── NO financial/ledger changes

approveReturn
  └── Stock: releaseReturnStock (reservedQty-- — available for sale)
  └── Order: sellReturn++, recalculate balanceDue/returnDue
  └── Customer Ledger: CREDIT returnValue (credit_note)

updateOrder (while processing)
  └── If grandTotal changed: debit_note (increase) or credit_note (decrease)

deleteOrder / cancel
  └── Stock: releaseReserved (if shipped+)
  └── Customer Ledger: CREDIT grandTotal (credit_note)

Customer topup
  └── Customer Ledger: CREDIT amount (balance_topup)

Customer adjust
  └── Customer Ledger: DEBIT or CREDIT (balance_adjustment)
```

```
PO Created → draft
PO → ordered (no financial effect)

GRN Created → draft
GRN Approved
  └── Stock: updateStock (qty++ — purchase_in, StockMovement)
  └── Supplier Ledger: DEBIT grnTotal (purchase_invoice)

Supplier Payment
  └── Supplier Ledger: CREDIT amount (payment)
  └── PO amountPaid++ (if linked)

Purchase Return (created as 'approved' immediately)
  └── Stock: adjustment_out (⚠ wrong movementType)
  └── Supplier Ledger: CREDIT totalValue (credit_note)

Supplier Adjust
  └── Supplier Ledger: DEBIT or CREDIT (balance_topup / balance_adjustment)
```

---

## 2. Complete Bug/Gap Catalog

### CRITICAL BUGS (Data Integrity)

#### BUG-1: Payment at order creation never reaches the ledger
**Location:** `orders.controller.js → createOrder`
**Problem:** When an order is created with `paymentAmount > 0`, an `OrderPayment` is saved, but NO ledger entry is created. The comment says "Payment ledger entry will be created when order moves to processing" — but `updateStatus('processing')` only posts the invoice debit. The pre-existing payment is **never posted** to the customer ledger.
**Impact:** Customer's ledger balance is wrong — they paid but it doesn't show. Every order created with an advance payment has this bug.
**Fix:** When transitioning to `processing`, after posting the invoice, also post ledger entries for any existing payments on the order.

#### BUG-2: Order cancellation credits full grandTotal, ignoring returns
**Location:** `orders.controller.js → deleteOrder` and `updateStatus → cancelled`
**Problem:** Credit note is posted for `order.grandTotal`. But if the order had partial returns (`sellReturn > 0`), the returned portion was already credited. Cancelling now double-credits the returned amount.
**Impact:** Customer balance goes lower than it should (we owe them more than we should).
**Fix:** Credit `Math.max(0, order.grandTotal - order.sellReturn)` instead of `order.grandTotal`.

#### BUG-3: Placed → Shipped skips invoice posting
**Location:** `orders.controller.js → updateStatus`
**Problem:** Valid transitions allow `placed → shipped`. But the invoice ledger entry is only posted when status = `processing`. If an order goes `placed → shipped` directly, stock is reserved but no invoice is posted — the sale is invisible to the ledger.
**Impact:** Revenue not recorded, customer balance not debited.
**Fix:** Either (a) remove `shipped` from `placed`'s valid transitions (force `placed → processing → shipped`), or (b) auto-post invoice when going to `shipped` if not already invoiced.

#### BUG-4: Concurrent ledger entries can break the balance chain
**Location:** `ledgerService.js → createCustomerLedgerEntry`
**Problem:** `balanceAfter` is computed by reading the latest entry (`sort createdAt: -1`). If two requests create entries simultaneously (even within transactions), both read the same "last" entry and compute `balanceAfter` from the same base — one overwrites the other's chain.
**Impact:** `balanceAfter` values become inconsistent, `customer.currentBalance` drifts from reality.
**Fix:** This is the core reason the ledger needs redesign. See Phase 1 solution below.

#### BUG-5: refundAmount set to whole order returnDue, not this return's portion
**Location:** `orders.controller.js → approveReturn`
**Problem:** `returnDoc.refundAmount = order.returnDue` — this is the TOTAL returnDue for the order after this approval, not the amount attributable to this specific return. If multiple returns are approved, earlier returns would need their refundAmount re-read.
**Impact:** returnDoc.refundAmount is misleading — it doesn't reflect the actual refund for that specific return.
**Fix:** Compute the delta: `const previousReturnDue = ... ; returnDoc.refundAmount = order.returnDue - previousReturnDue`

### SIGNIFICANT BUGS (Logic/Consistency)

#### BUG-6: Supplier ledger visibility — oldest-first with limit 20
**Location:** `suppliers.controller.js → getLedger`
**Problem:** Sorts `createdAt: 1` (oldest first) with default page size. Recent entries are invisible until you paginate forward.
**Impact:** Same bug that was already fixed for customers. Operators can't see recent supplier transactions.
**Fix:** Change to `createdAt: -1` (newest first), same as customer ledger fix.

#### BUG-7: Purchase return uses wrong movementType
**Location:** `purchaseOrders.controller.js → createPurchaseReturn`
**Problem:** Stock deduction uses `movementType: 'adjustment_out'` for a purchase return. This makes it look like a stock adjustment in reports when it's actually a return to supplier.
**Impact:** Stock movement reports are misleading. Can't filter "purchase returns" separately.
**Fix:** Add `'purchase_return_out'` to StockMovement.movementType enum and use it here.

#### BUG-8: Stock transfer reservation is not atomic
**Location:** `stock.controller.js → createTransfer`
**Problem:** Reserves stock for each item with individual `ProductStock.updateOne($inc)` calls WITHOUT a transaction. If item 3 of 5 fails, items 1-2 have their reserved qty increased with no rollback.
**Impact:** Reserved stock can get orphaned on partial failures.
**Fix:** Wrap in `withTransaction`.

#### BUG-9: Adjustment batch reservation is not atomic
**Location:** `stock.controller.js → bulkCreateAdjustment`
**Problem:** Same issue as BUG-8 — decrease reservations are done with individual `updateOne` calls without a transaction.
**Fix:** Wrap in `withTransaction`.

#### BUG-10: Purchase return has no approval flow
**Location:** `purchaseOrders.controller.js → createPurchaseReturn`
**Problem:** Purchase returns are created with `status: 'approved'` immediately. No pending → approved flow. No QA gate, no manager review.
**Impact:** Any user with access can return goods to supplier and affect stock + supplier ledger with no oversight.
**Fix:** Mirror the sell-return pattern: create as `pending`, separate `approveReturn` endpoint.

#### BUG-11: PO balanceDue not updated on GRN approval
**Location:** `purchaseOrders.controller.js → approveGRN`
**Problem:** GRN approval posts `purchase_invoice` to supplier ledger for the GRN total, but does NOT update `PurchaseOrder.balanceDue` at all. The PO's `balanceDue` only updates when a direct supplier payment is linked to it.
**Impact:** PO shows `balanceDue = grandTotal` forever even after GRN is approved and goods are received. Misleading.
**Fix:** This is actually by design (PO.balanceDue tracks payment, not receipt). But it's confusing. At minimum, add a `receivedTotal` field to PO.

### DESIGN GAPS (Missing Functionality)

#### GAP-1: No unified financial overview
There's no single place to see all money in/out across customers and suppliers. The dashboardStats only shows today's revenue and order count.

#### GAP-2: No reconciliation tools
No way to verify that `customer.currentBalance` matches `SUM(debit) - SUM(credit)` from their ledger. No way to verify stock totals match movement history.

#### GAP-3: Profit & Loss report is naive
`grossProfit = SUM(order.grandTotal) - SUM(grn.totalValue)`. Doesn't account for: sell returns (sellReturn), time-period matching (GRN from January counted against sales from March), coupon discounts already baked into grandTotal vs. separately stated.

#### GAP-4: No aging buckets
Customer/supplier aging reports just list entities with non-zero balance. No 0-30, 30-60, 60-90, 90+ day buckets.

#### GAP-5: Immutability enforcement is partial
Ledger schemas use `pre('findOneAndUpdate')` to prevent updates. But `updateOne`, `updateMany`, `replaceOne` bypass this. A determined developer (or bug) could corrupt ledger data.

#### GAP-6: Customer opening balance semantics are unclear
Opening balance uses `debit` (customer owes us). But `topup` uses `credit` (customer paid/deposited). Both increase `currentBalance` in different directions. The semantics of "balance" are not consistently defined — is positive balance "customer owes" or "customer has credit"?

**Current convention (implicit):** Positive `currentBalance` = customer OWES us. Debit increases it, credit decreases it. This is standard receivables accounting, but nowhere documented.

#### GAP-7: No duplicate/redundant entry detection
If `updateStatus` is called twice for the same transition (race condition), two invoices could be posted. The status check guards against this, but network retries or UI double-clicks could slip through.

#### GAP-8: Topup/Adjustment documents duplicate ledger data
`CustomerTopup` and `SupplierAdjustment` store `balanceBefore`/`balanceAfter` redundantly with the ledger entries. If they drift, there's no source of truth.

---

## 3. Complete Financial Event Map

### Customer Side (9 events)

| # | Event | Trigger | Debit | Credit | Ledger txnType | Status |
|---|---|---|---|---|---|---|
| C1 | Sale Invoice | order → processing | grandTotal | 0 | `invoice` | ✅ Works |
| C2 | Payment received | recordPayment | 0 | amount | `payment` | ✅ Works (post-processing only) |
| C3 | Pre-existing payment | order with advance → processing | 0 | amount | `payment` | ❌ **BUG-1: Never posted** |
| C4 | Order edit increase | updateOrder (processing) | diff | 0 | `debit_note` | ✅ Works |
| C5 | Order edit decrease | updateOrder (processing) | 0 | diff | `credit_note` | ✅ Works |
| C6 | Order cancelled | cancel/delete | 0 | grandTotal | `credit_note` | ⚠ **BUG-2: Should be grandTotal - sellReturn** |
| C7 | Return approved | approveReturn | 0 | returnValue | `credit_note` | ✅ Works |
| C8 | Balance topup | customer.topup | 0 | amount | `balance_topup` | ✅ Works |
| C9 | Balance adjustment | customer.adjust | varies | varies | `balance_adjustment` | ✅ Works |
| C10 | Opening balance | customer.create | openingBal | 0 | `opening_balance` | ✅ Works |

### Supplier Side (5 events)

| # | Event | Trigger | Debit | Credit | Ledger txnType | Status |
|---|---|---|---|---|---|---|
| S1 | Purchase invoice | GRN approved | grnTotal | 0 | `purchase_invoice` | ✅ Works |
| S2 | Payment to supplier | supplier.recordPayment | 0 | amount | `payment` | ✅ Works |
| S3 | Purchase return | createPurchaseReturn | 0 | totalValue | `credit_note` | ⚠ Works but no approval flow |
| S4 | Balance adjustment | supplier.adjust | varies | varies | `balance_topup`/`balance_adjustment` | ✅ Works |
| S5 | Opening balance | supplier.create | openingBal | 0 | `opening_balance` | ✅ Works |

### Stock Events (8 types)

| # | Event | movementType | qty change | reserved change | Status |
|---|---|---|---|---|---|
| K1 | Opening stock | `opening_stock` | +qty | — | ✅ |
| K2 | GRN (purchase in) | `purchase_in` | +received | — | ✅ |
| K3 | Sale delivery | `sale_out` | -qty | -qty | ✅ |
| K4 | Return pending | `return_in_pending` | +qty | +qty | ✅ |
| K5 | Return approved | `return_in_approved` | 0 | -qty | ✅ |
| K6 | Transfer out | `transfer_out` | -qty | — | ✅ |
| K7 | Transfer in | `transfer_in` | +qty | — | ✅ |
| K8 | Adjustment in/out | `adjustment_in`/`adjustment_out` | ±qty | — | ✅ |
| K9 | Purchase return | `adjustment_out` (wrong) | -qty | — | ⚠ **BUG-7** |

---

## 4. Proposed Ledger Architecture

### Design Principles

1. **Keep the per-entity sub-ledgers** — they work, operators understand them, and they're fast to query
2. **Add a unified Transaction Log** — a central record of every financial event for reconciliation & reporting
3. **Fix the balance chain** — make it reliable under concurrency
4. **Use plain business language** — no "accounts receivable", "COGS", "journal entries"
5. **Stay flexible** — system is still in development, no rigid locking

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Transaction Log (NEW)                     │
│  Central record of every financial event in the system       │
│  Links: sourceType + sourceId → originating document         │
│  Purpose: reconciliation, reporting, audit trail             │
└──────────┬───────────────┬──────────────────────────────────┘
           │               │
    ┌──────▼──────┐  ┌─────▼──────┐
    │  Customer   │  │  Supplier  │
    │  Ledger     │  │  Ledger    │
    │  (existing) │  │  (existing)│
    └──────┬──────┘  └─────┬──────┘
           │               │
    ┌──────▼──────┐  ┌─────▼──────┐
    │  Customer   │  │  Supplier  │
    │  .current   │  │  .current  │
    │  Balance    │  │  Balance   │
    └─────────────┘  └────────────┘
```

### Key Changes

| What | Current | Proposed |
|---|---|---|
| Balance computation | Chain-based (read last entry) | **Atomic increment** (`$inc` on entity) + ledger entry in same transaction |
| `balanceAfter` on entries | Computed from chain | **Computed from entity balance after $inc** |
| Reconciliation | None | **Recalc endpoint** that sums all entries and compares to entity balance |
| Transaction log | None | **New `TransactionLog` model** — one entry per financial event |
| Immutability | Mongoose middleware only | **Add MongoDB validation rules** + application-level guards |
| Duplicate detection | None | **Idempotency key** on ledger entries |

### Why NOT Full Double-Entry / Chart of Accounts

Your operators are wholesale distributors, not accountants. They think in:
- "Ramesh owes me ₹50,000"
- "I owe ABC Supplier ₹1,20,000"
- "Today I collected ₹3,00,000"

NOT in:
- "Dr. Accounts Receivable, Cr. Revenue"
- "Account code 40100 — Sales Revenue"

A chart of accounts adds complexity with zero user-facing value for your target audience. The sub-ledger pattern with a central transaction log gives you:
- ✅ Full audit trail
- ✅ Reconciliation
- ✅ P&L and cash flow reports
- ✅ Per-entity balance tracking
- ✅ Zero accounting jargon in the UI

If you EVER need formal double-entry (for a CA/auditor), the transaction log can be **mapped** to journal entries retroactively — no schema change needed.

---

## 5. Implementation Phases

### Phase 1: Fix Critical Bugs (No Schema Changes)
**Estimated effort:** 1-2 days
**Risk:** Low — these are bugfixes, not refactors

| # | Task | Files |
|---|---|---|
| 1.1 | **BUG-1**: Post pre-existing payments to ledger on processing transition | `orders.controller.js → updateStatus` |
| 1.2 | **BUG-2**: Cancel credits `grandTotal - sellReturn`, not `grandTotal` | `orders.controller.js → deleteOrder, updateStatus` |
| 1.3 | **BUG-3**: Remove `shipped` from `placed` valid transitions (force processing first) | `orders.controller.js → updateStatus` |
| 1.4 | **BUG-5**: Fix refundAmount to be delta, not total | `orders.controller.js → approveReturn` |
| 1.5 | **BUG-6**: Supplier ledger sort `createdAt: -1` | `suppliers.controller.js → getLedger` |
| 1.6 | **BUG-7**: Add `purchase_return_out` movement type | `StockMovement.js`, `purchaseOrders.controller.js` |
| 1.7 | **BUG-8 & BUG-9**: Wrap transfer/adjustment reservations in transactions | `stock.controller.js` |
| 1.8 | Update E2E tests for all fixes | `tests/` |

### Phase 2: Harden the Ledger Service (Core Refactor)
**Estimated effort:** 2-3 days
**Risk:** Medium — changes the core balance computation

Replace the chain-based `balanceAfter` computation with atomic increments.

**New `createCustomerLedgerEntry` logic:**
```javascript
// INSTEAD OF: read last entry → compute balanceAfter → save
// DO: $inc on customer → read new balance → save entry with that balance

const customer = await Customer.findOneAndUpdate(
  { _id: customerId },
  { $inc: { currentBalance: (debit || 0) - (credit || 0) } },
  { new: true, session }
);

const entry = new CustomerLedger({
  ...fields,
  balanceAfter: customer.currentBalance,  // guaranteed correct
});
await entry.save({ session });
```

This eliminates the "read last → compute → write" race condition entirely. `$inc` is atomic at the MongoDB level even without transactions.

| # | Task | Files |
|---|---|---|
| 2.1 | Rewrite `createCustomerLedgerEntry` with atomic `$inc` | `ledgerService.js` |
| 2.2 | Rewrite `createSupplierLedgerEntry` with atomic `$inc` | `ledgerService.js` |
| 2.3 | Add **idempotency key** field to both ledger schemas | `CustomerLedger.js`, `SupplierLedger.js` |
| 2.4 | Add idempotency key generation at each call site | All controllers that call ledger service |
| 2.5 | Add reconciliation endpoint: `/admin/customers/:id/reconcile` | `customers.controller.js` |
| 2.6 | Add reconciliation endpoint: `/admin/suppliers/:id/reconcile` | `suppliers.controller.js` |
| 2.7 | Add bulk reconciliation: `/admin/reports/reconcile-all` | `reports.controller.js` |
| 2.8 | Strengthen immutability: add `pre` hooks for `updateOne`, `updateMany`, `replaceOne` | `CustomerLedger.js`, `SupplierLedger.js`, `StockMovement.js` |
| 2.9 | Update all tests | `tests/` |

**Idempotency key format:** `{sourceType}:{sourceId}:{eventType}`
Example: `order:64abc123:invoice` — if this key already exists, skip the entry. Prevents double-posting from retries.

### Phase 3: Transaction Log (New Model)
**Estimated effort:** 2-3 days
**Risk:** Low — additive, doesn't change existing flows

Add a central `TransactionLog` that records every financial event. This is your audit trail and the basis for reports.

| # | Task | Files |
|---|---|---|
| 3.1 | Create `TransactionLog` schema | `models/org/TransactionLog.js` |
| 3.2 | Register in `models/org/index.js` | `index.js` |
| 3.3 | Create `transactionLogService.js` | `services/` |
| 3.4 | Instrument `createCustomerLedgerEntry` to also write transaction log | `ledgerService.js` |
| 3.5 | Instrument `createSupplierLedgerEntry` to also write transaction log | `ledgerService.js` |
| 3.6 | Add admin endpoints: list/filter transaction log | Controller + routes |
| 3.7 | Add frontend: Transaction Log page (admin) | Frontend page |
| 3.8 | Tests | `tests/` |

### Phase 4: Fix Reports
**Estimated effort:** 1-2 days

| # | Task |
|---|---|
| 4.1 | P&L: Subtract `sellReturn` from revenue, use cost-of-goods-sold from items (not raw GRN total) |
| 4.2 | Customer aging: Add 0-30, 30-60, 60-90, 90+ day buckets based on oldest unpaid invoice |
| 4.3 | Supplier aging: Same buckets |
| 4.4 | Dashboard: Add "Cash collected today", "Outstanding receivable", "Outstanding payable" |
| 4.5 | Cash flow report: Use transaction log to show money in vs money out by day/week/month |

### Phase 5: Purchase Return Approval Flow
**Estimated effort:** 1 day

| # | Task |
|---|---|
| 5.1 | Purchase returns: create as `pending`, add `approvePurchaseReturn` endpoint |
| 5.2 | On pending: no stock/ledger changes |
| 5.3 | On approve: deduct stock + post supplier ledger credit note |
| 5.4 | Frontend: approval UI for purchase returns |

### Phase 6: Remove Redundant Balance Documents
**Estimated effort:** 0.5 day

| # | Task |
|---|---|
| 6.1 | Stop writing `balanceBefore`/`balanceAfter` to `CustomerTopup` — ledger is the source of truth |
| 6.2 | Stop writing `balanceBefore`/`balanceAfter` to `SupplierAdjustment` — ledger is the source of truth |
| 6.3 | Keep the fields on existing docs (backward compat) but stop relying on them |

---

## 6. Schema Designs

### TransactionLog (New — Phase 3)

```javascript
const transactionLogSchema = new mongoose.Schema(
  {
    // What happened
    eventType: {
      type: String,
      enum: [
        // Customer events
        'sale_invoice',          // Order confirmed (processing)
        'sale_payment',          // Payment received from customer
        'sale_credit_note',      // Return / cancel / edit decrease
        'sale_debit_note',       // Edit increase
        'customer_topup',        // Customer deposited money
        'customer_adjustment',   // Manual balance correction
        'customer_opening',      // Opening balance

        // Supplier events
        'purchase_invoice',      // GRN approved — we owe supplier
        'purchase_payment',      // Payment to supplier
        'purchase_credit_note',  // Purchase return — reduces payable
        'supplier_adjustment',   // Manual balance correction
        'supplier_opening',      // Opening balance
      ],
      required: true,
    },

    // Who is this about
    partyType: { type: String, enum: ['customer', 'supplier'], required: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, required: true },
    partyName: { type: String, default: '' },  // Snapshot for fast display

    // Source document
    sourceType: {
      type: String,
      enum: ['order', 'order_payment', 'order_return', 'grn',
             'supplier_payment', 'purchase_return',
             'customer_topup', 'supplier_adjustment', 'manual'],
      required: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    sourceNumber: { type: String, default: '' },  // e.g. ORD-00071, RTN-00005

    // Money
    amount: { type: Number, required: true },         // Always positive
    direction: { type: String, enum: ['in', 'out'], required: true },
    // 'in' = money coming TO the business (customer payment, supplier credit note)
    // 'out' = money going OUT (supplier payment, customer refund/credit note)

    // Context
    narration: { type: String, default: '' },
    paymentMethod: { type: String, default: '' },     // cash, card, bank_transfer, etc.

    // Linked ledger entry
    ledgerEntryId: { type: mongoose.Schema.Types.ObjectId },

    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Immutable
transactionLogSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany', 'replaceOne'], function () {
  throw new Error('Transaction log entries are immutable');
});

transactionLogSchema.index({ partyType: 1, partyId: 1, createdAt: -1 });
transactionLogSchema.index({ eventType: 1, createdAt: -1 });
transactionLogSchema.index({ sourceType: 1, sourceId: 1 });
transactionLogSchema.index({ createdAt: -1 });
```

### CustomerLedger — Additions (Phase 2)

```javascript
// ADD these fields to existing schema:
idempotencyKey: { type: String, unique: true, sparse: true },
// sparse: true allows null values (for existing entries without keys)
```

### SupplierLedger — Additions (Phase 2)

```javascript
// Same as CustomerLedger:
idempotencyKey: { type: String, unique: true, sparse: true },
```

### StockMovement — Addition (Phase 1)

```javascript
// ADD to movementType enum:
'purchase_return_out'
```

### Strengthened Immutability (Phase 2)

```javascript
// Replace the single pre('findOneAndUpdate') with comprehensive guards:
const immutableGuard = function () {
  throw new Error('Ledger/movement records are immutable');
};

schema.pre('findOneAndUpdate', immutableGuard);
schema.pre('updateOne', immutableGuard);
schema.pre('updateMany', immutableGuard);
schema.pre('replaceOne', immutableGuard);
schema.pre('findOneAndReplace', immutableGuard);
```

---

## 7. Migration Strategy

### Phase 1 (Bug Fixes) — No migration needed
All fixes are in controller logic. Existing data is already in the DB; we're just fixing future behavior.

**Recommendation:** After deploying Phase 1, manually inspect orders that were created with advance payments. For each one, post the missing `payment` ledger entry by running a one-time script:

```javascript
// One-time script: backfill missing payment ledger entries
const orders = await Order.find({ amountPaid: { $gt: 0 }, status: { $ne: 'placed' } });
for (const order of orders) {
  const payments = await OrderPayment.find({ order: order._id });
  const ledgerPayments = await CustomerLedger.find({
    referenceId: { $in: payments.map(p => p._id) },
    transactionType: 'payment',
  });
  // Compare: if any payment doc lacks a matching ledger entry, create one
  // (Run with care — inspect before executing)
}
```

### Phase 2 (Ledger Hardening) — Minimal migration

1. Add `idempotencyKey` field (index with `sparse: true`) — no existing doc changes needed
2. Run reconciliation for all customers/suppliers to detect any existing drift
3. Fix any drifted `currentBalance` values

### Phase 3 (Transaction Log) — Backfill historical data

Write a migration script that:
1. Reads all `CustomerLedger` + `SupplierLedger` entries
2. Creates corresponding `TransactionLog` entries
3. Runs once, then all new entries are created inline

### Phase 4-6 — No migration needed

---

## Summary

| Phase | What | Effort | Risk | Business Impact |
|---|---|---|---|---|
| **1** | Fix 9 critical + significant bugs | 1-2 days | Low | Stop losing/duplicating money in the ledger |
| **2** | Atomic balance updates + idempotency + reconciliation | 2-3 days | Medium | Eliminate race conditions, add self-healing |
| **3** | Central Transaction Log | 2-3 days | Low | Full audit trail, unified reporting foundation |
| **4** | Fix reports (P&L, aging, dashboard) | 1-2 days | Low | Accurate business intelligence |
| **5** | Purchase return approval flow | 1 day | Low | Prevent unauthorized returns |
| **6** | Remove redundant balance documents | 0.5 day | Low | Single source of truth |

**Total estimated effort: 8-12 days**

### Convention Documentation (Add to README)

**Balance convention:**
- **Customer:** Positive `currentBalance` = customer owes us (receivable). Debit increases, credit decreases.
- **Supplier:** Positive `currentBalance` = we owe them (payable). Debit increases, credit decreases.
- **Transaction Log direction:** `in` = money comes to us. `out` = money leaves us.

**Idempotency key format:** `{sourceType}:{sourceId}:{eventType}[:{suffix}]`
- `order:64abc123:invoice`
- `order:64abc123:payment:64def456` (payment ID as suffix)
- `return:64abc123:credit_note`

---

*This plan was generated after a full audit of 32 org models, 21 route files, 12 controllers, 4 services, and the complete frontend API layer.*
