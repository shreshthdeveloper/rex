import api from './api';
import { API_BASE } from '../config/constants';

const d = (r) => r.data?.data;

export const catalogService = {
  getSettings:    ()            => api.get(`${API_BASE}/settings`).then(d),
  getCategories:  ()            => api.get(`${API_BASE}/categories`).then(d),
  getBrands:      ()            => api.get(`${API_BASE}/brands`).then(d),
  getProducts:    (params = {}) => api.get(`${API_BASE}/products`, { params }).then(d),
  getFeatured:    ()            => api.get(`${API_BASE}/products/featured`).then(d),
  getNewArrivals: (limit = 12)  => api.get(`${API_BASE}/products/new-arrivals`, { params: { limit } }).then(d),
  search:         (params = {}) => api.get(`${API_BASE}/products/search`, { params }).then(d),
  getProductBySlug: (slug)      => api.get(`${API_BASE}/products/slug/${slug}`).then(d),
  getProductById:   (id)        => api.get(`${API_BASE}/products/${id}`).then(d),
  getWarehouses:  ()            => api.get(`${API_BASE}/warehouses`).then(d),
  submitContactQuery: (payload) => api.post(`${API_BASE}/contact-query`, payload).then(d),
};
