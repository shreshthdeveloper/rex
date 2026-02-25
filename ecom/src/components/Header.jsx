import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, User, Menu, X, ChevronDown, LogOut, Package, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getCategories } from '../api';

export default function Header() {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hoveredCat, setHoveredCat] = useState(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    getCategories().then((r) => setCategories(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  // Top-level categories (those without children shown in nav bar)
  const topCats = categories.slice(0, 10);

  return (
    <header className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-md border-b border-gray-800">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        {/* Mobile menu */}
        <button className="lg:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-sm">S</div>
          <span className="text-lg font-bold hidden sm:block">STORE</span>
        </Link>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for products..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </form>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <Link to="/products" className="hidden sm:flex items-center gap-1 px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors">
            <Package size={18} />
            Products
          </Link>

          {/* wishlist placeholder */}
          <button className="p-2 text-gray-400 hover:text-white transition-colors relative">
            <Heart size={20} />
          </button>

          {/* Cart */}
          <Link to="/cart" className="p-2 text-gray-400 hover:text-white transition-colors relative">
            <ShoppingCart size={20} />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </Link>

          {/* User */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => user ? setUserMenuOpen(!userMenuOpen) : navigate('/login')}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <User size={18} />
              <span className="hidden sm:inline">{user ? 'My Account' : 'Login'}</span>
            </button>

            {userMenuOpen && user && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 z-50">
                <div className="px-4 py-2 border-b border-gray-800">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <Link to="/account" onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white">
                  <User size={14} /> My Account
                </Link>
                <Link to="/account?tab=orders" onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white">
                  <Package size={14} /> My Orders
                </Link>
                <button onClick={() => { logout(); setUserMenuOpen(false); navigate('/'); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-gray-800 w-full text-left">
                  <LogOut size={14} /> Logout
                </button>
              </div>
            )}

            {userMenuOpen && !user && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 z-50">
                <Link to="/login" onClick={() => setUserMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white">Login</Link>
                <Link to="/register" onClick={() => setUserMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white">Register</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category nav bar */}
      {topCats.length > 0 && (
        <nav className="border-t border-gray-800/50 bg-gray-950/80">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-0 overflow-x-auto no-scrollbar">
            {topCats.map((cat) => (
              <div
                key={cat._id}
                className="relative group"
                onMouseEnter={() => setHoveredCat(cat._id)}
                onMouseLeave={() => setHoveredCat(null)}
              >
                <Link
                  to={`/products?category=${cat._id}`}
                  className="flex items-center gap-1 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase text-gray-400 hover:text-white whitespace-nowrap transition-colors"
                >
                  {cat.name}
                  {cat.children?.length > 0 && <ChevronDown size={12} />}
                </Link>
                {/* Dropdown for subcategories */}
                {cat.children?.length > 0 && hoveredCat === cat._id && (
                  <div className="absolute top-full left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-2 min-w-[200px] z-50">
                    <div className="px-4 py-1 text-xs font-semibold tracking-wide uppercase text-gray-500">{cat.name}</div>
                    <div className="grid grid-cols-1 gap-0">
                      {cat.children.map((sub) => (
                        <Link
                          key={sub._id}
                          to={`/products?category=${sub._id}`}
                          className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                          onClick={() => setHoveredCat(null)}
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>
      )}

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setMobileOpen(false)}>
          <div className="w-72 h-full bg-gray-950 border-r border-gray-800 overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold text-lg">Menu</span>
              <button onClick={() => setMobileOpen(false)}><X size={20} /></button>
            </div>
            <Link to="/products" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-300 hover:text-white">All Products</Link>
            {categories.map((cat) => (
              <div key={cat._id}>
                <Link to={`/products?category=${cat._id}`} onClick={() => setMobileOpen(false)} className="block py-2 text-gray-300 hover:text-white text-sm">{cat.name}</Link>
                {cat.children?.map((sub) => (
                  <Link key={sub._id} to={`/products?category=${sub._id}`} onClick={() => setMobileOpen(false)}
                    className="block py-1.5 pl-4 text-gray-500 hover:text-white text-sm">{sub.name}</Link>
                ))}
              </div>
            ))}
            <hr className="my-4 border-gray-800" />
            {user ? (
              <>
                <Link to="/account" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-300 hover:text-white">My Account</Link>
                <button onClick={() => { logout(); setMobileOpen(false); navigate('/'); }} className="block py-2 text-red-400 hover:text-red-300">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-300 hover:text-white">Login</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-300 hover:text-white">Register</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
