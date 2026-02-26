import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { customerService } from '../services/customerService';
import { CURRENCY } from '../config/constants';
import { MapPin, Tag, Wallet, ShoppingBag, ArrowLeft, Check, Loader2, Plus, Truck, Shield, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
  const { items, subtotal, totalItems, clearCart } = useCart();
  const { customer } = useAuth();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [useBalance, setUseBalance] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [loading, setLoading] = useState(true);

  // New address form
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [addrForm, setAddrForm] = useState({ label: 'Home', line1: '', line2: '', city: '', state: '', pincode: '', phone: '', isDefault: false });
  const [addrSaving, setAddrSaving] = useState(false);

  useEffect(() => {
    if (items.length === 0) { navigate('/cart'); return; }
    Promise.all([
      customerService.listAddresses(),
      customerService.getBalance(),
    ]).then(([addrs, bal]) => {
      setAddresses(addrs);
      const def = addrs.find((a) => a.isDefault) || addrs[0];
      if (def) setSelectedAddress(def._id);
      setBalance(bal);
    }).catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const result = await customerService.validateCoupon(couponCode, subtotal);
      setCouponResult(result);
      toast.success(`Coupon applied! Discount: ${CURRENCY}${result.discountAmount?.toFixed(2)}`);
    } catch (e) {
      toast.error(e.message);
      setCouponResult(null);
    } finally { setCouponLoading(false); }
  };

  const removeCoupon = () => { setCouponResult(null); setCouponCode(''); };

  const saveNewAddress = async (e) => {
    e.preventDefault();
    if (!addrForm.line1 || !addrForm.city || !addrForm.state || !addrForm.pincode) {
      return toast.error('Please fill required address fields');
    }
    setAddrSaving(true);
    try {
      const newAddr = await customerService.addAddress(addrForm);
      setAddresses((prev) => [...prev, newAddr]);
      setSelectedAddress(newAddr._id);
      setShowNewAddr(false);
      setAddrForm({ label: 'Home', line1: '', line2: '', city: '', state: '', pincode: '', phone: '', isDefault: false });
      toast.success('Address added');
    } catch (e) { toast.error(e.message); }
    finally { setAddrSaving(false); }
  };

  const discount = couponResult?.discountAmount || 0;
  const walletCredit = balance?.currentBalance < 0 ? Math.abs(balance.currentBalance) : 0;
  const walletDeduct = useBalance ? Math.min(walletCredit, subtotal - discount) : 0;
  const grandTotal = Math.max(0, subtotal - discount - walletDeduct);

  const handlePlaceOrder = async () => {
    if (!selectedAddress && addresses.length > 0) return toast.error('Please select a shipping address');
    setPlacing(true);
    try {
      const addr = addresses.find((a) => a._id === selectedAddress);
      const payload = {
        items: items.map((item) => ({
          productId: item.productId || item.id,
          quantity: item.quantity,
        })),
        shippingAddress: addr ? {
          label: addr.label,
          line1: addr.line1, line2: addr.line2,
          city: addr.city, state: addr.state, pincode: addr.pincode,
          phone: addr.phone,
        } : undefined,
        couponCode: couponResult ? couponCode : undefined,
        useBalance,
        paymentMethod: 'credit',
        notes,
      };
      const order = await customerService.placeOrder(payload);
      clearCart();
      toast.success(`Order placed! #${order.orderNumber}`);
      navigate('/account?tab=orders');
    } catch (e) {
      toast.error(e.message);
    } finally { setPlacing(false); }
  };

  if (loading) {
    return (
      <div className="container-main py-10">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container-main py-6">
      <Link to="/cart" className="inline-flex items-center gap-1 text-sm text-content/60 hover:text-brand mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Cart
      </Link>
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Shipping Address */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand" /> Shipping Address
              </h3>
              <button onClick={() => setShowNewAddr(!showNewAddr)} className="text-sm text-brand hover:underline flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add New
              </button>
            </div>

            {showNewAddr && (
              <form onSubmit={saveNewAddress} className="mb-4 p-4 border border-border rounded-lg bg-surface-alt space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Label</label>
                    <select value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })} className="input-field text-sm">
                      <option>Home</option><option>Office</option><option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Phone</label>
                    <input value={addrForm.phone} onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })} className="input-field text-sm" placeholder="Phone" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Address Line 1 *</label>
                  <input value={addrForm.line1} onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })} className="input-field text-sm" required />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Address Line 2</label>
                  <input value={addrForm.line2} onChange={(e) => setAddrForm({ ...addrForm, line2: e.target.value })} className="input-field text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">City *</label>
                    <input value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })} className="input-field text-sm" required />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">State *</label>
                    <input value={addrForm.state} onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })} className="input-field text-sm" required />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Pincode *</label>
                    <input value={addrForm.pincode} onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })} className="input-field text-sm" required />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={addrSaving} className="btn btn-primary btn-sm">{addrSaving ? 'Saving...' : 'Save Address'}</button>
                  <button type="button" onClick={() => setShowNewAddr(false)} className="btn btn-secondary btn-sm">Cancel</button>
                </div>
              </form>
            )}

            {addresses.length === 0 && !showNewAddr ? (
              <p className="text-content/50 text-sm">No addresses found. Add a new address to continue.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {addresses.map((addr) => (
                  <label
                    key={addr._id}
                    className={`card p-4 cursor-pointer transition-all ${selectedAddress === addr._id ? 'ring-2 ring-brand' : 'hover:border-brand/30'}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="address"
                        checked={selectedAddress === addr._id}
                        onChange={() => setSelectedAddress(addr._id)}
                        className="mt-1 accent-[var(--color-brand)]"
                      />
                      <div className="text-sm">
                        <p className="font-semibold">{addr.label} {addr.isDefault && <span className="badge badge-info text-xs ml-1">Default</span>}</p>
                        <p className="text-content/60">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                        <p className="text-content/60">{addr.city}, {addr.state} – {addr.pincode}</p>
                        {addr.phone && <p className="text-content/50">{addr.phone}</p>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Coupon */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Tag className="w-5 h-5 text-brand" /> Coupon Code
            </h3>
            {couponResult ? (
              <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-green-400">{couponCode.toUpperCase()}</span>
                  <span className="text-sm text-content/60">– {CURRENCY}{discount.toFixed(2)} off</span>
                </div>
                <button onClick={removeCoupon} className="text-sm text-red-400 hover:underline">Remove</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter coupon code"
                  className="input-field flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                />
                <button onClick={applyCoupon} disabled={couponLoading} className="btn btn-primary btn-md">
                  {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </button>
              </div>
            )}
          </div>

          {/* Wallet Balance */}
          {walletCredit > 0 && (
            <div className="card p-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useBalance}
                  onChange={(e) => setUseBalance(e.target.checked)}
                  className="w-5 h-5 accent-[var(--color-brand)]"
                />
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-brand" />
                  <div>
                    <span className="font-semibold">Use wallet balance</span>
                    <p className="text-sm text-content/60">Available: {CURRENCY}{walletCredit.toFixed(2)} — will deduct {CURRENCY}{walletDeduct.toFixed(2)}</p>
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* Notes */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3">Order Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any special instructions for your order..."
              className="input-field resize-none"
            />
          </div>
        </div>

        {/* Right — Summary */}
        <div className="space-y-4">
          <div className="card p-6 sticky top-24">
            <h3 className="text-lg font-bold mb-4">Order Summary</h3>

            {/* Items preview */}
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="line-clamp-1 flex-1" style={{ color: 'var(--color-content-secondary)' }}>{item.name} × {item.quantity}</span>
                  <span className="ml-2 font-medium">{CURRENCY}{((item.price || 0) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-content-secondary)' }}>Subtotal ({totalItems} items)</span>
                <span>{CURRENCY}{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Coupon Discount</span>
                  <span>-{CURRENCY}{discount.toFixed(2)}</span>
                </div>
              )}
              {walletDeduct > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Wallet Balance</span>
                  <span>-{CURRENCY}{walletDeduct.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-bold text-lg" style={{ borderColor: 'var(--color-border)' }}>
                <span>Total</span>
                <span style={{ color: 'var(--color-brand)' }}>{CURRENCY}{grandTotal.toFixed(2)}</span>
              </div>
              {grandTotal > 0 && (
                <p className="text-xs" style={{ color: 'var(--color-content-tertiary)' }}>Balance of {CURRENCY}{grandTotal.toFixed(2)} will be added to your account</p>
              )}
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={placing || (addresses.length === 0)}
              className="btn btn-primary btn-md w-full mt-4 flex items-center justify-center gap-2"
            >
              {placing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Placing Order...</>
              ) : (
                <><ShoppingBag className="w-4 h-4" /> Place Order</>
              )}
            </button>

            {/* Trust badges */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { icon: Truck, text: 'Fast Delivery' },
                { icon: Shield, text: 'Secure' },
                { icon: Clock, text: '24×7 Support' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex flex-col items-center text-center text-xs text-content/50 gap-1">
                  <Icon className="w-4 h-4" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
