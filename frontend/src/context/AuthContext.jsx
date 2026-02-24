import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, superadminAPI, customerAuthAPI } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'superadmin' | 'admin' | 'customer'
  const [loading, setLoading] = useState(true);

  /* Restore session on mount */
  useEffect(() => {
    const restore = async () => {
      try {
        if (localStorage.getItem('superadminToken')) {
          setRole('superadmin');
          setUser({ role: 'superadmin' });
        } else if (localStorage.getItem('adminToken')) {
          const res = await authAPI.me();
          setUser(res.data);
          setRole('admin');
        } else if (localStorage.getItem('customerToken')) {
          setRole('customer');
          setUser({ role: 'customer' });
        }
      } catch {
        localStorage.removeItem('superadminToken');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('customerToken');
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const superadminLogin = useCallback(async (email, password) => {
    const res = await superadminAPI.login({ email, password });
    const token = res.data?.token;
    if (token) {
      localStorage.setItem('superadminToken', token);
      setUser({ role: 'superadmin', email });
      setRole('superadmin');
    }
    return res;
  }, []);

  const adminLogin = useCallback(async (email, password, orgSlug) => {
    const res = await authAPI.login({ email, password, orgSlug });
    const token = res.data?.token;
    if (token) {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminOrgSlug', orgSlug || '');
      const me = await authAPI.me();
      setUser(me.data);
      setRole('admin');
    }
    return res;
  }, []);

  const customerLogin = useCallback(async (slug, email, password) => {
    const res = await customerAuthAPI.login(slug, { email, password });
    const token = res.data?.token;
    if (token) {
      localStorage.setItem('customerToken', token);
      localStorage.setItem('storeSlug', slug);
      setUser({ role: 'customer', email });
      setRole('customer');
    }
    return res;
  }, []);

  const customerRegister = useCallback(async (slug, data) => {
    const res = await customerAuthAPI.register(slug, data);
    const token = res.data?.token;
    if (token) {
      localStorage.setItem('customerToken', token);
      localStorage.setItem('storeSlug', slug);
      setUser({ role: 'customer', email: data.email });
      setRole('customer');
    }
    return res;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('superadminToken');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('customerToken');
    localStorage.removeItem('storeSlug');
    setUser(null);
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, role, loading,
      superadminLogin, adminLogin, customerLogin, customerRegister,
      logout, isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
