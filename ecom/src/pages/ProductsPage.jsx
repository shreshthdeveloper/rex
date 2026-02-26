import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';
import { catalogService } from '../services/catalogService';
import ProductCard from '../components/product/ProductCard';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'name_asc', label: 'Name: A → Z' },
  { value: 'name_desc', label: 'Name: Z → A' },
];

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [catOpen, setCatOpen] = useState(true);
  const [brandOpen, setBrandOpen] = useState(true);

  // Read filter params
  const page = Number(searchParams.get('page')) || 1;
  const sort = searchParams.get('sort') || 'newest';
  const category = searchParams.get('category') || '';
  const brand = searchParams.get('brand') || '';
  const search = searchParams.get('search') || '';
  const featured = searchParams.get('featured') || '';

  // Fetch filter options once
  useEffect(() => {
    catalogService.getCategories().then((c) => setCategories(flattenCategories(c || []))).catch(() => {});
    catalogService.getBrands().then((b) => setBrands(b || [])).catch(() => {});
  }, []);

  // Fetch products on param change
  useEffect(() => {
    setLoading(true);
    const params = { page, sort, limit: 20 };
    if (category) params.category = category;
    if (brand) params.brand = brand;
    if (search) params.search = search;
    if (featured === 'true') params.featured = 'true';

    catalogService.getProducts(params)
      .then((data) => {
        setProducts(data?.products || []);
        setPagination(data?.pagination || null);
      })
      .catch(() => { setProducts([]); })
      .finally(() => setLoading(false));
  }, [page, sort, category, brand, search, featured]);

  const setParam = (key, val) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  // Build title
  const title = useMemo(() => {
    if (search) return `Search: "${search}"`;
    if (featured === 'true') return 'Featured Products';
    const catObj = categories.find((c) => c._id === category);
    const brandObj = brands.find((b) => b._id === brand);
    if (catObj && brandObj) return `${brandObj.name} — ${catObj.name}`;
    if (catObj) return catObj.name;
    if (brandObj) return brandObj.name;
    return 'All Products';
  }, [search, featured, category, brand, categories, brands]);

  return (
    <div className="container-main py-6">
      {/* Title bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {pagination && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-content-secondary)' }}>
              {pagination.total} product{pagination.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setParam('sort', e.target.value)}
            className="input-field w-auto text-xs"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Filter toggle (mobile) */}
          <button onClick={() => setShowFilters(!showFilters)} className="btn btn-secondary btn-sm lg:hidden">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className={`shrink-0 w-56 space-y-4 ${showFilters ? 'fixed inset-0 z-50 p-4 overflow-y-auto' : 'hidden lg:block'}`}
          style={showFilters ? { backgroundColor: 'var(--color-surface)' } : {}}
        >
          {showFilters && (
            <div className="flex items-center justify-between mb-4 lg:hidden">
              <h3 className="font-bold">Filters</h3>
              <button onClick={() => setShowFilters(false)}><X className="w-5 h-5" /></button>
            </div>
          )}

          {/* Active filters */}
          {(category || brand || search) && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase" style={{ color: 'var(--color-content-tertiary)' }}>Active filters</div>
              <div className="flex flex-wrap gap-1.5">
                {category && <FilterChip label={categories.find(c => c._id === category)?.name || 'Category'} onRemove={() => setParam('category', '')} />}
                {brand && <FilterChip label={brands.find(b => b._id === brand)?.name || 'Brand'} onRemove={() => setParam('brand', '')} />}
                {search && <FilterChip label={`"${search}"`} onRemove={() => setParam('search', '')} />}
              </div>
            </div>
          )}

          {/* Categories */}
          <FilterSection title="Categories" open={catOpen} onToggle={() => setCatOpen(!catOpen)}>
            {categories.map((c) => (
              <FilterOption key={c._id} label={c.name} depth={c.depth} active={category === c._id} onClick={() => setParam('category', category === c._id ? '' : c._id)} />
            ))}
          </FilterSection>

          {/* Brands */}
          <FilterSection title="Brands" open={brandOpen} onToggle={() => setBrandOpen(!brandOpen)}>
            {brands.map((b) => (
              <FilterOption key={b._id} label={b.name} active={brand === b._id} onClick={() => setParam('brand', brand === b._id ? '' : b._id)} />
            ))}
          </FilterSection>
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden">
                  <div className="skeleton aspect-square w-full" />
                  <div className="p-3 space-y-2"><div className="skeleton h-4 w-3/4" /><div className="skeleton h-3 w-1/2" /></div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg font-medium mb-1">No products found</p>
              <p className="text-sm" style={{ color: 'var(--color-content-secondary)' }}>Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button disabled={page <= 1} onClick={() => setParam('page', String(page - 1))} className="btn btn-secondary btn-sm">Prev</button>
                  {/* page numbers */}
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === pagination.pages || Math.abs(p - page) <= 2)
                    .reduce((acc, p, i, arr) => {
                      if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === '...' ? (
                        <span key={`dot-${i}`} className="px-1 text-sm" style={{ color: 'var(--color-content-tertiary)' }}>…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setParam('page', String(p))}
                          className={`w-8 h-8 rounded text-sm transition-colors ${p === page ? 'font-bold' : 'hover:bg-[var(--color-surface-secondary)]'}`}
                          style={{ color: p === page ? 'var(--color-brand)' : 'var(--color-content-secondary)', outline: p === page ? '1px solid var(--color-brand)' : 'none' }}
                        >{p}</button>
                      )
                    )}
                  <button disabled={page >= pagination.pages} onClick={() => setParam('page', String(page + 1))} className="btn btn-secondary btn-sm">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Helpers */

function flattenCategories(tree, depth = 0) {
  const result = [];
  tree.forEach((c) => {
    result.push({ _id: c._id, name: c.name, depth });
    if (c.children?.length) result.push(...flattenCategories(c.children, depth + 1));
  });
  return result;
}

function FilterSection({ title, open, onToggle, children }) {
  return (
    <div className="card p-3">
      <button onClick={onToggle} className="flex items-center justify-between w-full text-sm font-semibold mb-2">
        <span>{title}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="space-y-0.5 max-h-60 overflow-y-auto">{children}</div>}
    </div>
  );
}

function FilterOption({ label, active, onClick, depth = 0 }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full text-left text-sm px-2 py-1 rounded transition-colors ${active ? 'font-semibold' : ''}`}
      style={{
        paddingLeft: `${8 + depth * 12}px`,
        color: active ? 'var(--color-brand)' : 'var(--color-content-secondary)',
        backgroundColor: active ? 'var(--color-brand-light)' : 'transparent',
      }}
    >
      {label}
    </button>
  );
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="badge-brand flex items-center gap-1 pr-1">
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:text-[var(--color-status-error)]"><X className="w-3 h-3" /></button>
    </span>
  );
}
