import api from './api';
import { API_BASE } from '../config/constants';

const d = (r) => r.data?.data;

export const customerService = {
  // Auth
  register:        (data)       => api.post(`${API_BASE}/auth/register`, data).then(d),
  login:           (data)       => api.post(`${API_BASE}/auth/login`, data).then(d),

  // Profile
  getProfile:      ()           => api.get(`${API_BASE}/portal/profile`).then(d),
  updateProfile:   (data)       => api.put(`${API_BASE}/portal/profile`, data).then(d),
  changePassword:  (data)       => api.put(`${API_BASE}/portal/change-password`, data).then(d),

  // Addresses
  listAddresses:   ()           => api.get(`${API_BASE}/portal/addresses`).then(d),
  addAddress:      (data)       => api.post(`${API_BASE}/portal/addresses`, data).then(d),
  updateAddress:   (id, data)   => api.put(`${API_BASE}/portal/addresses/${id}`, data).then(d),
  deleteAddress:   (id)         => api.delete(`${API_BASE}/portal/addresses/${id}`).then(d),

  // Orders
  getOrders:       (params = {}) => api.get(`${API_BASE}/portal/orders`, { params }).then(d),
  getOrder:        (id)          => api.get(`${API_BASE}/portal/orders/${id}`).then(d),
  placeOrder:      (data)        => api.post(`${API_BASE}/portal/orders`, data).then(d),
  cancelOrder:     (id, data)    => api.patch(`${API_BASE}/portal/orders/${id}/cancel`, data).then(d),

  // Returns
  initiateReturn:  (orderId, data) => api.post(`${API_BASE}/portal/orders/${orderId}/return`, data).then(d),
  getOrderReturns: (orderId)       => api.get(`${API_BASE}/portal/orders/${orderId}/returns`).then(d),
  getReturns:      (params = {})   => api.get(`${API_BASE}/portal/returns`, { params }).then(d),

  // Financial
  getLedger:       (params = {}) => api.get(`${API_BASE}/portal/ledger`, { params }).then(d),
  getBalance:      ()            => api.get(`${API_BASE}/portal/balance`).then(d),
  getPayments:     (params = {}) => api.get(`${API_BASE}/portal/payments`, { params }).then(d),
  getTopups:       (params = {}) => api.get(`${API_BASE}/portal/topups`, { params }).then(d),
  getStatement:    ()            => api.get(`${API_BASE}/portal/statement`).then(d),

  // Utilities
  validateCoupon:  (data)        => api.post(`${API_BASE}/portal/coupon/validate`, data).then(d),
  stockCheck:      (data)        => api.post(`${API_BASE}/portal/stock-check`, data).then(d),
};
