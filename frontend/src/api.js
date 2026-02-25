import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor – attach token
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('superadminToken') ||
    localStorage.getItem('adminToken') ||
    localStorage.getItem('customerToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor – unwrap data / handle 401
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('superadminToken');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('customerToken');
      // Don't redirect automatically; let the auth context handle it
    }
    return Promise.reject(err.response?.data || err);
  }
);

/* ─── Helper to set auth header for specific role ─── */
const withToken = (tokenKey) => ({
  headers: { Authorization: `Bearer ${localStorage.getItem(tokenKey)}` },
});

/* ═══════════════════════════════════════════════════
   SUPER ADMIN
   ═══════════════════════════════════════════════════ */
export const superadminAPI = {
  login: (data) => api.post('/superadmin/login', data),
  listOrgs: () => api.get('/superadmin/organizations', withToken('superadminToken')),
  createOrg: (data) => api.post('/superadmin/organizations', data, withToken('superadminToken')),
  getOrg: (id) => api.get(`/superadmin/organizations/${id}`, withToken('superadminToken')),
  updateOrg: (id, data) => api.put(`/superadmin/organizations/${id}`, data, withToken('superadminToken')),
  deleteOrg: (id) => api.delete(`/superadmin/organizations/${id}`, withToken('superadminToken')),
  createOrgAdmin: (orgId, data) => api.post(`/superadmin/organizations/${orgId}/admins`, data, withToken('superadminToken')),
  listOrgAdmins: (orgId) => api.get(`/superadmin/organizations/${orgId}/admins`, withToken('superadminToken')),
};

/* ═══════════════════════════════════════════════════
   ADMIN AUTH
   ═══════════════════════════════════════════════════ */
export const authAPI = {
  login: (data) => api.post('/admin/auth/login', data),
  me: () => api.get('/admin/auth/me', withToken('adminToken')),
  changePassword: (data) => api.post('/admin/auth/change-password', data, withToken('adminToken')),
};

/* ═══════════════════════════════════════════════════
   ADMIN CRUD MODULES
   ═══════════════════════════════════════════════════ */
const adminCrud = (base) => ({
  list: (params) => api.get(`/admin/${base}`, { ...withToken('adminToken'), params }),
  create: (data) => api.post(`/admin/${base}`, data, withToken('adminToken')),
  get: (id) => api.get(`/admin/${base}/${id}`, withToken('adminToken')),
  update: (id, data) => api.put(`/admin/${base}/${id}`, data, withToken('adminToken')),
  delete: (id) => api.delete(`/admin/${base}/${id}`, withToken('adminToken')),
});

export const usersAPI = {
  ...adminCrud('users'),
  toggleActive: (id) => api.patch(`/admin/users/${id}/toggle-active`, {}, withToken('adminToken')),
};

export const categoriesAPI = {
  ...adminCrud('categories'),
  reorder: (data) => api.patch('/admin/categories/reorder', data, withToken('adminToken')),
};

export const unitsAPI = adminCrud('units');
export const barcodeTypesAPI = adminCrud('barcode-types');
export const taxSlabsAPI = adminCrud('tax-slabs');
export const brandsAPI = adminCrud('brands');

export const warehousesAPI = {
  ...adminCrud('warehouses'),
  getStock: (id, params) => api.get(`/admin/warehouses/${id}/stock`, { ...withToken('adminToken'), params }),
  getMovements: (id, params) => api.get(`/admin/warehouses/${id}/movements`, { ...withToken('adminToken'), params }),
};

export const productsAPI = {
  ...adminCrud('products'),
  stockSummary: () => api.get('/admin/products/stock-summary', withToken('adminToken')),
  addVariant: (id, data) => api.post(`/admin/products/${id}/variants`, data, withToken('adminToken')),
  updateVariant: (id, vid, data) => api.put(`/admin/products/${id}/variants/${vid}`, data, withToken('adminToken')),
  deleteVariant: (id, vid) => api.delete(`/admin/products/${id}/variants/${vid}`, withToken('adminToken')),
  addImages: (id, data) => api.post(`/admin/products/${id}/images`, data, withToken('adminToken')),
  removeImage: (id, imageId) => api.delete(`/admin/products/${id}/images/${imageId}`, withToken('adminToken')),
  getStock: (id) => api.get(`/admin/products/${id}/stock`, withToken('adminToken')),
  getMovements: (id, params) => api.get(`/admin/products/${id}/movements`, { ...withToken('adminToken'), params }),
};

