import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { placeOrder } from '../api';

export default function Checkout() {
  const { items, totalPrice, clearCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState({ label: 'Default', line1: '', city: '', state: '', zip: '', country: '' });

  const updateAddr = (k, v) => setAddress((p) => ({ ...p, [k]: v }));

  const handlePlace = async (e) => {
    e.preventDefault();
    if (!items.length) return toast.error('Cart is empty');
    if (!address.line1 || !address.city) return toast.error('Please enter shipping address');

    setLoading(true);
    try {
      const orderItems = items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
      const res = await placeOrder({
        items: orderItems,
        shippingAddress: address,
        paymentMethod: 'cod',
      });
      clearCart();
      toast.success('Order placed successfully!');
      navigate(`/account?tab=orders`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!items.length) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      <form onSubmit={handlePlace} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shipping form */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="font-semibold mb-4">Shipping Address</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-sm text-gray-400 mb-1 block">Address Line *</label>
              <input type="text" value={address.line1} onChange={(e) => updateAddr('line1', e.target.value)}
                className="input-field" placeholder="123 Main St, Suite 100" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">City *</label>
              <input type="text" value={address.city} onChange={(e) => updateAddr('city', e.target.value)}
                className="input-field" placeholder="Phoenix" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">State</label>
              <input type="text" value={address.state} onChange={(e) => updateAddr('state', e.target.value)}
                className="input-field" placeholder="AZ" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">ZIP Code</label>
              <input type="text" value={address.zip} onChange={(e) => updateAddr('zip', e.target.value)}
                className="input-field" placeholder="85001" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Country</label>
              <input type="text" value={address.country} onChange={(e) => updateAddr('country', e.target.value)}
                className="input-field" placeholder="US" />
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div className="glass-card p-6 h-fit sticky top-24">
          <h3 className="font-semibold mb-4">Order Summary</h3>

          <div className="flex flex-col gap-2 mb-4 max-h-60 overflow-y-auto">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between text-sm">
                <span className="text-gray-400 truncate mr-2">{item.name} × {item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <hr className="my-3 border-gray-800" />

          <div className="flex justify-between font-bold text-lg mb-4">
            <span>Total</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Placing order...' : 'Place Order'}
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">Payment will be collected on delivery</p>
        </div>
      </form>
    </div>
  );
}
