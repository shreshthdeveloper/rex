import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

import SuperAdminLogin from './pages/auth/SuperAdminLogin';
import AdminLogin from './pages/auth/AdminLogin';
import AdminLayout from './layouts/AdminLayout';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import StoreLayout from './layouts/StoreLayout';
import CustomerAuth from './pages/auth/CustomerAuth';

function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-violet-500" />
      </div>
    );
  }
  // Customer should never access admin/superadmin
  if (role === 'customer' && (requiredRole === 'admin' || requiredRole === 'superadmin')) {
    const slug = localStorage.getItem('storeSlug') || '';
    return <Navigate to={slug ? `/store/${slug}` : '/'} replace />;
  }
  if (!isAuthenticated || (requiredRole && role !== requiredRole)) {
    if (requiredRole === 'superadmin') return <Navigate to="/superadmin/login" replace />;
    if (requiredRole === 'admin') return <Navigate to="/admin/login" replace />;
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/superadmin/login" element={<SuperAdminLogin />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/store/:orgSlug/auth" element={<CustomerAuth />} />

      {/* SuperAdmin */}
      <Route
        path="/superadmin/*"
        element={
          <ProtectedRoute requiredRole="superadmin">
            <SuperAdminLayout />
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      />

      {/* Store (public) */}
      <Route path="/store/:orgSlug/*" element={<StoreLayout />} />

      {/* Defaults */}
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}
