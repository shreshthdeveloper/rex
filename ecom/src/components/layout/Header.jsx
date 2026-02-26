import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Heart, User, LogIn, Sun, Moon, Menu, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { catalogService } from '../../services/catalogService';

export default function Header() {
  const { isAuthenticated, customer, logout } = useAuth();
  const { totalItems } = useCart();
  const { count: wishCount } = useWishlist();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [settings, setSettings] = useState(null);
  const searchRef = useRef(null);
  const userRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    catalogService.getSettings().then(setSettings).catch(() => {});
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
  };

  const handleSearch = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (val.length < 2) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await catalogService.search({ q: val, limit: 6 });
        setResults(data?.products || []);
        setShowResults(true);
      } catch { setResults([]); }
    }, 300);
  };

  const doSearch = (e) => {
    e.preventDefault();
    if (query.trim()) { navigate(`/products?search=${encodeURIComponent(query.trim())}`); setShowResults(false); }
  };

  return (
    <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)' }}>
      {/* Top bar */}
      <div className="container-main flex items-center justify-between h-16 gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          {settings?.logo && <img src={settings.logo} alt={settings?.storeName || 'Store'} className="h-8 w-auto object-contain" />}
          <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-content)' }}>{settings?.storeName || 'Store'}</span>
        </Link>

        {/* Search */}
        <div ref={searchRef} className="relative flex-1 max-w-xl hidden md:block">
          <form onSubmit={doSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-content-tertiary)' }} />
            <input
              type="text"
              value={query}
              onChange={handleSearch}
              placeholder="Search for products..."
              className="input-field pl-10 pr-4"
            />
          </form>
          {showResults && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border overflow-hidden z-50" style={{ backgroundColor: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)' }}>
              {results.map((p) => (
                <button
                  key={p._id}
                  onClick={() => { navigate(`/products/${p.slug}`); setShowResults(false); setQuery(''); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-surface-tertiary)]"
                >
                  {p.images?.[0]?.url ? (
                    <img src={p.images[0].url} alt="" className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-[var(--color-surface-tertiary)]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="line-clamp-1" style={{ color: 'var(--color-content)' }}>{p.name}</div>
                    <div className="text-xs" style={{ color: 'var(--color-content-tertiary)' }}>{p.sku}</div>
                  </div>
                </button>
              ))}
              <button
                onClick={doSearch}
                className="w-full px-4 py-2 text-xs text-center font-medium hover:bg-[var(--color-surface-tertiary)]"
                style={{ color: 'var(--color-brand)' }}
              >
                View all results
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link to="/products" className="btn btn-ghost btn-sm hidden sm:inline-flex">Products</Link>

          {/* User menu */}
          <div ref={userRef} className="relative">
            {isAuthenticated ? (
              <>
                <button onClick={() => setUserMenu(!userMenu)} className="btn btn-ghost btn-sm gap-1">
                  <User className="w-4 h-4" />
                  <span className="hidden lg:inline">My Account</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {userMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border py-1 z-50" style={{ backgroundColor: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)' }}>
                    <Link to="/account" onClick={() => setUserMenu(false)} className="block px-4 py-2 text-sm hover:bg-[var(--color-surface-tertiary)]">My Account</Link>
                    <Link to="/account?tab=orders" onClick={() => setUserMenu(false)} className="block px-4 py-2 text-sm hover:bg-[var(--color-surface-tertiary)]">Orders</Link>
                    <div className="divider my-1" />
                    <button onClick={() => { logout(); setUserMenu(false); navigate('/'); }} className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-surface-tertiary)]" style={{ color: 'var(--color-status-error)' }}>Logout</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <button onClick={() => setUserMenu(!userMenu)} className="btn btn-ghost btn-sm gap-1">
                  <LogIn className="w-4 h-4" />
                  <span className="hidden lg:inline">Login</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {userMenu && (
                  <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border py-1 z-50" style={{ backgroundColor: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)' }}>
                    <Link to="/login" onClick={() => setUserMenu(false)} className="block px-4 py-2 text-sm hover:bg-[var(--color-surface-tertiary)]">Login</Link>
                    <Link to="/register" onClick={() => setUserMenu(false)} className="block px-4 py-2 text-sm hover:bg-[var(--color-surface-tertiary)]">Register</Link>
                  </div>
                )}
              </>
            )}
          </div>

          <Link to="/wishlist" className="btn btn-ghost btn-sm relative">
            <Heart className="w-4 h-4" />
            {wishCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: 'var(--color-brand)' }}>{wishCount}</span>}
          </Link>

          <Link to="/cart" className="btn btn-ghost btn-sm relative">
            <ShoppingCart className="w-4 h-4" />
            {totalItems > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: 'var(--color-brand)' }}>{totalItems}</span>}
          </Link>

          <button onClick={toggleTheme} className="btn btn-ghost btn-sm">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button onClick={() => setMobileMenu(!mobileMenu)} className="btn btn-ghost btn-sm md:hidden">
            {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenu && (
        <div className="md:hidden border-t px-4 pb-4 pt-2" style={{ borderColor: 'var(--color-border)' }}>
          <form onSubmit={(e) => { doSearch(e); setMobileMenu(false); }} className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-content-tertiary)' }} />
            <input type="text" value={query} onChange={handleSearch} placeholder="Search..." className="input-field pl-10" />
          </form>
          <nav className="flex flex-col gap-1">
            <Link to="/products" onClick={() => setMobileMenu(false)} className="px-3 py-2 rounded-lg text-sm hover:bg-[var(--color-surface-tertiary)]">All Products</Link>
            <Link to="/wishlist" onClick={() => setMobileMenu(false)} className="px-3 py-2 rounded-lg text-sm hover:bg-[var(--color-surface-tertiary)]">Wishlist ({wishCount})</Link>
            <Link to="/cart" onClick={() => setMobileMenu(false)} className="px-3 py-2 rounded-lg text-sm hover:bg-[var(--color-surface-tertiary)]">Cart ({totalItems})</Link>
            {isAuthenticated ? (
              <>
                <Link to="/account" onClick={() => setMobileMenu(false)} className="px-3 py-2 rounded-lg text-sm hover:bg-[var(--color-surface-tertiary)]">My Account</Link>
                <button onClick={() => { logout(); setMobileMenu(false); }} className="px-3 py-2 rounded-lg text-sm text-left" style={{ color: 'var(--color-status-error)' }}>Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileMenu(false)} className="px-3 py-2 rounded-lg text-sm hover:bg-[var(--color-surface-tertiary)]">Login</Link>
                <Link to="/register" onClick={() => setMobileMenu(false)} className="px-3 py-2 rounded-lg text-sm hover:bg-[var(--color-surface-tertiary)]">Register</Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
