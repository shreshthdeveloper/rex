import { createContext, useContext, useState, useEffect } from 'react';
import { Routes, Route, Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { storeAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Loader2, Store, User, Menu, X, ChevronRight, Search,
  ShoppingBag, Heart, Sparkles,
} from 'lucide-react';
import Home from '../pages/store/Home';
import ProductView from '../pages/store/ProductView';
import Portal from '../pages/store/Portal';

/* ═══════════════════════════════════════════════════
   Store Settings Context
   ═══════════════════════════════════════════════════ */
const StoreContext = createContext({ settings: null, settingsLoading: true });
export const useStoreSettings = () => useContext(StoreContext);

/* ═══════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════ */
function NavLink({ to, label, active, primary }) {
  return (
    <Link
      to={to}
      className="relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200"
      style={
        active
          ? { color: primary, background: `${primary}18` }
          : { color: '#94a3b8' }
      }
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#f1f5f9'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#94a3b8'; }}
    >
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
          style={{ background: primary }}
        />
      )}
    </Link>
  );
}

function MobileNavLink({ to, label, icon: Icon, onClick, primary, active }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-all"
      style={active ? { color: primary, background: `${primary}15` } : { color: '#94a3b8' }}
    >
      {Icon && <Icon size={16} />}
      {label}
      <ChevronRight size={14} className="ml-auto opacity-40" />
    </Link>
  );
}

/* ═══════════════════════════════════════════════════
   StoreLayout
   ═══════════════════════════════════════════════════ */
export default function StoreLayout() {
  const { orgSlug } = useParams();
  const { isAuthenticated, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isCustomer = isAuthenticated && role === 'customer';

  /* ── Settings ── */
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await storeAPI.settings(orgSlug);
        setSettings(res.data || {});
      } catch {
        setSettings({});
      } finally {
        setSettingsLoading(false);
      }
    })();
  }, [orgSlug]);

  /* ── Mobile menu ── */
  const [mobileOpen, setMobileOpen] = useState(false);

  if (settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="animate-spin text-violet-600" />
          <p className="text-sm text-gray-500">Loading store…</p>
        </div>
      </div>
    );
  }

  const primary = settings?.primaryColor || '#06b6d4';
  const storeName = settings?.storeName || orgSlug;
  const logoUrl = settings?.logo;

  const isHome = location.pathname === `/store/${orgSlug}` || location.pathname === `/store/${orgSlug}/`;
  const isPortal = location.pathname.startsWith(`/store/${orgSlug}/portal`);

  return (
    <StoreContext.Provider value={{ settings, settingsLoading }}>
      <div className="min-h-screen flex flex-col bg-white">

        {/* ════════════════════ HEADER ════════════════════ */}
        <header
          className="sticky top-0 z-50 backdrop-blur-xl border-b bg-white/80 border-violet-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">

            {/* Logo */}
            <Link
              to={`/store/${orgSlug}`}
              className="flex items-center gap-3 shrink-0 group"
            >
              {logoUrl ? (
                <img src={logoUrl} alt={storeName} className="h-9 w-auto object-contain" />
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: `${primary}20`, border: `1px solid ${primary}40` }}
                >
                  <Store size={18} style={{ color: primary }} />
                </div>
              )}
              <span className="font-bold text-lg text-slate-800 hidden sm:block tracking-tight">
                {storeName}
              </span>
            </Link>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink
                to={`/store/${orgSlug}`}
                label="Shop"
                active={isHome}
                primary={primary}
              />
              {isCustomer && (
                <NavLink
                  to={`/store/${orgSlug}/portal`}
                  label="My Account"
                  active={isPortal}
                  primary={primary}
                />
              )}
            </nav>

            {/* Auth CTA */}
            <div className="hidden md:flex items-center gap-2 ml-2">
              {isCustomer ? (
                <>
                  <Link
                    to={`/store/${orgSlug}/portal`}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-slate-800 border transition-all"
                    style={{ borderColor: `${primary}40`, background: `${primary}10` }}
                  >
                    <User size={15} style={{ color: primary }} />
                    <span>Account</span>
                  </Link>
                  <button
                    onClick={() => { logout(); navigate(`/store/${orgSlug}/auth`); }}
                    className="px-3 py-2 text-xs text-gray-500 hover:text-slate-600 transition-colors rounded-lg hover:bg-violet-50"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  to={`/store/${orgSlug}/auth`}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-slate-800 transition-all hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${primary}bb)` }}
                >
                  <User size={15} />
                  Sign In
                </Link>
              )}
            </div>

            {/* Mobile Hamburger */}
            <button
              className="md:hidden p-2 ml-2 text-slate-500 hover:text-slate-800 transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {/* Mobile Drawer */}
          {mobileOpen && (
            <div
              className="md:hidden border-t border-violet-100 px-4 py-4 space-y-1 bg-white"
            >
              <MobileNavLink
                to={`/store/${orgSlug}`}
                label="Shop"
                icon={ShoppingBag}
                active={isHome}
                primary={primary}
                onClick={() => setMobileOpen(false)}
              />
              {isCustomer ? (
                <>
                  <MobileNavLink
                    to={`/store/${orgSlug}/portal`}
                    label="My Account"
                    icon={User}
                    active={isPortal}
                    primary={primary}
                    onClick={() => setMobileOpen(false)}
                  />
                  <button
                    onClick={() => { logout(); navigate(`/store/${orgSlug}/auth`); setMobileOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <X size={16} /> Sign out
                  </button>
                </>
              ) : (
                <MobileNavLink
                  to={`/store/${orgSlug}/auth`}
                  label="Sign In"
                  icon={User}
                  active={false}
                  primary={primary}
                  onClick={() => setMobileOpen(false)}
                />
              )}
            </div>
          )}
        </header>

        {/* ════════════════════ MAIN CONTENT ════════════════════ */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
          <Routes>
            <Route index element={<Home />} />
            <Route path="products/:productId" element={<ProductView />} />
            <Route path="portal" element={<Portal />} />
            <Route path="portal/:tab" element={<Portal />} />
          </Routes>
        </main>

        {/* ════════════════════ FOOTER ════════════════════ */}
        <footer
          className="border-t border-violet-100 mt-16 bg-violet-50/30"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* Branding */}
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${primary}15`, border: `1px solid ${primary}30` }}
                >
                  <Store size={15} style={{ color: primary }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{storeName}</p>
                  <p className="text-[11px] text-gray-600">
                    {settings?.footerText || `© ${new Date().getFullYear()} All rights reserved`}
                  </p>
                </div>
              </div>

              {/* Links */}
              <div className="flex items-center gap-6 text-xs text-gray-600">
                <Link
                  to={`/store/${orgSlug}`}
                  className="hover:text-slate-500 transition-colors"
                >
                  Shop
                </Link>
                <Link
                  to={`/store/${orgSlug}/auth`}
                  className="hover:text-slate-500 transition-colors"
                >
                  {isCustomer ? 'My Account' : 'Sign In'}
                </Link>
              </div>

              {/* Badge */}
              <div className="flex items-center gap-1.5 text-[11px] text-gray-700">
                <Sparkles size={11} className="text-amber-600" />
                Powered by Rex
              </div>
            </div>
          </div>
        </footer>

      </div>
    </StoreContext.Provider>
  );
}
