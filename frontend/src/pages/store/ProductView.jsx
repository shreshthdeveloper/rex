import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { storeAPI, portalAPI } from '../../api';
import { useStoreSettings } from '../../layouts/StoreLayout';
import { useAuth } from '../../context/AuthContext';
import {
  Package, ChevronLeft, Tag, Layers, ShoppingCart, CheckCircle,
  AlertCircle, Loader2, ImageOff, ArrowRight, Sparkles, Plus, Minus,
  ZoomIn, Share2, Hash,
} from 'lucide-react';

/* ─── Skeleton block ─── */
const Sk = ({ className }) => (
  <div className={`animate-pulse rounded bg-violet-50 ${className}`} />
);

export default function ProductView() {
  const { orgSlug, productId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { settings } = useStoreSettings();
  const { isAuthenticated, role } = useAuth();

  const isCustomer = isAuthenticated && role === 'customer';
  const primary = settings?.primaryColor || '#06b6d4';

  /* ── State ── */
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImg, setSelectedImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [ordering, setOrdering] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  /* ── Fetch product ── */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setOrdered(false);
    setSelectedImg(0);
    setQty(1);
    setLoading(true);

    (async () => {
      try {
        const res = await storeAPI.productById(orgSlug, productId);
        setProduct(res.data?.product);
        setVariants(res.data?.variants || []);
        setAvailability(res.data?.availability || null);
      } catch (err) {
        toast.error(err?.message || 'Product not found');
        navigate(`/store/${orgSlug}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgSlug, productId]);

  /* ── Place order ── */
  const handleOrder = async () => {
    if (!isCustomer) {
      navigate(`/store/${orgSlug}/auth`);
      return;
    }
    setOrdering(true);
    try {
      await portalAPI.placeOrder(orgSlug, {
        items: [{ productId: product._id, quantity: qty }],
        warehouseId: 'auto',
      });
      toast.success(`Order placed for ${qty} × ${product.name}`);
      setOrdered(true);
    } catch (err) {
      toast.error(err?.message || 'Could not place order');
    } finally {
      setOrdering(false);
    }
  };

  /* ── Copy share link ── */
  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    toast.success('Link copied!');
  };

  /* ════════ LOADING SKELETON ════════ */
  if (loading) {
    return (
      <div className="space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Sk className="h-4 w-16" />
          <Sk className="h-4 w-4" />
          <Sk className="h-4 w-28" />
        </div>
        {/* Grid */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <div className="space-y-3">
            <Sk className="aspect-square w-full rounded-2xl" />
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => <Sk key={i} className="w-16 h-16 rounded-xl" />)}
            </div>
          </div>
          <div className="space-y-4 py-2">
            <Sk className="h-5 w-24 rounded-full" />
            <Sk className="h-8 w-3/4" />
            <Sk className="h-4 w-20" />
            <Sk className="h-10 w-36" />
            <Sk className="h-5 w-32 rounded-full" />
            <Sk className="h-4 w-full mt-6" />
            <Sk className="h-4 w-5/6" />
            <Sk className="h-4 w-4/6" />
            <div className="flex gap-3 pt-4">
              <Sk className="h-11 w-32 rounded-xl" />
              <Sk className="h-11 flex-1 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const discount =
    product.compareAtPrice > product.basePrice
      ? Math.round(((product.compareAtPrice - product.basePrice) / product.compareAtPrice) * 100)
      : 0;

  const images = product.images || [];
  const inStock = availability?.inStock;
  const availableQty = availability?.availableQty || 0;
  const maxQty = Math.min(availableQty, 99);

  return (
    <div className="space-y-10">

      {/* ═══ BREADCRUMB ═══ */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
        <Link
          to={`/store/${orgSlug}`}
          className="flex items-center gap-1 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={13} />
          Shop
        </Link>
        {product.categories?.length > 0 && (
          <>
            <span className="text-gray-700">/</span>
            <span className="text-slate-500">{product.categories[0]?.name}</span>
          </>
        )}
        <span className="text-gray-700">/</span>
        <span className="text-slate-600 truncate max-w-[200px] font-medium">
          {product.name}
        </span>
      </nav>

      {/* ═══ MAIN GRID ═══ */}
      <div className="grid md:grid-cols-2 gap-8 lg:gap-14">

        {/* ─── IMAGE PANEL ─── */}
        <div className="space-y-3">
          {/* Main image */}
          <div
            className="relative aspect-square rounded-2xl overflow-hidden border cursor-zoom-in group"
            style={{ background: 'rgba(255,255,255,0.015)', borderColor: 'rgba(255,255,255,0.06)' }}
            onClick={() => images[selectedImg]?.url && setZoomed(true)}
          >
            {images[selectedImg]?.url ? (
              <img
                src={images[selectedImg].url}
                alt={images[selectedImg].altText || product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-700">
                <Package size={56} />
                <span className="text-sm">No image available</span>
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5">
              {product.isFeatured && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-amber-500/90 text-slate-800 shadow">
                  <Sparkles size={10} /> Featured
                </span>
              )}
              {discount > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-full bg-red-500/90 text-slate-800 shadow">
                  -{discount}% OFF
                </span>
              )}
            </div>

            {/* Zoom hint */}
            {images[selectedImg]?.url && (
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-slate-500 bg-black/50 backdrop-blur-sm rounded-lg">
                  <ZoomIn size={12} /> Zoom
                </span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImg(i)}
                  className="w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-200 shrink-0"
                  style={
                    i === selectedImg
                      ? { borderColor: primary, transform: 'scale(1.05)', boxShadow: `0 0 12px ${primary}40` }
                      : { borderColor: 'rgba(255,255,255,0.08)' }
                  }
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── INFO PANEL ─── */}
        <div className="space-y-5 py-1">

          {/* Category chips */}
          {product.categories?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.categories.map((c) => (
                <span
                  key={c._id}
                  className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium rounded-full border text-slate-500"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  <Tag size={9} />
                  {c.name}
                </span>
              ))}
            </div>
          )}

          {/* Name + SKU */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-tight tracking-tight">
              {product.name}
            </h1>
            {product.sku && (
              <p className="flex items-center gap-1 text-xs text-gray-600 mt-1.5">
                <Hash size={10} />
                {product.sku}
              </p>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl font-extrabold" style={{ color: primary }}>
              ₹{product.basePrice?.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
            </span>
            {product.compareAtPrice > product.basePrice && (
              <span className="text-xl text-gray-500 line-through">
                ₹{product.compareAtPrice?.toLocaleString('en-IN')}
              </span>
            )}
            {discount > 0 && (
              <span
                className="px-2.5 py-0.5 text-xs font-bold rounded-full"
                style={{ color: '#4ade80', background: '#22c55e15', border: '1px solid #22c55e20' }}
              >
                Save {discount}%
              </span>
            )}
          </div>

          {/* Availability pill */}
          {availability && (
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border w-fit"
              style={
                inStock
                  ? { color: '#4ade80', background: '#22c55e10', borderColor: '#22c55e20' }
                  : { color: '#f87171', background: '#ef444410', borderColor: '#ef444420' }
              }
            >
              {inStock ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              {inStock
                ? availableQty > 5
                  ? 'In Stock'
                  : `Only ${availableQty} left!`
                : 'Out of Stock'}
            </div>
          )}

          {/* Description */}
          {product.description && (
            <p
              className="text-sm text-slate-500 leading-relaxed border-t pt-5"
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}
            >
              {product.description}
            </p>
          )}

          {/* Variants */}
          {variants.length > 0 && (
            <div
              className="space-y-2 border-t pt-5"
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}
            >
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={11} /> Variants
              </p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v._id}
                    onClick={() => navigate(`/store/${orgSlug}/products/${v._id}`)}
                    className="px-3 py-2 text-xs rounded-xl border transition-all hover:scale-105"
                    style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}
                  >
                    {v.variantAttribute && (
                      <span className="text-gray-600">{v.variantAttribute}: </span>
                    )}
                    {v.variantValue || v.name}
                    {v.basePrice && (
                      <span className="ml-1.5 font-semibold" style={{ color: primary }}>
                        ₹{v.basePrice.toLocaleString('en-IN')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tax info */}
          {product.taxSlab?.rate > 0 && (
            <p className="text-[11px] text-gray-600">
              + {product.taxSlab.rate}% {product.taxSlab.name} applicable
            </p>
          )}

          {/* ─── ORDER SECTION ─── */}
          {!ordered ? (
            inStock ? (
              <div
                className="flex items-center gap-3 pt-2 border-t"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                {/* Quantity stepper */}
                <div
                  className="flex items-center rounded-xl border overflow-hidden shrink-0"
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    className="w-10 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-violet-50 disabled:opacity-30 transition-all"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-slate-800 tabular-nums">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    disabled={qty >= maxQty}
                    className="w-10 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-violet-50 disabled:opacity-30 transition-all"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Order button */}
                <button
                  onClick={handleOrder}
                  disabled={ordering}
                  className="flex-1 h-11 flex items-center justify-center gap-2.5 text-sm font-bold rounded-xl text-slate-800 transition-all disabled:opacity-60 hover:opacity-90 active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}
                >
                  {ordering ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <ShoppingCart size={16} />
                      {isCustomer ? 'Place Order' : 'Sign In to Order'}
                    </>
                  )}
                </button>

                {/* Share */}
                <button
                  onClick={handleShare}
                  className="h-11 w-11 flex items-center justify-center shrink-0 rounded-xl border text-gray-500 hover:text-slate-800 hover:border-violet-200 transition-all"
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                  title="Copy link"
                >
                  <Share2 size={15} />
                </button>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-2 py-5 rounded-2xl border mt-2"
                style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}
              >
                <AlertCircle size={28} className="text-gray-600" />
                <p className="text-sm text-gray-500">This product is currently unavailable</p>
              </div>
            )
          ) : (
            /* ─── Success state ─── */
            <div
              className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-2xl border mt-2"
              style={{ background: '#22c55e0c', borderColor: '#22c55e25' }}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#22c55e15' }}>
                  <CheckCircle size={20} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-400">Order placed!</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {qty} × {product.name}
                  </p>
                </div>
              </div>
              <Link
                to={`/store/${orgSlug}/portal`}
                className="flex items-center gap-1.5 text-xs font-semibold text-green-400 hover:text-green-300 px-4 py-2 rounded-xl border border-green-500/20 hover:bg-green-500/10 transition-all shrink-0"
              >
                View Orders <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ═══ BACK TO SHOP ═══ */}
      <div
        className="pt-6 border-t text-center"
        style={{ borderColor: 'rgba(255,255,255,0.04)' }}
      >
        <Link
          to={`/store/${orgSlug}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={14} />
          Continue Shopping
        </Link>
      </div>

      {/* ═══ ZOOM MODAL ═══ */}
      {zoomed && images[selectedImg]?.url && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <img
            src={images[selectedImg].url}
            alt={product.name}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-violet-100 text-slate-800 hover:bg-violet-100 transition"
            onClick={() => setZoomed(false)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
