import { useState, useEffect, useCallback } from 'react';
import { customerService } from '../../services/customerService';
import { CURRENCY } from '../../config/constants';
import { Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = (v) => `${CURRENCY}${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

const TYPE_COLORS = {
  invoice: 'badge-info', payment: 'badge-success', credit_note: 'badge-warning',
  debit_note: 'badge-error', balance_topup: 'badge-brand', balance_adjustment: 'badge-warning',
  opening_balance: 'badge-info',
};

const LIMIT = 20;

function PaginationBar({ pagination, page, setPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page: pg, totalPages, total, limit } = pagination;
  const from = (pg - 1) * limit + 1;
  const to = Math.min(pg * limit, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t text-sm" style={{ borderColor: 'var(--color-border)' }}>
      <span style={{ color: 'var(--color-content-secondary)' }}>
        Showing <strong>{from}–{to}</strong> of <strong>{total}</strong> entries
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => setPage(1)}
          className="btn btn-secondary btn-sm px-2 disabled:opacity-40"
          title="First page"
        >«</button>
        <button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="btn btn-secondary btn-sm disabled:opacity-40"
        >Prev</button>
        <span className="px-3 py-1 rounded font-medium text-xs" style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}>
          {pg} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
          className="btn btn-secondary btn-sm disabled:opacity-40"
        >Next</button>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage(totalPages)}
          className="btn btn-secondary btn-sm px-2 disabled:opacity-40"
          title="Last page"
        >»</button>
      </div>
    </div>
  );
}

export default function LedgerTab() {
  const [data, setData]       = useState(null);
  const [balance, setBalance] = useState(null);
  const [page, setPage]       = useState(1);
  const [type, setType]       = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);

  const hasFilters = type || startDate || endDate || search;

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: LIMIT };
    if (type) params.type = type;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (search) params.q = search;

    const calls = [customerService.getLedger(params)];
    if (!balance) calls.push(customerService.getBalance());

    Promise.all(calls)
      .then(([ledger, bal]) => {
        setData(ledger);
        if (bal) setBalance(bal);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [page, type, startDate, endDate, search]);

  useEffect(() => { load(); }, [load]);

  const clearFilters = () => { setType(''); setStartDate(''); setEndDate(''); setSearch(''); setPage(1); };
  const applyFilter  = (setter) => (e) => { setter(e.target.value); setPage(1); };

  const entries    = data?.entries || [];
  const pagination = data?.pagination;

  return (
    <div>
      {/* Balance summary */}
      {balance && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <div className="card p-4">
            <div className="text-xs mb-1" style={{ color: 'var(--color-content-tertiary)' }}>Current Balance</div>
            <div className={`text-xl font-bold ${balance.currentBalance > 0 ? 'text-[var(--color-status-error)]' : balance.currentBalance < 0 ? 'text-[var(--color-status-success)]' : ''}`}>
              {fmt(Math.abs(balance.currentBalance))}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-content-tertiary)' }}>
              {balance.currentBalance > 0 ? 'You owe' : balance.currentBalance < 0 ? 'Credit available' : 'Settled'}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs mb-1" style={{ color: 'var(--color-content-tertiary)' }}>Credit Limit</div>
            <div className="text-xl font-bold">{fmt(balance.creditLimit || 0)}</div>
          </div>
          {pagination && (
            <div className="card p-4">
              <div className="text-xs mb-1" style={{ color: 'var(--color-content-tertiary)' }}>Total Entries</div>
              <div className="text-xl font-bold">{pagination.total || 0}</div>
              {hasFilters && <div className="text-[10px] mt-0.5 badge-warning">Filtered</div>}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
        <div className="flex items-center gap-1.5 text-xs font-medium mr-1" style={{ color: 'var(--color-content-secondary)' }}>
          <Filter className="w-3.5 h-3.5" /> Filters
        </div>
        <select value={type} onChange={applyFilter(setType)} className="input-field w-auto text-xs py-1.5">
          <option value="">All Types</option>
          {['invoice', 'payment', 'credit_note', 'debit_note', 'balance_topup', 'balance_adjustment', 'opening_balance'].map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <input type="date" value={startDate} onChange={applyFilter(setStartDate)} className="input-field text-xs py-1.5 w-36" placeholder="From" />
          <span className="text-xs" style={{ color: 'var(--color-content-tertiary)' }}>–</span>
          <input type="date" value={endDate} onChange={applyFilter(setEndDate)} className="input-field text-xs py-1.5 w-36" placeholder="To" />
        </div>
        <input
          type="text"
          value={search}
          onChange={applyFilter(setSearch)}
          placeholder="Search ref #…"
          className="input-field text-xs py-1.5 w-36"
        />
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-content-secondary)' }}>
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--color-content-secondary)' }}>
          <p className="font-medium">No ledger entries found</p>
          {hasFilters && <button onClick={clearFilters} className="text-xs mt-2 underline">Clear filters</button>}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
                  <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--color-content-secondary)' }}>Date</th>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Ref #</th>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Type</th>
                  <th className="text-right px-3 py-2.5 font-medium" style={{ color: 'var(--color-status-error)' }}>Debit</th>
                  <th className="text-right px-3 py-2.5 font-medium" style={{ color: 'var(--color-status-success)' }}>Credit</th>
                  <th className="text-right px-3 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--color-content-secondary)' }}>Balance</th>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: 'var(--color-content-secondary)' }}>Narration</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e._id} className="border-b hover:bg-[var(--color-surface-secondary)] transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="text-xs font-medium">{fmtDate(e.createdAt)}</div>
                      <div className="text-[10px]" style={{ color: 'var(--color-content-tertiary)' }}>{fmtTime(e.createdAt)}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-content-secondary)' }}>
                      {e.referenceNumber || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[e.transactionType] || 'badge-info'}`}>
                        {e.transactionType?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {e.debit > 0 ? <span style={{ color: 'var(--color-status-error)' }}>{fmt(e.debit)}</span> : <span style={{ color: 'var(--color-content-tertiary)' }}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {e.credit > 0 ? <span style={{ color: 'var(--color-status-success)' }}>{fmt(e.credit)}</span> : <span style={{ color: 'var(--color-content-tertiary)' }}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">
                      {e.balanceAfter != null ? (
                        <span style={{ color: e.balanceAfter > 0 ? 'var(--color-status-error)' : e.balanceAfter < 0 ? 'var(--color-status-success)' : 'inherit' }}>
                          {fmt(Math.abs(e.balanceAfter))}
                          {e.balanceAfter !== 0 && (
                            <span className="text-[9px] ml-0.5 font-normal" style={{ color: 'var(--color-content-tertiary)' }}>
                              {e.balanceAfter > 0 ? 'DR' : 'CR'}
                            </span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs max-w-[220px]" style={{ color: 'var(--color-content-secondary)' }}>
                      <span className="line-clamp-2">{e.narration || '—'}</span>
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
