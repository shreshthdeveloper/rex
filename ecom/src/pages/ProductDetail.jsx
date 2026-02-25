import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Minus, Plus, ChevronRight, Package, Truck, Shield } from 'lucide-react';
import { getProductBySlug, getProductById } from '../api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

export default function ProductDetail() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [availability, setAvailability] = useState({});
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [selectedImg, setSelectedImg] = useState(0);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    // Try slug first, then ID
    const fetcher = slug.match(/^[0-9a-fA-F]{24}$/) ? getProductById(slug) : getProductBySlug(slug);
    fetcher
      .then((r) => {
        setProduct(r.data.product);
        setVariants(r.data.variants || []);
        setAvailability(r.data.availability || {});
        setSelectedImg(0);
        setSelectedVariant(null);
        setQty(1);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
        <Link to="/products" className="text-brand-400 hover:underline">Back to products</Link>
      </div>
    );
  }

  const activeProduct = selectedVariant || product;
  const images = activeProduct.images?.length ? activeProduct.images : product.images || [];
  const price = activeProduct.basePrice || 0;
  const compareAt = activeProduct.compareAtPrice || 0;
  const cats = product.categories || [];
  const inStock = availability.inStock !== false;

  const handleAddToCart = () => {
    const cartProduct = selectedVariant ? {
      ...selectedVariant,
      name: `${product.name} - ${selectedVariant.variantValue}`,
    } : product;
    addItem(cartProduct, qty);
    toast.success(`${cartProduct.name} added to cart`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-white">Home</Link>
        <ChevronRight size={14} />
        <Link to="/products" className="hover:text-white">Products</Link>
        {cats[0] && (
          <>
            <ChevronRight size={14} />
            <Link to={`/products?category=${cats[0]._id}`} className="hover:text-white">{cats[0].name}</Link>
          </>
        )}
        <ChevronRight size={14} />
        <span className="text-gray-300 truncate">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Images */}
        <div>
          <div className="glass-card overflow-hidden rounded-xl aspect-square bg-gray-900">
            {images[selectedImg]?.url ? (
              <img src={images[selectedImg].url} alt={product.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={80} className="text-gray-700" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImg(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === selectedImg ? 'border-brand-500' : 'border-gray-800 hover:border-gray-600'}`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">SKU: {activeProduct.sku || product.sku}</p>
            <h1 className="text-2xl lg:text-3xl font-bold">{product.name}</h1>
            {selectedVariant && (
              <p className="text-sm text-brand-400 mt-1">{selectedVariant.variantAttribute}: {selectedVariant.variantValue}</p>
            )}
          </div>

          {/* Categories */}
          {cats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <Link
                  key={c._id}
                  to={`/products?category=${c._id}`}
                  className="text-xs uppercase tracking-wide text-brand-400 bg-brand-500/10 px-3 py-1 rounded-full hover:bg-brand-500/20 transition-colors"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold">${price.toFixed(2)}</span>
            {compareAt > price && price > 0 && (
              <>
                <span className="text-lg text-gray-500 line-through">${compareAt.toFixed(2)}</span>
                <span className="text-sm text-red-400 font-semibold">{Math.round((1 - price / compareAt) * 100)}% OFF</span>
              </>
            )}
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className={`text-sm ${inStock ? 'text-emerald-400' : 'text-red-400'}`}>
              {inStock ? 'In Stock' : 'Out of Stock'}
              {availability.availableQty > 0 && ` (${availability.availableQty} available)`}
            </span>
          </div>

          {/* Variants */}
          {variants.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-400 mb-2">
                {variants[0]?.variantAttribute || 'Variant'}
              </p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v._id}
                    onClick={() => setSelectedVariant(v._id === selectedVariant?._id ? null : v)}
                    className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                      v._id === selectedVariant?._id
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                    }`}
                  >
                    {v.variantValue || v.name}
                    {v.basePrice > 0 && <span className="ml-1 text-gray-500">${v.basePrice.toFixed(2)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center border border-gray-700 rounded-lg">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 text-gray-400 hover:text-white">
                <Minus size={16} />
              </button>
              <span className="px-4 py-2 text-sm font-medium min-w-[3rem] text-center">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="px-3 py-2 text-gray-400 hover:text-white">
                <Plus size={16} />
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              <ShoppingCart size={18} />
              Add to Cart
            </button>
          </div>

          {/* Trust signals */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-800">
            {[
              { icon: Truck, text: 'Fast Delivery' },
              { icon: Shield, text: 'Secure Payment' },
              { icon: Package, text: 'Quality Assured' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex flex-col items-center gap-1 text-center">
                <Icon size={18} className="text-gray-500" />
                <span className="text-xs text-gray-500">{text}</span>
              </div>
            ))}
          </div>

          {/* Description */}
          {product.description && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
