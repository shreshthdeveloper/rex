import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Minus, Plus, ShoppingCart, Heart, ExternalLink } from 'lucide-react';
import { catalogService } from '../../services/catalogService';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { CURRENCY } from '../../config/constants';
import toast from 'react-hot-toast';

const fmt = (v) => v != null ? `${CURRENCY}${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';

export default function QuickViewModal({ slug, onClose }) {
  const { addItem } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [mainImage, setMainImage] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    catalogService.getProductBySlug(slug)
      .then((d) => {
        setData(d);
        setMainImage(d.product?.images?.[0]?.url || '');
        if (d.variants?.length) setSelectedVariant(d.variants[0]);
        setQty(1);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!slug) return null;

  const product = data?.product;
  const variants = data?.variants || [];
  const availability = data?.availability;
  const isParent = product?.type === 'parent';
  const activeProduct = isParent && selectedVariant ? selectedVariant : product;
  const activePrice = activeProduct?.basePrice;
  const activeCompare = activeProduct?.compareAtPrice;
  const activeImages = isParent && selectedVariant?.images?.length
    ? selectedVariant.images
    : product?.images || [];
  const activeInStock = isParent && selectedVariant
    ? selectedVariant.inStock !== false
    : availability?.inStock !== false;
  const wishlisted = product ? isWishlisted(product._id) : false;

  const handleAdd = () => {
    if (!isAuthenticated) return toast.error('Login to see prices and add to cart');
    if (!product) return;
    addItem(product, isParent ? selectedVariant : null, qty);
  };

  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl z-10"
        style={{ backgroundColor: 'var(--color-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: 'var(--color-surface-tertiary)' }}
        >
          <X className="w-4 h-4" />
        </button>

        {loading ? (
          <div className="p-10 space-y-4">
            <div className="skeleton h-48 rounded-xl" />
            <div className="skeleton h-6 w-2/3" />
            <div className="skeleton h-8 w-1/3" />
          </div>
        ) : !product ? (
          <div className="p-10 text-center" style={{ color: 'var(--color-content-secondary)' }}>
            Product not found
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
            {/* Image */}
            <div className="relative aspect-square" style={{ backgroundColor: 'var(--color-surface-tertiary)' }}>
              {mainImage ? (
                <img src={mainImage} alt={product.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl font-bold" style={{ color: 'var(--color-content-tertiary)' }}>
                  {product.name?.[0]}
                </div>
              )}
              {activeImages.length > 1 && (
                <div className="absolute bottom-2 left-2 right-2 flex gap-1 justify-center">
                  {activeImages.slice(0, 5).map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setMainImage(img.url)}
                      className="w-10 h-10 rounded-md border overflow-hidden bg-white/90"
                      style={{ borderColor: mainImage === img.url ? 'var(--color-brand)' : 'var(--color-border)' }}
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="p-5 flex flex-col gap-3">
              {product.brand && (
                <span className="badge-brand text-[10px] w-fit">{product.brand.name}</span>
              )}

              <h3 className="text-lg font-bold leading-snug">{product.name}</h3>

              <div className="text-xs" style={{ color: 'var(--color-content-tertiary)' }}>
                SKU: {activeProduct?.sku || product.sku}
              </div>

              {isAuthenticated ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold" style={{ color: 'var(--color-brand)' }}>{fmt(activePrice)}</span>
                  {activeCompare > activePrice && (
                    <span className="text-sm line-through" style={{ color: 'var(--color-content-tertiary)' }}>{fmt(activeCompare)}</span>
                  )}
                </div>
              ) : (
                <Link to="/login" className="text-sm font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>
                  Login to see prices
                </Link>
              )}

              <div>
                {activeInStock ? (
                  <span className="badge-success text-xs">In stock</span>
                ) : (
                  <span className="badge-error text-xs">Out of stock</span>
                )}
              </div>

              {/* Variant selector */}
              {isParent && variants.length > 0 && (
                <div>
                  <span className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-content-secondary)' }}>
                    {variants[0]?.variantAttribute || 'Variant'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {variants.map((v) => (
                      <button
                        key={v._id}
                        onClick={() => {
                          setSelectedVariant(v);
                          if (v.images?.[0]?.url) setMainImage(v.images[0].url);
                        }}
                        className="px-2.5 py-1 rounded-md border text-xs transition-all"
                        style={{
                          borderColor: selectedVariant?._id === v._id ? 'var(--color-brand)' : 'var(--color-border)',
                          backgroundColor: selectedVariant?._id === v._id ? 'var(--color-brand-light)' : 'transparent',
                          color: selectedVariant?._id === v._id ? 'var(--color-brand)' : 'var(--color-content-secondary)',
                        }}
                      >
                        {v.variantValue}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Qty + Add to cart */}
              <div className="flex items-center gap-3 mt-auto pt-2">
                <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-2.5 py-1.5 hover:bg-[var(--color-surface-tertiary)]">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} className="px-2.5 py-1.5 hover:bg-[var(--color-surface-tertiary)]">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={handleAdd}
                  disabled={!activeInStock || !isAuthenticated}
                  className="btn btn-primary btn-md flex-1"
                >
                  <ShoppingCart className="w-4 h-4" /> {isAuthenticated ? 'Add to Cart' : 'Login to Buy'}
                </button>

                <button
                  onClick={() => toggle(product)}
                  className={`p-2 rounded-lg border transition-colors ${wishlisted ? 'text-red-500 border-red-200' : ''}`}
                  style={{ borderColor: wishlisted ? undefined : 'var(--color-border)' }}
                >
                  <Heart className="w-4 h-4" fill={wishlisted ? 'currentColor' : 'none'} />
                </button>
              </div>

              {/* View full page link */}
              <Link
                to={`/products/${product.slug}`}
                onClick={onClose}
                className="flex items-center gap-1 text-xs mt-1 hover:underline"
                style={{ color: 'var(--color-brand)' }}
              >
                View full details <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
