import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ChevronDown, Grid3X3, List, SlidersHorizontal, X } from 'lucide-react';
import { getProducts, getCategories } from '../api';
import ProductCard from '../components/ProductCard';

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price: Low → High', value: 'price_asc' },
  { label: 'Price: High → Low', value: 'price_desc' },
  { label: 'Name: A → Z', value: 'name_asc' },
  { label: 'Name: Z → A', value: 'name_desc' },
];

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const page = Number(params.get('page')) || 1;
  const category = params.get('category') || '';
  const search = params.get('search') || '';
  const sort = params.get('sort') || 'newest';
  const featured = params.get('featured') || '';

  useEffect(() => {
    getCategories().then((r) => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = { page, sort, limit: 20 };
    if (category) q.category = category;
    if (search) q.search = search;
    if (featured === 'true') q.featured = 'true';
    getProducts(q)
      .then((r) => {
        setProducts(r.data?.products || []);
        setPagination(r.data?.pagination || { total: 0, page: 1, pages: 1 });
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [page, category, search, sort, featured]);

  const updateParam = (key, val) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const activeCatName = categories.reduce((found, c) => {
    if (c._id === category) return c.name;
    const child = c.children?.find((s) => s._id === category);
    if (child) return child.name;
    return found;
  }, '');

  // Flatten categories for sidebar
  const flatCats = [];
  categories.forEach((c) => {
    flatCats.push({ ...c, depth: 0 });
    c.children?.forEach((s) => flatCats.push({ ...s, depth: 1 }));
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-white">Home</Link>
        <span>/</span>
        <span className="text-gray-300">
          {search ? `Search: "${search}"` : activeCatName || 'All Products'}
        </span>
      </div>

      <div className="flex gap-6">
        {/* Sidebar filters - desktop */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="glass-card p-4 sticky top-24">
            <h3 className="font-semibold text-sm mb-3">Categories</h3>
            <div className="flex flex-col gap-0.5 max-h-[60vh] overflow-y-auto">
              <button
                onClick={() => updateParam('category', '')}
                className={`text-left px-2 py-1.5 text-sm rounded transition-colors ${!category ? 'text-brand-400 bg-brand-500/10' : 'text-gray-400 hover:text-white'}`}
              >
                All Products
              </button>
              {flatCats.map((c) => (
                <button
                  key={c._id}
                  onClick={() => updateParam('category', c._id)}
                  className={`text-left px-2 py-1.5 text-sm rounded transition-colors ${c._id === category ? 'text-brand-400 bg-brand-500/10' : 'text-gray-400 hover:text-white'} ${c.depth ? 'pl-6' : ''}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="lg:hidden flex items-center gap-1 px-3 py-2 text-sm border border-gray-700 rounded-lg hover:border-gray-600"
              >
                <SlidersHorizontal size={14} /> Filters
              </button>
              <p className="text-sm text-gray-500">
                {pagination.total} product{pagination.total !== 1 ? 's' : ''}
              </p>
              {/* Active filters */}
              {(category || search || featured) && (
                <div className="hidden sm:flex items-center gap-2">
                  {category && activeCatName && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-brand-500/10 text-brand-400 rounded">
                      {activeCatName}
                      <button onClick={() => updateParam('category', '')}><X size={12} /></button>
                    </span>
                  )}
                  {search && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-brand-500/10 text-brand-400 rounded">
                      &quot;{search}&quot;
                      <button onClick={() => updateParam('search', '')}><X size={12} /></button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => updateParam('sort', e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none pr-8 cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Mobile filters drawer */}
          {filtersOpen && (
            <div className="lg:hidden mb-4 glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Categories</h3>
                <button onClick={() => setFiltersOpen(false)}><X size={16} /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { updateParam('category', ''); setFiltersOpen(false); }}
                  className={`px-3 py-1 text-sm rounded-full border ${!category ? 'border-brand-500 text-brand-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
                >
                  All
                </button>
                {flatCats.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => { updateParam('category', c._id); setFiltersOpen(false); }}
                    className={`px-3 py-1 text-sm rounded-full border ${c._id === category ? 'border-brand-500 text-brand-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Products grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg mb-2">No products found</p>
              <p className="text-sm">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => updateParam('page', String(p))}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${p === pagination.page ? 'bg-brand-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-gray-800'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
