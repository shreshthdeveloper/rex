import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Organizations from '../pages/superadmin/Organizations';
import { Building2, LogOut } from 'lucide-react';

export default function SuperAdminLayout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="glass-sidebar !border-r-0 border-b border-violet-100 h-14 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Super Admin Console</h1>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <Organizations />
      </main>
    </div>
  );
}
