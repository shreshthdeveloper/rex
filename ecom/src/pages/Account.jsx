import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Package, BookOpen, MapPin, CreditCard, User, LogOut,
  Eye, XCircle, ChevronRight, Calendar, Hash, DollarSign,
  Plus, Trash2, Edit2, Save, X, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../api';

const TABS = [
  { key: 'orders', label: 'Orders', icon: Package },
  { key: 'ledger', label: 'Ledger', icon: BookOpen },
  { key: 'addresses', label: 'Addresses', icon: MapPin },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'profile', label: 'Profile', icon: User },
];

export default function Account() {
  const [params, setParams] = useSearchParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const tab = params.get('tab') || 'orders';

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-2">Please login</h2>
        <Link to="/login" className="text-brand-400 hover:underline">Go to login</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Hi, {user.name}</h1>
        <button onClick={() => { logout(); navigate('/'); }}
          className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300">
          <LogOut size={14} /> Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto no-scrollbar">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setParams({ tab: key })}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              tab === key ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'ledger' && <LedgerTab />}
      {tab === 'addresses' && <AddressesTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'profile' && <ProfileTab />}
    </div>
  );
}

/* ─────────────── ORDERS ─────────────── */
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({});
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    const q = { page, limit: 10 };
    if (status) q.status = status;
    api.getMyOrders(q)
      .then((r) => { setOrders(r.data?.orders || []); setPagination(r.data?.pagination || {}); })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, status]);

  const handleCancel = async (id) => {
    if (!confirm('Cancel this order?')) return;
    try {
      await api.cancelOrder(id);
      toast.success('Order cancelled');
      load();
      setDetail(null);
    } catch (err) { toast.error(err.message); }
  };

  const statusColor = (s) => ({
    placed: 'bg-blue-500/10 text-blue-400',
    processing: 'bg-yellow-500/10 text-yellow-400',
    shipped: 'bg-purple-500/10 text-purple-400',
    delivered: 'bg-emerald-500/10 text-emerald-400',
    cancelled: 'bg-red-500/10 text-red-400',
  }[s] || 'bg-gray-500/10 text-gray-400');

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        {['', 'placed', 'processing', 'shipped', 'delivered', 'cancelled'].map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${s === status ? 'border-brand-500 text-brand-400 bg-brand-500/10' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Package size={48} className="mx-auto mb-2 text-gray-700" />
          <p>No orders found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <div key={o._id} className="glass-card p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-sm">{o.orderNumber}</p>
                    <p className="text-xs text-gray-500">{fmtDate(o.createdAt)}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColor(o.status)}`}>
                    {o.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">${o.grandTotal?.toFixed(2)}</span>
                  <button onClick={() => setDetail(o)} className="text-gray-400 hover:text-white">
                    <Eye size={16} />
                  </button>
                  {['placed', 'processing'].includes(o.status) && (
                    <button onClick={() => handleCancel(o._id)} className="text-red-400 hover:text-red-300">
                      <XCircle size={16} />
                    </button>
                  )}
                </div>
              </div>
              {/* Items preview */}
              <div className="mt-2 flex flex-wrap gap-2">
                {o.items?.slice(0, 3).map((it, i) => (
                  <span key={i} className="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded">
                    {it.productSnapshot?.name || 'Item'} × {it.quantity}
                  </span>
                ))}
                {o.items?.length > 3 && <span className="text-xs text-gray-600">+{o.items.length - 3} more</span>}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded text-sm ${p === page ? 'bg-brand-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{detail.orderNumber}</h3>
              <button onClick={() => setDetail(null)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div className="text-gray-500">Status</div>
              <div><span className={`px-2 py-0.5 text-xs rounded-full ${statusColor(detail.status)}`}>{detail.status}</span></div>
              <div className="text-gray-500">Date</div><div>{fmtDate(detail.createdAt)}</div>
              <div className="text-gray-500">Subtotal</div><div>${detail.subtotal?.toFixed(2)}</div>
              {detail.discountAmount > 0 && (<><div className="text-gray-500">Discount</div><div className="text-emerald-400">-${detail.discountAmount?.toFixed(2)}</div></>)}
              {detail.taxTotal > 0 && (<><div className="text-gray-500">Tax</div><div>${detail.taxTotal?.toFixed(2)}</div></>)}
              <div className="text-gray-500 font-medium">Grand Total</div><div className="font-bold">${detail.grandTotal?.toFixed(2)}</div>
              <div className="text-gray-500">Paid</div><div>${detail.amountPaid?.toFixed(2)}</div>
              <div className="text-gray-500">Balance Due</div><div className={detail.balanceDue > 0 ? 'text-red-400' : 'text-emerald-400'}>${detail.balanceDue?.toFixed(2)}</div>
            </div>

            {/* Shipping */}
            {detail.shippingAddress?.line1 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Shipping Address</p>
                <p className="text-sm text-gray-300">
                  {detail.shippingAddress.line1}, {detail.shippingAddress.city} {detail.shippingAddress.state} {detail.shippingAddress.zip}
                </p>
              </div>
            )}

            {/* Items */}
            <div className="border-t border-gray-800 pt-3">
              <p className="text-xs text-gray-500 mb-2">Items</p>
              {detail.items?.map((it, i) => (
                <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-800/50 last:border-0">
                  <div>
                    <p className="text-gray-200">{it.productSnapshot?.name}</p>
                    <p className="text-xs text-gray-500">SKU: {it.productSnapshot?.sku} · Qty: {it.quantity}</p>
                  </div>
                  <span className="shrink-0">${it.lineTotal?.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {['placed', 'processing'].includes(detail.status) && (
              <button onClick={() => handleCancel(detail._id)}
                className="mt-4 w-full py-2 text-sm border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                Cancel Order
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── LEDGER ─────────────── */
function LedgerTab() {
  const [entries, setEntries] = useState([]);
  const [balance, setBalance] = useState(null);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getMyLedger({ page, limit: 50 }),
      api.getMyBalance(),
    ]).then(([l, b]) => {
      setEntries(l.data?.entries || []);
      setPagination(l.data?.pagination || {});
      setBalance(b.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

  const typeColor = (t) => ({
    invoice: 'text-red-400',
    payment: 'text-emerald-400',
    credit_note: 'text-blue-400',
    debit_note: 'text-orange-400',
    topup: 'text-cyan-400',
    adjustment: 'text-purple-400',
  }[t] || 'text-gray-400');

  // Compute running totals
  const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-4">
          <p className="text-xs text-gray-500 mb-1">Total Invoice</p>
          <p className="text-lg font-bold">${totalDebit.toFixed(2)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-500 mb-1">Total Paid</p>
          <p className="text-lg font-bold">${totalCredit.toFixed(2)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-500 mb-1">Current Balance</p>
          <p className={`text-lg font-bold ${(balance?.currentBalance || 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            ${(balance?.currentBalance || 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Ledger table */}
      {entries.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No ledger entries</p>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Reference No</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3">Narration</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e._id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-400">{e.referenceNumber || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium capitalize ${typeColor(e.transactionType)}`}>
                        {e.transactionType?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{e.debit > 0 ? `$${e.debit.toFixed(2)}` : ''}</td>
                    <td className="px-4 py-3 text-right">{e.credit > 0 ? `$${e.credit.toFixed(2)}` : ''}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{e.narration || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded text-sm ${p === page ? 'bg-brand-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── ADDRESSES ─────────────── */
function AddressesTab() {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | address _id
  const [form, setForm] = useState({ label: '', line1: '', city: '', state: '', zip: '', country: '', isDefault: false });
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    api.getProfile()
      .then((r) => setProfile(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const addresses = profile?.addresses || [];

  const startNew = () => {
    setForm({ label: '', line1: '', city: '', state: '', zip: '', country: '', isDefault: false });
    setEditing('new');
  };

  const startEdit = (addr) => {
    setForm({ label: addr.label || '', line1: addr.line1 || '', city: addr.city || '', state: addr.state || '', zip: addr.zip || '', country: addr.country || '', isDefault: addr.isDefault || false });
    setEditing(addr._id);
  };

  const handleSave = async () => {
    if (!form.line1 || !form.city) return toast.error('Address and city are required');
    try {
      // Update the entire addresses array via profile update
      let updated;
      if (editing === 'new') {
        updated = [...addresses, form];
      } else {
        updated = addresses.map((a) => a._id === editing ? { ...a, ...form } : a);
      }
      // If new address is default, unset others
      if (form.isDefault) {
        updated = updated.map((a, i) => ({
          ...a,
          isDefault: (editing === 'new' ? i === updated.length - 1 : a._id === editing),
        }));
      }
      await api.updateProfile({ addresses: updated });
      toast.success('Address saved');
      setEditing(null);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this address?')) return;
    try {
      const updated = addresses.filter((a) => a._id !== id);
      await api.updateProfile({ addresses: updated });
      toast.success('Address deleted');
      load();
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Your Addresses</h3>
        <button onClick={startNew} className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300">
          <Plus size={14} /> Add Address
        </button>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="glass-card p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Label</label>
              <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input-field" placeholder="Home, Office..." />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Address *</label>
              <input type="text" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} className="input-field" placeholder="123 Main St" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">City *</label>
              <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field" placeholder="Phoenix" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">State</label>
              <input type="text" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="input-field" placeholder="AZ" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">ZIP</label>
              <input type="text" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} className="input-field" placeholder="85001" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Country</label>
              <input type="text" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input-field" placeholder="US" />
            </div>
          </div>
          <label className="flex items-center gap-2 mt-3">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="accent-brand-500" />
            <span className="text-sm text-gray-400">Set as default</span>
          </label>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={handleSave} className="btn-primary text-sm py-2 px-4 flex items-center gap-1"><Save size={14} /> Save</button>
            <button onClick={() => setEditing(null)} className="btn-outline text-sm py-2 px-4 flex items-center gap-1"><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      {/* Address cards */}
      {addresses.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No addresses saved</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {addresses.map((a) => (
            <div key={a._id} className={`glass-card p-4 ${a.isDefault ? 'border-brand-500/50' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{a.label || 'Address'}</span>
                    {a.isDefault && <span className="text-[10px] bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded-full">Default</span>}
                  </div>
                  <p className="text-sm text-gray-400">{a.line1}</p>
                  <p className="text-sm text-gray-500">{[a.city, a.state, a.zip].filter(Boolean).join(', ')}</p>
                  {a.country && <p className="text-sm text-gray-600">{a.country}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(a)} className="p-1.5 text-gray-500 hover:text-white"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(a._id)} className="p-1.5 text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── PAYMENTS ─────────────── */
function PaymentsTab() {
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getMyPayments({ page, limit: 20 })
      .then((r) => { setPayments(r.data?.payments || []); setPagination(r.data?.pagination || {}); })
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [page]);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      {payments.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No payments found</p>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(p.paidAt || p.createdAt)}</td>
                    <td className="px-4 py-3 text-brand-400">{p.order?.orderNumber || '-'}</td>
                    <td className="px-4 py-3 capitalize text-gray-400">{p.method || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium">${p.amount?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded text-sm ${p === page ? 'bg-brand-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── PROFILE ─────────────── */
function ProfileTab() {
  const { user } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // Password change
  const [showPwChange, setShowPwChange] = useState(false);
  const [pw, setPw] = useState({ current: '', newPw: '' });

  useEffect(() => {
    api.getProfile()
      .then((r) => { setProfile(r.data); setName(r.data.name); setPhone(r.data.phone || ''); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!name) return toast.error('Name is required');
    setSaving(true);
    try {
      await api.updateProfile({ name, phone });
      toast.success('Profile updated');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handlePwChange = async () => {
    if (!pw.current || !pw.newPw) return toast.error('Both fields required');
    if (pw.newPw.length < 6) return toast.error('New password must be at least 6 characters');
    setSaving(true);
    try {
      await api.changePassword({ currentPassword: pw.current, newPassword: pw.newPw });
      toast.success('Password changed');
      setPw({ current: '', newPw: '' });
      setShowPwChange(false);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-md">
      <div className="glass-card p-6 mb-4">
        <h3 className="font-semibold mb-4">Profile Details</h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Email</label>
            <input type="email" value={profile?.email || ''} disabled className="input-field opacity-50 cursor-not-allowed" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" />
          </div>
          {profile?.tier && (
            <div>
              <label className="text-sm text-gray-400 block mb-1">Tier</label>
              <span className="text-sm capitalize bg-brand-500/10 text-brand-400 px-3 py-1 rounded-full">{profile.tier}</span>
            </div>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Password change */}
      <div className="glass-card p-6">
        <button onClick={() => setShowPwChange(!showPwChange)}
          className="flex items-center gap-2 font-semibold text-sm text-gray-300 hover:text-white">
          <Lock size={16} /> Change Password
        </button>
        {showPwChange && (
          <div className="flex flex-col gap-3 mt-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Current Password</label>
              <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">New Password</label>
              <input type="password" value={pw.newPw} onChange={(e) => setPw({ ...pw, newPw: e.target.value })} className="input-field" />
            </div>
            <button onClick={handlePwChange} disabled={saving} className="btn-primary text-sm py-2 disabled:opacity-50">
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
