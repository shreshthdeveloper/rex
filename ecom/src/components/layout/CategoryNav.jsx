import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { catalogService } from '../../services/catalogService';
import { useAuth } from '../../context/AuthContext';

export default function CategoryNav() {
  const [categories, setCategories] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [dropLeft, setDropLeft] = useState(0);
  const scrollRef = useRef(null);
  const navRef = useRef(null);
  const btnRefs = useRef({});
  const { isAuthenticated } = useAuth();

  // Re-fetch whenever auth state changes so hidden-category visibility updates on login/logout
  useEffect(() => {
    catalogService.getCategories().then(setCategories).catch(() => {});
    setOpenId(null);
  }, [isAuthenticated]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recalculate dropdown horizontal position whenever the open category changes
  useEffect(() => {
    if (openId && btnRefs.current[openId] && navRef.current) {
      const btnRect = btnRefs.current[openId].getBoundingClientRect();
      const navRect = navRef.current.getBoundingClientRect();
      setDropLeft(btnRect.left - navRect.left);
    }
  }, [openId]);

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };

  const openCat = categories.find((c) => c._id === openId);

  if (!categories.length) return null;

  return (
    <nav ref={navRef} className="relative z-40 border-b" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="container-main flex items-center">
        <button onClick={() => scroll(-1)} className="shrink-0 p-1 hover:bg-[var(--color-surface-tertiary)] rounded">
          <ChevronLeft className="w-4 h-4" style={{ color: 'var(--color-content-secondary)' }} />
        </button>

        {/* overflow-x-auto scroll area — dropdown is rendered OUTSIDE this div
            to avoid being clipped by the overflow context (overflow-x:auto forces overflow-y:auto) */}
        <div ref={scrollRef} className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
          {categories.map((cat) => (
            <div key={cat._id} className="shrink-0">
              {cat.children?.length > 0 ? (
                <button
                  ref={(el) => { btnRefs.current[cat._id] = el; }}
                  onMouseEnter={() => setOpenId(cat._id)}
                  onClick={() => setOpenId(openId === cat._id ? null : cat._id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide whitespace-nowrap transition-colors hover:bg-[var(--color-surface-tertiary)]"
                  style={{ color: 'var(--color-content-secondary)' }}
                >
                  {cat.name}
                  <ChevronDown className="w-3 h-3" />
                </button>
              ) : (
                <Link
                  to={`/products?category=${cat._id}`}
                  className="block px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide whitespace-nowrap transition-colors hover:bg-[var(--color-surface-tertiary)]"
                  style={{ color: 'var(--color-content-secondary)' }}
                >
                  {cat.name}
                </Link>
              )}
            </div>
          ))}
        </div>

        <button onClick={() => scroll(1)} className="shrink-0 p-1 hover:bg-[var(--color-surface-tertiary)] rounded">
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-content-secondary)' }} />
        </button>
      </div>

      {/* Dropdown rendered here at <nav> level — escapes the overflow-x-auto scroll container
          so it is never clipped by it, and naturally floats above the page content below */}
      {openId && openCat?.children?.length > 0 && (
        <div
          onMouseLeave={() => setOpenId(null)}
          className="absolute top-full mt-0.5 w-52 rounded-lg border py-1 shadow-lg z-[70]"
          style={{
            left: dropLeft,
            backgroundColor: 'var(--color-surface-elevated)',
            borderColor: 'var(--color-border)',
          }}
        >
          <Link
            to={`/products?category=${openCat._id}`}
            className="block px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface-tertiary)]"
            onClick={() => setOpenId(null)}
          >
            All {openCat.name}
          </Link>
          <div className="divider" />
          {openCat.children.map((sub) => (
            <Link
              key={sub._id}
              to={`/products?category=${sub._id}`}
              onClick={() => setOpenId(null)}
              className="block px-4 py-2 text-sm hover:bg-[var(--color-surface-tertiary)]"
              style={{ color: 'var(--color-content-secondary)' }}
            >
              {sub.name}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

