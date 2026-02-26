import axios from 'axios';

const api = axios.create({ baseURL: '/' });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ecom_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap API response or throw
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message || err.message;
    if (err.response?.status === 401) {
      // Only clear token on portal (auth-required) endpoints, not public ones
      const url = err.config?.url || '';
      if (url.includes('/portal/')) {
        localStorage.removeItem('ecom_token');
        localStorage.removeItem('ecom_customer');
        window.dispatchEvent(new Event('auth:logout'));
      }
    }
    return Promise.reject(new Error(msg));
  },
);

export default api;
