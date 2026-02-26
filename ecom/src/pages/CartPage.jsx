import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { CURRENCY } from '../config/constants';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';

export default function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, subtotal, totalItems } = useCart();
  const { isAuthenticated } = useAuth();

  if (items.length === 0) {
    return (
      <div className="container-main py-20 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--color-content-tertiary)' }} />
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="mb-6" style={{ color: 'var(--color-content-secondary)' }}>Looks like you haven't added anything yet.</p>
        <Link to="/products" className="btn btn-primary btn-md inline-flex items-center gap-2">
          Continue Shopping <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="container-main py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Shopping Cart ({totalItems})</h1>
        <button onClick={clearCart} className="text-sm flex items-center gap-1" style={{ color: 'var(--color-status-error)' }}>
          <Trash2 className="w-4 h-4" /> Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
              <div key={item.id} className="card p-4 flex gap-4">
                <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-surface-secondary)' }}>
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold uppercase" style={{ color: 'var(--color-content-tertiary)' }}>
                      {item.name?.[0] || '?'}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <Link to={`/products/${item.slug}`} className="font-semibold hover:text-[var(--color-brand)] transition-colors line-clamp-2">{item.name}</Link>
                  {item.sku && <p className="text-xs mt-0.5" style={{ color: 'var(--color-content-tertiary)' }}>SKU: {item.sku}</p>}
                  <p className="font-bold mt-1" style={{ color: 'var(--color-brand)' }}>
                    {isAuthenticated ? `${CURRENCY}${(item.price || 0).toFixed(2)}` : 'Login to see prices'}
                  </p>
                </div>

                <div className="flex flex-col items-end justify-between gap-2">
                  <button onClick={() => removeItem(item.id)} className="p-1 transition-colors" style={{ color: 'var(--color-content-tertiary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-status-error)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-content-tertiary)'}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-center rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-secondary)]" disabled={item.quantity <= 1}>
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-secondary)]">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold">
                    {isAuthenticated ? `${CURRENCY}${((item.price || 0) * item.quantity).toFixed(2)}` : '—'}
                  </p>
                </div>
              </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="card p-6 h-fit sticky top-24">
          <h3 className="text-lg font-bold mb-4">Order Summary</h3>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-content-secondary)' }}>Items ({totalItems})</span>
              <span>{isAuthenticated ? `${CURRENCY}${subtotal.toFixed(2)}` : 'Login to see prices'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-content-secondary)' }}>Shipping</span>
              <span style={{ color: 'var(--color-status-success)' }}>Calculated at checkout</span>
            </div>
          </div>
          <div className="border-t pt-3 mb-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex justify-between font-bold text-lg">
              <span>Subtotal</span>
              <span style={{ color: 'var(--color-brand)' }}>
                {isAuthenticated ? `${CURRENCY}${subtotal.toFixed(2)}` : 'Login to see prices'}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-content-tertiary)' }}>Tax included where applicable</p>
          </div>
          {isAuthenticated ? (
            <Link to="/checkout" className="btn btn-primary btn-md w-full flex items-center justify-center gap-2">
              Proceed to Checkout <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link to="/login" className="btn btn-primary btn-md w-full flex items-center justify-center gap-2">
              Login to Continue <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          <Link to="/products" className="btn btn-secondary btn-md w-full mt-2 text-center block">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
