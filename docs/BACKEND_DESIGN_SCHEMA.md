# Backend Design Schema — Multi-Tenant E-Commerce Platform

> Complete file-by-file architecture, request flows, data flows, service interactions, and sequential diagrams.

---

## 1. Technology Stack

| Tech | Version | Purpose |
|---|---|---|
| Node.js | Runtime | Server-side JavaScript |
| Express | 5.2 | HTTP framework |
| Mongoose | 9.2 | MongoDB ODM |
| bcryptjs | 3.0 | Password hashing |
| jsonwebtoken | 9.0 | JWT authentication |
| express-validator | 7.3 | Request validation |
| multer | 2.0 | File upload handling |
| helmet | 8.1 | HTTP security headers |
| cors | 2.8 | Cross-origin requests |
| morgan | 1.10 | HTTP request logging |
| slugify | 1.6 | URL-safe slug generation |
| dotenv | 16.5 | Environment variables |

---

## 2. High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            EXPRESS SERVER (server.js)                       │
│                                                                            │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│   │ helmet() │  │  cors()  │  │ morgan() │  │ express.json(50mb)       │  │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────────┬──────────────┘  │
│        └──────────────┴────────────┴─────────────────────┘                 │
│                                    │                                       │
│                            /api/* ─┤                                       │
│                                    │                                       │
│              ┌─────────────────────┼─────────────────────┐                 │
│              ▼                     ▼                     ▼                 │
│        /superadmin           /admin/*              /store/*                │
│          routes               routes                routes                │
│              │                     │                     │                 │
│              ▼                     ▼                     ▼                 │
│        superAdminAuth        adminAuth +           resolveOrg /            │
│        middleware             rbac middleware       customerAuth            │
│              │                     │                     │                 │
│              ▼                     ▼                     ▼                 │
│        superadmin            admin controllers      store controllers      │
│        controller            (20 modules)           (3 modules)           │
│              │                     │                     │                 │
│              ▼                     ▼                     ▼                 │
│        SuperAdmin DB         Org DB (per tenant)    Org DB (per tenant)   │
│        ┌──────────┐         ┌────────────────┐     ┌────────────────┐     │
│        │Organization│        │ 30 collections │     │ same 30 coll.  │     │
│        │SuperAdmin │        │ per org DB      │     │ (read-heavy)   │     │
│        └──────────┘         └────────────────┘     └────────────────┘     │
│                                                                            │
│                          MongoDB Server                                    │
│              superadmin_db  │  org_demo  │  org_acme  │  ...              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Multi-Tenant Database Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MongoDB Server                        │
│                                                         │
│  ┌─────────────────┐     Each org gets its own DB       │
│  │ superadmin_db    │     with identical schema          │
│  │  ├─ organizations│                                    │
│  │  └─ superadmins  │     ┌──────────────┐              │
│  └─────────────────┘     │ org_demo_store│              │
│                           │  ├─ users         │              │
│  ┌──────────────┐        │  ├─ categories     │              │
│  │ org_acme_corp │        │  ├─ products       │              │
│  │  (same schema)│        │  ├─ productstocks  │              │
│  └──────────────┘        │  ├─ stockmovements  │              │
│                           │  ├─ orders          │              │
│  Connection pooling:      │  ├─ customers       │              │
│  database.js caches       │  ├─ customerledgers │              │
│  connections in           │  ├─ suppliers        │              │
│  orgConnections{}         │  ├─ purchaseorders   │              │
│                           │  └─ ... (30 total)   │              │
│                           └──────────────┘              │
└─────────────────────────────────────────────────────────┘
```

---

## 4. File-by-File Purpose and Details

### 4.1 Server Entry Point

#### `server.js` (86 lines)
- **Purpose:** Application bootstrap — creates Express app, mounts all middleware, connects to SuperAdmin DB, seeds default data, starts HTTP listener
- **Execution flow:**
  ```
  1. Load .env via dotenv
  2. Create Express app
  3. Apply global middleware: helmet, cors, morgan, json(50mb), urlencoded
  4. Serve static /uploads directory
  5. Mount all routes at /api
  6. Apply global error handler
  7. connectSuperAdminDB() → register SuperAdmin models → seed default superadmin
  8. Listen on config.port (default 5000)
  9. Register SIGTERM/SIGINT handlers → closeAllConnections() → process.exit
  ```
- **Connects to:** `config.js`, `database.js`, `routes/index.js`, `errorHandler.js`, `seeder.js`
- **Output:** Running HTTP server on port 5000

### 4.2 Configuration Files

#### `src/config/config.js` (15 lines)
- **Purpose:** Centralized environment configuration
- **Fields:**
  | Field | Default | Source |
  |---|---|---|
  | `port` | 5000 | `PORT` env |
  | `mongoUri` | `mongodb://localhost:27017` | `MONGO_URI` env |
  | `jwtSecret` | `your-secret-key` | `JWT_SECRET` env |
  | `jwtExpiresIn` | `7d` | `JWT_EXPIRES_IN` env |
  | `superadminDb` | `superadmin_db` | `SUPERADMIN_DB` env |
  | `superadminEmail` | `admin@erp.com` | `SUPERADMIN_EMAIL` env |
  | `superadminPassword` | `admin123` | `SUPERADMIN_PASSWORD` env |
- **Used by:** `database.js`, `auth.js`, `server.js`, controllers that sign JWTs

#### `src/config/database.js` (48 lines)
- **Purpose:** MongoDB connection management with per-org connection pooling
- **Exports:**
  | Function | Purpose | Returns |
  |---|---|---|
  | `connectSuperAdminDB()` | Creates connection to `superadmin_db` | mongoose.Connection |
  | `getOrgConnection(dbName)` | Gets/creates connection to org DB, caches in pool | mongoose.Connection |
  | `closeAllConnections()` | Closes SuperAdmin + all org connections | void |
- **Connection pool strategy:** `orgConnections = {}` object caches connections by dbName. First call creates, subsequent calls return cached. Each connection gets org models registered via `registerOrgModels()`.
- **Flow:**
  ```
  Request arrives → auth middleware reads JWT → extracts orgDb
    → getOrgConnection(orgDb)
      → if cached: return orgConnections[orgDb]
      → if new: mongoose.createConnection(mongoUri/orgDb) → registerOrgModels() → cache → return
  ```
- **Used by:** `auth.js` middleware (on every authenticated request)

### 4.3 Middleware Layer

#### `src/middleware/auth.js` (140 lines)
- **Purpose:** JWT authentication — the gateway for every protected route
- **Exports 4 middleware functions:**

##### `adminAuth`
- **Used on:** ALL `/admin/*` routes
- **Flow:**
  ```
  1. Extract Bearer token from Authorization header
  2. jwt.verify(token, jwtSecret)
  3. If decoded.role === 'superadmin':
     │  → Connect to SuperAdmin DB
     │  → Find SuperAdmin by decoded.adminId
     │  → Attach req.user, req.orgConn = null, req.models = null
     │  → next()
  4. If regular org user:
     │  → getOrgConnection(decoded.orgDb)
     │  → Register org models on connection
     │  → Find User by decoded.userId
     │  → Check user.isActive
     │  → Attach req.user (id, role, orgId, orgDb)
     │  → Attach req.orgConn (mongoose connection)
     │  → Attach req.models (all 30 org models)
     │  → next()
  5. On any failure → ApiError(401)
  ```

##### `customerAuth`
- **Used on:** `/store/:orgSlug/portal/*` routes
- **Flow:** Same as adminAuth but for customer tokens. Extracts customerId, orgDb from JWT. Attaches `req.customer`, `req.models`.

##### `resolveOrg`
- **Used on:** Public `/store/:orgSlug/*` routes (catalog, no auth required)
- **Flow:** Reads `:orgSlug` from URL → finds Organization in SuperAdmin DB → `getOrgConnection(org.dbName)` → attaches `req.models`

##### `superAdminAuth`
- **Used on:** `/superadmin/*` routes
- **Flow:** Calls `adminAuth` first, then checks `req.user.role === 'superadmin'`. Rejects org users.

#### `src/middleware/rbac.js` (28 lines)
- **Purpose:** Role-Based Access Control — restricts endpoints to specific roles
- **Core function:** `authorize(...allowedRoles)` — returns middleware that checks `req.user.role ∈ allowedRoles`
- **Shorthand helpers:**
  | Helper | Allowed Roles |
  |---|---|
  | `adminOnly` | admin |
  | `managerPlus` | admin, manager |
  | `cashierPlus` | admin, manager, cashier |
  | `warehousePlus` | admin, manager, warehouse_staff |
  | `accountantPlus` | admin, manager, accountant |
  | `allRoles` | admin, manager, cashier, warehouse_staff, accountant |
- **Used by:** All admin route files

#### `src/middleware/validate.js` (16 lines)
- **Purpose:** Express-validator result checker
- **Flow:** Runs after validation chains → if errors exist, throws `ApiError(400, errors[])` → otherwise `next()`
- **Used by:** Route files that define validation rules inline

#### `src/middleware/errorHandler.js` (24 lines)
- **Purpose:** Global error handler — catches all errors thrown anywhere in the request pipeline
- **Flow:**
  ```
  Error caught
    ├── If ApiError: respond with err.statusCode + err.message + err.errors
    └── If other: wrap as 500 Internal Server Error
  Response: { statusCode, success: false, message, errors }
  ```
- **Used by:** Mounted last in `server.js` — catches errors from asyncHandler

### 4.4 Utility Layer

#### `src/utils/ApiError.js` (15 lines)
- **Purpose:** Custom error class with HTTP status code
- **Fields:** `statusCode`, `message`, `errors[]`, `success: false`
- **Usage:** `throw new ApiError(400, 'Validation failed', [{field: 'email', message: 'required'}])`
- **Used by:** ALL controllers, middleware

#### `src/utils/ApiResponse.js` (10 lines)
- **Purpose:** Standardized success response wrapper
- **Fields:** `statusCode`, `success: true`, `message`, `data`
- **Usage:** `res.status(200).json(new ApiResponse(200, data, 'Success'))`
- **Used by:** ALL controllers

#### `src/utils/asyncHandler.js` (8 lines)
- **Purpose:** Wraps async route handlers to auto-catch promise rejections
- **Pattern:** `asyncHandler(fn) => (req, res, next) => fn(req, res, next).catch(next)`
- **Used by:** ALL controller methods (every route handler is wrapped)

#### `src/utils/helpers.js` (30 lines)
- **Purpose:** Shared utility functions
- **Exports:**
  | Function | Purpose |
  |---|---|
  | `generateSlug(text)` | Creates URL-safe slug via slugify (lowercase, strict) |
  | `paginate(query)` | Extracts page/limit from query, calculates skip, returns {page, limit, skip} |
  | `paginationMeta(total, page, limit)` | Computes {total, page, limit, pages} |
- **Used by:** Controllers for pagination and slug generation

#### `src/utils/transaction.js` (55 lines)
- **Purpose:** MongoDB transaction wrapper with standalone mode fallback
- **Core function:** `withTransaction(connection, callback)`
- **Flow:**
  ```
  1. Check supportCache for this connection
  2. If not cached → try session.startTransaction()
     ├── If success → supportCache[host] = true
     └── If "not supported" error → supportCache[host] = false
  3. If transactions supported:
     │  → Start session → startTransaction → run callback(session) → commit → end
  4. If NOT supported (standalone MongoDB):
     │  → Run callback(null) without session
     │  → Operations execute without atomicity
  ```
- **Used by:** `orders.controller.js`, `stock.controller.js`, `purchaseOrders.controller.js`, `customers.controller.js`

### 4.5 Plugins

#### `src/plugins/softDelete.js` (38 lines)
- **Purpose:** Mongoose plugin that adds soft delete capability to any model
- **Adds to schema:**
  - Field: `deletedAt: Date` (default null)
  - Pre-hooks on `find`, `findOne`, `findOneAndUpdate`, `countDocuments` → auto-filters `deletedAt: null`
  - Instance method: `softDelete()` → sets `deletedAt = new Date()`
  - Instance method: `restore()` → sets `deletedAt = null`
- **Used by:** 18 models: User, Category, Warehouse, Product, StockTransfer, Customer, CustomerTierPrice, Order, Supplier, PurchaseOrder, Coupon, EcomSettings, Unit, TaxSlab, BarcodeType, CustomerTopup, SupplierPayment, SupplierAdjustment

---

### 4.6 Models Layer — SuperAdmin Database

#### `src/models/superadmin/index.js`
- **Purpose:** Defines schemas for the platform-wide SuperAdmin database
- **Schemas:**

##### `organizationSchema`
| Field | Type | Details |
|---|---|---|
| `name` | String | Required, trimmed |
| `slug` | String | Required, unique, lowercase |
| `dbName` | String | Required, unique — e.g., `org_demo_store` |
| `plan` | String | Enum: free, basic, premium, enterprise |
| `isActive` | Boolean | Default true |
| `createdBy` | ObjectId → SuperAdmin | Who created it |
| `deletedAt` | Date | Soft delete |

##### `superAdminSchema`
| Field | Type | Details |
|---|---|---|
| `name` | String | Required |
| `email` | String | Required, unique, lowercase |
| `password` | String | Required, bcrypt hashed (pre-save hook) |
| `role` | String | Default 'superadmin' |
| `isActive` | Boolean | Default true |

- **Export:** `registerSuperAdminModels(connection)` → returns `{ Organization, SuperAdmin }`

---

### 4.7 Models Layer — Org Database (30 Schemas)

#### `src/models/org/index.js`
- **Purpose:** Central registration function for ALL org models
- **Export:** `registerOrgModels(connection)` — registers all 30 models on a mongoose connection, returns object with all model references
- **Used by:** `database.js` (when creating org connection), `auth.js` (attaches to `req.models`)

---

#### **Core Entity Models**

##### `User.js`
| Field | Type | Details |
|---|---|---|
| `name` | String | Required |
| `email` | String | Required, unique |
| `password` | String | bcrypt hashed (pre-save) |
| `role` | String | Enum: admin, manager, cashier, warehouse_staff, accountant |
| `isActive` | Boolean | Default true |
- **Plugin:** softDelete
- **Password method:** `comparePassword(candidate)` → bcrypt.compare

##### `Category.js`
| Field | Type | Details |
|---|---|---|
| `name` | String | Required |
| `slug` | String | Required, unique |
| `parentCategory` | ObjectId → Category | Self-referential for hierarchy |
| `image` | String | URL |
| `description` | String | |
| `sortOrder` | Number | Default 0 |
| `isActive` | Boolean | Default true |
- **Plugin:** softDelete

##### `Product.js`
| Field | Type | Details |
|---|---|---|
| `name` | String | Required |
| `sku` | String | Required, unique, uppercase |
| `type` | String | Enum: single, parent, variant |
| `parentProduct` | ObjectId → Product | For variants only |
| `variantAttribute` | String | e.g., "Color", "Size" |
| `variantValue` | String | e.g., "Red", "Large" |
| `categories` | [ObjectId → Category] | Multiple categories |
| `unit` | ObjectId → Unit | |
| `barcodeType` | ObjectId → BarcodeType | |
| `barcodeValue` | String | Indexed |
| `description` | String | |
| `images` | [sub-schema] | url, isPrimary, sortOrder, altText |
| `basePrice` | Number | Default 0 |
| `costPrice` | Number | Default 0 |
| `taxSlab` | ObjectId → TaxSlab | |
| `weight` | Number | |
| `isActive` | Boolean | Default true |
| `isFeatured` | Boolean | Default false |
| `slug` | String | Unique |
| `compareAtPrice` | Number | Strikethrough price |
| `tags` | [String] | |
- **Plugin:** softDelete
- **Indexes:** sku, parentProduct, categories, barcodeValue, slug

##### `Customer.js`
| Field | Type | Details |
|---|---|---|
| `name` | String | Required |
| `companyName` | String | |
| `email` | String | Unique, sparse |
| `phone` | String | |
| `password` | String | Hashed (for store login) |
| `gstNumber` | String | |
| `paymentTerms` | Number | Days |
| `website` | String | |
| `tier` | String | Enum: retail, wholesale, vip, custom |
| `addresses` | [sub-schema] | label, line1, line2, city, state, pincode, country, isDefault |
| `creditLimit` | Number | Default 0 |
| `currentBalance` | Number | Default 0, running balance |
| `notes` | String | |
| `termsAcceptedAt` | Date | |
| `documents` | [sub-schema] | name, url, status (pending/approved/rejected), uploadedAt |
| `isActive` | Boolean | Default true |
- **Plugin:** softDelete
- **Password method:** `comparePassword(candidate)`

##### `Supplier.js`
| Field | Type | Details |
|---|---|---|
| `name` | String | Required |
| `email` | String | Sparse unique |
| `phone` | String | |
| `contactPerson` | String | |
| `address` | embedded | line1, line2, city, state, pincode, country |
| `gstNumber` | String | |
| `taxId` | String | |
| `paymentTerms` | Number | Days |
| `creditLimit` | Number | Default 0 |
| `currentBalance` | Number | Default 0, running balance |
| `notes` | String | |
| `isActive` | Boolean | Default true |
- **Plugin:** softDelete

---

#### **Inventory & Stock Models**

##### `ProductStock.js`
| Field | Type | Details |
|---|---|---|
| `product` | ObjectId → Product | Required |
| `warehouse` | ObjectId → Warehouse | Required |
| `quantity` | Number | Default 0 |
| `reservedQuantity` | Number | Default 0 (reserved for pending orders) |
| `warehousePrice` | Number | Per-warehouse price override |
| `lowStockThreshold` | Number | Default 10 |
- **Unique compound index:** `{product, warehouse}` — one record per product-warehouse pair
- **Virtual:** `availableQuantity = quantity - reservedQuantity`

##### `StockMovement.js`
| Field | Type | Details |
|---|---|---|
| `product` | ObjectId → Product | Required |
| `warehouse` | ObjectId → Warehouse | Required |
| `movementType` | String | Enum: opening, purchase, sale, return, transfer_in, transfer_out, adjustment, manual |
| `quantityBefore` | Number | |
| `quantityChange` | Number | +/- |
| `quantityAfter` | Number | |
| `referenceType` | String | e.g., 'Order', 'GRN', 'StockAdjustment' |
| `referenceId` | ObjectId | |
| `referenceNumber` | String | |
| `fromWarehouse` / `toWarehouse` | ObjectId | For transfers |
| `notes` | String | |
| `createdBy` | ObjectId → User | |
- **IMMUTABLE:** Pre-hook on `findOneAndUpdate` throws error — movements can never be edited
- **Purpose:** Complete audit trail of every stock change

##### `StockTransfer.js`
| Field | Type | Details |
|---|---|---|
| `transferNumber` | String | Auto-generated (TRF-00001) |
| `fromWarehouse` | ObjectId → Warehouse | Required |
| `toWarehouse` | ObjectId → Warehouse | Required |
| `status` | String | Enum: draft, in_transit, completed, cancelled |
| `items` | [sub-schema] | product, requestedQty, transferredQty, notes |
| `createdBy` / `completedBy` | ObjectId → User | |
| `completedAt` | Date | |
- **Plugin:** softDelete

##### `StockAdjustment.js`
| Field | Type | Details |
|---|---|---|
| `adjustmentNumber` | String | Auto-generated (ADJ-00001) |
| `warehouse` | ObjectId → Warehouse | |
| `product` | ObjectId → Product | |
| `quantityBefore` | Number | |
| `adjustedQuantity` | Number | Amount changed |
| `quantityAfter` | Number | |
| `adjustmentType` | String | increase / decrease |
| `reason` | String | Enum: damage, theft, count_correction, expiry, other |
| `notes` | String | |
| `createdBy` | ObjectId → User | |

---

#### **Order & Payment Models**

##### `Order.js`
| Field | Type | Details |
|---|---|---|
| `orderNumber` | String | Auto-generated (ORD-00001) |
| `customer` | ObjectId → Customer | Required |
| `warehouse` | ObjectId → Warehouse | Required |
| `status` | String | Enum: placed, confirmed, processing, packed, shipped, in_transit, delivered, cancelled, returned, on_hold. Default: placed |
| `orderDate` | Date | Default now |
| `items` | [embedded] | See below |
| `subtotal` | Number | Sum of line totals |
| `discountType` | String | percentage / fixed |
| `discountValue` | Number | |
| `discountAmount` | Number | Computed |
| `couponCode` | String | |
| `couponDiscount` | Number | |
| `taxTotal` | Number | Sum of item taxes |
| `shippingCharge` | Number | |
| `grandTotal` | Number | Final amount |
| `amountPaid` | Number | Running total of payments |
| `balanceDue` | Number | grandTotal - amountPaid |
| `paymentStatus` | String | unpaid / partial / paid |
| `shippingAddress` | embedded | |
| `notes` | String | |
| `referenceNumber` | String | External ref |
| `saleType` | String | direct / online |
| `orderSource` | String | admin / store |
| `invoiceNumber` | String | Auto-generated (INV-00001) |
| `editHistory` | [embedded] | editedBy, editedAt, changes (before/after snapshot) |
| `statusHistory` | [embedded] | from, to, changedBy, changedAt, notes |
| `createdBy` | ObjectId → User | |

**Order Item sub-schema:**
| Field | Type | Details |
|---|---|---|
| `product` | ObjectId → Product | |
| `productSnapshot` | Mixed | Frozen copy of product at order time |
| `quantity` | Number | |
| `unitPrice` | Number | Resolved price |
| `discountType/Value/Amount` | | Per-item discount |
| `taxSlab` | embedded | name, rate (snapshot) |
| `taxAmount` | Number | Computed |
| `lineTotal` | Number | (qty × price - discount + tax) |
| `status` | String | pending / fulfilled / returned |
| `returnedQty` | Number | |

##### `OrderPayment.js`
| Field | Type | Details |
|---|---|---|
| `order` | ObjectId → Order | |
| `customer` | ObjectId → Customer | |
| `amount` | Number | Payment amount |
| `splitMethods` | [sub-schema] | method + amount + reference (for split payments) |
| `method` | String | cash, card, bank_transfer, credit, split |
| `reference` | String | Transaction ref |
| `paymentDate` | Date | |
| `notes` | String | |
| `createdBy` | ObjectId → User | |

##### `OrderReturn.js`
| Field | Type | Details |
|---|---|---|
| `returnNumber` | String | Auto-generated (RET-00001) |
| `order` | ObjectId → Order | |
| `customer` | ObjectId → Customer | |
| `returnType` | String | full / partial |
| `items` | [sub-schema] | lineItemId, product, returnQty, reason, condition |
| `returnWarehouse` | ObjectId → Warehouse | |
| `refundAmount` | Number | |
| `refundMethod` | String | |
| `status` | String | initiated / approved / completed / rejected |
| `notes` | String | |
| `createdBy` | ObjectId → User | |

---

#### **Ledger Models (IMMUTABLE)**

##### `CustomerLedger.js`
| Field | Type | Details |
|---|---|---|
| `customer` | ObjectId → Customer | Required |
| `transactionType` | String | Enum: sale, payment, credit_note, debit_note, topup, opening_balance, adjustment |
| `referenceType` | String | e.g., 'Order', 'OrderPayment', 'CustomerTopup' |
| `referenceId` | ObjectId | |
| `referenceNumber` | String | |
| `debit` | Number | Default 0 |
| `credit` | Number | Default 0 |
| `balanceAfter` | Number | Running balance after this entry |
| `narration` | String | Human-readable description |
| `createdBy` | ObjectId → User | |
- **IMMUTABLE:** Pre-hook prevents updates — append-only ledger

##### `SupplierLedger.js`
- Same structure as CustomerLedger but for suppliers
- **transactionTypes:** purchase, payment, debit_note, credit_note, opening_balance, adjustment, return

##### `CustomerTopup.js`
| Field | Type | Details |
|---|---|---|
| `topupNumber` | String | Auto-generated (TOP-00001) |
| `customer` | ObjectId | |
| `amount` | Number | |
| `type` | String | topup, debit_adjustment, credit_adjustment, opening_balance |
| `method` | String | |
| `reference` | String | |
| `narration` | String | |
| `balanceBefore` / `balanceAfter` | Number | |
| `createdBy` | ObjectId | |

---

#### **Purchase Models**

##### `PurchaseOrder.js`
| Field | Type | Details |
|---|---|---|
| `poNumber` | String | Auto-generated (PO-00001) |
| `supplier` | ObjectId → Supplier | |
| `warehouse` | ObjectId → Warehouse | |
| `status` | String | draft, ordered, partial, received, cancelled |
| `orderDate` | Date | |
| `expectedDate` | Date | |
| `items` | [sub-schema] | product, orderedQty, receivedQty, unitCost, taxSlab ref, lineTotal |
| `subtotal` / `taxTotal` / `discount` / `shippingCost` / `grandTotal` | Number | |
| `amountPaid` / `balanceDue` | Number | |
| `notes` | String | |
- **Plugin:** softDelete

##### `GRN.js` (Goods Received Note)
| Field | Type | Details |
|---|---|---|
| `grnNumber` | String | Auto-generated (GRN-00001) |
| `purchaseOrder` | ObjectId → PurchaseOrder | |
| `supplier` | ObjectId → Supplier | |
| `warehouse` | ObjectId → Warehouse | |
| `items` | [sub-schema] | product, orderedQty, receivedQty, unitCost, lineTotal |
| `totalValue` | Number | |
| `status` | String | draft, approved, rejected |
| `receivedDate` | Date | |
| `notes` | String | |
| `approvedBy` | ObjectId → User | |
| `approvedAt` | Date | |

##### `PurchaseReturn.js`
| Field | Type | Details |
|---|---|---|
| `returnNumber` | String | Auto-generated (PRET-00001) |
| `purchaseOrder` | ObjectId → PurchaseOrder | |
| `supplier` | ObjectId → Supplier | |
| `warehouse` | ObjectId → Warehouse | |
| `items` | [sub-schema] | product, returnQty, reason, unitCost, lineTotal |
| `totalValue` | Number | |
| `status` | String | initiated, approved, completed |
| `notes` | String | |

##### `SupplierPayment.js` / `SupplierAdjustment.js`
- Payment recording and balance adjustments for suppliers
- Same pattern as CustomerTopup but for supplier side

---

#### **Supporting Models**

##### `Warehouse.js`
| Field | Type | Details |
|---|---|---|
| `name` | String | Required |
| `code` | String | Required, unique, uppercase |
| `location` | String | |
| `contactPerson` | String | |
| `phone` | String | |
| `isActive` | Boolean | Default true |

##### `Unit.js` / `BarcodeType.js` / `TaxSlab.js`
- Simple reference data: name, description/shortName, rate, isActive

##### `Coupon.js`
| Field | Type | Details |
|---|---|---|
| `code` | String | Unique, uppercase |
| `description` | String | |
| `discountType` | String | percentage / fixed |
| `discountValue` | Number | |
| `maxDiscountAmount` | Number | Cap for percentage |
| `minOrderValue` | Number | |
| `usageLimit` | Number | |
| `usedCount` | Number | Default 0 |
| `applicableTo` | String | all / category / product |
| `applicableIds` | [ObjectId] | |
| `validFrom` / `validUntil` | Date | |
| `isActive` | Boolean | |

##### `Notification.js`
| Field | Type | Details |
|---|---|---|
| `user` | ObjectId → User | |
| `title` / `message` | String | |
| `type` | String | info, warning, success, error |
| `isRead` | Boolean | Default false |
| `readAt` | Date | |
| `link` | String | Optional link |

##### `Counter.js`
| Field | Type | Details |
|---|---|---|
| `_id` | String | Counter name (e.g., 'order', 'grn') |
| `seq` | Number | Current sequence number |
- **Used by:** `counterService.js` for auto-incrementing reference numbers

##### `EcomSettings.js`
- Singleton document per org containing ALL storefront configuration
- **Sections:** branding, theme, banners, layout, marquee, terms, documents, footer, social links, homepage sections

---

### 4.8 Services Layer

#### `src/services/counterService.js`
- **Purpose:** Auto-incrementing reference number generation
- **Function:** `getNextSequence(models, counterName, prefix, padLength)`
- **Flow:**
  ```
  findOneAndUpdate({_id: counterName}, {$inc: {seq: 1}}, {upsert: true})
    → returns new seq value
    → formats as "PREFIX-00001" (zero-padded)
  ```
- **Example outputs:** ORD-00001, INV-00001, GRN-00001, PO-00001, TRF-00001, ADJ-00001, TOP-00001, RET-00001, PRET-00001
- **Used by:** Order, GRN, PurchaseOrder, StockTransfer, StockAdjustment, CustomerTopup, OrderReturn, PurchaseReturn, SupplierPayment, SupplierAdjustment controllers

#### `src/services/ledgerService.js`
- **Purpose:** Immutable financial ledger management for customers and suppliers
- **Exports:**

##### `createCustomerLedgerEntry(models, { customerId, transactionType, referenceType, referenceId, referenceNumber, debit, credit, narration, createdBy })`
- **Flow:**
  ```
  1. Find last ledger entry for customer sorted by createdAt desc
  2. lastBalance = last entry's balanceAfter (or 0 if first)
  3. newBalance = lastBalance + debit - credit
  4. Create CustomerLedger entry with balanceAfter = newBalance
  5. Update Customer.currentBalance = newBalance
  6. Return the new ledger entry
  ```

##### `createSupplierLedgerEntry(models, { ... })`
- Same pattern but for supplier: `newBalance = lastBalance + debit - credit`
- Updates `Supplier.currentBalance`

- **Used by:** `orders.controller.js`, `customers.controller.js`, `suppliers.controller.js`, `purchaseOrders.controller.js`, `portal.controller.js`

#### `src/services/priceResolver.js`
- **Purpose:** 4-tier price resolution engine
- **Function:** `resolvePrice(models, { productId, warehouseId, customerId, qty })`
- **Resolution cascade (first non-null wins):**
  ```
  Tier 1: CustomerTierPrice (product + customer.tier + qty ≥ minQty)
      ↓ if null
  Tier 2: ProductStock.warehousePrice (product + warehouse)
      ↓ if null
  Tier 3: Product.basePrice for the specific SKU
      ↓ if product.type === 'variant' and still searching
  Tier 4: Product.basePrice of parentProduct
  ```
- **Returns:** `{ price, source }` where source is 'tier_price' | 'warehouse_price' | 'product_price' | 'parent_price'
- **Used by:** `orders.controller.js` (order creation), `pricing.controller.js` (resolver tool), `portal.controller.js`

#### `src/services/stockService.js`
- **Purpose:** All stock quantity mutations with audit trail
- **Exports:**

| Function | Purpose | Movement Type |
|---|---|---|
| `updateStock(models, {product, warehouse, qty, type, ref, refId, refNum, notes, createdBy})` | General stock update (opening, purchase, adjustment) | Varies |
| `reserveStock(models, {product, warehouse, qty, ref...})` | Reserve stock for pending orders — increments `reservedQuantity` | `sale` (recorded but qty not deducted yet) |
| `releaseReserved(models, {product, warehouse, qty, ref...})` | Release previously reserved stock (order cancelled) | `return` |
| `deductOnShipment(models, {product, warehouse, qty, ref...})` | Deduct actual quantity and release reservation (order shipped) | `sale` |

- **Every function:**
  1. Finds or creates ProductStock record
  2. Records quantityBefore
  3. Updates quantity and/or reservedQuantity
  4. Records quantityAfter
  5. Creates StockMovement entry (immutable audit trail)
- **Used by:** `orders.controller.js`, `stock.controller.js`, `purchaseOrders.controller.js`, `portal.controller.js`

---

### 4.9 Routes Layer

#### `src/routes/index.js`
- **Purpose:** Main route aggregator
- **Mounts:**
  ```
  /superadmin  → superadmin.routes.js
  /admin       → admin/index.js
  /store       → store/index.js
  /health      → { status: 'ok', timestamp }
  ```

#### `src/routes/superadmin.routes.js`
- **Purpose:** Platform-level routes (org management)
- **All routes behind `superAdminAuth` middleware**
- **Endpoints:**
  | Method | Path | Handler | RBAC |
  |---|---|---|---|
  | POST | `/login` | login | Public |
  | GET | `/organizations` | listOrgs | superAdminAuth |
  | POST | `/organizations` | createOrg | superAdminAuth |
  | GET | `/organizations/:id` | getOrg | superAdminAuth |
  | PUT | `/organizations/:id` | updateOrg | superAdminAuth |
  | DELETE | `/organizations/:id` | deleteOrg | superAdminAuth |
  | POST | `/organizations/:orgId/admins` | createOrgAdmin | superAdminAuth |
  | GET | `/organizations/:orgId/admins` | listOrgAdmins | superAdminAuth |

#### `src/routes/admin/index.js`
- **Purpose:** Mounts all 20 admin sub-route modules
- **All behind `adminAuth` middleware (token required)**
- **Mounts:**
  ```
  /auth             → admin/auth.routes.js
  /users            → admin/users.routes.js
  /categories       → admin/categories.routes.js
  /units            → admin/units.routes.js
  /barcode-types    → admin/barcodeTypes.routes.js
  /tax-slabs        → admin/taxSlabs.routes.js
  /warehouses       → admin/warehouses.routes.js
  /products         → admin/products.routes.js
  /stock            → admin/stock.routes.js
  /customers        → admin/customers.routes.js
  /orders           → admin/orders.routes.js
  /suppliers        → admin/suppliers.routes.js
  /purchase-orders  → admin/purchaseOrders.routes.js
  /coupons          → admin/coupons.routes.js
  /pricing          → admin/pricing.routes.js
  /reports          → admin/reports.routes.js
  /notifications    → admin/notifications.routes.js
  /ecom-settings    → admin/ecomSettings.routes.js
  /upload           → admin/upload.routes.js
  ```

#### `src/routes/store/index.js`
- **Purpose:** Public storefront + customer portal routes
- **Structure:**
  ```
  /:orgSlug/          (resolveOrg middleware)
    /settings         → catalog.getSettings
    /categories       → catalog.getCategories
    /products         → catalog.getProducts
    /featured         → catalog.getFeatured
    /search           → catalog.searchProducts
    /products/slug/:slug → catalog.getProductBySlug
    /products/:id     → catalog.getProductById

  /:orgSlug/auth/     (resolveOrg middleware)
    /register         → customerAuth.register
    /login            → customerAuth.login

  /:orgSlug/portal/   (customerAuth middleware)
    /profile          → portal.getProfile / updateProfile
    /orders           → portal.myOrders / placeOrder
    /orders/:id       → portal.getOrder
    /orders/:id/cancel → portal.cancelOrder
    /ledger           → portal.myLedger
    /balance          → portal.myBalance
    /payments         → portal.myPayments
  ```

---

### 4.10 Controllers Layer (23 Controllers)

#### `src/controllers/superadmin.controller.js` (104 lines)
- **Purpose:** Platform management — login, org CRUD, admin provisioning
- **Handlers:**

| Handler | Flow |
|---|---|
| `login` | Find SuperAdmin by email → bcrypt compare → sign JWT({adminId, role:'superadmin'}) → return token |
| `listOrgs` | Organization.find() paginated |
| `createOrg` | Generate slug + dbName → Organization.create() → getOrgConnection() (initializes DB) |
| `getOrg` | Organization.findById() |
| `updateOrg` | Organization.findByIdAndUpdate() |
| `deleteOrg` | Organization.softDelete() |
| `createOrgAdmin` | getOrgConnection(org.dbName) → User.create({role:'admin', hashedPw}) |
| `listOrgAdmins` | getOrgConnection(org.dbName) → User.find() |

#### `src/controllers/admin/auth.controller.js` (57 lines)
- **Purpose:** Admin authentication
- **Handlers:**
  | Handler | Flow |
  |---|---|
  | `login` | Find Org by slug → getOrgConnection → find User by email → bcrypt compare → sign JWT({userId, orgId, orgDb, role}) → return token |
  | `me` | Return req.user (from adminAuth middleware) |
  | `changePassword` | Verify current pw → hash new pw → save |

#### `src/controllers/admin/products.controller.js`
- **Purpose:** Product CRUD + variant management + image management
- **Key handlers:**
  | Handler | Flow |
  |---|---|
  | `list` | Product.find() with populate (categories, unit, barcodeType, taxSlab, parentProduct), paginated, filterable by type/category/search |
  | `create` | Validate fields → generateSlug → Product.create() → return with populates |
  | `update` | Product.findByIdAndUpdate() → return with populates |
  | `delete` | Product.softDelete() |
  | `addVariant` | Verify parent is type='parent' → create variant product linked via parentProduct |
  | `updateVariant` | Update variant product fields |
  | `deleteVariant` | Variant.softDelete() |
  | `addImages` | Push to product.images array |
  | `removeImage` | Pull from product.images array |
  | `getStock` | ProductStock.find({product}) with warehouse populate |
  | `stockSummary` | Aggregate total qty, reserved, across all warehouses |

#### `src/controllers/admin/orders.controller.js`
- **Purpose:** Full order lifecycle — the most complex controller
- **Key handlers:**

##### `create` (Order Creation)
```
1. Validate: customerId, warehouseId, items[]
2. Generate orderNumber via counterService ('ORD-XXXXX')
3. Generate invoiceNumber via counterService ('INV-XXXXX')
4. For each item:
   a. Find Product, verify exists & active
   b. Snapshot product data (productSnapshot)
   c. Resolve price via priceResolver
   d. Calculate line discount
   e. Snapshot tax slab (name + rate)
   f. Calculate taxAmount = (lineTotal * taxRate / 100)
   g. Compute lineTotal
5. Calculate subtotal, apply order-level discount, apply coupon
6. Calculate taxTotal, grandTotal
7. withTransaction():
   a. Create Order document
   b. For each item: stockService.reserveStock() → reserves qty in ProductStock
   c. Create CustomerLedger entry (debit = grandTotal, type = 'sale')
   d. If coupon used: increment Coupon.usedCount
8. Return populated order
```

##### `updateStatus`
```
Define valid transitions:
  placed → confirmed, processing, cancelled, on_hold
  confirmed → processing, cancelled, on_hold
  processing → packed, cancelled, on_hold
  packed → shipped, cancelled
  shipped → in_transit, delivered
  in_transit → delivered
  on_hold → processing, cancelled

Special handling for 'shipped':
  → For each item: stockService.deductOnShipment() (deducts quantity, releases reservation)

Special handling for 'cancelled':
  → For each item: stockService.releaseReserved() (releases reservation)
  → Create CustomerLedger credit_note entry
```

##### `recordPayment`
```
1. Create OrderPayment record
2. Update Order: amountPaid += amount, balanceDue -= amount
3. Update paymentStatus: paid / partial / unpaid
4. Create CustomerLedger entry (credit = amount, type = 'payment')
```

##### `initiateReturn`
```
1. Generate returnNumber via counterService ('RET-XXXXX')
2. Create OrderReturn
3. For each return item:
   a. stockService.updateStock(+returnQty, type='return') → restore to warehouse
   b. Update Order item: returnedQty += returnQty, status='returned' if fully returned
4. Create CustomerLedger credit_note entry
5. Update Order status to 'returned' if all items returned
```

#### `src/controllers/admin/stock.controller.js`
- **Purpose:** Stock management operations
- **Key handlers:**
  | Handler | Flow |
  |---|---|
  | `list` | ProductStock.find() with product+warehouse populates |
  | `lowStock` | ProductStock.find where quantity ≤ lowStockThreshold |
  | `movements` | StockMovement.find() paginated, filterable by product/warehouse/type |
  | `setOpening` | stockService.updateStock(type='opening') |
  | `createAdjustment` | withTransaction: generate ADJ number → stockService.updateStock(type='adjustment') → StockAdjustment.create() |
  | `createTransfer` | Generate TRF number → StockTransfer.create(status='draft') |
  | `completeTransfer` | withTransaction: for each item → stockService.updateStock(transfer_out from source) + stockService.updateStock(transfer_in to dest) → update status='completed' |
  | `cancelTransfer` | Update status='cancelled' |

#### `src/controllers/admin/customers.controller.js`
- **Purpose:** Customer CRUD + financial operations
- **Key handlers:**
  | Handler | Flow |
  |---|---|
  | `list` | Customer.find() paginated |
  | `create` | Hash password if provided → Customer.create() |
  | `getLedger` | CustomerLedger.find({customer}) sorted by createdAt |
  | `getBalance` | Return customer.currentBalance |
  | `topup` | Generate TOP number → save CustomerTopup → ledgerService.createCustomerLedgerEntry(credit=amount, type='topup') |
  | `adjust` | Generate TOP number → save CustomerTopup(type='debit/credit_adjustment') → create ledger entry |
  | `getStatement` | CustomerLedger.find({customer, date range}) |

#### `src/controllers/admin/suppliers.controller.js`
- **Purpose:** Supplier CRUD + financial operations
- **Same pattern as customers** but for supplier side with SupplierLedger, SupplierPayment, SupplierAdjustment

#### `src/controllers/admin/purchaseOrders.controller.js`
- **Purpose:** PO lifecycle + GRN + Purchase Returns
- **Key handlers:**

##### `approveGRN` (most complex PO operation)
```
withTransaction():
  1. Find GRN, verify status='draft'
  2. For each GRN item:
     a. stockService.updateStock(+receivedQty, type='purchase') → adds to warehouse
     b. Update PO item: receivedQty += GRN.receivedQty
  3. Update PO status: 'received' if all items fully received, 'partial' otherwise
  4. Calculate PO amountPaid and balanceDue
  5. Create SupplierLedger entry (debit = GRN.totalValue, type = 'purchase')
  6. Update GRN status = 'approved'
```

#### `src/controllers/admin/coupons.controller.js`
- **Purpose:** Coupon CRUD + validation
- **validate handler:**
  ```
  1. Find coupon by code
  2. Check isActive
  3. Check validFrom ≤ now ≤ validUntil
  4. Check usedCount < usageLimit
  5. Check cart total ≥ minOrderValue
  6. Calculate discount (percentage or fixed)
  7. Cap discount at maxDiscountAmount
  8. Return { valid, discount, coupon }
  ```

#### `src/controllers/admin/pricing.controller.js`
- **Purpose:** Tier price CRUD + price resolver tool
- **resolve handler:** Calls `priceResolver.resolvePrice(models, {productId, warehouseId, customerId, qty})` → returns { price, source }

#### `src/controllers/admin/reports.controller.js`
- **Purpose:** Analytics and reporting
- **Handlers:**
  | Report | Logic |
  |---|---|
  | `dashboard` | Count orders, sum revenue (delivered only), count customers, count products. Get top 5 products by order qty. Get recent 10 orders. |
  | `sales` | Aggregation pipeline: match date range + delivered status → group by date/week/month → sum grandTotal, count orders |
  | `stock` | ProductStock.find() with product + warehouse populate |
  | `customerAging` | Customer.find where currentBalance > 0... sorted by balance desc |
  | `supplierAging` | Supplier.find where currentBalance > 0 |
  | `profitLoss` | Aggregate delivered orders revenue vs cost (from productSnapshot.costPrice × qty) |

#### `src/controllers/store/catalog.controller.js`
- **Purpose:** Public storefront data (no auth required)
- **Handlers:**
  | Handler | Flow |
  |---|---|
  | `getSettings` | EcomSettings.findOne() |
  | `getCategories` | Category.find(active) → build tree structure (parent → children) |
  | `getProducts` | Product.find(active, type≠variant) paginated, filterable by category/sort |
  | `getFeatured` | Product.find(isFeatured, active) |
  | `searchProducts` | Product.find({name: regex(query)}, active) |
  | `getProductBySlug` | Product.findOne({slug}) → also fetch variants (Product.find({parentProduct})) → fetch stock for each |
  | `getProductById` | Product.findById() with populates |

#### `src/controllers/store/customerAuth.controller.js`
- **Purpose:** Customer registration and authentication for store
- **Handlers:**
  | Handler | Flow |
  |---|---|
  | `register` | Validate → hash password → Customer.create() → sign JWT({customerId, orgId, orgDb, role:'customer'}) |
  | `login` | Find customer by email → bcrypt compare → sign JWT |
  | `getProfile` | Return req.customer data |
  | `updateProfile` | Customer.findByIdAndUpdate() (name, phone, addresses only — not email/password) |
  | `changePassword` | Verify old → hash new → save |

#### `src/controllers/store/portal.controller.js`
- **Purpose:** Customer self-service portal
- **Handlers:**
  | Handler | Flow |
  |---|---|
  | `placeOrder` | Same logic as admin order create but for customer: reserve stock, create ledger entry, generate order/invoice numbers |
  | `cancelOrder` | Verify order belongs to customer + status before shipment → release reserved stock → create credit_note ledger |
  | `myOrders` | Order.find({customer: req.customer._id}) |
  | `myLedger` | CustomerLedger.find({customer}) |
  | `myBalance` | Customer.findById → currentBalance |
  | `myPayments` | OrderPayment.find({customer}) |

---

#### Remaining Simple CRUD Controllers
- `admin/users.controller.js`: User CRUD + toggleActive
- `admin/categories.controller.js`: Category CRUD + reorder (updates sortOrder for an array of {id, sortOrder})
- `admin/units.controller.js` / `barcodeTypes.controller.js` / `taxSlabs.controller.js`: Simple CRUD
- `admin/warehouses.controller.js`: Warehouse CRUD + getStock(warehouseId) + getMovements(warehouseId)
- `admin/notifications.controller.js`: List (filtered by user), markRead, markAllRead, delete
- `admin/ecomSettings.controller.js`: Get (findOne) / Update (findOneAndUpdate with upsert)
- `admin/upload.controller.js`: Single upload (multer diskStorage → `/uploads/` → URL) / multiple upload

---

### 4.11 Seeder

#### `src/seeder.js` (1067 lines)
- **Purpose:** Comprehensive demo data seeder for development and testing
- **Execution:** `npm run seed` → creates 1 demo org + all sample data
- **Creates (in order):**
  1. Organization (demo-store) + org database connection
  2. Users (admin, manager, cashier, warehouse_staff, accountant)
  3. Units (Pieces, Kg, Liter, Box, Set, Pack, Meter, Pair, Dozen, Gram)
  4. Barcode Types (EAN-13, QR Code, CODE-128, UPC-A, EAN-8, CODE-39)
  5. Tax Slabs (GST 5%, 12%, 18%, 28%, Exempt)
  6. Warehouses (Main, Secondary, Express)
  7. Categories (Electronics→Smartphones/Laptops/Accessories, Fashion→Men's/Women's/Kids, Home & Living→Kitchen/Furniture/Decor → sub-subcategories)
  8. EcomSettings (full storefront config with banners, sections)
  9. Products (5 parent products with 2 variants each + 3 single products = 16 products total)
  10. Customers (5 customers across tiers: retail, wholesale, vip)
  11. Suppliers (3 suppliers)
  12. ProductStock (stock for all products across warehouses)
  13. StockMovements (opening stock records)
  14. CustomerTierPrices (wholesale/vip tier prices)
  15. Coupons (3 coupons: WELCOME10, FLAT500, PREMIUM20)
  16. PurchaseOrders (2 POs)
  17. GRNs (2 GRNs, 1 approved)
  18. PurchaseReturns (1 return)
  19. SupplierLedger entries
  20. Orders (3 orders in various statuses)
  21. OrderPayments
  22. CustomerLedger entries
  23. CustomerTopups
  24. SupplierPayments
  25. StockTransfers
  26. StockAdjustments
  27. OrderReturns
  28. Notifications

### 4.12 Test Suite

#### `tests/api.test.js`
- **Purpose:** Comprehensive API integration tests
- **Coverage:** ~80+ tests across 22 module groups
- **Groups:** Auth, Users, Categories, Units, BarcodeTypes, TaxSlabs, Warehouses, Products, Stock, Customers, Orders, Suppliers, PurchaseOrders, Coupons, Pricing, Reports, Notifications, EcomSettings, Upload, Store Catalog, Customer Auth, Customer Portal
- **Pattern:** Sequential — login first, then CRUD operations, store created entities for later tests

---

## 5. Complete Request Flow Diagrams

### 5.1 Generic Admin Request Flow

```
[HTTP Request]
     │
     ▼
[Express receives at /api/admin/*]
     │
     ▼
[helmet() + cors() + morgan() + json parser]
     │
     ▼
[routes/index.js → routes/admin/index.js]
     │
     ▼
[adminAuth middleware]
  ├── Extract Bearer token from Authorization header
  ├── jwt.verify(token, secret) → decode payload
  ├── getOrgConnection(decoded.orgDb) → mongoose connection
  ├── registerOrgModels(connection) → 30 models
  ├── Find User by decoded.userId
  ├── Verify user.isActive
  └── Attach: req.user, req.orgConn, req.models
     │
     ▼
[RBAC middleware] (e.g., managerPlus)
  └── Check req.user.role ∈ allowedRoles
     │
     ▼
[validate middleware] (if route has validators)
  └── Check express-validator results → ApiError(400) if invalid
     │
     ▼
[Controller handler] (wrapped in asyncHandler)
  ├── Access req.models.Product, req.models.Order, etc.
  ├── Perform business logic (may call services)
  ├── Query/mutate MongoDB via Mongoose
  └── Return res.json(new ApiResponse(status, data, message))
     │
     ▼
[If error thrown at any point]
  └── asyncHandler catches → next(error) → errorHandler middleware
        └── ApiError → { statusCode, message, errors }
        └── Other → 500 Internal Server Error
```

### 5.2 Order Creation — Full Sequential Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ POST /api/admin/orders                                               │
│                                                                     │
│  adminAuth → rbac(cashierPlus) → controller.create                  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. VALIDATE INPUT                                                    │
│    - customerId exists → Customer.findById()                         │
│    - warehouseId exists → Warehouse.findById()                       │
│    - items[] not empty                                               │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. GENERATE REFERENCE NUMBERS                                        │
│    counterService.getNextSequence('order', 'ORD', 5) → ORD-00004    │
│    counterService.getNextSequence('invoice', 'INV', 5) → INV-00004  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. PROCESS EACH LINE ITEM                                            │
│    For each item in items[]:                                         │
│    ┌───────────────────────────────────────────────────────────────┐ │
│    │ a. Product.findById(item.productId)                           │ │
│    │    → verify exists, isActive                                  │ │
│    │                                                               │ │
│    │ b. Snapshot: { name, sku, basePrice, costPrice, images }      │ │
│    │                                                               │ │
│    │ c. priceResolver.resolvePrice(models, {                       │ │
│    │       productId, warehouseId, customerId, qty                 │ │
│    │    })                                                         │ │
│    │    → Tier 1: CustomerTierPrice? → Tier 2: warehousePrice?     │ │
│    │    → Tier 3: product.basePrice → Tier 4: parent.basePrice     │ │
│    │    → returns { price: 89999, source: 'tier_price' }           │ │
│    │                                                               │ │
│    │ d. Calculate line discount (if applicable)                    │ │
│    │    → discountAmount = percentage ? (price×%/100) : fixed      │ │
│    │                                                               │ │
│    │ e. Snapshot tax slab: TaxSlab.findById(product.taxSlab)       │ │
│    │    → { name: 'GST 18%', rate: 18 }                           │ │
│    │                                                               │ │
│    │ f. taxAmount = (qty × price - discount) × rate / 100          │ │
│    │    lineTotal = (qty × price) - discount + taxAmount           │ │
│    └───────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. CALCULATE ORDER TOTALS                                            │
│    subtotal = Σ lineTotal (before order discount)                    │
│    discountAmount = apply order-level discount                       │
│    couponDiscount = apply coupon (if valid)                          │
│    taxTotal = Σ item taxAmounts                                      │
│    grandTotal = subtotal - discountAmount - couponDiscount + shipping│
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. TRANSACTION BLOCK — withTransaction(connection, async(session))    │
│                                                                     │
│    a. Order.create({ orderNumber, invoiceNumber, customer,           │
│       warehouse, items, totals, status:'placed' })                   │
│                                                                     │
│    b. For each item:                                                 │
│       stockService.reserveStock(models, {                            │
│         product, warehouse, qty,                                     │
│         referenceType:'Order', referenceId, referenceNumber          │
│       })                                                             │
│       → ProductStock.reservedQuantity += qty                         │
│       → StockMovement created (type: 'sale')                         │
│                                                                     │
│    c. ledgerService.createCustomerLedgerEntry(models, {              │
│         customerId, transactionType:'sale',                          │
│         referenceType:'Order', debit: grandTotal                     │
│       })                                                             │
│       → CustomerLedger entry created (debit)                         │
│       → Customer.currentBalance updated                              │
│                                                                     │
│    d. If coupon: Coupon.usedCount++                                  │
│                                                                     │
│    → commit transaction                                              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. RETURN RESPONSE                                                   │
│    res.status(201).json(new ApiResponse(201, populatedOrder,         │
│      'Order created'))                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Order Status Progression — Shipped Flow

```
PATCH /api/admin/orders/:id/status  { status: 'shipped' }
     │
     ▼
[Validate: current status must be 'packed']
     │
     ▼
[For each order item:]
  │
  ├── stockService.deductOnShipment(models, {
  │     product: item.product,
  │     warehouse: order.warehouse,
  │     qty: item.quantity
  │   })
  │     │
  │     ├── Find ProductStock record
  │     ├── quantity -= qty         (actual stock deducted)
  │     ├── reservedQuantity -= qty (reservation released)
  │     ├── Save ProductStock
  │     └── Create StockMovement {
  │           movementType: 'sale',
  │           quantityChange: -qty,
  │           referenceType: 'Order'
  │         }
  │
  └── (continues for each item)
     │
     ▼
[Update Order status → 'shipped']
[Push to statusHistory: { from: 'packed', to: 'shipped', changedBy, changedAt }]
     │
     ▼
[Return updated order]
```

### 5.4 GRN Approval — Full Sequential Flow

```
POST /api/admin/purchase-orders/:poId/grn/:grnId/approve
     │
     ▼
[Validate GRN exists, status='draft']
     │
     ▼
[withTransaction(connection, async(session))]
  │
  ├── For each GRN item:
  │     │
  │     ├── stockService.updateStock(models, {
  │     │     product: item.product,
  │     │     warehouse: grn.warehouse,
  │     │     qty: item.receivedQty,
  │     │     type: 'purchase',
  │     │     ref: 'GRN', refId: grn._id, refNum: grn.grnNumber
  │     │   })
  │     │     │
  │     │     ├── ProductStock.quantity += receivedQty
  │     │     └── StockMovement created (type: 'purchase')
  │     │
  │     └── PO item: receivedQty += GRN item receivedQty
  │
  ├── Update PO status:
  │     all items fully received? → 'received'
  │     some items received? → 'partial'
  │
  ├── ledgerService.createSupplierLedgerEntry(models, {
  │     supplierId, transactionType: 'purchase',
  │     debit: grn.totalValue
  │   })
  │     │
  │     ├── SupplierLedger entry created (debit)
  │     └── Supplier.currentBalance updated
  │
  └── GRN.status = 'approved', GRN.approvedBy, GRN.approvedAt
     │
     ▼
[Return updated GRN]
```

### 5.5 Stock Transfer — Complete Flow

```
[Step 1: Create Transfer]
POST /api/admin/stock/transfers
  → StockTransfer.create(status='draft', items=[{product, requestedQty}])
  → Returns transferNumber: TRF-00001
     │
     ▼
[Step 2: Complete Transfer]
PATCH /api/admin/stock/transfers/:id/complete
     │
     ▼
[withTransaction(connection, async(session))]
  │
  ├── For each item:
  │     │
  │     ├── stockService.updateStock(models, {
  │     │     product, warehouse: fromWarehouse,
  │     │     qty: -requestedQty, type: 'transfer_out'
  │     │   })
  │     │     → ProductStock(from).quantity -= requestedQty
  │     │     → StockMovement (transfer_out, toWarehouse ref)
  │     │
  │     └── stockService.updateStock(models, {
  │           product, warehouse: toWarehouse,
  │           qty: +requestedQty, type: 'transfer_in'
  │         })
  │           → ProductStock(to).quantity += requestedQty
  │           → StockMovement (transfer_in, fromWarehouse ref)
  │
  └── Update transfer: status='completed', completedBy, completedAt
```

### 5.6 Customer Top-up — Ledger Flow

```
POST /api/admin/customers/:id/topup  { amount: 5000, method: 'cash' }
     │
     ▼
[Generate topup number: counterService → TOP-00001]
     │
     ▼
[Create CustomerTopup record]
  { topupNumber, customerId, amount: 5000, type: 'topup',
    balanceBefore: customer.currentBalance, balanceAfter: ... }
     │
     ▼
[ledgerService.createCustomerLedgerEntry(models, {
    customerId,
    transactionType: 'topup',
    credit: 5000,
    narration: 'Balance topup via cash'
  })]
     │
     ├── Find last CustomerLedger entry → lastBalance (e.g., -2000)
     ├── newBalance = -2000 + 0(debit) - 5000(credit) = -7000
     │   Wait — credit REDUCES balance (customer owes less):
     │   newBalance = lastBalance + debit - credit
     │   = -2000 + 0 - 5000 → -7000? No:
     │   Convention: positive balance = customer owes money
     │   credit (topup) reduces what they owe:
     │   newBalance = lastBalance - credit = -2000 - 5000 → depends on sign convention
     │
     ├── Create CustomerLedger entry: { credit: 5000, balanceAfter: newBalance }
     └── Update Customer.currentBalance = newBalance
     │
     ▼
[Return topup record + updated balance]
```

### 5.7 Price Resolution — 4-Tier Cascade

```
priceResolver.resolvePrice(models, { productId, warehouseId, customerId, qty })
     │
     ▼
┌────────────────────────────────────────────────────────────────┐
│ Tier 1: CUSTOMER TIER PRICE                                    │
│   Find customer → get tier (e.g., 'wholesale')                 │
│   CustomerTierPrice.findOne({ product, tier, minQty ≤ qty })   │
│   Sorted by minQty desc (highest applicable qty bracket)       │
│   Found? → return { price: tierPrice.price, source: 'tier' }   │
└──────────────────────┬─────────────────────────────────────────┘
                       │ not found
                       ▼
┌────────────────────────────────────────────────────────────────┐
│ Tier 2: WAREHOUSE PRICE                                        │
│   ProductStock.findOne({ product, warehouse })                 │
│   Has warehousePrice? → return { price, source: 'warehouse' }  │
└──────────────────────┬─────────────────────────────────────────┘
                       │ not found
                       ▼
┌────────────────────────────────────────────────────────────────┐
│ Tier 3: PRODUCT BASE PRICE                                     │
│   Product.findById(productId)                                  │
│   product.basePrice > 0? → return { price, source: 'product' } │
└──────────────────────┬─────────────────────────────────────────┘
                       │ product is variant with basePrice=0
                       ▼
┌────────────────────────────────────────────────────────────────┐
│ Tier 4: PARENT PRODUCT PRICE                                   │
│   Product.findById(product.parentProduct)                      │
│   return { price: parent.basePrice, source: 'parent' }         │
└────────────────────────────────────────────────────────────────┘
```

### 5.8 Store Customer Registration & Order Flow

```
[Customer visits /store/demo-store]
     │
     ▼
[GET /api/store/demo-store/settings]
  → resolveOrg('demo-store') → find Org → getOrgConnection → req.models
  → catalog.getSettings → EcomSettings.findOne()
     │
     ▼
[Customer registers]
POST /api/store/demo-store/auth/register
  { name, email, phone, password }
     │
  → resolveOrg → req.models
  → Check email not taken
  → Hash password
  → Customer.create()
  → Sign JWT({ customerId, orgId, orgDb, role:'customer' })
  → Return token
     │
     ▼
[Customer places order]
POST /api/store/demo-store/portal/orders
  { items: [{productId, quantity}], shippingAddress }
     │
  → customerAuth → verify JWT → req.customer, req.models
  → Same order creation logic as admin:
    → Generate ORD + INV numbers
    → Process items with price resolution
    → withTransaction: create Order, reserve stock, debit ledger
  → Return order
     │
     ▼
[Customer cancels order]
POST /api/store/demo-store/portal/orders/:id/cancel
     │
  → Verify order belongs to this customer
  → Verify status ∈ [placed, confirmed, processing]
  → Release reserved stock for each item
  → Create credit_note ledger entry
  → Update order status = 'cancelled'
```

---

## 6. Complete File Connection Map

```
server.js
  ├── config/config.js (configuration values)
  ├── config/database.js (MongoDB connections)
  │     ├── models/superadmin/index.js (SuperAdmin + Organization schemas)
  │     └── models/org/index.js (registers all 30 org models)
  │           ├── models/org/User.js
  │           ├── models/org/Category.js
  │           ├── models/org/Product.js
  │           ├── models/org/ProductStock.js
  │           ├── models/org/StockMovement.js (IMMUTABLE)
  │           ├── models/org/StockTransfer.js
  │           ├── models/org/StockAdjustment.js
  │           ├── models/org/Customer.js
  │           ├── models/org/CustomerLedger.js (IMMUTABLE)
  │           ├── models/org/CustomerTierPrice.js
  │           ├── models/org/CustomerTopup.js
  │           ├── models/org/Order.js
  │           ├── models/org/OrderPayment.js
  │           ├── models/org/OrderReturn.js
  │           ├── models/org/Supplier.js
  │           ├── models/org/SupplierLedger.js (IMMUTABLE)
  │           ├── models/org/SupplierPayment.js
  │           ├── models/org/SupplierAdjustment.js
  │           ├── models/org/PurchaseOrder.js
  │           ├── models/org/GRN.js
  │           ├── models/org/PurchaseReturn.js
  │           ├── models/org/Warehouse.js
  │           ├── models/org/Unit.js
  │           ├── models/org/TaxSlab.js
  │           ├── models/org/BarcodeType.js
  │           ├── models/org/Coupon.js
  │           ├── models/org/Notification.js
  │           ├── models/org/Counter.js
  │           └── models/org/EcomSettings.js
  │
  ├── middleware/auth.js (JWT verification, org connection, model attachment)
  │     └── uses: config.js, database.js, models
  ├── middleware/rbac.js (role checking)
  ├── middleware/validate.js (express-validator result checking)
  ├── middleware/errorHandler.js (global error handler)
  │
  ├── routes/index.js
  │     ├── routes/superadmin.routes.js
  │     │     └── controllers/superadmin.controller.js
  │     │           └── uses: database.js, models/superadmin
  │     │
  │     ├── routes/admin/index.js
  │     │     ├── routes/admin/auth.routes.js
  │     │     │     └── controllers/admin/auth.controller.js
  │     │     ├── routes/admin/users.routes.js
  │     │     │     └── controllers/admin/users.controller.js
  │     │     ├── routes/admin/categories.routes.js
  │     │     │     └── controllers/admin/categories.controller.js
  │     │     │           └── uses: helpers.js (generateSlug)
  │     │     ├── routes/admin/products.routes.js
  │     │     │     └── controllers/admin/products.controller.js
  │     │     │           └── uses: helpers.js (generateSlug, paginate)
  │     │     ├── routes/admin/stock.routes.js
  │     │     │     └── controllers/admin/stock.controller.js
  │     │     │           └── uses: stockService, counterService, transaction.js
  │     │     ├── routes/admin/customers.routes.js
  │     │     │     └── controllers/admin/customers.controller.js
  │     │     │           └── uses: ledgerService, counterService
  │     │     ├── routes/admin/orders.routes.js
  │     │     │     └── controllers/admin/orders.controller.js
  │     │     │           └── uses: stockService, ledgerService, priceResolver, counterService, transaction.js
  │     │     ├── routes/admin/suppliers.routes.js
  │     │     │     └── controllers/admin/suppliers.controller.js
  │     │     │           └── uses: ledgerService, counterService
  │     │     ├── routes/admin/purchaseOrders.routes.js
  │     │     │     └── controllers/admin/purchaseOrders.controller.js
  │     │     │           └── uses: stockService, ledgerService, counterService, transaction.js
  │     │     ├── routes/admin/coupons.routes.js
  │     │     │     └── controllers/admin/coupons.controller.js
  │     │     ├── routes/admin/pricing.routes.js
  │     │     │     └── controllers/admin/pricing.controller.js
  │     │     │           └── uses: priceResolver
  │     │     ├── routes/admin/reports.routes.js
  │     │     │     └── controllers/admin/reports.controller.js
  │     │     ├── routes/admin/notifications.routes.js
  │     │     │     └── controllers/admin/notifications.controller.js
  │     │     ├── routes/admin/ecomSettings.routes.js
  │     │     │     └── controllers/admin/ecomSettings.controller.js
  │     │     ├── routes/admin/upload.routes.js
  │     │     │     └── controllers/admin/upload.controller.js (uses multer)
  │     │     └── (units, barcodeTypes, taxSlabs, warehouses routes → simple CRUD controllers)
  │     │
  │     └── routes/store/index.js
  │           ├── controllers/store/catalog.controller.js (public, uses resolveOrg)
  │           ├── controllers/store/customerAuth.controller.js (uses resolveOrg)
  │           └── controllers/store/portal.controller.js (uses customerAuth)
  │                 └── uses: stockService, ledgerService, priceResolver, counterService, transaction.js
  │
  ├── services/
  │     ├── counterService.js (auto-incrementing numbers, uses Counter model)
  │     ├── ledgerService.js (immutable ledger entries, uses CustomerLedger/SupplierLedger)
  │     ├── priceResolver.js (4-tier price cascade, uses CustomerTierPrice/ProductStock/Product)
  │     └── stockService.js (stock mutations + audit trail, uses ProductStock/StockMovement)
  │
  ├── utils/
  │     ├── ApiError.js (custom error class)
  │     ├── ApiResponse.js (standard response wrapper)
  │     ├── asyncHandler.js (async error catcher)
  │     ├── helpers.js (slug, pagination)
  │     └── transaction.js (MongoDB transaction wrapper)
  │
  ├── plugins/
  │     └── softDelete.js (Mongoose plugin, used by 18 models)
  │
  └── seeder.js (demo data generation, uses all models and services)
```

---

## 7. Data Flow Summary — How Data Moves Through the System

### Write Operations

```
CLIENT REQUEST
     │
     ▼
[Route] → [Auth MW] → [RBAC MW] → [Validate MW] → [Controller]
                                                        │
                                                        ▼
                                                   [Service Layer]
                                                   (stockService, ledgerService,
                                                    counterService, priceResolver)
                                                        │
                                                        ▼
                                                   [Model Layer]
                                                   (Mongoose operations on org DB)
                                                        │
                                                        ▼
                                                   [MongoDB]
                                                   (org-specific database)
                                                        │
                                                        ▼
                                                   [ApiResponse]
                                                        │
                                                        ▼
                                                   CLIENT RESPONSE
```

### Read Operations

```
CLIENT REQUEST
     │
     ▼
[Route] → [Auth MW / resolveOrg] → [Controller]
                                        │
                                        ▼
                                   [Model.find/findById/aggregate]
                                   (with .populate() for refs)
                                        │
                                        ▼
                                   [paginate() + paginationMeta()]
                                        │
                                        ▼
                                   [ApiResponse]
                                        │
                                        ▼
                                   CLIENT RESPONSE
```

### Transaction-Protected Operations

These operations use `withTransaction()` for atomicity:
1. **Order creation** — create order + reserve stock + debit ledger + increment coupon
2. **Stock adjustment** — adjust stock + create adjustment record
3. **Stock transfer completion** — transfer_out from source + transfer_in to dest
4. **GRN approval** — update stock + update PO + debit supplier ledger
5. **Order cancellation** — release stock + credit_note ledger
6. **Portal order placement** — same as admin order creation
7. **Portal order cancellation** — same as admin order cancellation

---

## 8. Authentication & Authorization Matrix

### Token Types

| Token Type | Payload | Storage | Used For |
|---|---|---|---|
| SuperAdmin JWT | `{ adminId, role: 'superadmin' }` | localStorage: `superadminToken` | Platform management |
| Admin/Org JWT | `{ userId, orgId, orgDb, role }` | localStorage: `adminToken` | Org admin panel |
| Customer JWT | `{ customerId, orgId, orgDb, role: 'customer' }` | localStorage: `customerToken` | Store portal |

### RBAC Permission Matrix

| Endpoint Group | admin | manager | cashier | warehouse_staff | accountant |
|---|---|---|---|---|---|
| Users CRUD | ✅ | ❌ | ❌ | ❌ | ❌ |
| Categories CRUD | ✅ | ✅ | ❌ | ❌ | ❌ |
| Products CRUD | ✅ | ✅ | ❌ | ❌ | ❌ |
| Stock Management | ✅ | ✅ | ❌ | ✅ | ❌ |
| Orders (create) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Orders (status/payment/return) | ✅ | ✅ | ❌ | ❌ | ❌ |
| POS | ✅ | ✅ | ✅ | ❌ | ❌ |
| Customers CRUD | ✅ | ✅ | ✅ | ❌ | ❌ |
| Customers (financial) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Suppliers | ✅ | ✅ | ❌ | ❌ | ❌ |
| Purchase Orders | ✅ | ✅ | ❌ | ✅ | ❌ |
| Coupons | ✅ | ✅ | ❌ | ❌ | ❌ |
| Pricing | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reports | ✅ | ✅ | ❌ | ❌ | ✅ |
| Notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| Upload | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 9. Immutability & Audit Patterns

| Pattern | Models | Enforcement |
|---|---|---|
| **Immutable ledger** | CustomerLedger, SupplierLedger | Mongoose pre-hook on `findOneAndUpdate` throws error |
| **Immutable movements** | StockMovement | Same pre-hook — once created, never modified |
| **Soft delete** | 18 models | Mongoose plugin: `deletedAt` field, auto-filtered from queries |
| **Edit history** | Order | `editHistory[]` array captures before/after snapshots |
| **Status history** | Order | `statusHistory[]` captures every transition |
| **Product snapshots** | Order.items | `productSnapshot` freezes product data at order time |
| **Tax snapshots** | Order.items | `taxSlab: { name, rate }` frozen at order time |

---

*End of Backend Design Schema*
