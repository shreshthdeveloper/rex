import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Cart() {
  const { items, updateQty, removeItem, clearCart, totalPrice, totalItems } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <ShoppingBag size={64} className="mx-auto text-gray-700 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Looks like you haven&apos;t added any products yet.</p>
        <Link to="/products" className="btn-primary">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Shopping Cart ({totalItems})</h1>
        <button onClick={clearCart} className="text-sm text-red-400 hover:text-red-300 transition-colors">Clear all</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart items */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.productId} className="glass-card p-4 flex gap-4">
              {/* Image */}
              <div className="w-20 h-20 rounded-lg bg-gray-900 overflow-hidden shrink-0">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-700">
                    <ShoppingBag size={24} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Link to={`/product/${item.productId}`} className="text-sm font-semibold hover:text-brand-400 line-clamp-2 transition-colors">
                  {item.name}
                </Link>
                <p className="text-xs text-gray-500 mt-0.5">SKU: {item.sku}</p>
                <p className="text-sm font-medium mt-1">${item.price.toFixed(2)}</p>
              </div>

              {/* Qty controls */}
              <div className="flex flex-col items-end justify-between">
                <button onClick={() => removeItem(item.productId)} className="text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={16} />
                </button>
                <div className="flex items-center border border-gray-700 rounded-lg">
                  <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="px-2 py-1 text-gray-400 hover:text-white">
                    <Minus size={14} />
                  </button>
                  <span className="px-3 py-1 text-sm font-medium">{item.quantity}</span>
                  <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="px-2 py-1 text-gray-400 hover:text-white">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="glass-card p-6 h-fit sticky top-24">
          <h3 className="font-semibold mb-4">Order Summary</h3>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal ({totalItems} items)</span>
              <span className="text-white">${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Shipping</span>
              <span className="text-emerald-400">Calculated at checkout</span>
            </div>
          </div>

          <hr className="my-4 border-gray-800" />

          <div className="flex justify-between font-bold text-lg mb-4">
            <span>Total</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>

          {user ? (
            <button
              onClick={() => navigate('/checkout')}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              Proceed to Checkout <ArrowRight size={16} />
            </button>
          ) : (
            <div>
              <Link to="/login" className="btn-primary w-full flex items-center justify-center gap-2 mb-2">
                Login to Checkout <ArrowRight size={16} />
              </Link>
              <p className="text-xs text-center text-gray-500">You need to login to place an order</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
