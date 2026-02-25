import { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('ecom_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.getProfile()
        .then((res) => setUser(res.data))
        .catch(() => { localStorage.removeItem('ecom_token'); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const loginUser = async (email, password) => {
    const res = await api.login({ email, password });
    const { token: t, customer } = res.data;
    localStorage.setItem('ecom_token', t);
    setToken(t);
    setUser(customer);
    return customer;
  };

  const registerUser = async (data) => {
    const res = await api.register(data);
    const { token: t, customer } = res.data;
    localStorage.setItem('ecom_token', t);
    setToken(t);
    setUser(customer);
    return customer;
  };

  const logout = () => {
    localStorage.removeItem('ecom_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginUser, registerUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
