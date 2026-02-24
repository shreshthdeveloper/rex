const userSchema = require('./User');
const categorySchema = require('./Category');
const unitSchema = require('./Unit');
const barcodeTypeSchema = require('./BarcodeType');
const taxSlabSchema = require('./TaxSlab');
const warehouseSchema = require('./Warehouse');
const productSchema = require('./Product');
const productStockSchema = require('./ProductStock');
const stockMovementSchema = require('./StockMovement');
const stockTransferSchema = require('./StockTransfer');
const stockAdjustmentSchema = require('./StockAdjustment');
const customerTierPriceSchema = require('./CustomerTierPrice');
const customerSchema = require('./Customer');
const customerLedgerSchema = require('./CustomerLedger');
const customerTopupSchema = require('./CustomerTopup');
const orderSchema = require('./Order');
const orderPaymentSchema = require('./OrderPayment');
const orderReturnSchema = require('./OrderReturn');
const supplierSchema = require('./Supplier');
const supplierLedgerSchema = require('./SupplierLedger');
const supplierPaymentSchema = require('./SupplierPayment');
const supplierAdjustmentSchema = require('./SupplierAdjustment');
const purchaseOrderSchema = require('./PurchaseOrder');
const grnSchema = require('./GRN');
const purchaseReturnSchema = require('./PurchaseReturn');
const couponSchema = require('./Coupon');
const notificationSchema = require('./Notification');
const counterSchema = require('./Counter');
const ecomSettingsSchema = require('./EcomSettings');
const brandSchema = require('./Brand');

/**
 * Register all org-level models on a given connection.
 * Returns an object with all models.
 */
const registerOrgModels = (connection) => {
  const models = {};
  const register = (name, schema) => {
    if (!connection.models[name]) {
      connection.model(name, schema);
    }
    models[name] = connection.model(name);
  };

  register('User', userSchema);
  register('Brand', brandSchema);
  register('Category', categorySchema);
  register('Unit', unitSchema);
  register('BarcodeType', barcodeTypeSchema);
  register('TaxSlab', taxSlabSchema);
  register('Warehouse', warehouseSchema);
  register('Product', productSchema);
  register('ProductStock', productStockSchema);
  register('StockMovement', stockMovementSchema);
  register('StockTransfer', stockTransferSchema);
  register('StockAdjustment', stockAdjustmentSchema);
  register('CustomerTierPrice', customerTierPriceSchema);
  register('Customer', customerSchema);
  register('CustomerLedger', customerLedgerSchema);
  register('CustomerTopup', customerTopupSchema);
  register('Order', orderSchema);
  register('OrderPayment', orderPaymentSchema);
  register('OrderReturn', orderReturnSchema);
  register('Supplier', supplierSchema);
  register('SupplierLedger', supplierLedgerSchema);
  register('SupplierPayment', supplierPaymentSchema);
  register('SupplierAdjustment', supplierAdjustmentSchema);
  register('PurchaseOrder', purchaseOrderSchema);
  register('GRN', grnSchema);
  register('PurchaseReturn', purchaseReturnSchema);
  register('Coupon', couponSchema);
  register('Notification', notificationSchema);
  register('Counter', counterSchema);
  register('EcomSettings', ecomSettingsSchema);

  return models;
};

module.exports = { registerOrgModels };
