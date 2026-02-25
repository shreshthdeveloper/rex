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
