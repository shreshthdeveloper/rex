import { useState, useEffect, useCallback } from 'react';
import { customerService } from '../../services/customerService';
import { CURRENCY } from '../../config/constants';
import { Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = (v) => `${CURRENCY}${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const METHODS = ['cash', 'bank_transfer', 'cheque', 'online', 'credit', 'upi', 'wallet'];

function PaginationBar({ pagination, page, setPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page: pg, totalPages, total, limit } = pagination;
  const from = (pg - 1) * limit + 1;
  const to   = Math.min(pg * limit, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t text-sm" style={{ borderColor: 'var(--color-border)' }}>
      <span style={{ color: 'var(--color-content-secondary)' }}>Showing <strong>{from}–{to}</strong> of <strong>{total}</strong> payments</span>
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

export default function PaymentsTab() {
  const [data, setData]           = useState(null);
  const [page, setPage]           = useState(1);
  const [method, setMethod]       = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);

  const hasFilters = method || startDate || endDate || search;

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 20 };
    if (method) params.method = method;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (search) params.q = search;
    customerService.getPayments(params)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [page, method, startDate, endDate, search]);

  useEffect(() => { load(); }, [load]);

  const clearFilters = () => { setMethod(''); setStartDate(''); setEndDate(''); setSearch(''); setPage(1); };

  const payments  = data?.payments || [];
  const pagination = data?.pagination;

  // Running total for filtered results
  const filteredTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
        <div className="flex items-center gap-1.5 text-xs font-medium mr-1" style={{ color: 'var(--color-content-secondary)' }}>
          <Filter className="w-3.5 h-3.5" /> Filters
        </div>
        <select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} className="input-field w-auto text-xs py-1.5">
          <option value="">All Methods</option>
          {METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
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
          placeholder="Search ref # or amount…"
          className="input-field text-xs py-1.5 w-40"
        />
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-content-secondary)' }}>
            <X className="w-3 h-3" /> Clear
          </button>
        )}
        {pagination && (
          <div className="ml-auto text-xs font-medium" style={{ color: 'var(--color-content-secondary)' }}>
            {pagination.total} entries · page total: <span style={{ color: 'var(--color-status-success)' }}>{fmt(filteredTotal)}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--color-content-secondary)' }}>
          <p className="font-medium">No payments found</p>
          {hasFilters && <button onClick={clearFilters} className="text-xs mt-2 underline">Clear filters</button>}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Date</th>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Order #</th>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Method</th>
                  <th className="text-right px-3 py-2.5 font-medium" style={{ color: 'var(--color-status-success)' }}>Amount</th>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id} className="border-b hover:bg-[var(--color-surface-secondary)] transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{fmtDate(p.paymentDate || p.createdAt)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs font-medium">{p.order?.orderNumber || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="badge-brand text-[10px] px-1.5 py-0.5 rounded font-medium capitalize">
                        {p.method?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: 'var(--color-status-success)' }}>
                      {fmt(p.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-xs max-w-[200px] line-clamp-1" style={{ color: 'var(--color-content-tertiary)' }}>
                      {p.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Page subtotal row */}
              <tfoot>
                <tr style={{ backgroundColor: 'var(--color-surface-secondary)' }}>
                  <td colSpan={3} className="px-3 py-2 text-xs font-medium text-right" style={{ color: 'var(--color-content-secondary)' }}>
                    Page subtotal
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: 'var(--color-status-success)' }}>
                    {fmt(filteredTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <PaginationBar pagination={pagination} page={page} setPage={setPage} />
        </>
      )}
    </div>
  );
}