export const stockAPI = {
  list: (params) => api.get('/admin/stock', { ...withToken('adminToken'), params }),
  lowStock: (params) => api.get('/admin/stock/low', { ...withToken('adminToken'), params }),
  movements: (params) => api.get('/admin/stock/movements', { ...withToken('adminToken'), params }),
  productMovements: (productId, params) => api.get(`/admin/stock/movements/product/${productId}`, { ...withToken('adminToken'), params }),
  setOpening: (data) => api.post('/admin/stock/opening', data, withToken('adminToken')),
  bulkOpeningByWarehouse: (data) => api.post('/admin/stock/opening/bulk-by-warehouse', data, withToken('adminToken')),
  bulkCreateAdjustment: (data) => api.post('/admin/stock/adjustments/bulk', data, withToken('adminToken')),
  listAdjustments: (params) => api.get('/admin/stock/adjustments', { ...withToken('adminToken'), params }),
  getAdjustment: (id) => api.get(`/admin/stock/adjustments/${id}`, withToken('adminToken')),
  updateAdjustment: (id, data) => api.put(`/admin/stock/adjustments/${id}`, data, withToken('adminToken')),
  approveAdjustment: (id) => api.patch(`/admin/stock/adjustments/${id}/approve`, {}, withToken('adminToken')),
  cancelAdjustment: (id) => api.patch(`/admin/stock/adjustments/${id}/cancel`, {}, withToken('adminToken')),
  createTransfer: (data) => api.post('/admin/stock/transfers', data, withToken('adminToken')),
  updateTransfer: (id, data) => api.put(`/admin/stock/transfers/${id}`, data, withToken('adminToken')),
  listTransfers: (params) => api.get('/admin/stock/transfers', { ...withToken('adminToken'), params }),
  getTransfer: (id) => api.get(`/admin/stock/transfers/${id}`, withToken('adminToken')),
  completeTransfer: (id) => api.patch(`/admin/stock/transfers/${id}/complete`, {}, withToken('adminToken')),
  cancelTransfer: (id) => api.patch(`/admin/stock/transfers/${id}/cancel`, {}, withToken('adminToken')),
};

export const customersAPI = {
  ...adminCrud('customers'),
  getLedger: (id, params) => api.get(`/admin/customers/${id}/ledger`, { ...withToken('adminToken'), params }),
  getBalance: (id) => api.get(`/admin/customers/${id}/balance`, withToken('adminToken')),
  topup: (id, data) => api.post(`/admin/customers/${id}/topup`, data, withToken('adminToken')),
  adjust: (id, data) => api.post(`/admin/customers/${id}/adjust`, data, withToken('adminToken')),
  getStatement: (id, params) => api.get(`/admin/customers/${id}/statement`, { ...withToken('adminToken'), params }),
  getOrders: (id, params) => api.get(`/admin/customers/${id}/orders`, { ...withToken('adminToken'), params }),
  getPayments: (id, params) => api.get(`/admin/customers/${id}/payments`, { ...withToken('adminToken'), params }),
  getTopups: (id, params) => api.get(`/admin/customers/${id}/topups`, { ...withToken('adminToken'), params }),
  reconcile: (id) => api.get(`/admin/customers/${id}/reconcile`, withToken('adminToken')),
};

export const ordersAPI = {
  ...adminCrud('orders'),
  updateStatus: (id, data) => api.patch(`/admin/orders/${id}/status`, data, withToken('adminToken')),
  recordPayment: (id, data) => api.post(`/admin/orders/${id}/payments`, data, withToken('adminToken')),
  listPayments: (id) => api.get(`/admin/orders/${id}/payments`, withToken('adminToken')),
  getInvoice: (id) => api.get(`/admin/orders/${id}/invoice`, withToken('adminToken')),
  getHistory: (id) => api.get(`/admin/orders/${id}/history`, withToken('adminToken')),
  initiateReturn: (id, data) => api.post(`/admin/orders/${id}/returns`, data, withToken('adminToken')),
  approveReturn: (orderId, returnId, refundMethod) => api.patch(`/admin/orders/${orderId}/returns/${returnId}/approve`, { refundMethod }, withToken('adminToken')),
  listReturns: (id) => api.get(`/admin/orders/${id}/returns`, withToken('adminToken')),
  posOrder: (data) => api.post('/admin/orders/pos', data, withToken('adminToken')),
};

