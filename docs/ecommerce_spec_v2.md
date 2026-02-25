**MULTI-TENANT E-COMMERCE PLATFORM**

Complete System Architecture, Schema & API Specification

React JS · Node JS · MongoDB

Version 2.0 · Final Draft

**1. Architecture Decisions Summary**

  --------------------- -------------------------------------------------
  **Stack**             React JS (Frontend) · Node JS / Express (Backend)
                        · MongoDB (Database)

  **Multi-tenancy**     Separate MongoDB database per organization ---
                        strongest isolation, zero cross-org leakage

  **Variant depth**     1-level variants only (e.g. Size OR Color per
                        product)

  **Pricing model**     4-tier resolution: Customer Tier → Warehouse →
                        SKU → Parent Product (first non-null wins)

  **Payment methods**   Cash, Card, Bank Transfer, Credit/Pay-Later,
                        Partial/Split payments

  **Return flow**       Stock auto-reverts to selected warehouse
                        immediately on return approval

  **Purchase flow**     PO → GRN (Goods Received Note) → Stock update
                        (2-step, GRN triggers stock)

  **Ledger style**      Running balance ledger + full transaction log ---
                        immutable entries

  **Balance top-up**    Admin can top-up / adjust customer balance with
                        ledger entry created each time

  **Tax/GST**           Multiple tax slabs per product (5%, 12%, 18%,
                        28%, Exempt, etc.)

  **Customer portal**   Customers log in to view orders, invoices,
                        ledger, payments, and pay online

  **Public ecom API**   Unauthenticated APIs for storefront: categories,
                        products, search --- no login needed

  **Delete strategy**   Soft delete everywhere --- deletedAt timestamp,
                        records never physically removed

  **Discounts**         Order-level (flat or %), Line-item level,
                        Coupon/promo codes

  **Sell page**         Hybrid: POS mode (barcode scan) + Full Order
                        Management panel

  **Stock history**     Every stock movement logged to stock_movements
                        collection with from/to/reason

  **Roles**             Super Admin · Admin · Manager · Cashier ·
                        Warehouse Staff · Accountant
  --------------------- -------------------------------------------------

**2. System Module Map**

  -----------------------------------------------------------------------
  **Module**            **Responsibility**
  --------------------- -------------------------------------------------
  **🏢 Super Admin**    Org creation, admin provisioning, platform-level
                        management

  **👤 User & RBAC**    Role-based access per org: Admin, Manager,
                        Cashier, WH Staff, Accountant

  **📦 Products**       Single / Parent / Variant products, images, SKU,
                        barcode, unit, categories

  **🏭 Warehouses**     Warehouse CRUD, stock per SKU per warehouse

  **📋 Categories**     Hierarchical categories, multi-category per
                        product

  **📐 Units**          Unit of measurement master (kg, pcs, box, litre,
                        etc.)

  **🔖 Barcodes**       Barcode type master (EAN-13, QR, CODE-128, UPC-A)

  **📊 Stock &          Stock per SKU/warehouse, full movement history,
  Movements**           transfer, adjustment

  **🛒 Orders / POS**   Hybrid POS + Order mgmt, full order lifecycle,
                        line-item tracking, invoices

  **👥 Customers**      CRUD, balance top-up, running ledger,
                        transactions, portal login

  **🚚 Suppliers**      CRUD, Purchase Orders, GRN, running ledger,
                        payments, returns

  **💰 Ledger &         Immutable running-balance ledger for customers
  Payments**            and suppliers

  **🏷️ Pricing &        4-tier pricing, GST slabs, discounts, coupon
  Coupons**             codes

  **🌐 Public           Unauthenticated product/category listing for
  Storefront API**      e-commerce frontend

  **🔐 Customer Portal  Auth-gated APIs: customer orders, ledger,
  API**                 invoices, payments

  **📈 Reports**        Sales, Stock, P&L, Customer aging, Supplier
                        aging, Purchase reports
  -----------------------------------------------------------------------

**3. Roles & Permissions (RBAC)**

  ------------------------------------------------------------------------------
  **Role**         **Scope**   **Access Level**
  ---------------- ----------- -------------------------------------------------
  **Super Admin**  Platform    Create/manage organizations, provision admin
                               users, platform settings

  **Admin**        Org         Full access: all modules, users, settings,
                               reports

  **Manager**      Org         All operational modules EXCEPT user management
                               and org settings

  **Cashier**      Org         Sell page (POS + orders), customer lookup,
                               payment collection, own invoices

  **Warehouse      Org         Stock in/out, GRN processing, stock transfers,
  Staff**                      stock adjustments

  **Accountant**   Org         VIEW ONLY: ledgers, payments, invoices, P&L and
                               aging reports
  ------------------------------------------------------------------------------

**4. Database Architecture**

**4.1 Multi-Tenancy: Separate DB Per Org**

  --------------------- -------------------------------------------------
  **superadmin_db**     Organizations collection, Super Admin
                        credentials, platform settings

  **org\_{orgId}**      ALL org data: users, products, warehouses,
                        orders, customers, suppliers, ledgers, stock
  --------------------- -------------------------------------------------

> **ℹ** JWT middleware on Node.js extracts orgId from the token and
> routes each request to the correct database connection. A connection
> pool per org is maintained using mongoose.createConnection().

**4.2 Super Admin DB Schema**

**organizations**

  -----------------------------------------------------------------------
  **Field**       **Type**      **Notes / Description**
  --------------- ------------- -----------------------------------------
  **\_id**        ObjectId      Primary key

  **name**        String        Organization display name

  **slug**        String        Unique URL-safe identifier

  **dbName**      String        Actual MongoDB DB name: org\_{slug}

  **plan**        String        Enum: basic \| pro \| enterprise

  **isActive**    Boolean       Soft-active flag

  **createdBy**   ObjectId      Super admin who created this org

  **deletedAt**   Date          Soft delete --- null if active

  **createdAt /   Date          Timestamps
  updatedAt**                   
  -----------------------------------------------------------------------

**5. Master Data Collections**

**5.1 Users**

**users**

  -----------------------------------------------------------------------
  **Field**       **Type**      **Notes / Description**
  --------------- ------------- -----------------------------------------
  **\_id**        ObjectId      Primary key

  **name**        String        Full name

  **email**       String        Unique --- used for login

  **password**    String        bcrypt hashed

  **role**        String        Enum: admin \| manager \| cashier \|
                                warehouse_staff \| accountant

  **isActive**    Boolean       Account active status

  **deletedAt**   Date          Soft delete

  **createdAt /   Date          Timestamps
  updatedAt**                   
  -----------------------------------------------------------------------

**5.2 Categories**

**categories**

  ----------------------------------------------------------------------------
  **Field**            **Type**      **Notes / Description**
  -------------------- ------------- -----------------------------------------
  **\_id**             ObjectId      Primary key

  **name**             String        Category name

  **slug**             String        URL-safe slug --- used in storefront API

  **parentCategory**   ObjectId \|   Ref: categories --- hierarchical nesting
                       null          

  **image**            String        Category image URL

  **description**      String        Short description

  **sortOrder**        Number        Display order on storefront

  **isActive**         Boolean       Active status

  **deletedAt**        Date          Soft delete
  ----------------------------------------------------------------------------

**5.3 Units**

**units**

  -----------------------------------------------------------------------
  **Field**       **Type**      **Notes / Description**
  --------------- ------------- -----------------------------------------
  **\_id**        ObjectId      Primary key

  **name**        String        e.g. Kilogram, Piece, Box

  **shortName**   String        e.g. kg, pcs, box

  **isActive**    Boolean       Active
  -----------------------------------------------------------------------

**5.4 Barcode Types**

**barcode_types**

  -------------------------------------------------------------------------
  **Field**         **Type**      **Notes / Description**
  ----------------- ------------- -----------------------------------------
  **\_id**          ObjectId      Primary key

  **name**          String        e.g. EAN-13, QR Code, CODE-128, UPC-A

  **description**   String        Optional description

  **isActive**      Boolean       Active
  -------------------------------------------------------------------------

**5.5 Tax Slabs**

