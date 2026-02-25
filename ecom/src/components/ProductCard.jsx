import { Link } from 'react-router-dom';
import { ShoppingCart, Eye } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const toast = useToast();

  const img = product.images?.[0]?.url || null;
  const cats = product.categories || [];
  const price = product.basePrice ?? 0;
  const compareAt = product.compareAtPrice ?? 0;
  const slug = product.slug || product._id;

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <Link
      to={`/product/${slug}`}
      className="glass-card group flex flex-col overflow-hidden hover:border-gray-700 transition-all"
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-900 overflow-hidden">
        {img ? (
          <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700">
            <ShoppingCart size={48} />
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button onClick={handleAdd} className="bg-brand-500 hover:bg-brand-600 text-white p-2.5 rounded-full transition-colors" title="Add to cart">
            <ShoppingCart size={18} />
          </button>
          <span className="bg-gray-800 hover:bg-gray-700 text-white p-2.5 rounded-full transition-colors" title="Quick view">
            <Eye size={18} />
          </span>
        </div>
        {compareAt > price && price > 0 && (
          <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
            {Math.round((1 - price / compareAt) * 100)}% OFF
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-1">
        <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-brand-400 transition-colors">{product.name}</h3>
        <p className="text-xs text-gray-500">SKU: {product.sku}</p>
        {cats.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {cats.slice(0, 2).map((c) => (
              <span key={c._id || c} className="text-[10px] uppercase tracking-wide text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">
                {c.name || c}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto pt-2 flex items-baseline gap-2">
          {price > 0 && <span className="text-base font-bold text-white">${price.toFixed(2)}</span>}
          {compareAt > price && price > 0 && (
            <span className="text-xs text-gray-500 line-through">${compareAt.toFixed(2)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