export const suppliersAPI = {
  ...adminCrud('suppliers'),
  getLedger: (id, params) => api.get(`/admin/suppliers/${id}/ledger`, { ...withToken('adminToken'), params }),
  getBalance: (id) => api.get(`/admin/suppliers/${id}/balance`, withToken('adminToken')),
  recordPayment: (id, data) => api.post(`/admin/suppliers/${id}/payments`, data, withToken('adminToken')),
  adjust: (id, data) => api.post(`/admin/suppliers/${id}/adjust`, data, withToken('adminToken')),
  getPurchaseOrders: (id, params) => api.get(`/admin/suppliers/${id}/purchase-orders`, { ...withToken('adminToken'), params }),
  getStatement: (id, params) => api.get(`/admin/suppliers/${id}/statement`, { ...withToken('adminToken'), params }),
  reconcile: (id) => api.get(`/admin/suppliers/${id}/reconcile`, withToken('adminToken')),
};

export const purchaseOrdersAPI = {
  ...adminCrud('purchase-orders'),
  updateStatus: (id, data) => api.patch(`/admin/purchase-orders/${id}/status`, data, withToken('adminToken')),
  createGRN: (data) => api.post('/admin/purchase-orders/grn', data, withToken('adminToken')),
  listGRN: (params) => api.get('/admin/purchase-orders/grn/list', { ...withToken('adminToken'), params }),
  getGRN: (id) => api.get(`/admin/purchase-orders/grn/${id}`, withToken('adminToken')),
  approveGRN: (id) => api.patch(`/admin/purchase-orders/grn/${id}/approve`, {}, withToken('adminToken')),
  rejectGRN: (id) => api.patch(`/admin/purchase-orders/grn/${id}/reject`, {}, withToken('adminToken')),
  createReturn: (data) => api.post('/admin/purchase-orders/returns', data, withToken('adminToken')),
  listReturns: (params) => api.get('/admin/purchase-orders/returns/list', { ...withToken('adminToken'), params }),
  approveReturn: (returnId) => api.patch(`/admin/purchase-orders/returns/${returnId}/approve`, {}, withToken('adminToken')),
};

export const couponsAPI = {
  ...adminCrud('coupons'),
  validate: (data) => api.post('/admin/coupons/validate', data, withToken('adminToken')),
};

export const pricingAPI = {
  listTierPrices: (params) => api.get('/admin/pricing/tier-prices', { ...withToken('adminToken'), params }),
  createTierPrice: (data) => api.post('/admin/pricing/tier-prices', data, withToken('adminToken')),
  updateTierPrice: (id, data) => api.put(`/admin/pricing/tier-prices/${id}`, data, withToken('adminToken')),
  deleteTierPrice: (id) => api.delete(`/admin/pricing/tier-prices/${id}`, withToken('adminToken')),
  resolve: (data) => api.post('/admin/pricing/resolve', data, withToken('adminToken')),
};

export const reportsAPI = {
  dashboard: () => api.get('/admin/reports/dashboard', withToken('adminToken')),
  sales: (params) => api.get('/admin/reports/sales', { ...withToken('adminToken'), params }),
  stock: (params) => api.get('/admin/reports/stock', { ...withToken('adminToken'), params }),
  customerAging: (params) => api.get('/admin/reports/customer-aging', { ...withToken('adminToken'), params }),
  supplierAging: (params) => api.get('/admin/reports/supplier-aging', { ...withToken('adminToken'), params }),
  profitLoss: (params) => api.get('/admin/reports/profit-loss', { ...withToken('adminToken'), params }),
  cashFlow: (params) => api.get('/admin/reports/cash-flow', { ...withToken('adminToken'), params }),
  reconcileAll: (params) => api.get('/admin/reports/reconcile-all', { ...withToken('adminToken'), params }),
};

