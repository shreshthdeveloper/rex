import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Eye } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { CURRENCY } from '../../config/constants';
import QuickViewModal from './QuickViewModal';

function formatPrice(val) {
  if (val == null) return '';
  return `${CURRENCY}${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const { isAuthenticated } = useAuth();
  const [quickView, setQuickView] = useState(false);
  const p = product;

  const image = p.images?.[0]?.url || '';
  const hasVariants = p.type === 'parent';
  const price = hasVariants ? p.priceRange?.min : p.basePrice;
  const maxPrice = hasVariants ? p.priceRange?.max : null;
  const inStock = p.inStock !== false;
  const category = p.categories?.[0];
  const brand = p.brand?.name;
  const wishlisted = isWishlisted(p._id);

  return (
    <>
      <div className="card-hover group flex flex-col h-full overflow-hidden">
        {/* Image */}
        <Link to={`/products/${p.slug}`} className="relative block aspect-square overflow-hidden" style={{ backgroundColor: 'var(--color-surface-tertiary)' }}>
          {image ? (
            <img src={image} alt={p.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl font-bold" style={{ color: 'var(--color-content-tertiary)' }}>
              {p.name?.[0] || '?'}
            </div>
          )}

          {/* Hover overlay actions */}
          <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => { e.preventDefault(); toggle(p); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${wishlisted ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-700 hover:bg-white hover:shadow-md'}`}
              title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className="w-3.5 h-3.5" fill={wishlisted ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setQuickView(true); }}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/90 text-gray-700 hover:bg-white hover:shadow-md transition-all shadow-sm"
              title="Quick view"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </Link>

        {/* Info */}
        <div className="flex-1 flex flex-col p-3 gap-1">
          {/* Brand badge */}
          {brand && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border w-fit mb-0.5"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-content-tertiary)' }}>
              {brand}
            </span>
          )}

          {/* Product name */}
          <Link to={`/products/${p.slug}`} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-[var(--color-brand)] transition-colors">
            {p.name}
          </Link>

          {/* SKU & Category */}
          <div className="text-[11px] space-y-0.5" style={{ color: 'var(--color-content-tertiary)' }}>
            {p.sku && <div>SKU: {p.sku}</div>}
            {category && (
              <Link
                to={`/products?category=${category._id}`}
                className="block hover:text-[var(--color-brand)] transition-colors"
                style={{ color: 'var(--color-content-tertiary)' }}
              >
                {category.name}
              </Link>
            )}
          </div>

          {/* Stock badge */}
          <div className="mt-1">
            {inStock ? (
              <span className="badge-success text-[10px]">In Stock</span>
            ) : (
              <span className="badge-error text-[10px]">Out of Stock</span>
            )}
          </div>

          {/* Price + Cart button row */}
          <div className="mt-auto pt-2 flex items-end justify-between gap-2">
            <div>
              {isAuthenticated ? hasVariants ? (
                <div className="text-sm font-bold" style={{ color: 'var(--color-brand)' }}>
                  {formatPrice(price)} {maxPrice && price !== maxPrice ? `— ${formatPrice(maxPrice)}` : ''}
                </div>
              ) : (
                <>
                  <div className="text-sm font-bold" style={{ color: 'var(--color-brand)' }}>
                    {formatPrice(price)}
                  </div>
                  {p.compareAtPrice > price && (
                    <div className="text-[10px] line-through" style={{ color: 'var(--color-content-tertiary)' }}>
                      {formatPrice(p.compareAtPrice)}
                    </div>
                  )}
                </>
              ) : (
                <Link to="/login" className="text-xs font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>
                  Login to see prices
                </Link>
              )}
            </div>

            {/* Cart button — always visible */}
            {!isAuthenticated ? (
              <Link
                to="/login"
                className="shrink-0 px-2.5 h-8 rounded-lg flex items-center justify-center text-[10px] font-semibold transition-colors"
                style={{ backgroundColor: 'var(--color-surface-tertiary)', color: 'var(--color-content-secondary)' }}
                title="Login to purchase"
              >
                Login
              </Link>
            ) : hasVariants ? (
              <Link
                to={`/products/${p.slug}`}
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-white"
                style={{ backgroundColor: 'var(--color-brand)' }}
                title="Select variant"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <button
                onClick={() => inStock && addItem(p, null, 1)}
                disabled={!inStock}
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-white disabled:opacity-40"
                style={{ backgroundColor: 'var(--color-brand)' }}
                title={inStock ? 'Add to cart' : 'Out of stock'}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick View Modal */}
      {quickView && (
        <QuickViewModal slug={p.slug} onClose={() => setQuickView(false)} />
      )}
    </>
  );
}
