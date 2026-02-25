# Frontend Design Schema — Multi-Tenant E-Commerce Platform

> Complete file-by-file architecture, sequential flows, data flows, and component relationships.

---

## 1. Technology Stack

| Tech | Version | Purpose |
|---|---|---|
| React | 19.1 | UI library (SPA) |
| React Router DOM | 7.6 | Client-side routing |
| Vite | 6.3 | Build tool & dev server |
| Axios | 1.9 | HTTP client (API calls) |
| Tailwind CSS | 3.4 | Utility-first CSS framework |
| Lucide-React | 0.513 | Icon library |
| Recharts | 2.15 | Charts for reports |
| date-fns | 4.1 | Date formatting |

---

## 2. High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                              │
│                                                                      │
│  index.html  ──►  main.jsx  ──►  App.jsx (Routes)                   │
│                       │                  │                           │
│             ┌─────────┤         ┌────────┴─────────┐                 │
│             ▼         ▼         ▼        ▼         ▼                 │
│       ToastProvider  AuthProvider                                     │
│             │         │         │        │         │                 │
│             ▼         ▼         ▼        ▼         ▼                 │
│    /superadmin/*   /admin/*   /store/:orgSlug/*                      │
│         │              │              │                              │
│    SuperAdmin     AdminLayout     StoreLayout                        │
│    Layout         (TabProvider)                                      │
│                   ┌────┴────┐                                        │
│                Sidebar   TabBar                                      │
│                   │         │                                        │
│              (Nav items) (Active page tabs)                          │
│                             │                                        │
│                        Page Components                               │
│                        (19 admin pages)                              │
│                             │                                        │
│                        UI Components                                 │
│                        (ui/index.jsx)                                │
│                             │                                        │
│                         api.js ──── HTTP ──── Backend :5000          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. File-by-File Purpose and Details

### 3.1 Configuration & Build Files

#### `index.html`
- **Purpose:** Single HTML entry point for the SPA
- **Key:** Loads Inter font from Google Fonts, mounts React at `<div id="root">`
- **Connects to:** `src/main.jsx` via `<script type="module">`

#### `package.json`
- **Purpose:** NPM dependencies and scripts
- **Scripts:** `dev` (vite dev server :3000), `build` (production), `preview`
- **Key deps:** react 19, react-router-dom 7, axios, lucide-react, recharts, date-fns, tailwindcss

#### `vite.config.js`
- **Purpose:** Vite build configuration
- **Key config:** Dev server on port 3000, proxy `/api` → `http://localhost:5000` (backend)
- **Connects to:** All `.jsx` files (builds them), `index.html`

#### `tailwind.config.js`
- **Purpose:** Tailwind CSS customization
- **Content scan:** `index.html`, `src/**/*.{js,jsx}`
- **Custom:** Glass colors (rgba-based), custom animations (glass-shine, fade-in, slide-up, slide-right)

#### `postcss.config.js`
- **Purpose:** PostCSS pipeline
- **Plugins:** tailwindcss, autoprefixer
- **Connects to:** `tailwind.config.js` → `index.css`

#### `src/index.css`
- **Purpose:** Global styles + Tailwind directives
- **Key classes:** `.glass`, `.glass-card`, `.glass-input`, `.glass-sidebar`, `.glass-tab`, `.glass-btn-primary`, `.skeleton-shimmer`
- **Theme:** Clean white glassmorphism with violet (#7c3aed) accent, custom scrollbar

---

### 3.2 Core Entry Files

#### `src/main.jsx`
- **Purpose:** React application bootstrap — the very first JS that runs
- **Flow:**
  ```
  main.jsx
    └─► ReactDOM.createRoot('#root').render(
          <BrowserRouter>         ← React Router context
            <ToastProvider>       ← Global toast notifications
              <AuthProvider>      ← Auth state (user, role, tokens)
                <App />           ← Route definitions
              </AuthProvider>
            </ToastProvider>
          </BrowserRouter>
        )
  ```
- **Connects to:** `App.jsx`, `AuthContext.jsx`, `ToastContext.jsx`, `index.css`

#### `src/App.jsx`
- **Purpose:** Top-level route definitions and auth-based route protection
- **Route map:**
  ```
  /superadmin/login        → SuperAdminLogin page
  /admin/login             → AdminLogin page
  /store/:orgSlug/auth     → CustomerAuth page
  /superadmin/*            → SuperAdminLayout (protected: superadmin)
  /admin/*                 → AdminLayout (protected: admin)
  /store/:orgSlug/*        → StoreLayout (public + portal)
  /                        → redirect to /admin/login
  ```
- **ProtectedRoute component:** Checks `isAuthenticated` + `role` from AuthContext. Redirects to login if unauthorized.
- **Connects to:** All layouts, all auth pages, `AuthContext.jsx`

---

### 3.3 API Layer

#### `src/api.js`
- **Purpose:** Centralized HTTP client — ALL backend communication goes through this file
- **Base URL:** `VITE_API_URL` or `http://localhost:5000/api`
- **Interceptors:**
  - **Request:** Auto-attaches Bearer token from localStorage (checks superadminToken → adminToken → customerToken)
  - **Response:** Unwraps `res.data` automatically; on 401, clears all tokens
- **API modules exported:**

| API Object | Backend Prefix | Methods |
|---|---|---|
| `superadminAPI` | `/superadmin/` | login, listOrgs, createOrg, getOrg, updateOrg, deleteOrg, createOrgAdmin, listOrgAdmins |
| `authAPI` | `/admin/auth/` | login, me, changePassword |
| `usersAPI` | `/admin/users` | list, create, get, update, delete, toggleActive |
| `categoriesAPI` | `/admin/categories` | list, create, get, update, delete, reorder |
| `unitsAPI` | `/admin/units` | list, create, get, update, delete |
| `barcodeTypesAPI` | `/admin/barcode-types` | list, create, get, update, delete |
| `taxSlabsAPI` | `/admin/tax-slabs` | list, create, get, update, delete |
| `warehousesAPI` | `/admin/warehouses` | list, create, get, update, delete, getStock, getMovements |
| `productsAPI` | `/admin/products` | list, create, get, update, delete, stockSummary, addVariant, updateVariant, deleteVariant, addImages, removeImage, getStock, getMovements |
| `stockAPI` | `/admin/stock` | list, lowStock, movements, productMovements, setOpening, createAdjustment, listAdjustments, getAdjustment, createTransfer, listTransfers, getTransfer, completeTransfer, cancelTransfer |
| `customersAPI` | `/admin/customers` | list, create, get, update, delete, getLedger, getBalance, topup, adjust, getStatement, getOrders, getPayments, getTopups |
| `ordersAPI` | `/admin/orders` | list, create, get, update, delete, updateStatus, recordPayment, listPayments, getInvoice, getHistory, initiateReturn, listReturns, posOrder |
| `suppliersAPI` | `/admin/suppliers` | list, create, get, update, delete, getLedger, getBalance, recordPayment, adjust, getPurchaseOrders, getStatement |
| `purchaseOrdersAPI` | `/admin/purchase-orders` | list, create, get, update, delete, updateStatus, createGRN, listGRN, getGRN, approveGRN, rejectGRN, createReturn, listReturns |
| `couponsAPI` | `/admin/coupons` | list, create, get, update, delete, validate |
| `pricingAPI` | `/admin/pricing` | listTierPrices, createTierPrice, updateTierPrice, deleteTierPrice, resolve |
| `reportsAPI` | `/admin/reports` | dashboard, sales, stock, customerAging, supplierAging, profitLoss |
| `notificationsAPI` | `/admin/notifications` | list, markRead, markAllRead, delete |
| `ecomSettingsAPI` | `/admin/ecom-settings` | get, update |
| `uploadAPI` | `/admin/upload` | upload (single), uploadMultiple |
| `storeAPI` | `/store/:slug/` | settings, categories, products, featured, search, productBySlug, productById |
| `customerAuthAPI` | `/store/:slug/auth/` | register, login |
| `portalAPI` | `/store/:slug/portal/` | getProfile, updateProfile, listOrders, getOrder, placeOrder, cancelOrder, getLedger, getBalance, getPayments |

- **Connection pattern:**
  ```
  Page Component → api.js function → axios.get/post/put/patch/delete → Backend API
                                                                            ↓
  Page Component ← state update ← response.data ← Backend JSON response
  ```

---

### 3.4 Context Providers (Global State)

#### `src/context/AuthContext.jsx`
- **Purpose:** Global authentication state management
- **State:** `user`, `role` ('superadmin' | 'admin' | 'customer'), `loading`
- **Token strategy:** 3 separate localStorage keys:
  - `superadminToken` — SuperAdmin JWT
  - `adminToken` — Admin/org user JWT
  - `customerToken` — Customer portal JWT
- **Methods exposed:**
  - `superadminLogin(email, pw)` → calls `superadminAPI.login`, stores token
  - `adminLogin(email, pw, orgSlug)` → calls `authAPI.login`, stores token + fetches `/me`
  - `customerLogin(slug, email, pw)` → calls `customerAuthAPI.login`, stores token
  - `customerRegister(slug, data)` → calls `customerAuthAPI.register`, stores token
  - `logout()` → clears all tokens and state
- **Session restore:** On mount, checks localStorage for existing tokens, validates via `/me` for admin
- **Used by:** All pages via `useAuth()` hook

#### `src/context/TabContext.jsx`
- **Purpose:** Browser-tab-like navigation within the admin panel
- **State:** `tabs[]` (open tabs), `activeTabId`, `flashTabId`
- **Features:**
  - `openTab({ id, label, icon, component })` — adds or switches to tab, flashes if already open
  - `closeTab(tabId)` — removes tab, activates adjacent
  - `closeAllTabs()` — close everything
  - **Persistence:** Saves tab IDs to `sessionStorage` → survives page refresh
  - **Registry:** `tabRegistry` Map populated by Sidebar — maps tab IDs to components
- **Used by:** `AdminLayout`, `Sidebar`, `TabBar`

#### `src/context/ToastContext.jsx`
- **Purpose:** Global toast notification system
- **State:** `toasts[]` with auto-dismiss timers
- **Methods:** `toast.success(msg)`, `toast.error(msg)`, `toast.warning(msg)`, `toast.info(msg)`
- **UI:** Fixed top-right position, glassmorphism styled, colored by type
- **Used by:** All pages via `useToast()` hook

---

### 3.5 Layout Components

#### `src/layouts/AdminLayout.jsx`
- **Purpose:** Main shell for the admin panel — sidebar + tab bar + active page content
- **Structure:**
  ```
  ┌──────────────────────────────────────────────┐
  │  TabProvider                                  │
  │  ┌──────────┬───────────────────────────────┐ │
  │  │          │  TabBar (horizontal tabs)      │ │
  │  │ Sidebar  ├───────────────────────────────┤ │
  │  │ (left)   │                               │ │
  │  │          │  Active Tab Content            │ │
  │  │          │  (rendered page component)     │ │
  │  │          │                               │ │
  │  └──────────┴───────────────────────────────┘ │
  └──────────────────────────────────────────────┘
  ```
- **Flow:** Sidebar click → `openTab()` → TabBar shows tab → component renders in content area
- **Connects to:** `TabProvider`, `Sidebar`, `TabBar`, all 19 admin page components

#### `src/layouts/SuperAdminLayout.jsx`
- **Purpose:** Shell for superadmin — simple sidebar + content
- **Pages:** Routes `organizations` → `Organizations.jsx`
- **Features:** Navbar with user info, logout, sidebar with org management link
- **Connects to:** `AuthContext`, `Organizations.jsx`

#### `src/layouts/StoreLayout.jsx`
- **Purpose:** Shell for the public storefront + customer portal
- **Route map:**
  ```
  /store/:orgSlug/          → Home (product catalog)
  /store/:orgSlug/product/* → ProductView
  /store/:orgSlug/portal/*  → Portal (customer dashboard)
  ```
- **Features:** Dynamic navbar from `EcomSettings` (storeName, logo, colors), customer login/logout
- **Connects to:** `storeAPI.settings`, `Home.jsx`, `ProductView.jsx`, `Portal.jsx`, `AuthContext`

---

### 3.6 Shared Components

#### `src/components/Sidebar.jsx`
- **Purpose:** Left navigation panel for admin layout
- **Behavior:** Defines all nav items (19 sections), each with `id`, `label`, `icon`, `component`
- **Tab registration:** On mount, calls `registerTab()` for each nav item → fills `tabRegistry`
- **Click handler:** Calls `openTab()` from TabContext to open the page in a tab
- **Nav sections:**
  ```
  Dashboard, Products, Stock Management, Categories, Units,
  Barcode Types, Tax Slabs, Warehouses, Orders, POS, Customers,
  Suppliers, Purchase Orders, Coupons, Pricing, Reports,
  Notifications, Users, E-com Settings
  ```
- **Visual:** Active item highlighted with violet accent, icons from lucide-react

#### `src/components/TabBar.jsx`
- **Purpose:** Horizontal tab strip (like browser tabs) showing open pages
- **Features:**
  - Shows all open tabs from TabContext
  - Click tab → switch active page
  - X button → close tab
  - Flash animation when clicking already-open tab
  - "Close all" button
- **Connects to:** `TabContext` (`tabs`, `activeTabId`, `closeTab`, `setActiveTabId`)

#### `src/components/ui/index.jsx`
- **Purpose:** Reusable UI primitive library — ALL shared components in one file
- **Exports (18 components):**

| Component | Purpose |
|---|---|
| `GlassCard` | White card with border, optional hover effect |
| `Button` | Primary/secondary/danger/ghost variants, loading spinner |
| `Input` | Text input with label and error display |
| `Textarea` | Multi-line input with label and error |
| `Select` | Dropdown select with label, options, error |
| `Badge` | Colored pill badge (cyan, emerald, amber, red, violet, slate) |
| `Modal` | Overlay dialog with backdrop, title bar, close button, sizes sm/md/lg/xl/full |
| `ConfirmDialog` | Confirm/cancel dialog for destructive actions |
| `Loader` | Animated loading spinner (two rings + dot) |
| `SearchInput` | Search box with magnifier icon |
| `Pagination` | Page navigation with prev/next, page numbers |
| `EmptyState` | "No data" placeholder with icon |
| `StatCard` | Dashboard metric card with icon, value, trend |
| `PageHeader` | Page title + subtitle + action buttons |
| `DataTable` | Full data table with sortable columns, loading skeleton, row click |
| `TabList` | Horizontal tabs (within a page, not browser tabs) |
| `SearchableSelect` | Dropdown with search/filter, custom display |
| `CsvImport` | CSV file import with column mapping, preview, sample download |

---

### 3.7 Auth Pages

#### `src/pages/auth/SuperAdminLogin.jsx`
- **Purpose:** Login form for platform super admin
- **Flow:** Email + Password → `superadminLogin()` → success → navigate `/superadmin/organizations`
- **Connects to:** `AuthContext.superadminLogin`

#### `src/pages/auth/AdminLogin.jsx`
- **Purpose:** Login form for org admin/manager/cashier/etc
- **Flow:** Email + Password + Org Slug → `adminLogin()` → success → navigate `/admin`
- **Connects to:** `AuthContext.adminLogin`

#### `src/pages/auth/CustomerAuth.jsx`
- **Purpose:** Combined login/register page for store customers
- **Flow:**
  - Login tab: email + password → `customerLogin(orgSlug, ...)` → navigate to store portal
  - Register tab: name + email + phone + password → `customerRegister(orgSlug, ...)` → navigate to store portal
- **Connects to:** `AuthContext.customerLogin`, `AuthContext.customerRegister`

---

### 3.8 SuperAdmin Pages

#### `src/pages/superadmin/Organizations.jsx`
- **Purpose:** Manage organizations (tenants) on the platform
- **Features:** List orgs, create org (name + plan), edit, delete, create admin user per org
- **Data flow:**
  ```
  Organizations.jsx
    ├── load: superadminAPI.listOrgs() → orgs[]
    ├── create: superadminAPI.createOrg({name,plan})
    ├── edit: superadminAPI.updateOrg(id, data)
    ├── delete: superadminAPI.deleteOrg(id)
    ├── create admin: superadminAPI.createOrgAdmin(orgId, {name,email,password,role})
    └── list admins: superadminAPI.listOrgAdmins(orgId)
  ```
- **Connects to:** `superadminAPI`

---

### 3.9 Admin Pages (19 pages — each opened as a tab)

#### `Dashboard.jsx`
- **Purpose:** Overview dashboard with KPI cards, top products, recent orders
- **Data:** `reportsAPI.dashboard()` → totalOrders, totalRevenue, totalCustomers, totalProducts, topProducts[], recentOrders[]
- **UI:** 4 StatCards + 2 DataTables
- **Connects to:** `reportsAPI`

#### `Users.jsx`
- **Purpose:** CRUD for org users (admin, manager, cashier, warehouse_staff, accountant)
- **Data flow:** `usersAPI.list()` → DataTable → create/edit Modal → `usersAPI.create/update/delete/toggleActive`
- **Connects to:** `usersAPI`

#### `Categories.jsx`
- **Purpose:** Hierarchical category management
- **Features:** Tree display, create/edit with parent selection, reorder, CSV import
- **Data flow:** `categoriesAPI.list()` → tree view → `categoriesAPI.create/update/delete/reorder`
- **Connects to:** `categoriesAPI`

#### `Units.jsx`
- **Purpose:** Units of measurement CRUD (kg, pcs, box, etc.)
- **Data flow:** `unitsAPI.list()` → DataTable → `unitsAPI.create/update/delete`
- **Connects to:** `unitsAPI`

#### `BarcodeTypes.jsx`
- **Purpose:** Barcode format CRUD (EAN-13, QR Code, CODE-128, UPC-A)
- **Data flow:** `barcodeTypesAPI.list()` → DataTable → `barcodeTypesAPI.create/update/delete`
- **Connects to:** `barcodeTypesAPI`

#### `TaxSlabs.jsx`
- **Purpose:** Tax rate management (GST 5%, 12%, 18%, 28%, Exempt)
- **Data flow:** `taxSlabsAPI.list()` → DataTable → `taxSlabsAPI.create/update/delete`
- **Connects to:** `taxSlabsAPI`

#### `Warehouses.jsx`
- **Purpose:** Warehouse CRUD + view stock by warehouse + view movements
- **Features:** Create/edit warehouse, view stock levels per product, view stock movement history
- **Data flow:**
  ```
  warehousesAPI.list() → DataTable
  warehousesAPI.getStock(id) → stock detail modal
  warehousesAPI.getMovements(id) → movements history
  ```
- **Connects to:** `warehousesAPI`

#### `Products.jsx`
- **Purpose:** Complete product management — the most complex admin page
- **Features:**
  - List all products (filterable by type, category, search)
  - Create/edit single, parent, or variant products
  - Manage variants under parent products
  - Image management (add/remove/reorder)
  - View stock per warehouse
  - View stock movement history
  - CSV import
- **Data flow:**
  ```
  productsAPI.list()       → product table
  productsAPI.create()     → new product
  productsAPI.update()     → edit product
  productsAPI.delete()     → soft delete
  productsAPI.addVariant() → add variant to parent
  productsAPI.addImages()  → add images
  productsAPI.getStock()   → stock per warehouse
  productsAPI.getMovements() → movement history
  categoriesAPI.list()     → category dropdown
  unitsAPI.list()          → unit dropdown
  barcodeTypesAPI.list()   → barcode type dropdown
  taxSlabsAPI.list()       → tax slab dropdown
  ```
- **Connects to:** `productsAPI`, `categoriesAPI`, `unitsAPI`, `barcodeTypesAPI`, `taxSlabsAPI`

#### `StockManagement.jsx`
- **Purpose:** Multi-tab stock management hub
- **Internal tabs:** Overview | Low Stock | Adjustments | Transfers | Movements
- **Features:**
  - Overview: all stock levels across warehouses
  - Low stock alerts (below threshold)
  - Create stock adjustments (increase/decrease with reason)
  - Create stock transfers between warehouses, complete/cancel
  - Full movement history with filters
  - Set opening stock
- **Data flow:**
  ```
  stockAPI.list()            → overview
  stockAPI.lowStock()        → low stock alerts
  stockAPI.createAdjustment() → adjust stock
  stockAPI.createTransfer()  → transfer between warehouses
  stockAPI.completeTransfer() → complete transfer
  stockAPI.movements()       → movement history
  stockAPI.setOpening()      → opening stock
  warehousesAPI.list()       → warehouse dropdowns
  productsAPI.list()         → product dropdowns
  ```
- **Connects to:** `stockAPI`, `warehousesAPI`, `productsAPI`

#### `Customers.jsx`
- **Purpose:** Full customer management with 8-tab detail view
- **Features:**
  - List/search/create/edit/delete customers
  - Detail modal tabs: Info | Ledger | Balance | Orders | Payments | Top-ups | Statement | Documents
  - Balance top-up and adjustment operations
  - View customer's orders, payments, ledger history
  - View/download statement
- **Data flow:**
  ```
  customersAPI.list()        → customer table
  customersAPI.create()      → new customer
  customersAPI.getLedger(id)  → ledger entries
  customersAPI.getBalance(id) → balance summary
  customersAPI.topup(id)     → balance top-up
  customersAPI.adjust(id)    → balance adjustment
  customersAPI.getOrders(id) → customer orders
  customersAPI.getPayments(id) → payment history
  customersAPI.getTopups(id) → top-up history
  customersAPI.getStatement(id) → full statement
  ```
- **Connects to:** `customersAPI`

#### `Orders.jsx`
- **Purpose:** Full order lifecycle management — most business-critical page
- **Features:**
  - List all orders with status filter
  - Create new order (select customer, warehouse, products, quantities, discounts, coupon)
  - Edit order (before shipment only)
  - Status progression: placed → processing → shipped → in_transit → delivered
  - Record payments (cash, card, bank_transfer, credit, split)
  - Initiate returns (full/partial)
  - View invoice, edit history
- **Data flow:**
  ```
  ordersAPI.list()           → order table
  ordersAPI.create()         → new order
  ordersAPI.update()         → edit order
  ordersAPI.updateStatus()   → change status
  ordersAPI.recordPayment()  → add payment
  ordersAPI.listPayments()   → payment list
  ordersAPI.initiateReturn() → return flow
  ordersAPI.listReturns()    → return list
  ordersAPI.getInvoice()     → invoice data
  ordersAPI.getHistory()     → edit history
  customersAPI.list()        → customer select
  warehousesAPI.list()       → warehouse select
  productsAPI.list()         → product select
  pricingAPI.resolve()       → resolve price per item
  ```
- **Connects to:** `ordersAPI`, `customersAPI`, `warehousesAPI`, `productsAPI`, `pricingAPI`

#### `POS.jsx`
- **Purpose:** Quick point-of-sale order creation
- **Flow:** Select customer → select warehouse → scan/search products → set quantities → submit
- **Data flow:**
  ```
  ordersAPI.posOrder({customerId, warehouseId, items[], paymentMethod, paymentAmount})
  customersAPI.list()  → customer dropdown
  warehousesAPI.list() → warehouse dropdown
  productsAPI.list()   → product search
  ```
- **Connects to:** `ordersAPI`, `customersAPI`, `warehousesAPI`, `productsAPI`

#### `Suppliers.jsx`
- **Purpose:** Full supplier management with 7-tab detail view
- **Features:**
  - List/create/edit/delete suppliers
  - Detail tabs: Info | Ledger | Balance | Payments | Adjustments | Purchase Orders | Statement
  - Record payments to suppliers
  - Balance adjustments
  - View supplier's purchase orders and statement
- **Data flow:**
  ```
  suppliersAPI.list()          → supplier table
  suppliersAPI.getLedger(id)   → ledger entries
  suppliersAPI.getBalance(id)  → balance summary
  suppliersAPI.recordPayment() → record payment
  suppliersAPI.adjust()        → balance adjustment
  suppliersAPI.getPurchaseOrders() → PO list
  suppliersAPI.getStatement()  → full statement
  ```
- **Connects to:** `suppliersAPI`

#### `PurchaseOrders.jsx`
- **Purpose:** Complete purchase order lifecycle — PO → GRN → Purchase Returns
- **Features:**
  - Create/edit/delete purchase orders
  - Status management: draft → ordered → partial → received → cancelled
  - Create GRN (Goods Received Note) against a PO
  - Approve/reject GRN
  - Create purchase returns
  - List all GRNs and purchase returns
- **Data flow:**
  ```
  purchaseOrdersAPI.list()          → PO table
  purchaseOrdersAPI.create()        → new PO
  purchaseOrdersAPI.updateStatus()  → status change
  purchaseOrdersAPI.createGRN()     → new GRN
  purchaseOrdersAPI.approveGRN()    → approve GRN → triggers stock update
  purchaseOrdersAPI.rejectGRN()     → reject GRN
  purchaseOrdersAPI.createReturn()  → purchase return
  suppliersAPI.list()               → supplier dropdown
  warehousesAPI.list()              → warehouse dropdown
  productsAPI.list()                → product dropdown
  ```
- **Connects to:** `purchaseOrdersAPI`, `suppliersAPI`, `warehousesAPI`, `productsAPI`

#### `Coupons.jsx`
- **Purpose:** Promotional coupon management
- **Features:** CRUD, validate coupon against cart total, CSV import
- **Data flow:** `couponsAPI.list/create/update/delete/validate`
- **Connects to:** `couponsAPI`

#### `Pricing.jsx`
- **Purpose:** Tier pricing management and price resolution tool
- **Features:**
  - List/create/edit/delete tier prices per product
  - Price resolution tool: given product+warehouse+customer+qty, resolve effective price
- **Data flow:**
  ```
  pricingAPI.listTierPrices()  → tier price table
  pricingAPI.createTierPrice() → new tier price
  pricingAPI.resolve()         → test price resolution (4-tier)
  productsAPI.list()           → product dropdown
  ```
- **Connects to:** `pricingAPI`, `productsAPI`

#### `Reports.jsx`
- **Purpose:** Analytics and reporting hub
- **Internal tabs:** Dashboard | Sales | Stock | Customer Aging | Supplier Aging | P&L
- **Data flow:**
  ```
  reportsAPI.dashboard()     → KPI overview
  reportsAPI.sales()         → sales by period (recharts)
  reportsAPI.stock()         → stock levels
  reportsAPI.customerAging() → outstanding customer balances
  reportsAPI.supplierAging() → outstanding supplier balances
  reportsAPI.profitLoss()    → revenue vs cost
  ```
- **Connects to:** `reportsAPI`

#### `Notifications.jsx`
- **Purpose:** View and manage system notifications
- **Features:** List notifications, mark read, mark all read, delete, filter by read/unread
- **Data flow:** `notificationsAPI.list/markRead/markAllRead/delete`
- **Connects to:** `notificationsAPI`

#### `EcomSettings.jsx`
- **Purpose:** Configure storefront appearance and behavior
- **Features:**
  - Branding: store name, tagline, logo (with file upload), favicon
  - Theme: primary/secondary/accent colors, theme variant
  - Banners: manage hero banners (add/edit/delete/reorder)
  - Layout: products per row, products per page, show featured, show categories
  - Marquee & sale alerts
  - Homepage sections configuration
  - Terms & conditions, required documents
  - Footer text, social links
- **Data flow:**
  ```
  ecomSettingsAPI.get()    → load current settings
  ecomSettingsAPI.update() → save all settings
  uploadAPI.upload()       → upload logo/banner images
  ```
- **Connects to:** `ecomSettingsAPI`, `uploadAPI`

---

### 3.10 Store Pages (Public Storefront)

#### `src/pages/store/Home.jsx`
- **Purpose:** Public product catalog / storefront homepage
- **Features:**
  - Dynamic banners (carousel from EcomSettings)
  - Category chip filters
  - Featured products section
  - Product grid with pagination, sort by (newest, price), search
  - Product cards with images, price, compare-at-price, badges
- **Data flow:**
  ```
  storeAPI.settings(slug)  → store branding, banners, sections
  storeAPI.categories(slug) → category list
  storeAPI.products(slug)  → paginated product list
  storeAPI.featured(slug)  → featured products
  storeAPI.search(slug)    → search results
  ```
- **Navigation:** Product click → `/store/:orgSlug/product/:slug`
- **Connects to:** `storeAPI`, `AuthContext` (for login/logout state)

#### `src/pages/store/ProductView.jsx`
- **Purpose:** Single product detail page
- **Features:**
  - Image gallery with zoom/fullscreen
  - Variant selection (e.g., Color, Size)
  - Stock availability indicator
  - Quantity stepper
  - Place order button (for logged-in customers)
  - Share button
  - Related product tags
- **Data flow:**
  ```
  storeAPI.productBySlug(slug, productSlug) → product detail + variants + stock
  portalAPI.placeOrder(slug, orderData)      → place order (if logged in)
  ```
- **Connects to:** `storeAPI`, `portalAPI`, `AuthContext`

#### `src/pages/store/Portal.jsx`
- **Purpose:** Customer self-service dashboard (requires customer login)
- **Features:**
  - Profile view/edit
  - My orders list with status, detail view, cancel (before shipment)
  - Ledger: all financial transactions with running balance
  - Balance summary
  - Payment history
- **Data flow:**
  ```
  portalAPI.getProfile(slug)  → customer profile
  portalAPI.updateProfile()   → edit profile
  portalAPI.listOrders(slug)  → order list
  portalAPI.getOrder(slug,id) → order detail
  portalAPI.cancelOrder()     → cancel order
  portalAPI.getLedger(slug)   → ledger entries
  portalAPI.getBalance(slug)  → current balance
  portalAPI.getPayments(slug) → payment history
  ```
- **Connects to:** `portalAPI`, `AuthContext`

---

## 4. Sequential Flow Diagrams

### 4.1 Application Bootstrap Flow

```
[Browser loads index.html]
         │
         ▼
[Vite loads /src/main.jsx]
         │
         ▼
[React renders provider tree]
  BrowserRouter → ToastProvider → AuthProvider → App
         │
         ▼
[AuthProvider checks localStorage]
  superadminToken? → set role='superadmin'
  adminToken?      → call authAPI.me() → set user + role='admin'
  customerToken?   → set role='customer'
  none?            → loading=false, not authenticated
         │
         ▼
[App.jsx evaluates current URL path]
         │
         ├── /superadmin/* → ProtectedRoute(superadmin) → SuperAdminLayout
         ├── /admin/*      → ProtectedRoute(admin)      → AdminLayout
         ├── /store/:slug/* →                            → StoreLayout
         └── /             → Navigate to /admin/login
```

### 4.2 Admin Login Flow

```
[User at /admin/login]
         │
   [Enters email, password, orgSlug]
         │
         ▼
[AdminLogin.jsx → useAuth().adminLogin(email, pw, orgSlug)]
         │
         ▼
[AuthContext.adminLogin()]
  │
  ├── authAPI.login({email, password, orgSlug})
  │     └── POST /api/admin/auth/login
  │           └── Backend validates → returns JWT token
  │
  ├── localStorage.setItem('adminToken', token)
  │
  ├── authAPI.me()
  │     └── GET /api/admin/auth/me (with token)
  │           └── Backend returns user profile
  │
  └── setUser(profile), setRole('admin')
         │
         ▼
[Navigate to /admin → ProtectedRoute passes → AdminLayout renders]
         │
         ▼
[AdminLayout wraps with TabProvider]
  ├── Sidebar renders (registers all 19 tabs in tabRegistry)
  ├── TabBar renders (shows open tabs)
  └── Default: no tabs open → welcome message
```

### 4.3 Admin Tab Navigation Flow

```
[User clicks "Products" in Sidebar]
         │
         ▼
[Sidebar.onClick → openTab({id:'products', label:'Products', icon:Package, component:Products})]
         │
         ▼
[TabContext.openTab()]
  ├── Check if tab already open → if yes, flash + set active
  └── If new → add to tabs[], set activeTabId='products'
         │
         ▼
[TabBar re-renders → shows "Products" tab]
         │
         ▼
[AdminLayout renders Products component in content area]
         │
         ▼
[Products.jsx mounts → useEffect → productsAPI.list() → renders product table]
```

### 4.4 Order Creation Flow (Admin)

```
[Admin clicks "Create Order" in Orders page]
         │
         ▼
[Modal opens → Select customer, warehouse, products]
         │
  ┌──────┼──────────────────────────┐
  │      ▼                          │
  │  customersAPI.list()   warehousesAPI.list()   productsAPI.list()
  │      │                    │                        │
  │      ▼                    ▼                        ▼
  │  Customer dropdown    Warehouse dropdown      Product search
  └──────┬──────────────────────────┘
         │
[User selects products, sets quantities]
         │
         ▼
[For each item: pricingAPI.resolve({productId, warehouseId, customerId, qty})]
         │
         ▼
[Prices resolved → line totals calculated → grand total shown]
         │
[User clicks "Create Order"]
         │
         ▼
[ordersAPI.create({customerId, warehouseId, items[], discounts, coupon, payment})]
         │
         ▼
[POST /api/admin/orders]
         │                          Backend side: stock reserved, ledger debited
         ▼
[Success → toast.success → refresh order list]
```

### 4.5 Store Product Browsing Flow

```
[Customer visits /store/demo-store]
         │
         ▼
[StoreLayout mounts → storeAPI.settings('demo-store')]
         │
         ▼
[Home.jsx mounts]
  ├── storeAPI.settings()    → banners, sections, theme
  ├── storeAPI.categories()  → category chips
  ├── storeAPI.products()    → product grid (page 1)
  └── storeAPI.featured()    → featured section
         │
         ▼
[User clicks a product card]
         │
         ▼
[Navigate to /store/demo-store/product/iphone-15-pro]
         │
         ▼
[ProductView.jsx mounts → storeAPI.productBySlug('demo-store', 'iphone-15-pro')]
         │
         ▼
[Product detail renders: images, variants, price, stock, description]
         │
[User clicks "Buy Now" (must be logged in)]
         │
         ├── Not logged in → redirect to /store/demo-store/auth
         │
         └── Logged in → portalAPI.placeOrder(slug, {items, warehouseId, shippingAddress})
                │
                ▼
         [Order placed → redirect to portal orders]
```

### 4.6 Customer Portal Flow

```
[Customer logs in at /store/demo-store/auth]
         │
         ▼
[customerAuthAPI.login('demo-store', {email, password})]
  → token stored in localStorage as 'customerToken'
  → role = 'customer'
         │
         ▼
[Navigate to /store/demo-store/portal]
         │
         ▼
[Portal.jsx mounts]
  ├── portalAPI.getProfile() → profile tab
  ├── portalAPI.listOrders() → orders tab
  ├── portalAPI.getLedger()  → ledger tab
  ├── portalAPI.getBalance() → balance summary
  └── portalAPI.getPayments() → payments tab
         │
         ▼
[Customer can:]
  ├── Edit profile → portalAPI.updateProfile()
  ├── View order detail → portalAPI.getOrder()
  ├── Cancel order → portalAPI.cancelOrder()
  ├── View ledger with running balance
  └── View payment history
```

---

## 5. Complete File Dependency Graph

```
main.jsx
  ├── index.css
  ├── App.jsx
  │     ├── pages/auth/SuperAdminLogin.jsx ─── api.js (superadminAPI)
  │     ├── pages/auth/AdminLogin.jsx ──────── api.js (authAPI)
  │     ├── pages/auth/CustomerAuth.jsx ────── api.js (customerAuthAPI)
  │     ├── layouts/SuperAdminLayout.jsx
  │     │     └── pages/superadmin/Organizations.jsx ── api.js (superadminAPI)
  │     ├── layouts/AdminLayout.jsx
  │     │     ├── components/Sidebar.jsx (registers tabs, triggers openTab)
  │     │     ├── components/TabBar.jsx (shows/manages open tabs)
  │     │     └── pages/admin/*.jsx (19 pages, each is a tab component)
  │     │           ├── Dashboard.jsx ────── api.js (reportsAPI)
  │     │           ├── Users.jsx ─────────── api.js (usersAPI)
  │     │           ├── Categories.jsx ────── api.js (categoriesAPI)
  │     │           ├── Units.jsx ─────────── api.js (unitsAPI)
  │     │           ├── BarcodeTypes.jsx ──── api.js (barcodeTypesAPI)
  │     │           ├── TaxSlabs.jsx ──────── api.js (taxSlabsAPI)
  │     │           ├── Warehouses.jsx ────── api.js (warehousesAPI)
  │     │           ├── Products.jsx ──────── api.js (products,categories,units,barcodeTypes,taxSlabs)
  │     │           ├── StockManagement.jsx ── api.js (stock,warehouses,products)
  │     │           ├── Customers.jsx ─────── api.js (customersAPI)
  │     │           ├── Orders.jsx ────────── api.js (orders,customers,warehouses,products,pricing)
  │     │           ├── POS.jsx ───────────── api.js (orders,customers,warehouses,products)
  │     │           ├── Suppliers.jsx ─────── api.js (suppliersAPI)
  │     │           ├── PurchaseOrders.jsx ── api.js (purchaseOrders,suppliers,warehouses,products)
  │     │           ├── Coupons.jsx ───────── api.js (couponsAPI)
  │     │           ├── Pricing.jsx ───────── api.js (pricing,products)
  │     │           ├── Reports.jsx ───────── api.js (reportsAPI)
  │     │           ├── Notifications.jsx ──── api.js (notificationsAPI)
  │     │           └── EcomSettings.jsx ──── api.js (ecomSettings,upload)
  │     └── layouts/StoreLayout.jsx
  │           ├── pages/store/Home.jsx ────── api.js (storeAPI)
  │           ├── pages/store/ProductView.jsx ── api.js (storeAPI, portalAPI)
  │           └── pages/store/Portal.jsx ──── api.js (portalAPI)
  ├── context/AuthContext.jsx ─── api.js (authAPI, superadminAPI, customerAuthAPI)
  ├── context/TabContext.jsx (no API, pure state)
  └── context/ToastContext.jsx (no API, pure UI)
```

---

## 6. State Management Summary

| State Area | Provider | Storage | Scope |
|---|---|---|---|
| Authentication | `AuthContext` | `localStorage` (tokens) | Global |
| Tab navigation | `TabContext` | `sessionStorage` (tab IDs) | Admin layout only |
| Toast notifications | `ToastContext` | In-memory (auto-dismiss) | Global |
| Page-local data | `useState` hooks | In-memory per component | Per page |

---

## 7. Data Flow Pattern (Universal for all pages)

```
┌──────────────────────────────────────────────────────┐
│  Page Component (e.g., Products.jsx)                 │
│                                                      │
│  useEffect(() => { load data on mount })             │
│         │                                            │
│         ▼                                            │
│  api.js function (e.g., productsAPI.list())           │
│         │                                            │
│         ▼                                            │
│  axios instance                                      │
│    → request interceptor adds Bearer token           │
│    → HTTP GET/POST/PUT/PATCH/DELETE                  │
│    → response interceptor unwraps .data              │
│         │                                            │
│         ▼         (network)                          │
│  Backend /api/admin/products                         │
│    → auth middleware validates JWT                    │
│    → rbac middleware checks role                      │
│    → controller queries MongoDB                      │
│    → returns JSON { success, data, message }         │
│         │                                            │
│         ▼                                            │
│  Response flows back through axios                   │
│         │                                            │
│         ▼                                            │
│  setState(response.data) → React re-renders UI       │
│                                                      │
│  User interaction (click/submit)                     │
│         │                                            │
│         ▼                                            │
│  api.js mutation function (create/update/delete)     │
│         │                                            │
│         ▼                                            │
│  Success → toast.success() + reload data             │
│  Error   → toast.error(err.message)                  │
└──────────────────────────────────────────────────────┘
```

---

*End of Frontend Design Schema*
