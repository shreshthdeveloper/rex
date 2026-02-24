import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { portalAPI } from '../../api';
import { useStoreSettings } from '../../layouts/StoreLayout';
import {
  User, ShoppingBag, BookOpen, Wallet, CreditCard, LogIn,
  Eye, XCircle, ArrowDownRight, ArrowUpRight, Calendar, Hash,
  Edit3, X, ChevronLeft, ChevronRight, FileText, DollarSign,
} from 'lucide-react';

const STATUS_MAP = {
  placed: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/20' },
  processing: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/20' },
  shipped: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/20' },
  in_transit: { bg: 'bg-cyan-500/15', text: 'text-violet-600', border: 'border-cyan-500/20' },
  out_for_delivery: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  delivered: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/20' },
  cancelled: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/20' },
  return: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/20' },
  partial_return: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/20' },
  failed_delivery: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/20' },
};
const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || { bg: 'bg-gray-500/15', text: 'text-slate-500', border: 'border-gray-500/20' };
  return <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${s.bg} ${s.text} ${s.border}`}>{status?.replace(/_/g, ' ')}</span>;
};

export default function Portal() {
  const { orgSlug } = useParams();
  const toast = useToast();
  const { isAuthenticated, role } = useAuth();
  const { settings } = useStoreSettings();
  const isCustomer = isAuthenticated && role === 'customer';
  const primary = settings?.primaryColor || '#06b6d4';

  const [activeTab, setActiveTab] = useState('orders');
  const tabs = [
    { id: 'orders', label: 'My Orders', icon: ShoppingBag },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
    { id: 'balance', label: 'Balance', icon: Wallet },
    { id: 'payments', label: 'Payments', icon: CreditCard },
  ];

  /* ─── Profile ─── */
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!isCustomer) return;
    setProfileLoading(true);
    try {
      const res = await portalAPI.getProfile(orgSlug);
      setProfile(res.data);
      setProfileForm({ name: res.data?.name || '', phone: res.data?.phone || '' });
    } catch (err) { toast.error(err.message || 'Failed to load profile'); }
    finally { setProfileLoading(false); }
  }, [orgSlug, isCustomer]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      await portalAPI.updateProfile(orgSlug, profileForm);
      toast.success('Profile updated');
      setEditProfile(false);
      fetchProfile();
    } catch (err) { toast.error(err.message || 'Failed to update profile'); }
    finally { setSaving(false); }
  };

  /* ─── Orders ─── */
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!isCustomer) return;
    setOrdersLoading(true);
    try {
      const res = await portalAPI.listOrders(orgSlug, { page: ordersPage, limit: 10 });
      setOrders(res.data?.orders || []);
      setOrdersTotalPages(res.data?.pagination?.pages || 1);
    } catch (err) { toast.error(err.message || 'Failed to load orders'); }
    finally { setOrdersLoading(false); }
  }, [orgSlug, ordersPage, isCustomer]);

  useEffect(() => { if (activeTab === 'orders') fetchOrders(); }, [fetchOrders, activeTab]);

  const viewOrder = async (id) => {
    setSelectedOrder(id);
    setDetailLoading(true);
    try {
      const res = await portalAPI.getOrder(orgSlug, id);
      setOrderDetail(res.data);
    } catch (err) { toast.error(err.message || 'Failed to load order'); }
    finally { setDetailLoading(false); }
  };

  const cancelOrder = async (id) => {
    setCancelling(true);
    try {
      await portalAPI.cancelOrder(orgSlug, id);
      toast.success('Order cancelled');
      setSelectedOrder(null); setOrderDetail(null);
      fetchOrders();
    } catch (err) { toast.error(err.message || 'Cannot cancel order'); }
    finally { setCancelling(false); }
  };

  /* ─── Ledger ─── */
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  useEffect(() => {
    if (activeTab !== 'ledger' || !isCustomer) return;
    (async () => {
      setLedgerLoading(true);
      try { const res = await portalAPI.getLedger(orgSlug); setLedger(res.data?.entries || []); }
      catch (err) { toast.error(err.message || 'Failed to load ledger'); }
      finally { setLedgerLoading(false); }
    })();
  }, [activeTab, orgSlug, isCustomer]);

  /* ─── Balance ─── */
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  useEffect(() => {
    if (activeTab !== 'balance' || !isCustomer) return;
    (async () => {
      setBalanceLoading(true);
      try { const res = await portalAPI.getBalance(orgSlug); setBalance(res.data); }
      catch (err) { toast.error(err.message || 'Failed to load balance'); }
      finally { setBalanceLoading(false); }
    })();
  }, [activeTab, orgSlug, isCustomer]);

  /* ─── Payments ─── */
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  useEffect(() => {
    if (activeTab !== 'payments' || !isCustomer) return;
    (async () => {
      setPaymentsLoading(true);
      try { const res = await portalAPI.getPayments(orgSlug); setPayments(res.data?.payments || []); }
      catch (err) { toast.error(err.message || 'Failed to load payments'); }
      finally { setPaymentsLoading(false); }
    })();
  }, [activeTab, orgSlug, isCustomer]);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  /* ─── Not authenticated ─── */
  if (!isCustomer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="max-w-sm w-full text-center space-y-6 p-8 rounded-2xl border border-violet-100 bg-violet-50/50 backdrop-blur-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: `${primary}15` }}>
            <LogIn size={28} style={{ color: primary }} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Customer Portal</h2>
          <p className="text-sm text-slate-500">Sign in to view your orders, ledger, and more.</p>
          <Link
            to={`/store/${orgSlug}/auth`}
            className="block w-full py-3 rounded-xl text-sm font-semibold text-slate-800 text-center transition-all hover:brightness-110"
            style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd)` }}
          >
            Login / Register
          </Link>
          <Link to={`/store/${orgSlug}`} className="text-xs text-gray-500 hover:text-slate-800 transition-colors">← Back to store</Link>
        </div>
      </div>
    );
  }

  /* ─── Skeleton helpers ─── */
  const Skeleton = ({ className }) => <div className={`skeleton-shimmer rounded ${className}`} />;
  const ListSkeleton = () => Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 skeleton-shimmer rounded-xl mb-3" />);

  return (
    <div className="space-y-6">

      {/* ─── Profile Card ─── */}
      <div className="rounded-2xl border border-violet-100 bg-violet-50/50 backdrop-blur-sm p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-slate-800" style={{ background: `${primary}20`, color: primary }}>
              {profile?.name?.[0]?.toUpperCase() || <User size={24} />}
            </div>
            {profileLoading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>
            ) : (
              <div>
                <h3 className="text-lg font-bold text-slate-800">{profile?.name || 'Customer'}</h3>
                <p className="text-sm text-slate-500">{profile?.email}</p>
                {profile?.phone && <p className="text-xs text-gray-500 mt-0.5">{profile.phone}</p>}
              </div>
            )}
          </div>
          <button
            onClick={() => setEditProfile(true)}
            className="p-2 rounded-lg text-gray-500 hover:text-slate-800 hover:bg-violet-50 transition-colors"
          >
            <Edit3 size={16} />
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editProfile && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditProfile(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-violet-200 bg-white backdrop-blur-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Edit Profile</h3>
              <button onClick={() => setEditProfile(false)} className="text-gray-500 hover:text-slate-800"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Name</label>
                <input className="w-full glass-input px-3 py-2.5 text-sm rounded-lg" value={profileForm.name} onChange={(e) => setProfileForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Phone</label>
                <input className="w-full glass-input px-3 py-2.5 text-sm rounded-lg" value={profileForm.phone} onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditProfile(false)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-500 border border-violet-100 hover:bg-violet-50">Cancel</button>
              <button onClick={handleUpdateProfile} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-800 disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd)` }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 p-1 rounded-xl border border-violet-100 bg-violet-50/50 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap flex-1 justify-center ${
                isActive ? 'text-slate-800 shadow-lg' : 'text-gray-500 hover:text-slate-800 hover:bg-violet-50'
              }`}
              style={isActive ? { background: `${primary}20`, color: primary } : {}}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ─── Orders Tab ─── */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {ordersLoading ? <ListSkeleton /> : orders.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-violet-100 bg-violet-50/50">
              <ShoppingBag size={44} className="mx-auto text-gray-700 mb-3" />
              <p className="text-slate-500 font-medium">No orders yet</p>
              <Link to={`/store/${orgSlug}`} className="text-xs mt-2 inline-block hover:underline" style={{ color: primary }}>Browse Products</Link>
            </div>
          ) : (
            <>
              {orders.map((order) => (
                <button
                  key={order._id}
                  onClick={() => viewOrder(order._id)}
                  className="w-full text-left p-4 rounded-xl border border-violet-100 bg-violet-50/50 hover:bg-violet-50 hover:border-violet-200 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${primary}10` }}>
                        <Hash size={16} style={{ color: primary }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{order.orderNumber || order._id.slice(-8)}</p>
                        <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                          <Calendar size={10} /> {fmtDate(order.createdAt)}
                          {order.items && <span className="ml-1">· {order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <StatusBadge status={order.status} />
                        <p className="text-sm font-bold mt-1" style={{ color: primary }}>{fmtCurrency(order.grandTotal)}</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-600 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                </button>
              ))}

              {/* Pagination */}
              {ordersTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button onClick={() => setOrdersPage(p => Math.max(1, p - 1))} disabled={ordersPage <= 1} className="px-3 py-2 rounded-lg text-xs text-slate-500 border border-violet-100 disabled:opacity-30"><ChevronLeft size={14} /></button>
                  <span className="text-xs text-gray-500">Page {ordersPage} of {ordersTotalPages}</span>
                  <button onClick={() => setOrdersPage(p => Math.min(ordersTotalPages, p + 1))} disabled={ordersPage >= ordersTotalPages} className="px-3 py-2 rounded-lg text-xs text-slate-500 border border-violet-100 disabled:opacity-30"><ChevronRight size={14} /></button>
                </div>
              )}
            </>
          )}

          {/* Order Detail Modal */}
          {selectedOrder && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setSelectedOrder(null); setOrderDetail(null); }} />
              <div className="relative w-full max-w-lg rounded-2xl border border-violet-200 bg-white backdrop-blur-xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-800">Order Details</h3>
                  <button onClick={() => { setSelectedOrder(null); setOrderDetail(null); }} className="text-gray-500 hover:text-slate-800"><X size={20} /></button>
                </div>
                {detailLoading ? (
                  <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-12 w-full" /></div>
                ) : orderDetail ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-slate-500">#{orderDetail.orderNumber || orderDetail._id.slice(-8)}</p>
                        <p className="text-[11px] text-gray-500">{fmtDate(orderDetail.createdAt)}</p>
                      </div>
                      <StatusBadge status={orderDetail.status} />
                    </div>
                    <div className="border-t border-violet-100 pt-3 space-y-2">
                      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Items</p>
                      {(orderDetail.items || []).map((item, i) => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-violet-50 last:border-0">
                          <div>
                            <p className="text-sm text-slate-800">{item.productSnapshot?.name || item.product?.name || item.name || 'Product'}</p>
                            <p className="text-[11px] text-gray-500">Qty: {item.quantity} × {fmtCurrency(item.unitPrice)}</p>
                          </div>
                          <p className="text-sm font-medium text-slate-600">{fmtCurrency(item.lineTotal || (item.quantity * item.unitPrice))}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl border" style={{ borderColor: `${primary}25`, background: `${primary}08` }}>
                      <span className="text-sm text-slate-600">Grand Total</span>
                      <span className="text-xl font-bold" style={{ color: primary }}>{fmtCurrency(orderDetail.grandTotal)}</span>
                    </div>
                    {orderDetail.shippingAddress && (
                      <div className="text-xs text-gray-500"><p className="font-medium text-slate-500 mb-1">Shipping</p><p>{orderDetail.shippingAddress.line1}, {orderDetail.shippingAddress.city}, {orderDetail.shippingAddress.state} {orderDetail.shippingAddress.zip}</p></div>
                    )}
                    {(orderDetail.status === 'placed' || orderDetail.status === 'processing') && (
                      <button
                        onClick={() => cancelOrder(selectedOrder)}
                        disabled={cancelling}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        <XCircle size={16} /> {cancelling ? 'Cancelling...' : 'Cancel Order'}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Ledger Tab ─── */}
      {activeTab === 'ledger' && (
        <div className="rounded-xl border border-violet-100 overflow-hidden">
          {ledgerLoading ? <div className="p-6"><ListSkeleton /></div> : ledger.length === 0 ? (
            <div className="text-center py-12"><FileText size={40} className="mx-auto text-gray-700 mb-3" /><p className="text-slate-500">No ledger entries</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-violet-100">
                    <th className="px-4 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="px-4 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wide">Description</th>
                    <th className="px-4 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wide text-right">Debit</th>
                    <th className="px-4 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wide text-right">Credit</th>
                    <th className="px-4 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wide text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((r, i) => (
                    <tr key={i} className="border-b border-violet-50 hover:bg-violet-50/50">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(r.date || r.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-800">{r.narration || r.transactionType}</td>
                      <td className="px-4 py-3 text-xs text-right text-red-400">{r.debit ? fmtCurrency(r.debit) : '—'}</td>
                      <td className="px-4 py-3 text-xs text-right text-emerald-400">{r.credit ? fmtCurrency(r.credit) : '—'}</td>
                      <td className="px-4 py-3 text-xs text-right text-slate-600 font-medium">{fmtCurrency(r.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Balance Tab ─── */}
      {activeTab === 'balance' && (
        balanceLoading ? <div className="space-y-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-violet-100 bg-violet-50/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${primary}15` }}>
                  <DollarSign size={20} style={{ color: primary }} />
                </div>
                <span className="text-xs text-gray-500 uppercase tracking-wide">Account Balance</span>
              </div>
              <p className="text-3xl font-bold" style={{ color: primary }}>{fmtCurrency(Math.abs(balance?.currentBalance ?? 0))}</p>
              <p className="text-xs text-gray-500 mt-1">
                {(balance?.currentBalance ?? 0) > 0 ? 'Outstanding' : (balance?.currentBalance ?? 0) < 0 ? 'Credit' : 'Settled'}
              </p>
            </div>
            <div className="p-5 rounded-2xl border border-violet-100 bg-violet-50/50 flex items-center gap-4">
              <Wallet size={24} className="text-gray-500 flex-shrink-0" />
              <p className="text-sm text-slate-500 leading-relaxed">
                {(balance?.currentBalance ?? 0) > 0
                  ? 'You have an outstanding balance to pay.'
                  : (balance?.currentBalance ?? 0) < 0
                  ? 'You have credit available.'
                  : 'Your account is settled.'}
              </p>
            </div>
          </div>
        )
      )}

      {/* ─── Payments Tab ─── */}
      {activeTab === 'payments' && (
        <div className="rounded-xl border border-violet-100 overflow-hidden">
          {paymentsLoading ? <div className="p-6"><ListSkeleton /></div> : payments.length === 0 ? (
            <div className="text-center py-12"><CreditCard size={40} className="mx-auto text-gray-700 mb-3" /><p className="text-slate-500">No payments found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-violet-100">
                    <th className="px-4 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="px-4 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wide">Method</th>
                    <th className="px-4 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wide">Reference</th>
                    <th className="px-4 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wide text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((r, i) => (
                    <tr key={i} className="border-b border-violet-50 hover:bg-violet-50/50">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(r.date || r.createdAt)}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">{r.method || r.paymentMethod || '—'}</span></td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{r.reference || r.transactionId || '—'}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: primary }}>{fmtCurrency(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
