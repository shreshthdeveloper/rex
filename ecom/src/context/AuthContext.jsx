import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { customerService } from '../services/customerService';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ecom_customer')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('ecom_token'));

  const isAuthenticated = !!token && !!customer;

  const login = useCallback(async ({ email, password }) => {
    const data = await customerService.login({ email, password });
    localStorage.setItem('ecom_token', data.token);
    localStorage.setItem('ecom_customer', JSON.stringify(data.customer));
    setToken(data.token);
    setCustomer(data.customer);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await customerService.register(payload);
    localStorage.setItem('ecom_token', data.token);
    localStorage.setItem('ecom_customer', JSON.stringify(data.customer));
    setToken(data.token);
    setCustomer(data.customer);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ecom_token');
    localStorage.removeItem('ecom_customer');
    setToken(null);
    setCustomer(null);
  }, []);

  // Listen for forced logout from API interceptor
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ customer, token, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
