import { useState, useEffect, useCallback } from 'react';
import { customerService } from '../../services/customerService';
import { CURRENCY } from '../../config/constants';
import { X, Package, Calendar, CreditCard, AlertCircle, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

function PaginationBar({ pagination, page, setPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page: pg, totalPages, total, limit } = pagination;
  const from = (pg - 1) * limit + 1;
  const to   = Math.min(pg * limit, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t text-sm" style={{ borderColor: 'var(--color-border)' }}>
      <span style={{ color: 'var(--color-content-secondary)' }}>Showing <strong>{from}–{to}</strong> of <strong>{total}</strong> orders</span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => setPage(1)} className="btn btn-secondary btn-sm px-2 disabled:opacity-40" title="First">«</button>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-secondary btn-sm disabled:opacity-40">Prev</button>
        <span className="px-3 py-1 rounded font-medium text-xs" style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}>{pg} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="btn btn-secondary btn-sm disabled:opacity-40">Next</button>
        <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} className="btn btn-secondary btn-sm px-2 disabled:opacity-40" title="Last">»</button>
      </div>
    </div>
  );
}

const fmt = (v) => `${CURRENCY}${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const STATUS_COLORS = {
  placed: 'badge-info', processing: 'badge-warning', shipped: 'badge-brand',
  delivered: 'badge-success', cancelled: 'badge-error', partial_return: 'badge-warning',
  returned: 'badge-error',
};

export default function OrdersTab() {
  const [data, setData]         = useState(null);
  const [page, setPage]         = useState(1);
  const [status, setStatus]     = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [detail, setDetail]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const hasFilters = status || startDate || endDate || search;

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 10 };
    if (status) params.status = status;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (search) params.q = search;
    customerService.getOrders(params)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [page, status, startDate, endDate, search]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    setDetailLoading(true);
    try {
      const d = await customerService.getOrder(id);
      setDetail(d);
      // Push history state so browser back closes modal instead of navigating
      window.history.pushState({ orderModal: true }, '');
    } catch (e) { toast.error(e.message); }
    finally { setDetailLoading(false); }
  };

  const closeDetail = useCallback(() => {
    setDetail(null);
  }, []);

  // Listen for browser back button to close modal
  useEffect(() => {
    const onPopState = (e) => {
      if (detail) {
        // Modal is open, close it (back already consumed the pushed state)
        closeDetail();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [detail, closeDetail]);

  // When modal closes normally (via X or overlay click), go back to pop the pushed state
  const handleClose = () => {
    if (detail) {
      window.history.back();
      // closeDetail will be called by the popstate handler
    }
  };

  const cancelOrder = async (id) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      await customerService.cancelOrder(id, { reason: 'Cancelled by customer' });
      toast.success('Order cancelled');
      load();
      handleClose();
    } catch (e) { toast.error(e.message); }
  };

  const orders = data?.orders || [];
  const pagination = data?.pagination;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
        <div className="flex items-center gap-1.5 text-xs font-medium mr-1" style={{ color: 'var(--color-content-secondary)' }}>
          <Filter className="w-3.5 h-3.5" /> Filters
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field w-auto text-xs py-1.5">
          <option value="">All Statuses</option>
          {['placed', 'processing', 'shipped', 'delivered', 'cancelled', 'partial_return', 'returned'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="input-field text-xs py-1.5 w-36" />
          <span className="text-xs" style={{ color: 'var(--color-content-tertiary)' }}>–</span>
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="input-field text-xs py-1.5 w-36" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search order #…"
          className="input-field text-xs py-1.5 w-36"
        />
        {hasFilters && (
          <button onClick={() => { setStatus(''); setStartDate(''); setEndDate(''); setSearch(''); setPage(1); }} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-content-secondary)' }}>
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Detail modal — centered, compact */}
      {detail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={handleClose}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl z-10"
            style={{ backgroundColor: 'var(--color-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
                <h3 className="text-base font-bold">Order {detail.order?.orderNumber}</h3>
                <span className={STATUS_COLORS[detail.order?.status] || 'badge-info'}>{detail.order?.status}</span>
              </div>
              <button onClick={handleClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-tertiary)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Summary cards row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--color-surface-tertiary)' }}>
                  <div className="flex items-center gap-1 text-[10px] mb-1" style={{ color: 'var(--color-content-tertiary)' }}>
                    <Calendar className="w-3 h-3" /> Date
                  </div>
                  <div className="text-xs font-semibold">{fmtDate(detail.order?.createdAt)}</div>
                </div>
                <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--color-surface-tertiary)' }}>
                  <div className="flex items-center gap-1 text-[10px] mb-1" style={{ color: 'var(--color-content-tertiary)' }}>
                    <CreditCard className="w-3 h-3" /> Total
                  </div>
                  <div className="text-xs font-bold" style={{ color: 'var(--color-brand)' }}>{fmt(detail.order?.grandTotal)}</div>
                </div>
                <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--color-surface-tertiary)' }}>
                  <div className="flex items-center gap-1 text-[10px] mb-1" style={{ color: 'var(--color-content-tertiary)' }}>
                    <AlertCircle className="w-3 h-3" /> Due
                  </div>
                  <div className="text-xs font-semibold">{fmt(detail.order?.balanceDue)}</div>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-content-secondary)' }}>Items ({detail.order?.items?.length || 0})</h4>
                <div className="space-y-2">
                  {detail.order?.items?.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg" style={{ backgroundColor: 'var(--color-surface-tertiary)' }}>
                      {item.productSnapshot?.image ? (
                        <img src={item.productSnapshot.image} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-md shrink-0 flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-content-tertiary)' }}>
                          {item.productSnapshot?.name?.[0] || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{item.productSnapshot?.name}</div>
                        <div className="text-[10px]" style={{ color: 'var(--color-content-tertiary)' }}>
                          {item.quantity} × {fmt(item.unitPrice)}
                        </div>
                      </div>
                      <div className="text-xs font-semibold shrink-0">{fmt(item.lineTotal)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price breakdown */}
              <div className="rounded-lg p-3 space-y-1.5 text-xs" style={{ backgroundColor: 'var(--color-surface-tertiary)' }}>
                <div className="flex justify-between" style={{ color: 'var(--color-content-secondary)' }}>
                  <span>Subtotal</span><span>{fmt(detail.order?.subtotal)}</span>
                </div>
                {detail.order?.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-content-secondary)' }}>Discount</span>
                    <span style={{ color: 'var(--color-status-success)' }}>-{fmt(detail.order.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between" style={{ color: 'var(--color-content-secondary)' }}>
                  <span>Tax</span><span>{fmt(detail.order?.taxTotal)}</span>
                </div>
                <div className="border-t pt-1.5 flex justify-between font-bold text-sm" style={{ borderColor: 'var(--color-border)' }}>
                  <span>Grand Total</span><span style={{ color: 'var(--color-brand)' }}>{fmt(detail.order?.grandTotal)}</span>
                </div>
                <div className="flex justify-between" style={{ color: 'var(--color-content-secondary)' }}>
                  <span>Paid</span><span>{fmt(detail.order?.amountPaid)}</span>
                </div>
                {detail.order?.balanceDue > 0 && (
                  <div className="flex justify-between font-medium">
                    <span style={{ color: 'var(--color-status-error)' }}>Balance Due</span>
                    <span style={{ color: 'var(--color-status-error)' }}>{fmt(detail.order?.balanceDue)}</span>
                  </div>
                )}
              </div>

              {/* Payments */}
              {detail.payments?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-content-secondary)' }}>Payments</h4>
                  <div className="space-y-1">
                    {detail.payments.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <span style={{ color: 'var(--color-content-secondary)' }}>{fmtDate(p.paymentDate)} — {p.method}</span>
                        <span className="font-medium">{fmt(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancel action */}
              {['placed', 'processing'].includes(detail.order?.status) && (
                <button onClick={() => cancelOrder(detail.order._id)} className="btn btn-danger btn-sm w-full">
                  Cancel Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Orders list */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--color-content-secondary)' }}>
          <p className="font-medium">No orders found</p>
          {hasFilters && <button onClick={() => { setStatus(''); setStartDate(''); setEndDate(''); setPage(1); }} className="text-xs mt-2 underline">Clear filters</button>}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Order #</th>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Date</th>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Status</th>
                  <th className="text-right px-3 py-2.5 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Total</th>
                  <th className="text-right px-3 py-2.5 font-medium" style={{ color: 'var(--color-status-error)' }}>Balance Due</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id} className="border-b hover:bg-[var(--color-surface-secondary)] transition-colors cursor-pointer" style={{ borderColor: 'var(--color-border)' }} onClick={() => openDetail(o._id)}>
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold">{o.orderNumber}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-content-secondary)' }}>{fmtDate(o.createdAt)}</td>
                    <td className="px-3 py-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[o.status] || 'badge-info'}`}>{o.status?.replace(/_/g, ' ')}</span></td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{fmt(o.grandTotal)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {o.balanceDue > 0
                        ? <span className="font-semibold" style={{ color: 'var(--color-status-error)' }}>{fmt(o.balanceDue)}</span>
                        : <span style={{ color: 'var(--color-status-success)' }}>Paid</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button className="btn btn-ghost btn-sm text-xs">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar pagination={pagination} page={page} setPage={setPage} />
        </>
      )}
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="card p-3">
      <div className="text-xs mb-1" style={{ color: 'var(--color-content-tertiary)' }}>{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