**tax_slabs**

  -----------------------------------------------------------------------
  **Field**       **Type**      **Notes / Description**
  --------------- ------------- -----------------------------------------
  **\_id**        ObjectId      Primary key

  **name**        String        e.g. GST 18%, GST 5%, Exempt

  **rate**        Number        Tax rate as percentage (0 for exempt)

  **isActive**    Boolean       Active
  -----------------------------------------------------------------------

**5.6 Warehouses**

**warehouses**

  ---------------------------------------------------------------------------
  **Field**           **Type**      **Notes / Description**
  ------------------- ------------- -----------------------------------------
  **\_id**            ObjectId      Primary key

  **name**            String        Warehouse name

  **code**            String        Short code (e.g. WH-DELHI-01)

  **location**        String        Full address

  **contactPerson**   String        Contact name

  **phone**           String        Contact number

  **isActive**        Boolean       Active

  **deletedAt**       Date          Soft delete
  ---------------------------------------------------------------------------

**6. Product Module**

> **ℹ** 3 product types: single (standalone SKU), parent (holds variant
> template, no own stock), variant (child of parent, each is a distinct
> SKU with its own stock).

**6.1 Products Collection**

**products**

  -------------------------------------------------------------------------------
  **Field**              **Type**       **Notes / Description**
  ---------------------- -------------- -----------------------------------------
  **\_id**               ObjectId       Primary key

  **name**               String         Product / variant display name

  **sku**                String         Unique SKU code per org

  **type**               String         Enum: single \| parent \| variant

  **parentProduct**      ObjectId \|    Ref: products --- null for single/parent,
                         null           required for variant

  **variantAttribute**   String \| null Attribute name on parent (e.g. \'Size\',
                                        \'Color\')

  **variantValue**       String \| null Attribute value on variant (e.g.
                                        \'Large\', \'Red\')

  **categories**         \[ObjectId\]   Multiple refs to categories collection

  **unit**               ObjectId       Ref: units --- on single/parent only

  **barcodeType**        ObjectId       Ref: barcode_types --- on single/parent
                                        only

  **barcodeValue**       String         Actual barcode value/string

  **description**        String         Full product description

  **images**             \[Object\]     Array: { url, isPrimary, sortOrder,
                                        altText }

  **basePrice**          Number         Default selling price (tier-4 fallback in
                                        price resolution)

  **costPrice**          Number         Purchase cost --- used for P&L
                                        calculations

  **taxSlab**            ObjectId       Ref: tax_slabs --- snapshotted at order
                                        time

  **weight**             Number         Weight in grams --- for shipping

  **isActive**           Boolean        Active

  **deletedAt**          Date           Soft delete

  **createdAt /          Date           Timestamps
  updatedAt**                           
  -------------------------------------------------------------------------------

**6.2 Product Stock (Per SKU Per Warehouse)**

**product_stocks**

  -------------------------------------------------------------------------------
  **Field**               **Type**      **Notes / Description**
  ----------------------- ------------- -----------------------------------------
  **\_id**                ObjectId      Primary key

  **product**             ObjectId      Ref: products --- only single or variant
                                        type

  **warehouse**           ObjectId      Ref: warehouses

  **quantity**            Number        Physical quantity on hand

  **reservedQuantity**    Number        Reserved for placed/processing orders ---
                                        not yet fulfilled

  **warehousePrice**      Number \|     Warehouse-level price override (tier-2 in
                          null          price resolution)

  **lowStockThreshold**   Number        Alert fires when quantity falls below
                                        this

  **updatedAt**           Date          Last updated
  -------------------------------------------------------------------------------

> **⚠** Available qty = quantity - reservedQuantity. On order PLACED:
> reservedQty++. On SHIPPED: quantity\-- AND reservedQty\--. On CANCEL:
> reservedQty\--. On RETURN: quantity++.

**6.3 Stock Movements (Full Audit Trail)**

Every single stock change --- from any source --- is recorded here. This
is the complete from/to history for every SKU.

**stock_movements**

  -----------------------------------------------------------------------------
  **Field**             **Type**      **Notes / Description**
  --------------------- ------------- -----------------------------------------
  **\_id**              ObjectId      Primary key

  **product**           ObjectId      Ref: products (SKU --- single/variant
                                      only)

  **warehouse**         ObjectId      Primary warehouse involved in this
                                      movement

  **movementType**      String        Enum: purchase_in \| sale_out \|
                                      return_in \| transfer_in \| transfer_out
                                      \| adjustment_in \| adjustment_out \|
                                      opening_stock

  **quantityBefore**    Number        Stock level before this movement

  **quantityChange**    Number        Positive = stock added, Negative = stock
                                      removed

  **quantityAfter**     Number        Stock level after this movement

  **referenceType**     String        Enum: grn \| order \| return \|
                                      stock_transfer \| stock_adjustment \|
                                      manual

  **referenceId**       ObjectId      Ref to the source document (GRN \_id,
                                      Order \_id, Transfer \_id, etc.)

  **referenceNumber**   String        Human-readable: GRN-001, ORD-0042,
                                      TRF-003, ADJ-007

  **fromWarehouse**     ObjectId \|   Ref: warehouses --- populated for
                        null          transfer_out movements

  **toWarehouse**       ObjectId \|   Ref: warehouses --- populated for
                        null          transfer_in movements

  **notes**             String        Optional notes

  **createdBy**         ObjectId      Ref: users who triggered this movement

  **createdAt**         Date          Immutable timestamp
  -----------------------------------------------------------------------------

> **⚠** stock_movements records are IMMUTABLE. Never update or delete.
> This is a complete audit log. To reverse, a new counter-movement is
> created.

Movement type reference:

  --------------------- -------------------------------------------------
  **purchase_in**       GRN approved --- stock received from supplier
                        into warehouse

  **sale_out**          Order SHIPPED --- stock leaves warehouse to
                        fulfil order

  **return_in**         Customer return approved --- stock re-enters
                        warehouse

  **transfer_out**      Stock transferred OUT of a warehouse to another

  **transfer_in**       Stock transferred IN to a warehouse from another

  **adjustment_in**     Manual stock increase (count correction, damage
                        reversal)

  **adjustment_out**    Manual stock decrease (damage write-off,
                        shrinkage)

  **opening_stock**     Initial stock entry when warehouse/product is
                        first set up
  --------------------- -------------------------------------------------

**6.4 Stock Transfer**

**stock_transfers**

  ----------------------------------------------------------------------------
  **Field**            **Type**      **Notes / Description**
  -------------------- ------------- -----------------------------------------
  **\_id**             ObjectId      Primary key

  **transferNumber**   String        Auto-generated: TRF-00001

  **fromWarehouse**    ObjectId      Source warehouse

  **toWarehouse**      ObjectId      Destination warehouse

  **status**           String        Enum: draft \| in_transit \| completed \|
                                     cancelled

  **items**            \[Object\]    Array: { product, requestedQty,
                                     transferredQty, notes }

  **notes**            String        Transfer notes

  **createdBy**        ObjectId      User who created the transfer

  **completedBy**      ObjectId      User who completed/received

  **completedAt**      Date          Completion timestamp --- when
                                     stock_movements are written

  **deletedAt**        Date          Soft delete

  **createdAt /        Date          Timestamps
  updatedAt**                        
  ----------------------------------------------------------------------------

> **ℹ** On status → completed: Two stock_movements are created per item
> --- one transfer_out for fromWarehouse and one transfer_in for
> toWarehouse.

**6.5 Stock Adjustments**

**stock_adjustments**

  ------------------------------------------------------------------------------
  **Field**              **Type**      **Notes / Description**
  ---------------------- ------------- -----------------------------------------
  **\_id**               ObjectId      Primary key

  **adjustmentNumber**   String        Auto-generated: ADJ-00001

  **warehouse**          ObjectId      Ref: warehouses

  **product**            ObjectId      Ref: products (SKU)

  **quantityBefore**     Number        Stock before adjustment

  **adjustedQuantity**   Number        Amount adjusted (+/-)

  **quantityAfter**      Number        Stock after adjustment

  **adjustmentType**     String        Enum: increase \| decrease

  **reason**             String        Enum: damage \| theft \| count_correction
                                       \| expiry \| other

  **notes**              String        Detailed notes

  **createdBy**          ObjectId      Ref: users

  **createdAt**          Date          Timestamp
  ------------------------------------------------------------------------------

**6.6 Pricing --- 4-Tier Resolution**

  --------------------- -------------------------------------------------
  **Tier 1 (Highest)**  Customer tier price --- customer_tier_prices
                        where tier matches customer.tier

  **Tier 2**            Warehouse price --- product_stocks.warehousePrice
                        for the fulfilling warehouse

  **Tier 3**            SKU base price --- products.basePrice on the
                        specific variant/single

  **Tier 4 (Fallback)** Parent product base price ---
                        parentProduct.basePrice if variant has no own
                        price
  --------------------- -------------------------------------------------

**customer_tier_prices**

  -----------------------------------------------------------------------
  **Field**       **Type**      **Notes / Description**
  --------------- ------------- -----------------------------------------
  **\_id**        ObjectId      Primary key

  **product**     ObjectId      Ref: products

  **tier**        String        Enum: retail \| wholesale \| vip \|
                                custom

  **price**       Number        Price for this tier

  **minQty**      Number        Minimum qty for this price (volume
                                pricing, 1 = always)
  -----------------------------------------------------------------------

**7. Customer Module**

**7.1 Customers Collection**

**customers**

  ----------------------------------------------------------------------------
  **Field**            **Type**      **Notes / Description**
  -------------------- ------------- -----------------------------------------
  **\_id**             ObjectId      Primary key

  **name**             String        Customer / business name

  **email**            String        Unique --- used for portal login

  **phone**            String        Contact number

  **password**         String        bcrypt hashed --- customer portal login

  **tier**             String        Enum: retail \| wholesale \| vip \|
                                     custom --- drives tier pricing

  **addresses**        \[Object\]    Array: { label, line1, city, state, zip,
                                     country, isDefault }

  **creditLimit**      Number        Max allowed outstanding balance (0 = no
                                     credit)

  **currentBalance**   Number        Running balance: positive = customer OWES
                                     us, negative = advance/overpaid

  **isActive**         Boolean       Active

  **deletedAt**        Date          Soft delete

  **createdAt /        Date          Timestamps
  updatedAt**                        
  ----------------------------------------------------------------------------

**7.2 Customer Ledger**

The ledger is an immutable append-only log. Every financial transaction
creates a new entry and updates balanceAfter based on the previous
entry\'s balanceAfter.

**customer_ledger**

  -----------------------------------------------------------------------------
  **Field**             **Type**      **Notes / Description**
  --------------------- ------------- -----------------------------------------
  **\_id**              ObjectId      Primary key

  **customer**          ObjectId      Ref: customers

  **transactionType**   String        Enum: invoice \| payment \| credit_note
                                      \| debit_note \| balance_topup \|
                                      balance_adjustment \| opening_balance

  **referenceType**     String        Enum: order \| payment \| return \| topup
                                      \| manual

  **referenceId**       ObjectId      Ref to the source document

  **referenceNumber**   String        Human-readable: ORD-001, PAY-001,
                                      TOP-001, ADJ-001

  **debit**             Number        Increases what customer owes us (invoice,
                                      debit_note). 0 if not applicable.

  **credit**            Number        Reduces what customer owes us (payment,
                                      credit_note, topup). 0 if not applicable.

  **balanceAfter**      Number        Running balance after this entry. + =
                                      owes us, - = advance/credit with us.

  **narration**         String        Human-readable description of the entry

  **createdBy**         ObjectId      Ref: users (admin/manager who created
                                      this entry)

  **createdAt**         Date          Immutable timestamp
  -----------------------------------------------------------------------------

> **⚠** IMMUTABLE: Ledger records are never edited or deleted. All
> corrections use counter-entries (credit_note reverses a debit,
> debit_note reverses a credit). This ensures a full audit trail.

**7.3 Customer Balance Top-Up Flow**

Admins can top-up a customer\'s account (add advance/credit) or make
manual adjustments. Each action writes a ledger entry and updates
customer.currentBalance atomically.

  --------------------- -------------------------------------------------
  **Top-Up (deposit)**  Customer pays in advance. Creates a CREDIT entry.
                        Reduces currentBalance (customer owes less / is
                        in credit).

  **Debit Adjustment**  Admin corrects an error upward. Creates a DEBIT
                        entry. Increases currentBalance.

  **Credit Adjustment** Admin corrects an error downward. Creates a
                        CREDIT entry. Decreases currentBalance.

  **Opening Balance**   One-time entry when customer is first added with
                        a pre-existing balance.
  --------------------- -------------------------------------------------

**Ledger Example: Balance -50, Top-Up +100, Invoice +150, Payment +80**

  ----------------------------------------------------------------------------------------------------
  **\#**   **Date**   **Type**          **Narration**           **Debit**   **Credit**   **Balance**
  -------- ---------- ----------------- ----------------------- ----------- ------------ -------------
  1        01 Jan     opening_balance   Opening balance carried 50.00       \-           **50.00**
                                        forward                                          

  2        05 Jan     balance_topup     Cash top-up received    \-          100.00       **-50.00**
                                        from customer                                    

  3        10 Jan     invoice           Order ORD-0041 --- Sale 150.00      \-           **100.00**
                                        invoice                                          

  4        15 Jan     payment           Payment received ---    \-          80.00        **20.00**
                                        Bank Transfer PAY-012                            

  5        18 Jan     credit_note       Return RTN-003 ---      \-          30.00        **-10.00**
                                        partial return credit                            
  ----------------------------------------------------------------------------------------------------

> **ℹ** Balance interpretation: Positive = customer owes us money.
> Negative = customer has advance/credit with us (we owe them).

**7.4 Customer Balance Top-Up Collection**

**customer_topups**

  ---------------------------------------------------------------------------
  **Field**           **Type**      **Notes / Description**
  ------------------- ------------- -----------------------------------------
  **\_id**            ObjectId      Primary key

  **topupNumber**     String        Auto-generated: TOP-00001

  **customer**        ObjectId      Ref: customers

  **amount**          Number        Top-up amount (always positive)

  **type**            String        Enum: topup \| debit_adjustment \|
                                    credit_adjustment \| opening_balance

  **method**          String        Enum: cash \| card \| bank_transfer \|
                                    other

  **reference**       String        Payment reference / slip number

  **narration**       String        Description / reason

  **balanceBefore**   Number        customer.currentBalance before this entry

  **balanceAfter**    Number        customer.currentBalance after this entry

  **createdBy**       ObjectId      Ref: users

  **createdAt**       Date          Timestamp
  ---------------------------------------------------------------------------

**8. Order (Sales) Module**

**8.1 Order Status Lifecycle**

  ---------------------- -------------------------------------------------
  **PLACED**             Order created. Stock reserved. Edit allowed.
                         Ledger debit created.

  **PROCESSING**         Order being prepared. Edit still allowed.

  **SHIPPED**            Dispatched. NO more edits. Stock quantity
                         decremented.

  **IN_TRANSIT**         Order is on the way.

  **OUT_FOR_DELIVERY**   Last-mile --- out for delivery.

  **DELIVERED**          Successfully delivered. Stock confirmed deducted.

  **RETURN**             Full return initiated and approved. Stock
                         restored.

  **PARTIAL_RETURN**     Some line items returned. Partial stock restored.

  **CANCELLED**          Cancelled before shipment. Reserved stock
                         released. Ledger credit note.

  **FAILED_DELIVERY**    Delivery attempt failed. Awaiting resolution.
  ---------------------- -------------------------------------------------

> **⚠** Edit window closes on SHIPPED. After SHIPPED: only status
> progression, returns, or cancel (if allowed). Each status change
> triggers a customer notification.

**8.2 Orders Collection**

**orders**

  -----------------------------------------------------------------------------
  **Field**             **Type**      **Notes / Description**
  --------------------- ------------- -----------------------------------------
  **\_id**              ObjectId      Primary key

  **orderNumber**       String        Auto-generated: ORD-00001

  **customer**          ObjectId      Ref: customers

  **warehouse**         ObjectId      Ref: warehouses --- fulfilment source

  **status**            String        Current order status (see lifecycle
                                      above)

  **orderDate**         Date          Order creation date

  **items**             \[Object\]    Embedded line items array (see 8.3)

  **subtotal**          Number        Sum of all lineTotal before order-level
                                      discount

  **discountType**      String        Enum: flat \| percentage \| null

  **discountValue**     Number        Order-level discount value

  **discountAmount**    Number        Computed discount amount

  **couponCode**        String \|     Applied coupon code
                        null          

  **couponDiscount**    Number        Discount amount from coupon

  **taxTotal**          Number        Total tax across all line items

  **shippingCharge**    Number        Shipping fee

  **grandTotal**        Number        Final payable amount

  **amountPaid**        Number        Total payments received against this
                                      order

  **balanceDue**        Number        grandTotal - amountPaid

  **paymentStatus**     String        Enum: unpaid \| partial \| paid

  **shippingAddress**   Object        Snapshot of delivery address at order
                                      time

  **notes**             String        Internal order notes

  **invoiceNumber**     String        Invoice reference number

  **editHistory**       \[Object\]    Snapshots of every pre-shipment edit

  **statusHistory**     \[Object\]    Array: { status, changedAt, changedBy,
                                      note }

  **createdBy**         ObjectId      Ref: users

  **deletedAt**         Date          Soft delete

  **createdAt /         Date          Timestamps
  updatedAt**                         
  -----------------------------------------------------------------------------

**8.3 Order Line Items (Embedded)**

**items\[\]**

  -----------------------------------------------------------------------------
  **Field**             **Type**      **Notes / Description**
  --------------------- ------------- -----------------------------------------
  **\_id**              ObjectId      Line item ID

  **product**           ObjectId      Ref: products (SKU)

  **productSnapshot**   Object        Snapshot at sale time: { name, sku,
                                      barcodeValue, unitName, images\[0\] }

  **quantity**          Number        Ordered quantity

  **unitPrice**         Number        Resolved price at sale time

  **discountType**      String        Enum: flat \| percentage \| null

  **discountValue**     Number        Line-item discount value

  **discountAmount**    Number        Computed line-item discount

  **taxSlab**           Object        Snapshot: { name, rate } --- frozen at
                                      order time

  **taxAmount**         Number        Tax for this line

  **lineTotal**         Number        (unitPrice - discountAmount) \*
                                      quantity + taxAmount

  **status**            String        Enum: active \| returned \|
                                      partial_returned \| cancelled

  **returnedQty**       Number        Quantity returned so far
  -----------------------------------------------------------------------------

**8.4 Order Payments**

**order_payments**

  --------------------------------------------------------------------------
  **Field**          **Type**      **Notes / Description**
  ------------------ ------------- -----------------------------------------
  **\_id**           ObjectId      Primary key

  **order**          ObjectId      Ref: orders

  **customer**       ObjectId      Ref: customers

  **amount**         Number        Total payment amount

  **splitMethods**   \[Object\]    For partial/split: \[{ method, amount,
                                   reference }\]

  **method**         String        Primary method: cash \| card \|
                                   bank_transfer \| credit \| split

  **reference**      String        Transaction ID, cheque no., slip no.

  **paymentDate**    Date          Date of payment

  **notes**          String        Notes

  **createdBy**      ObjectId      Ref: users

  **createdAt**      Date          Timestamp
  --------------------------------------------------------------------------

**8.5 Order Returns**

**order_returns**

  -----------------------------------------------------------------------------
  **Field**             **Type**      **Notes / Description**
  --------------------- ------------- -----------------------------------------
  **\_id**              ObjectId      Primary key

  **returnNumber**      String        Auto-generated: RTN-00001

  **order**             ObjectId      Ref: orders

  **customer**          ObjectId      Ref: customers

  **returnType**        String        Enum: full \| partial

  **items**             \[Object\]    Array: { lineItemId, product, returnQty,
                                      reason, condition }

  **returnWarehouse**   ObjectId      Stock reverts to this warehouse on
                                      approval

  **refundAmount**      Number        Amount to refund/credit to customer

  **refundMethod**      String        Enum: cash \| bank_transfer \|
                                      credit_note \| ledger_credit

  **status**            String        Enum: initiated \| approved \| completed

  **notes**             String        Return notes

  **createdBy**         ObjectId      Ref: users

  **createdAt**         Date          Timestamp
  -----------------------------------------------------------------------------

> **✓** On return approved: (1) returnedQty++ on line items, (2) line
> status updated, (3) stock_movements record created (return_in), (4)
> product_stocks.quantity++, (5) credit note entry in customer_ledger,
> (6) customer.currentBalance updated.

**9. Supplier & Purchase Module**

**9.1 Suppliers Collection**

**suppliers**

  ----------------------------------------------------------------------------
  **Field**            **Type**      **Notes / Description**
  -------------------- ------------- -----------------------------------------
  **\_id**             ObjectId      Primary key

  **name**             String        Supplier / company name

  **email**            String        Contact email

  **phone**            String        Contact number

  **address**          Object        { line1, city, state, zip, country }

  **gstNumber**        String        GST / tax registration number

  **paymentTerms**     String        e.g. Net 30, Net 15, Immediate

  **creditLimit**      Number        Maximum purchase credit allowed

  **currentBalance**   Number        Running balance: positive = we owe
                                     supplier, negative = advance paid

  **isActive**         Boolean       Active

  **deletedAt**        Date          Soft delete

  **createdAt /        Date          Timestamps
  updatedAt**                        
  ----------------------------------------------------------------------------

**9.2 Supplier Ledger**

Mirrors customer ledger. Debit = we owe supplier (purchase invoice).
Credit = we paid supplier or supplier issued credit.

**supplier_ledger**

  -----------------------------------------------------------------------------
  **Field**             **Type**      **Notes / Description**
  --------------------- ------------- -----------------------------------------
  **\_id**              ObjectId      Primary key

  **supplier**          ObjectId      Ref: suppliers

  **transactionType**   String        Enum: purchase_invoice \| payment \|
                                      credit_note \| debit_note \|
                                      balance_topup \| balance_adjustment \|
                                      opening_balance

  **referenceType**     String        Enum: grn \| payment \| return \| topup
                                      \| manual

  **referenceId**       ObjectId      Ref to source document

  **referenceNumber**   String        Human-readable: GRN-001, SPAY-001, etc.

  **debit**             Number        We owe supplier more (purchase invoice,
                                      debit_note)

  **credit**            Number        We owe supplier less (payment,
                                      credit_note, advance)

  **balanceAfter**      Number        Running balance after entry. + = we owe
                                      supplier, - = advance/overpaid.

  **narration**         String        Description

  **createdBy**         ObjectId      Ref: users

  **createdAt**         Date          Immutable timestamp
  -----------------------------------------------------------------------------

**Supplier Ledger Example**

  -----------------------------------------------------------------------------------------------------
  **\#**   **Date**   **Type**           **Narration**           **Debit**   **Credit**   **Balance**
  -------- ---------- ------------------ ----------------------- ----------- ------------ -------------
  1        01 Jan     opening_balance    Opening balance ---     500.00      \-           **500.00**
                                         previous dues carried                            
                                         forward                                          

  2        05 Jan     purchase_invoice   GRN-0012 received ---   2000.00     \-           **2500.00**
                                         invoice from supplier                            

  3        08 Jan     balance_topup      Advance payment made to \-          1000.00      **1500.00**
                                         supplier                                         

  4        12 Jan     payment            Payment via Bank        \-          800.00       **700.00**
                                         Transfer SPAY-009                                

  5        15 Jan     credit_note        Purchase return PRR-004 \-          200.00       **500.00**
                                         --- credit from                                  
                                         supplier                                         
  -----------------------------------------------------------------------------------------------------

> **ℹ** Balance interpretation for supplier: Positive = we owe them.
> Negative = we have advance credit with them (they owe us).

**9.3 Supplier Payments Collection**

**supplier_payments**

  ---------------------------------------------------------------------------
  **Field**           **Type**      **Notes / Description**
  ------------------- ------------- -----------------------------------------
  **\_id**            ObjectId      Primary key

  **paymentNumber**   String        Auto-generated: SPAY-00001

  **supplier**        ObjectId      Ref: suppliers

  **purchaseOrder**   ObjectId \|   Ref: purchase_orders --- if tied to a PO
                      null          

  **amount**          Number        Payment amount

  **method**          String        Enum: cash \| card \| bank_transfer \|
                                    cheque

  **reference**       String        Cheque no. / transaction ID

  **paymentDate**     Date          Date of payment

  **narration**       String        Notes

  **balanceBefore**   Number        Supplier balance before payment

  **balanceAfter**    Number        Supplier balance after payment

  **createdBy**       ObjectId      Ref: users

  **createdAt**       Date          Timestamp
  ---------------------------------------------------------------------------

**9.4 Supplier Balance Adjustment**

**supplier_adjustments**

  ------------------------------------------------------------------------------
  **Field**              **Type**      **Notes / Description**
  ---------------------- ------------- -----------------------------------------
  **\_id**               ObjectId      Primary key

  **adjustmentNumber**   String        Auto-generated: SADJ-00001

  **supplier**           ObjectId      Ref: suppliers

  **amount**             Number        Adjustment amount

  **type**               String        Enum: topup \| debit_adjustment \|
                                       credit_adjustment \| opening_balance

  **narration**          String        Reason for adjustment

  **balanceBefore**      Number        Balance before adjustment

  **balanceAfter**       Number        Balance after adjustment

  **createdBy**          ObjectId      Ref: users

  **createdAt**          Date          Timestamp
  ------------------------------------------------------------------------------

**9.5 Purchase Orders**

**purchase_orders**

  --------------------------------------------------------------------------
  **Field**          **Type**      **Notes / Description**
  ------------------ ------------- -----------------------------------------
  **\_id**           ObjectId      Primary key

  **poNumber**       String        Auto-generated: PO-00001

  **supplier**       ObjectId      Ref: suppliers

  **warehouse**      ObjectId      Ref: warehouses --- receiving warehouse

  **status**         String        Enum: draft \| ordered \| partial \|
                                   received \| cancelled

  **orderDate**      Date          PO creation date

  **expectedDate**   Date          Expected delivery date

  **items**          \[Object\]    Array: { product, orderedQty,
                                   receivedQty, unitCost, taxSlab, lineTotal
                                   }

  **subtotal**       Number        Sum before tax

  **taxTotal**       Number        Total tax

  **grandTotal**     Number        Total PO value

  **amountPaid**     Number        Payments made against this PO

  **balanceDue**     Number        grandTotal - amountPaid

  **notes**          String        PO notes

  **createdBy**      ObjectId      Ref: users

  **deletedAt**      Date          Soft delete

  **createdAt /      Date          Timestamps
  updatedAt**                      
  --------------------------------------------------------------------------

**9.6 GRN --- Goods Received Note**

Stock update ONLY happens on GRN status → approved. This triggers
stock_movements and supplier ledger debit.

**grns**

  ---------------------------------------------------------------------------
  **Field**           **Type**      **Notes / Description**
  ------------------- ------------- -----------------------------------------
  **\_id**            ObjectId      Primary key

  **grnNumber**       String        Auto-generated: GRN-00001

  **purchaseOrder**   ObjectId      Ref: purchase_orders

  **supplier**        ObjectId      Ref: suppliers

  **warehouse**       ObjectId      Ref: warehouses

  **items**           \[Object\]    Array: { product, orderedQty,
                                    receivedQty, unitCost, lineTotal }

  **totalValue**      Number        Total value of received goods

  **status**          String        Enum: draft \| approved

  **receivedDate**    Date          Physical receipt date

  **notes**           String        GRN notes

  **approvedBy**      ObjectId      Ref: users

  **createdBy**       ObjectId      Ref: users

  **createdAt**       Date          Timestamp
  ---------------------------------------------------------------------------

> **✓** On GRN approved: (1) product_stocks.quantity += receivedQty per
> SKU, (2) stock_movements created (purchase_in per item), (3)
> PO.items\[\].receivedQty updated, (4) PO status updated, (5)
> supplier_ledger debit entry created, (6) supplier.currentBalance
> updated.

**9.7 Purchase Returns**

**purchase_returns**

  ---------------------------------------------------------------------------
  **Field**           **Type**      **Notes / Description**
  ------------------- ------------- -----------------------------------------
  **\_id**            ObjectId      Primary key

  **returnNumber**    String        Auto-generated: PRR-00001

  **purchaseOrder**   ObjectId      Ref: purchase_orders

  **supplier**        ObjectId      Ref: suppliers

  **warehouse**       ObjectId      Stock removed from this warehouse

  **items**           \[Object\]    Array: { product, returnQty, reason,
                                    unitCost, lineTotal }

  **totalValue**      Number        Total return value

  **status**          String        Enum: initiated \| approved \| completed

  **notes**           String        Return notes

  **createdBy**       ObjectId      Ref: users

  **createdAt**       Date          Timestamp
  ---------------------------------------------------------------------------

**10. Coupons & Discount Module**

**coupons**

  --------------------------------------------------------------------------------
  **Field**               **Type**       **Notes / Description**
  ----------------------- -------------- -----------------------------------------
  **\_id**                ObjectId       Primary key

  **code**                String         Unique coupon code (e.g. SAVE10, FLAT200)

  **description**         String         What this coupon offers

  **discountType**        String         Enum: flat \| percentage

  **discountValue**       Number         Amount or percentage

  **maxDiscountAmount**   Number         Cap on % discounts (e.g. max 500 off on
                                         20% coupon)

  **minOrderValue**       Number         Minimum order value required

  **usageLimit**          Number \| null Max total redemptions (null = unlimited)

  **usedCount**           Number         Current redemption count

  **applicableTo**        String         Enum: all \| specific_products \|
                                         specific_categories

  **applicableIds**       \[ObjectId\]   Product/category IDs if applicableTo is
                                         specific

  **validFrom /           Date           Validity window
  validUntil**                           

  **isActive**            Boolean        Active
  --------------------------------------------------------------------------------

**11. Public Storefront & Customer Portal APIs**

Two separate API groups serve the e-commerce website:

  --------------------- -------------------------------------------------
  **Public Storefront   No authentication required. Customers browse
  APIs**                products, categories, search. These are the
                        unauthenticated routes that the website frontend
                        uses to display content.

  **Customer Portal     Requires customer JWT token. After login,
  APIs**                customers can view their own orders, ledger,
                        invoices, payments, and make online payments.
  --------------------- -------------------------------------------------

**11.1 Public Storefront --- Catalog**

Base path: /api/v1/store/{orgSlug}/ --- no auth header needed.

  ------------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                              **Auth**   **Description**
  ------------ ----------------------------------------- ---------- ------------------------------
  **GET**      /store/:orgSlug/categories                None       List all active top-level
                                                                    categories with subcategories

  **GET**      /store/:orgSlug/categories/:slug          None       Single category details +
                                                                    child categories

  **GET**      /store/:orgSlug/products                  None       Paginated product listing
                                                                    (filterable: category,
                                                                    priceMin, priceMax, inStock)

  **GET**      /store/:orgSlug/products/:sku             None       Single product detail with all
                                                                    variants, images, stock
                                                                    availability

  **GET**      /store/:orgSlug/products/search           None       Search products by name, SKU,
                                                                    barcode --- query param: q

  **GET**      /store/:orgSlug/products/featured         None       Featured / trending products

  **GET**      /store/:orgSlug/products/category/:slug   None       Products filtered by category
                                                                    slug
  ------------------------------------------------------------------------------------------------

**11.2 Customer Authentication (Portal)**

  ---------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                           **Auth**   **Description**
  ------------ -------------------------------------- ---------- ------------------------------
  **POST**     /store/:orgSlug/auth/register          None       Customer self-registration

  **POST**     /store/:orgSlug/auth/login             None       Customer login --- returns
                                                                 customer JWT

  **POST**     /store/:orgSlug/auth/forgot-password   None       Send password reset email

  **POST**     /store/:orgSlug/auth/reset-password    None       Reset password with token

  **GET**      /store/:orgSlug/auth/profile           Customer   Get own profile

  **PUT**      /store/:orgSlug/auth/profile           Customer   Update own profile, phone,
                                                                 addresses
  ---------------------------------------------------------------------------------------------

**11.3 Customer Portal --- Orders & Invoices**

  -------------------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                                     **Auth**   **Description**
  ------------ ------------------------------------------------ ---------- ------------------------------
  **GET**      /store/:orgSlug/my/orders                        Customer   List own orders --- paginated,
                                                                           filterable by status

  **GET**      /store/:orgSlug/my/orders/:orderNumber           Customer   Order detail with line items,
                                                                           status history, payment status

  **GET**      /store/:orgSlug/my/orders/:orderNumber/invoice   Customer   Download invoice PDF for this
                                                                           order

  **POST**     /store/:orgSlug/my/orders/:orderNumber/cancel    Customer   Request cancellation (if
                                                                           before shipment)
  -------------------------------------------------------------------------------------------------------

**11.4 Customer Portal --- Ledger & Payments**

  ------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                        **Auth**   **Description**
  ------------ ----------------------------------- ---------- ------------------------------
  **GET**      /store/:orgSlug/my/ledger           Customer   Full ledger: all debit/credit
                                                              entries with running balance

  **GET**      /store/:orgSlug/my/ledger/balance   Customer   Current balance summary

  **GET**      /store/:orgSlug/my/payments         Customer   List all payments made

  **POST**     /store/:orgSlug/my/payments         Customer   Initiate online payment
                                                              (integrates with payment
                                                              gateway)

  **GET**      /store/:orgSlug/my/topups           Customer   View balance top-up history
  ------------------------------------------------------------------------------------------

> **⚠** Customer JWT is separate from Admin JWT. Customer token
> contains: { customerId, orgId, role: \'customer\' }. Admin token
> contains: { userId, orgId, role: \'\...\' }. Both verified by the same
> middleware but routed to different handlers.

**12. Admin API Endpoints (Full Reference)**

Base path: /api/v1/admin --- all require admin JWT. Role-based access
enforced per endpoint.

**12.1 Authentication**

  ------------------------------------------------------------------------------------
  **Method**   **Endpoint**                  **Auth**   **Description**
  ------------ ----------------------------- ---------- ------------------------------
  **POST**     /admin/auth/login             None       Admin/user login --- returns
                                                        JWT

  **POST**     /admin/auth/logout            Admin+     Invalidate token

  **POST**     /admin/auth/forgot-password   None       Send password reset email

  **POST**     /admin/auth/reset-password    None       Reset password with token

  **GET**      /admin/auth/me                Admin+     Get current user profile

  **PUT**      /admin/auth/change-password   Admin+     Change own password
  ------------------------------------------------------------------------------------

**12.2 Super Admin --- Org & Admin Management**

  --------------------------------------------------------------------------------------
  **Method**   **Endpoint**                  **Auth**     **Description**
  ------------ ----------------------------- ------------ ------------------------------
  **GET**      /superadmin/orgs              SuperAdmin   List all organizations

  **POST**     /superadmin/orgs              SuperAdmin   Create new organization ---
                                                          provisions new MongoDB DB

  **GET**      /superadmin/orgs/:id          SuperAdmin   Get organization details

  **PUT**      /superadmin/orgs/:id          SuperAdmin   Update organization

  **DELETE**   /superadmin/orgs/:id          SuperAdmin   Soft delete organization

  **POST**     /superadmin/orgs/:id/admins   SuperAdmin   Create admin user for
                                                          organization

  **GET**      /superadmin/orgs/:id/admins   SuperAdmin   List admins for an
                                                          organization
  --------------------------------------------------------------------------------------

**12.3 User Management (Within Org)**

  ---------------------------------------------------------------------------------------
  **Method**   **Endpoint**                     **Auth**   **Description**
  ------------ -------------------------------- ---------- ------------------------------
  **GET**      /admin/users                     Admin      List all users in org

  **POST**     /admin/users                     Admin      Create new user with role

  **GET**      /admin/users/:id                 Admin      Get user details

  **PUT**      /admin/users/:id                 Admin      Update user details / role

  **DELETE**   /admin/users/:id                 Admin      Soft delete user

  **PUT**      /admin/users/:id/toggle-active   Admin      Activate / deactivate user
  ---------------------------------------------------------------------------------------

**12.4 Categories**

  ----------------------------------------------------------------------------------
  **Method**   **Endpoint**                **Auth**   **Description**
  ------------ --------------------------- ---------- ------------------------------
  **GET**      /admin/categories           Manager+   List all categories (tree
                                                      structure)

  **POST**     /admin/categories           Manager+   Create category

  **GET**      /admin/categories/:id       Manager+   Get category details

  **PUT**      /admin/categories/:id       Manager+   Update category

  **DELETE**   /admin/categories/:id       Manager+   Soft delete category

  **PUT**      /admin/categories/reorder   Manager+   Update sortOrder for multiple
                                                      categories
  ----------------------------------------------------------------------------------

**12.5 Units**

  --------------------------------------------------------------------------------
  **Method**   **Endpoint**              **Auth**   **Description**
  ------------ ------------------------- ---------- ------------------------------
  **GET**      /admin/units              Manager+   List all units

  **POST**     /admin/units              Manager+   Create unit

  **PUT**      /admin/units/:id          Manager+   Update unit

  **DELETE**   /admin/units/:id          Manager+   Soft delete unit
  --------------------------------------------------------------------------------

**12.6 Barcode Types**

  ---------------------------------------------------------------------------------
  **Method**   **Endpoint**               **Auth**   **Description**
  ------------ -------------------------- ---------- ------------------------------
  **GET**      /admin/barcode-types       Manager+   List all barcode types

  **POST**     /admin/barcode-types       Manager+   Create barcode type

  **PUT**      /admin/barcode-types/:id   Manager+   Update barcode type

  **DELETE**   /admin/barcode-types/:id   Manager+   Soft delete
  ---------------------------------------------------------------------------------

**12.7 Tax Slabs**

  --------------------------------------------------------------------------------
  **Method**   **Endpoint**              **Auth**   **Description**
  ------------ ------------------------- ---------- ------------------------------
  **GET**      /admin/tax-slabs          Manager+   List all tax slabs

  **POST**     /admin/tax-slabs          Manager+   Create tax slab

  **PUT**      /admin/tax-slabs/:id      Manager+   Update tax slab

  **DELETE**   /admin/tax-slabs/:id      Manager+   Soft delete
  --------------------------------------------------------------------------------

**12.8 Warehouses**

  ----------------------------------------------------------------------------------------
  **Method**   **Endpoint**                      **Auth**   **Description**
  ------------ --------------------------------- ---------- ------------------------------
  **GET**      /admin/warehouses                 Manager+   List all warehouses

  **POST**     /admin/warehouses                 Admin,     Create warehouse
                                                 Manager    

  **GET**      /admin/warehouses/:id             Manager+   Get warehouse details

  **PUT**      /admin/warehouses/:id             Admin,     Update warehouse
                                                 Manager    

  **DELETE**   /admin/warehouses/:id             Admin      Soft delete warehouse

  **GET**      /admin/warehouses/:id/stock       Manager+   Get all stock for this
                                                            warehouse

  **GET**      /admin/warehouses/:id/movements   Manager+   Stock movement history for
                                                            this warehouse
  ----------------------------------------------------------------------------------------

**12.9 Products**

  ------------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                              **Auth**   **Description**
  ------------ ----------------------------------------- ---------- ------------------------------
  **GET**      /admin/products                           Manager+   List products (paginated,
                                                                    filter: type, category,
                                                                    warehouse)

  **POST**     /admin/products                           Admin,     Create product (single or
                                                         Manager    parent)

  **GET**      /admin/products/:id                       Manager+   Get product with variants,
                                                                    stock, images

  **PUT**      /admin/products/:id                       Admin,     Update product
                                                         Manager    

  **DELETE**   /admin/products/:id                       Admin,     Soft delete product
                                                         Manager    

  **POST**     /admin/products/:id/variants              Admin,     Add variant to parent product
                                                         Manager    

  **PUT**      /admin/products/:id/variants/:variantId   Admin,     Update variant
                                                         Manager    

  **DELETE**   /admin/products/:id/variants/:variantId   Admin,     Soft delete variant
                                                         Manager    

  **POST**     /admin/products/:id/images                Admin,     Upload product images
                                                         Manager    

  **DELETE**   /admin/products/:id/images/:imageId       Admin,     Remove product image
                                                         Manager    

  **PUT**      /admin/products/:id/images/reorder        Admin,     Reorder product images
                                                         Manager    

  **GET**      /admin/products/:id/stock                 Manager+   Get stock per warehouse for
                                                                    this product/variant

  **GET**      /admin/products/:id/movements             Manager+   Stock movement history for
                                                                    this SKU
  ------------------------------------------------------------------------------------------------

**12.10 Stock Management**

  ---------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                          **Auth**    **Description**
  ------------ ------------------------------------- ----------- ------------------------------
  **GET**      /admin/stock                          Manager+    All stock across all
                                                                 warehouses

  **PUT**      /admin/stock/set                      Admin,      Set opening stock for a SKU +
                                                     Manager, WH warehouse
                                                     Staff       

  **POST**     /admin/stock/adjustments              Admin,      Create stock adjustment
                                                     Manager, WH (increase/decrease)
                                                     Staff       

  **GET**      /admin/stock/adjustments              Manager+    List all adjustments

  **GET**      /admin/stock/adjustments/:id          Manager+    Adjustment detail

  **POST**     /admin/stock/transfers                Manager+,   Create stock transfer
                                                     WH Staff    

  **GET**      /admin/stock/transfers                Manager+    List all stock transfers

  **GET**      /admin/stock/transfers/:id            Manager+    Transfer detail with items

  **PUT**      /admin/stock/transfers/:id/complete   Manager+,   Mark transfer complete ---
                                                     WH Staff    triggers stock_movements

  **PUT**      /admin/stock/transfers/:id/cancel     Manager+    Cancel transfer

  **GET**      /admin/stock/movements                Manager+    All stock movements ---
                                                                 filter: product, warehouse,
                                                                 type, dateRange

  **GET**      /admin/stock/movements/:productId     Manager+    Stock movement history per SKU

  **GET**      /admin/stock/low-stock                Manager+    Products below
                                                                 lowStockThreshold
  ---------------------------------------------------------------------------------------------

**12.11 Customers**

  -----------------------------------------------------------------------------------------
  **Method**   **Endpoint**                     **Auth**     **Description**
  ------------ -------------------------------- ------------ ------------------------------
  **GET**      /admin/customers                 Manager+,    List customers --- search by
                                                Cashier      name, phone, email

  **POST**     /admin/customers                 Admin,       Create customer
                                                Manager      

  **GET**      /admin/customers/:id             Manager+,    Customer detail with balance
                                                Cashier      summary

  **PUT**      /admin/customers/:id             Admin,       Update customer
                                                Manager      

  **DELETE**   /admin/customers/:id             Admin        Soft delete customer

  **GET**      /admin/customers/:id/ledger      Manager+,    Full ledger with running
                                                Accountant   balance

  **GET**      /admin/customers/:id/balance     Manager+,    Current balance summary
                                                Cashier,     
                                                Accountant   

  **POST**     /admin/customers/:id/topup       Admin,       Add balance top-up --- creates
                                                Manager      ledger entry

  **POST**     /admin/customers/:id/adjust      Admin,       Manual debit/credit adjustment
                                                Manager      --- creates ledger entry

  **GET**      /admin/customers/:id/orders      Manager+,    Order history for customer
                                                Cashier      

  **GET**      /admin/customers/:id/payments    Manager+,    Payment history for customer
                                                Accountant   

  **GET**      /admin/customers/:id/topups      Manager+,    Top-up history for customer
                                                Accountant   

  **GET**      /admin/customers/:id/statement   Manager+,    Full account statement (PDF
                                                Accountant   export)
  -----------------------------------------------------------------------------------------

**12.12 Orders**

  -----------------------------------------------------------------------------------------
  **Method**   **Endpoint**                     **Auth**     **Description**
  ------------ -------------------------------- ------------ ------------------------------
  **GET**      /admin/orders                    Manager+,    List orders --- filter:
                                                Cashier      status, customer, warehouse,
                                                             dateRange

  **POST**     /admin/orders                    Manager+,    Create new order (standard
                                                Cashier      mode)

  **GET**      /admin/orders/:id                Manager+,    Order detail with line items,
                                                Cashier      payments, status history

  **PUT**      /admin/orders/:id                Manager+,    Edit order (only
                                                Cashier      PLACED/PROCESSING status)

  **DELETE**   /admin/orders/:id                Admin,       Soft delete + ledger
                                                Manager      counter-entry

  **PUT**      /admin/orders/:id/status         Manager+     Update order status

  **POST**     /admin/orders/:id/payments       Manager+,    Record payment against order
                                                Cashier      

  **GET**      /admin/orders/:id/payments       Manager+,    List payments for order
                                                Cashier,     
                                                Accountant   

  **POST**     /admin/orders/:id/returns        Admin,       Initiate return
                                                Manager      

  **GET**      /admin/orders/:id/returns        Manager+     List returns for order

  **GET**      /admin/orders/:id/invoice        Manager+,    Download/view invoice PDF
                                                Cashier      

  **POST**     /admin/orders/pos                Manager+,    Quick POS order creation
                                                Cashier      (barcode scan optimised)

  **GET**      /admin/orders/:id/edit-history   Admin,       View edit audit trail
                                                Manager,     
                                                Accountant   
  -----------------------------------------------------------------------------------------

**12.13 Suppliers**

  -----------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                           **Auth**     **Description**
  ------------ -------------------------------------- ------------ ------------------------------
  **GET**      /admin/suppliers                       Manager+,    List suppliers
                                                      Accountant   

  **POST**     /admin/suppliers                       Admin,       Create supplier
                                                      Manager      

  **GET**      /admin/suppliers/:id                   Manager+     Supplier detail with balance
                                                                   summary

  **PUT**      /admin/suppliers/:id                   Admin,       Update supplier
                                                      Manager      

  **DELETE**   /admin/suppliers/:id                   Admin        Soft delete supplier

  **GET**      /admin/suppliers/:id/ledger            Manager+,    Full supplier ledger with
                                                      Accountant   running balance

  **GET**      /admin/suppliers/:id/balance           Manager+,    Current balance summary
                                                      Accountant   

  **POST**     /admin/suppliers/:id/payments          Admin,       Record payment to supplier
                                                      Manager,     
                                                      Accountant   

  **POST**     /admin/suppliers/:id/adjust            Admin,       Manual debit/credit adjustment
                                                      Manager      on supplier

  **GET**      /admin/suppliers/:id/purchase-orders   Manager+     PO history for supplier

  **GET**      /admin/suppliers/:id/statement         Manager+,    Supplier account statement
                                                      Accountant   (PDF export)
  -----------------------------------------------------------------------------------------------

**12.14 Purchase Orders**

  ---------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                          **Auth**    **Description**
  ------------ ------------------------------------- ----------- ------------------------------
  **GET**      /admin/purchase-orders                Manager+,   List POs --- filter: status,
                                                     WH Staff    supplier, warehouse, dateRange

  **POST**     /admin/purchase-orders                Admin,      Create new purchase order
                                                     Manager     

  **GET**      /admin/purchase-orders/:id            Manager+,   PO detail with items and GRNs
                                                     WH Staff    

  **PUT**      /admin/purchase-orders/:id            Admin,      Edit PO (only draft/ordered
                                                     Manager     status)

  **DELETE**   /admin/purchase-orders/:id            Admin       Soft delete PO

  **PUT**      /admin/purchase-orders/:id/status     Admin,      Update PO status
                                                     Manager     

  **POST**     /admin/purchase-orders/:id/payments   Admin,      Record payment to supplier for
                                                     Manager     PO

  **POST**     /admin/grns                           Manager+,   Create GRN against PO ---
                                                     WH Staff    triggers stock + ledger on
                                                                 approval

  **GET**      /admin/grns                           Manager+,   List all GRNs
                                                     WH Staff    

  **GET**      /admin/grns/:id                       Manager+,   GRN detail
                                                     WH Staff    

  **PUT**      /admin/grns/:id/approve               Admin,      Approve GRN --- triggers
                                                     Manager     stock_movements + supplier
                                                                 ledger

  **POST**     /admin/purchase-returns               Admin,      Create purchase return
                                                     Manager     

  **GET**      /admin/purchase-returns               Manager+    List purchase returns

  **PUT**      /admin/purchase-returns/:id/approve   Admin,      Approve return --- adjusts
                                                     Manager     stock + supplier ledger
  ---------------------------------------------------------------------------------------------

**12.15 Coupons**

  ---------------------------------------------------------------------------------
  **Method**   **Endpoint**              **Auth**    **Description**
  ------------ ------------------------- ----------- ------------------------------
  **GET**      /admin/coupons            Admin,      List all coupons
                                         Manager     

  **POST**     /admin/coupons            Admin,      Create coupon
                                         Manager     

  **GET**      /admin/coupons/:id        Admin,      Coupon detail with usage stats
                                         Manager     

  **PUT**      /admin/coupons/:id        Admin,      Update coupon
                                         Manager     

  **DELETE**   /admin/coupons/:id        Admin,      Soft delete coupon
                                         Manager     

  **POST**     /admin/coupons/validate   Manager+,   Validate coupon code against
                                         Cashier     order value
  ---------------------------------------------------------------------------------

**12.16 Pricing**

  ----------------------------------------------------------------------------------------
  **Method**   **Endpoint**                     **Auth**    **Description**
  ------------ -------------------------------- ----------- ------------------------------
  **GET**      /admin/pricing/tier-prices       Admin,      List all tier prices
                                                Manager     

  **POST**     /admin/pricing/tier-prices       Admin,      Set tier price for a product
                                                Manager     

  **PUT**      /admin/pricing/tier-prices/:id   Admin,      Update tier price
                                                Manager     

  **DELETE**   /admin/pricing/tier-prices/:id   Admin,      Remove tier price
                                                Manager     

  **POST**     /admin/pricing/resolve           Manager+,   Resolve effective price: {
                                                Cashier     productId, warehouseId,
                                                            customerId, qty }
  ----------------------------------------------------------------------------------------

**12.17 Reports**

  ------------------------------------------------------------------------------------------------
  **Method**   **Endpoint**                           **Auth**      **Description**
  ------------ -------------------------------------- ------------- ------------------------------
  **GET**      /admin/reports/sales                   Admin,        Sales summary --- filter:
                                                      Manager,      dateRange, warehouse, product,
                                                      Accountant    category

  **GET**      /admin/reports/sales/daily             Admin,        Daily sales breakdown
                                                      Manager,      
                                                      Accountant    

  **GET**      /admin/reports/sales/by-product        Admin,        Sales grouped by product
                                                      Manager,      
                                                      Accountant    

  **GET**      /admin/reports/sales/by-category       Admin,        Sales grouped by category
                                                      Manager,      
                                                      Accountant    

  **GET**      /admin/reports/stock                   Admin,        Current stock across all
                                                      Manager,      warehouses
                                                      Accountant,   
                                                      WH Staff      

  **GET**      /admin/reports/stock/movement          Admin,        Stock movement report ---
                                                      Manager,      filter: product, warehouse,
                                                      Accountant,   type, dateRange
                                                      WH Staff      

  **GET**      /admin/reports/stock/valuation         Admin,        Stock value at cost price per
                                                      Manager,      warehouse
                                                      Accountant    

  **GET**      /admin/reports/stock/low-stock         Admin,        Products below threshold
                                                      Manager, WH   
                                                      Staff         

  **GET**      /admin/reports/pnl                     Admin,        P&L: Revenue - COGS - Returns
                                                      Manager,      = Gross Profit
                                                      Accountant    

  **GET**      /admin/reports/customers/outstanding   Admin,        Customer outstanding balances
                                                      Manager,      
                                                      Accountant    

  **GET**      /admin/reports/customers/aging         Admin,        Aging buckets: 0-30, 31-60,
                                                      Manager,      61-90, 90+ days
                                                      Accountant    

  **GET**      /admin/reports/suppliers/outstanding   Admin,        Supplier outstanding balances
                                                      Manager,      
                                                      Accountant    

  **GET**      /admin/reports/suppliers/aging         Admin,        Supplier aging report
                                                      Manager,      
                                                      Accountant    

  **GET**      /admin/reports/purchases               Admin,        Purchase summary by
                                                      Manager,      supplier/product
                                                      Accountant    
  ------------------------------------------------------------------------------------------------

**12.18 Notifications**

  --------------------------------------------------------------------------------------
  **Method**   **Endpoint**                    **Auth**   **Description**
  ------------ ------------------------------- ---------- ------------------------------
  **GET**      /admin/notifications            Admin+     List in-app notifications for
                                                          current user

  **PUT**      /admin/notifications/:id/read   Admin+     Mark notification as read

  **PUT**      /admin/notifications/read-all   Admin+     Mark all as read

  **GET**      /admin/notifications/settings   Admin      Get notification settings

  **PUT**      /admin/notifications/settings   Admin      Update notification settings
                                                          (email/SMS toggles)
  --------------------------------------------------------------------------------------

**13. Key Implementation Rules**

**13.1 Soft Delete**

All deletes set deletedAt to current timestamp. A global Mongoose plugin
filters { deletedAt: null } on all queries automatically. No record is
ever permanently removed.

**13.2 Ledger Immutability**

No ledger record (customer_ledger, supplier_ledger) is ever updated or
deleted. Corrections are always counter-entries with an opposite
debit/credit. The running balance is always computed from the sequence
of entries. This is non-negotiable for audit compliance.

**13.3 MongoDB Transactions on All Stock Writes**

Any operation that modifies product_stocks.quantity or reservedQuantity
must use a MongoDB session transaction. This prevents race conditions in
concurrent order creation. Wrap: stock update + stock_movement insert +
ledger entry in one atomic transaction.

**13.4 Product Snapshot on Orders**

When creating order line items, always snapshot: name, SKU,
barcodeValue, unitName, taxSlab (name + rate), unitPrice. Historical
orders must remain accurate regardless of future product edits or
deletions.

**13.5 Price Resolution Service**

Implement a PriceResolver service that: (1) checks customer_tier_prices
for customer.tier, (2) checks product_stocks.warehousePrice, (3) checks
products.basePrice on SKU, (4) falls back to parentProduct.basePrice.
First non-null result at each tier wins.

**13.6 Stock Movement on Every Change**

Every stock change must produce a stock_movements entry. The
quantityBefore → quantityChange → quantityAfter pattern allows complete
reconstruction of stock history at any point in time.

**13.7 Balance Update Atomicity**

When writing a ledger entry (customer or supplier), always: (1) read the
last ledger entry\'s balanceAfter, (2) compute new balanceAfter =
last.balanceAfter +/- delta, (3) insert ledger entry, (4) update
customer.currentBalance --- all within a MongoDB transaction.

**13.8 JWT Strategy**

  --------------------- -------------------------------------------------
  **Admin JWT**         { userId, orgId, role, iat, exp } --- 8h expiry.
                        Org DB resolved from orgId.

  **Customer JWT**      { customerId, orgId, role: \'customer\', iat, exp
                        } --- 7d expiry for portal sessions.

  **Super Admin JWT**   { adminId, role: \'superadmin\', iat, exp } ---
                        routes to superadmin_db, no orgId.
  --------------------- -------------------------------------------------

*End of Specification --- v2.0*
