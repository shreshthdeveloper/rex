import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, ShoppingCart, Minus, Plus, ChevronRight, Package, Truck, ShieldCheck } from 'lucide-react';
import { catalogService } from '../services/catalogService';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { CURRENCY } from '../config/constants';
import toast from 'react-hot-toast';

const fmt = (v) => v != null ? `${CURRENCY}${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { addItem } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const { isAuthenticated } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [mainImage, setMainImage] = useState('');
  // Per-variant quantities for the table
  const [variantQtys, setVariantQtys] = useState({});

  useEffect(() => {
    setLoading(true);
    catalogService.getProductBySlug(slug)
      .then((d) => {
        setData(d);
        const images = d.product?.images || [];
        setMainImage(images[0]?.url || '');
        if (d.variants?.length) {
          setSelectedVariant(d.variants[0]);
          // Init all variant qtys to 0
          const qMap = {};
          d.variants.forEach((v) => { qMap[v._id] = 0; });
          setVariantQtys(qMap);
        }
        setQty(1);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="container-main py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="skeleton aspect-square rounded-xl" />
          <div className="space-y-4">
            <div className="skeleton h-8 w-3/4" />
            <div className="skeleton h-5 w-1/3" />
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-12 w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!data?.product) {
    return (
      <div className="container-main py-20 text-center">
        <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
        <Link to="/products" className="btn btn-primary btn-md mt-4">Browse Products</Link>
      </div>
    );
  }

  const { product, variants, availability } = data;
  const isParent = product.type === 'parent';
  const activeProduct = isParent && selectedVariant ? selectedVariant : product;
  const activePrice = activeProduct.basePrice;
  const activeCompare = activeProduct.compareAtPrice;
  const activeImages = isParent && selectedVariant?.images?.length
    ? selectedVariant.images
    : product.images || [];
  const activeAvail = isParent && selectedVariant
    ? selectedVariant.availableQty ?? 0
    : availability?.availableQty ?? 0;
  const activeInStock = isParent && selectedVariant
    ? selectedVariant.inStock !== false
    : availability?.inStock !== false;
  const wishlisted = isWishlisted(product._id);

  const handleAddToCart = () => {
    if (!isAuthenticated) return toast.error('Login to see prices and add to cart');
    addItem(product, isParent ? selectedVariant : null, qty);
  };

  const setVarQty = (vid, val) => {
    setVariantQtys((prev) => ({ ...prev, [vid]: Math.max(0, val) }));
  };

  const addVariantToCart = (variant) => {
    if (!isAuthenticated) return toast.error('Login to see prices and add to cart');
    const q = variantQtys[variant._id] || 0;
    if (q < 1) return toast.error('Set quantity first');
    if (!variant.inStock) return toast.error('Out of stock');
    addItem(product, variant, q);
    setVariantQtys((prev) => ({ ...prev, [variant._id]: 0 }));
  };

  const addAllToCart = () => {
    if (!isAuthenticated) return toast.error('Login to see prices and add to cart');
    let added = 0;
    variants.forEach((v) => {
      const q = variantQtys[v._id] || 0;
      if (q > 0 && v.inStock !== false) {
        addItem(product, v, q);
        added++;
      }
    });
    if (added === 0) return toast.error('Set quantities for at least one variant');
    toast.success(`Added ${added} variant(s) to cart`);
    const reset = {};
    variants.forEach((v) => { reset[v._id] = 0; });
    setVariantQtys(reset);
  };

  return (
    <div className="container-main py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs mb-6" style={{ color: 'var(--color-content-tertiary)' }}>
        <Link to="/" className="hover:text-[var(--color-content)]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/products" className="hover:text-[var(--color-content)]">Products</Link>
        {product.categories?.[0] && (
          <>
            <ChevronRight className="w-3 h-3" />
            <Link to={`/products?category=${product.categories[0]._id}`} className="hover:text-[var(--color-content)]">{product.categories[0].name}</Link>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span style={{ color: 'var(--color-content-secondary)' }}>{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Gallery */}
        <div className="w-full max-w-[560px]">
          <div className="rounded-xl overflow-hidden border mb-3 aspect-square" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-tertiary)' }}>
            {mainImage ? (
              <img src={mainImage} alt={product.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl font-bold" style={{ color: 'var(--color-content-tertiary)' }}>
                {product.name?.[0]}
              </div>
            )}
          </div>
          {activeImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {activeImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setMainImage(img.url)}
                  className={`shrink-0 w-16 h-16 rounded-lg border overflow-hidden transition-colors ${mainImage === img.url ? 'border-[var(--color-brand)]' : ''}`}
                  style={{ borderColor: mainImage === img.url ? 'var(--color-brand)' : 'var(--color-border)' }}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-5">
          {product.brand && (
            <Link to={`/products?brand=${product.brand._id}`} className="badge-brand text-xs">
              {product.brand.name}
            </Link>
          )}

          <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>

          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-content-tertiary)' }}>
            <span>SKU: {activeProduct.sku || product.sku}</span>
            {activeInStock ? (
              <span className="badge-success ml-1">{activeAvail > 0 ? `In stock` : 'In stock'}</span>
            ) : (
              <span className="badge-error ml-1">Out of stock</span>
            )}
          </div>

          {/* Price */}
          {isAuthenticated ? (
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold" style={{ color: 'var(--color-brand)' }}>{fmt(activePrice)}</span>
              {activeCompare > activePrice && (
                <span className="text-lg line-through" style={{ color: 'var(--color-content-tertiary)' }}>{fmt(activeCompare)}</span>
              )}
              {product.taxSlab && (
                <span className="text-xs" style={{ color: 'var(--color-content-tertiary)' }}>+ {product.taxSlab.rate}% {product.taxSlab.name}</span>
              )}
            </div>
          ) : (
            <Link to="/login" className="text-sm font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>
              Login to see prices
            </Link>
          )}

          {/* ── Variant Table (for parent products) ── */}
          {isParent && variants.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Variants ({variants.length})</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={addAllToCart}
                    disabled={!isAuthenticated}
                    className="btn btn-secondary btn-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" /> Add All to Cart
                  </button>
                  <button
                    onClick={() => toggle(product)}
                    className={`btn btn-secondary btn-sm ${wishlisted ? 'text-red-500' : ''}`}
                    title="Add to wishlist"
                  >
                    <Heart className="w-4 h-4" fill={wishlisted ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-surface-tertiary)' }}>
                      <th className="text-left py-2.5 px-3 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Variant</th>
                      <th className="text-left py-2.5 px-3 font-medium" style={{ color: 'var(--color-content-secondary)' }}>SKU</th>
                      <th className="text-left py-2.5 px-3 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Price</th>
                      <th className="text-left py-2.5 px-3 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Stock</th>
                      <th className="text-center py-2.5 px-3 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => {
                      const vImg = v.images?.[0]?.url || product.images?.[0]?.url || '';
                      const vQty = variantQtys[v._id] || 0;
                      return (
                        <tr
                          key={v._id}
                          className="border-t transition-colors hover:bg-[var(--color-surface-tertiary)]"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <button
                                onClick={() => {
                                  setSelectedVariant(v);
                                  if (v.images?.[0]?.url) setMainImage(v.images[0].url);
                                }}
                                className="shrink-0 w-10 h-10 rounded-lg border overflow-hidden"
                                style={{ borderColor: selectedVariant?._id === v._id ? 'var(--color-brand)' : 'var(--color-border)' }}
                              >
                                {vImg ? <img src={vImg} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[var(--color-surface-tertiary)]" />}
                              </button>
                              <span className="font-medium">{v.variantValue}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-content-tertiary)' }}>{v.sku}</td>
                          <td className="py-2.5 px-3 font-semibold">
                            {isAuthenticated ? fmt(v.basePrice) : <Link to="/login" className="text-xs hover:underline" style={{ color: 'var(--color-brand)' }}>Login to see prices</Link>}
                          </td>
                          <td className="py-2.5 px-3">
                            {v.inStock !== false ? (
                              <span className="badge-success text-xs">{v.availableQty > 0 ? `In stock` : 'In stock'}</span>
                            ) : (
                              <span className="badge-error text-xs">Out of stock</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setVarQty(v._id, vQty - 1)}
                                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--color-surface-tertiary)] transition-colors"
                                style={{ border: '1px solid var(--color-border)' }}
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={vQty}
                                onChange={(e) => setVarQty(v._id, parseInt(e.target.value) || 0)}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="w-10 text-center text-sm bg-transparent outline-none"
                              />
                              <button
                                onClick={() => setVarQty(v._id, vQty + 1)}
                                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--color-surface-tertiary)] transition-colors"
                                style={{ border: '1px solid var(--color-border)' }}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => addVariantToCart(v)}
                                disabled={!v.inStock || !isAuthenticated}
                                className="ml-1 w-7 h-7 rounded-md flex items-center justify-center transition-colors text-white disabled:opacity-40"
                                style={{ backgroundColor: 'var(--color-brand)' }}
                                title="Add to cart"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quantity + Add to cart (single products only) */}
          {!isParent && (
            <div className="flex items-center gap-4">
              <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 hover:bg-[var(--color-surface-tertiary)] transition-colors">
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-14 text-center text-sm bg-transparent border-x outline-none py-2"
                  style={{ borderColor: 'var(--color-border)' }}
                />
                <button onClick={() => setQty(qty + 1)} className="px-3 py-2 hover:bg-[var(--color-surface-tertiary)] transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!activeInStock || !isAuthenticated}
                className="btn btn-primary btn-lg flex-1"
              >
                <ShoppingCart className="w-5 h-5" />
                {isAuthenticated ? 'Add to Cart' : 'Login to Buy'}
              </button>

              <button
                onClick={() => toggle(product)}
                className={`btn btn-lg ${wishlisted ? 'text-red-500' : ''}`}
                style={{ backgroundColor: 'var(--color-surface-tertiary)', borderColor: 'var(--color-border)' }}
              >
                <Heart className="w-5 h-5" fill={wishlisted ? 'currentColor' : 'none'} />
              </button>
            </div>
          )}

          {/* Unit */}
          {product.unit && (
            <div className="text-xs" style={{ color: 'var(--color-content-tertiary)' }}>
              Unit: {product.unit.shortName || product.unit.name}
            </div>
          )}

          {/* Trust badges */}
          <div className="flex flex-wrap gap-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-content-secondary)' }}>
              <Package className="w-4 h-4" style={{ color: 'var(--color-brand)' }} /> Wholesale pricing
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-content-secondary)' }}>
              <Truck className="w-4 h-4" style={{ color: 'var(--color-brand)' }} /> Fast delivery
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-content-secondary)' }}>
              <ShieldCheck className="w-4 h-4" style={{ color: 'var(--color-brand)' }} /> Secure payment
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="pt-4">
              <h3 className="text-sm font-semibold mb-2">Description</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-content-secondary)' }}>{product.description}</p>
            </div>
          )}

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {product.tags.map((t, i) => (
                <Link key={i} to={`/products?search=${t}`} className="badge-brand text-[10px]">{t}</Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
