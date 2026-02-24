import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { storeAPI } from '../../api';
import { useStoreSettings } from '../../layouts/StoreLayout';
import { Package, Sparkles, Search, Tag, ChevronRight, SlidersHorizontal, ArrowUpDown, Eye } from 'lucide-react';

/* ─── Lazy Image with skeleton ─── */
function LazyImg({ src, alt, className, ...props }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  if (error || !src) return null;
  return (
    <>
      {!loaded && <div className={`${className} skeleton-shimmer`} />}
      <img
        src={src}
        alt={alt}
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0 absolute'}`}
        style={{ transition: 'opacity 0.3s ease' }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
        {...props}
      />
    </>
  );
}

export default function Home() {
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { settings } = useStoreSettings();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const perRow = settings?.productsPerRow || 4;
  const perPage = settings?.productsPerPage || 12;
  const primary = settings?.primaryColor || '#06b6d4';

  useEffect(() => {
    const init = async () => {
      try {
        const [catRes, featRes] = await Promise.all([
          storeAPI.categories(orgSlug),
          storeAPI.featured(orgSlug),
        ]);
        setCategories(catRes.data || []);
        setFeatured(featRes.data || []);
      } catch (err) {
        toast.error(err.message || 'Failed to load store data');
      }
    };
    init();
  }, [orgSlug]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: perPage, sort: sortBy };
      if (selectedCat) params.category = selectedCat;
      if (search) params.search = search;
      const res = await storeAPI.products(orgSlug, params);
      setProducts(res.data?.products || res.data || []);
      setTotalPages(res.data?.pagination?.pages || 1);
    } catch (err) {
      toast.error(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, page, selectedCat, search, sortBy, perPage]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSearch = (val) => { setSearch(val); setPage(1); };
  const handleCatFilter = (catId) => { setSelectedCat(catId === selectedCat ? '' : catId); setPage(1); };

  const gridColsClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6',
  }[perRow] || 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';

  /* ─── Banner Carousel ─── */
  const banners = (settings?.banners || []).filter((b) => b.isActive);
  const [bannerIdx, setBannerIdx] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  /* ─── Product Card ─── */
  const ProductCard = ({ product, idx }) => {
    const discount = product.compareAtPrice > product.basePrice
      ? Math.round(((product.compareAtPrice - product.basePrice) / product.compareAtPrice) * 100) : 0;

    return (
      <div
        className="group relative rounded-2xl overflow-hidden border border-violet-100 bg-violet-50/50 backdrop-blur-sm hover:bg-violet-50 hover:border-violet-200 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20"
        onClick={() => navigate(`/store/${orgSlug}/products/${product._id}`)}
      >
        {/* Image */}
        <div className="relative aspect-square bg-gradient-to-br from-white/[0.02] to-white/[0.005] overflow-hidden">
          {product.images?.[0]?.url ? (
            <LazyImg
              src={product.images[0].url}
              alt={product.images[0].altText || product.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={48} className="text-slate-300" />
            </div>
          )}

          {/* Badges overlay */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.isFeatured && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/90 text-slate-800 shadow-lg">
                <Sparkles size={10} /> Featured
              </span>
            )}
            {discount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500/90 text-slate-800 shadow-lg">
                -{discount}%
              </span>
            )}
          </div>

          {/* Quick view hover overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium text-slate-800 bg-violet-100 backdrop-blur-sm border border-violet-200">
              <Eye size={14} /> Quick View
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="p-4 space-y-2">
          {product.categories?.length > 0 && (
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: `${primary}cc` }}>
              {product.categories[0]?.name || product.categories[0]}
            </span>
          )}
          <h3 className="text-sm font-semibold text-slate-800 truncate group-hover:text-violet-600 transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: primary }}>
              ₹{product.basePrice?.toLocaleString('en-IN', { minimumFractionDigits: 0 }) || '0'}
            </span>
            {product.compareAtPrice > product.basePrice && (
              <span className="text-xs text-gray-500 line-through">₹{product.compareAtPrice?.toLocaleString('en-IN')}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ─── Skeleton Loader ─── */
  const SkeletonCard = () => (
    <div className="rounded-2xl overflow-hidden border border-violet-100 bg-violet-50/50">
      <div className="aspect-square skeleton-shimmer" />
      <div className="p-4 space-y-2">
        <div className="h-2.5 w-16 skeleton-shimmer rounded" />
        <div className="h-3.5 w-3/4 skeleton-shimmer rounded" />
        <div className="h-4 w-20 skeleton-shimmer rounded" />
      </div>
    </div>
  );

  const sortOpts = [
    { value: 'newest', label: 'Newest' },
    { value: 'price_asc', label: 'Price: Low → High' },
    { value: 'price_desc', label: 'Price: High → Low' },
    { value: 'name_asc', label: 'A → Z' },
  ];

  return (
    <div className="space-y-5">

      {/* ─── Hero / Banners ─── */}
      {banners.length > 0 && !search && !selectedCat && (
        <div className="relative rounded-3xl overflow-hidden border border-violet-100" style={{ minHeight: 280 }}>
          {banners.map((b, i) => (
            <div
              key={b._id || i}
              className={`absolute inset-0 transition-opacity duration-700 ${i === bannerIdx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              onClick={() => b.link && navigate(b.link)}
              style={{ cursor: b.link ? 'pointer' : 'default' }}
            >
              {b.image ? (
                <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${primary}30, ${primary}10)` }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent flex items-center">
                <div className="px-8 sm:px-12 max-w-lg">
                  {b.title && <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">{b.title}</h2>}
                  {b.subtitle && <p className="text-sm text-slate-600">{b.subtitle}</p>}
                </div>
              </div>
            </div>
          ))}
          {banners.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setBannerIdx(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === bannerIdx ? 'w-6' : 'bg-violet-200'}`}
                  style={i === bannerIdx ? { background: primary } : {}}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Search + Sort Bar ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full glass-input pl-11 pr-4 py-3 text-sm rounded-xl"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="glass-input pl-9 pr-4 py-3 text-xs rounded-xl bg-transparent appearance-none cursor-pointer min-w-[140px]"
            >
              {sortOpts.map((o) => <option key={o.value} value={o.value} className="bg-white">{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ─── Category Chips ─── */}
      {settings?.showCategories !== false && categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCatFilter('')}
            className={`px-4 py-2 text-xs font-medium rounded-full border transition-all duration-200 ${
              !selectedCat
                ? 'text-slate-800 shadow-lg'
                : 'text-slate-500 border-violet-100 hover:border-violet-200 hover:text-slate-800'
            }`}
            style={!selectedCat ? { background: `${primary}25`, borderColor: `${primary}40`, color: primary } : {}}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => handleCatFilter(cat._id)}
              className={`px-4 py-2 text-xs font-medium rounded-full border transition-all duration-200 flex items-center gap-1.5 ${
                selectedCat === cat._id
                  ? 'text-slate-800 shadow-lg'
                  : 'text-slate-500 border-violet-100 hover:border-violet-200 hover:text-slate-800'
              }`}
              style={selectedCat === cat._id ? { background: `${primary}25`, borderColor: `${primary}40`, color: primary } : {}}
            >
              {cat.image && <img src={cat.image} alt="" className="w-4 h-4 rounded-full object-cover" />}
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* ─── Featured Section ─── */}
      {settings?.showFeatured !== false && !search && !selectedCat && featured.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f59e0b20' }}>
              <Sparkles size={16} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Featured Products</h2>
              <p className="text-xs text-gray-500">Handpicked for you</p>
            </div>
          </div>
          <div className={`grid ${gridColsClass} gap-4`}>
            {featured.slice(0, perRow).map((p, i) => (
              <ProductCard key={p._id} product={{...p, isFeatured: true}} idx={i} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Product Grid ─── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800">
            {selectedCat ? categories.find((c) => c._id === selectedCat)?.name || 'Products' : 'All Products'}
          </h2>
          {!loading && <span className="text-xs text-gray-500">{products.length} product{products.length !== 1 ? 's' : ''}</span>}
        </div>

        {loading ? (
          <div className={`grid ${gridColsClass} gap-4`}>
            {Array.from({ length: perPage > 8 ? 8 : perPage }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-violet-100 bg-violet-50/50">
            <Search size={48} className="mx-auto text-gray-700 mb-4" />
            <p className="text-slate-500 font-medium">No products found</p>
            <p className="text-xs text-gray-600 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className={`grid ${gridColsClass} gap-4`}>
              {products.map((p, i) => <ProductCard key={p._id} product={p} idx={i} />)}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-2 rounded-lg text-xs text-slate-500 border border-violet-100 hover:border-violet-200 disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-lg text-xs font-medium transition-all ${
                        p === page ? 'text-slate-800 shadow-lg' : 'text-gray-500 hover:text-slate-800 hover:bg-violet-50'
                      }`}
                      style={p === page ? { background: `${primary}25`, color: primary } : {}}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-2 rounded-lg text-xs text-slate-500 border border-violet-100 hover:border-violet-200 disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