export const transactionLogAPI = {
  list: (params) => api.get('/admin/transaction-log', { ...withToken('adminToken'), params }),
  summary: (params) => api.get('/admin/transaction-log/summary', { ...withToken('adminToken'), params }),
};

export const notificationsAPI = {
  list: (params) => api.get('/admin/notifications', { ...withToken('adminToken'), params }),
  markRead: (id) => api.patch(`/admin/notifications/${id}/read`, {}, withToken('adminToken')),
  markAllRead: () => api.patch('/admin/notifications/read-all', {}, withToken('adminToken')),
  delete: (id) => api.delete(`/admin/notifications/${id}`, withToken('adminToken')),
};

export const ecomSettingsAPI = {
  get: () => api.get('/admin/ecom-settings', withToken('adminToken')),
  update: (data) => api.put('/admin/ecom-settings', data, withToken('adminToken')),
};

export const integrationsAPI = {
  list: () => api.get('/admin/integrations', withToken('adminToken')),
  get: (slug) => api.get(`/admin/integrations/${slug}`, withToken('adminToken')),
  upsert: (data) => api.put('/admin/integrations', data, withToken('adminToken')),
  toggle: (slug) => api.patch(`/admin/integrations/${slug}/toggle`, {}, withToken('adminToken')),
  delete: (slug) => api.delete(`/admin/integrations/${slug}`, withToken('adminToken')),
  sendToDispatch: (data) => api.post('/admin/integrations/dispatch/send', data, withToken('adminToken')),
};

export const uploadAPI = {
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/admin/upload', fd, {
      ...withToken('adminToken'),
      headers: { ...withToken('adminToken').headers, 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadMultiple: (files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('file', f));
    return api.post('/admin/upload/multiple', fd, {
      ...withToken('adminToken'),
      headers: { ...withToken('adminToken').headers, 'Content-Type': 'multipart/form-data' },
    });
  },
};

/* ═══════════════════════════════════════════════════
   STORE (PUBLIC + CUSTOMER PORTAL)
   ═══════════════════════════════════════════════════ */
const storeBase = (slug) => `/store/${slug}`;

export const storeAPI = {
  settings: (slug) => api.get(`${storeBase(slug)}/settings`),
  categories: (slug) => api.get(`${storeBase(slug)}/categories`),
  products: (slug, params) => api.get(`${storeBase(slug)}/products`, { params }),
  featured: (slug) => api.get(`${storeBase(slug)}/products/featured`),
  search: (slug, params) => api.get(`${storeBase(slug)}/products/search`, { params }),
  productBySlug: (slug, productSlug) => api.get(`${storeBase(slug)}/products/slug/${productSlug}`),
  productById: (slug, id) => api.get(`${storeBase(slug)}/products/${id}`),
};

export const customerAuthAPI = {
  register: (slug, data) => api.post(`${storeBase(slug)}/auth/register`, data),
  login: (slug, data) => api.post(`${storeBase(slug)}/auth/login`, data),
};

export const portalAPI = {
  getProfile: (slug) => api.get(`${storeBase(slug)}/portal/profile`, withToken('customerToken')),
  updateProfile: (slug, data) => api.put(`${storeBase(slug)}/portal/profile`, data, withToken('customerToken')),
  listOrders: (slug, params) => api.get(`${storeBase(slug)}/portal/orders`, { ...withToken('customerToken'), params }),
  getOrder: (slug, id) => api.get(`${storeBase(slug)}/portal/orders/${id}`, withToken('customerToken')),
  placeOrder: (slug, data) => api.post(`${storeBase(slug)}/portal/orders`, data, withToken('customerToken')),
  cancelOrder: (slug, id) => api.patch(`${storeBase(slug)}/portal/orders/${id}/cancel`, {}, withToken('customerToken')),
  getLedger: (slug, params) => api.get(`${storeBase(slug)}/portal/ledger`, { ...withToken('customerToken'), params }),
  getBalance: (slug) => api.get(`${storeBase(slug)}/portal/balance`, withToken('customerToken')),
  getPayments: (slug, params) => api.get(`${storeBase(slug)}/portal/payments`, { ...withToken('customerToken'), params }),
};

export default api;
