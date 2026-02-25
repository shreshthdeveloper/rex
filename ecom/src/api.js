import axios from 'axios';

// Org slug — reads from env or defaults to 'demo-store'
const ORG = import.meta.env.VITE_ORG_SLUG || 'demo-store';
const BASE = `/api/store/${ORG}`;

const api = axios.create({ baseURL: BASE });

// Attach auth token when available
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('ecom_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Unwrap { data: { statusCode, data, message } }
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.message || err.message || 'Something went wrong';
    return Promise.reject(new Error(msg));
  }
);

// ─── Public Catalog ───
export const getSettings = () => api.get('/settings');
export const getCategories = () => api.get('/categories');
export const getProducts = (params) => api.get('/products', { params });
export const getFeatured = () => api.get('/products/featured');
export const searchProducts = (params) => api.get('/products/search', { params });
export const getProductBySlug = (slug) => api.get(`/products/slug/${slug}`);
export const getProductById = (id) => api.get(`/products/${id}`);

// ─── Auth ───
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);

// ─── Profile ───
export const getProfile = () => api.get('/portal/profile');
export const updateProfile = (data) => api.put('/portal/profile', data);
export const changePassword = (data) => api.put('/portal/change-password', data);

// ─── Orders ───
export const getMyOrders = (params) => api.get('/portal/orders', { params });
export const getMyOrder = (id) => api.get(`/portal/orders/${id}`);
export const placeOrder = (data) => api.post('/portal/orders', data);
export const cancelOrder = (id) => api.patch(`/portal/orders/${id}/cancel`);

// ─── Financial ───
export const getMyLedger = (params) => api.get('/portal/ledger', { params });
export const getMyBalance = () => api.get('/portal/balance');
export const getMyPayments = (params) => api.get('/portal/payments', { params });

export default api;
