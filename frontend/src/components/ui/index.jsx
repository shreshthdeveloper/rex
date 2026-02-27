/* Reusable UI components – White & Violet Theme */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Search, Loader2, Upload, Download } from 'lucide-react';

/* ─── Glass Card ─── */
export function GlassCard({ children, className = '', hover = false, ...props }) {
  return (
    <div className={`glass-card p-6 ${hover ? 'glass-card-hover cursor-pointer' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}

/* ─── Button ─── */
export function Button({ children, variant = 'primary', size = 'md', loading = false, className = '', ...props }) {
  const variants = {
    primary: 'glass-btn-solid',
    ghost: 'glass-btn',
    danger: 'glass-btn-danger',
    icon: 'p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors',
  };
  const sizes = {
    xs: 'px-2 py-1 text-xs gap-1',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${variant !== 'icon' ? sizes[size] : ''} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ─── Input ─── */
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>}
      <input
        className={`w-full glass-input px-3.5 py-2.5 text-sm ${error ? 'border-red-500/50 focus:border-red-400' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

/* ─── Textarea ─── */
export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>}
      <textarea
        className={`w-full glass-input px-3.5 py-2.5 text-sm resize-none ${error ? 'border-red-500/50' : ''} ${className}`}
        rows={3}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

/* ─── Select ─── */
export function Select({ label, options = [], error, className = '', placeholder, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>}
      <select
        className={`w-full glass-input px-3.5 py-2.5 text-sm bg-transparent appearance-none ${error ? 'border-red-500/50' : ''} ${className}`}
        {...props}
      >
        {placeholder && <option value="" className="bg-white text-slate-800">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-white text-slate-800">
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

/* ─── Badge ─── */
export function Badge({ children, color = 'cyan', className = '' }) {
  const colors = {
    cyan: 'bg-violet-100 text-violet-700 border-violet-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    red: 'bg-red-100 text-red-600 border-red-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    gray: 'bg-slate-100 text-slate-600 border-slate-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${colors[color]} ${className}`}>
      {children}
    </span>
  );
}

/* ─── Modal ─── */
export function Modal({ open, onClose, title, children, size = 'md', footer }) {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', '2xl': 'max-w-5xl', full: 'max-w-6xl', wide: 'w-[80vw] max-w-[80vw]', view: 'w-[70vw] max-w-[70vw]' };
  const maxHeights = { view: 'max-h-[80vh]' };
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 glass-modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className={`w-full ${sizes[size]} glass-modal animate-slide-up ${maxHeights[size] || 'max-h-[90vh]'} flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ─── Confirm Dialog ─── */
export function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirm', message, loading }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>Delete</Button>
        </>
      }
    >
      <p className="text-slate-600">{message}</p>
    </Modal>
  );
}

/* ─── Loader ─── */
export function Loader({ className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 gap-3 ${className}`}>
      <div className="relative w-12 h-12">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-[3px] border-t-violet-600 border-r-violet-300/30 border-b-transparent border-l-violet-300/30 loader-ring-outer" />
        {/* Inner ring */}
        <div className="absolute inset-[7px] rounded-full border-2 border-t-transparent border-r-transparent border-b-violet-400/70 border-l-transparent loader-ring-inner" />
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-violet-500/80 loader-dot" />
        </div>
      </div>
      <span className="text-[10px] text-violet-400/60 uppercase tracking-[0.2em] loader-dot">Loading</span>
    </div>
  );
}

/* ─── Search Input ─── */
export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full glass-input pl-9 pr-3.5 py-2 text-sm"
      />
    </div>
  );
}

/* ─── Pagination ─── */
export function Pagination({ page, totalPages, onPageChange, className = '' }) {
  if (totalPages <= 1) return null;
  return (
    <div className={`flex items-center justify-center gap-1 mt-4 ${className}`}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-30 transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        let p;
        if (totalPages <= 7) p = i + 1;
        else if (page <= 4) p = i + 1;
        else if (page >= totalPages - 3) p = totalPages - 6 + i;
        else p = page - 3 + i;
        return (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${
              p === page
                ? 'bg-violet-100 text-violet-700 border border-violet-300'
                : 'text-slate-500 hover:text-violet-700 hover:bg-violet-50'
            }`}
          >
            {p}
          </button>
        );
      })}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-30 transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/* ─── Empty State ─── */
export function EmptyState({ icon: Icon, title = 'No data', subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={48} className="text-violet-300 mb-4" />}
      <h3 className="text-lg font-medium text-slate-500">{title}</h3>
      {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

/* ─── Stat Card ─── */
export function StatCard({ label, value, icon: Icon, trend, color = 'cyan' }) {
  const colors = {
    cyan: 'border-violet-200 bg-gradient-to-br from-violet-50 to-white',
    green: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
    amber: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
    purple: 'border-purple-200 bg-gradient-to-br from-purple-50 to-white',
    red: 'border-red-200 bg-gradient-to-br from-red-50 to-white',
  };
  const iconColors = {
    cyan: 'text-violet-500', green: 'text-emerald-500', amber: 'text-amber-500',
    purple: 'text-purple-500', red: 'text-red-500',
  };
  return (
    <div className={`glass-card p-5 ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
          {trend && <p className={`text-xs mt-1 ${trend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{trend > 0 ? '+' : ''}{trend}%</p>}
        </div>
        {Icon && <Icon size={24} className={iconColors[color]} />}
      </div>
    </div>
  );
}

/* ─── Page Header ─── */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─── DataTable ─── */
export function DataTable({
  columns,
  data = [],
  loading,
  onRowClick,
  emptyMessage = 'No records found',
  scrollable = false,
  paginated = true,
  pageSize = 10,
  serverPagination = false,
  currentPage,
  totalItems,
  onPageChange,
}) {
  const [internalPage, setInternalPage] = useState(1);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const page = serverPagination ? Math.max(1, Number(currentPage) || 1) : internalPage;
  const totalCount = serverPagination ? Math.max(0, Number(totalItems) || 0) : data.length;
  const totalPages = paginated ? Math.max(1, Math.ceil(totalCount / safePageSize)) : 1;
  const visibleData = paginated && !serverPagination
    ? data.slice((page - 1) * safePageSize, page * safePageSize)
    : data;

  useEffect(() => {
    if (!serverPagination) setInternalPage(1);
  }, [data.length, safePageSize, paginated, serverPagination]);

  useEffect(() => {
    if (!serverPagination && page > totalPages) setInternalPage(totalPages);
  }, [page, totalPages, serverPagination]);

  const handlePageChange = (nextPage) => {
    if (serverPagination) {
      onPageChange?.(nextPage);
      return;
    }
    setInternalPage(nextPage);
  };

  const tableMinW = scrollable ? 'min-w-[1100px]' : 'w-full';
  if (loading) {
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className={`${tableMinW} glass-table`}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-5 py-3 text-left">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-gray-100">
                {columns.map((col, j) => (
                  <td key={col.key} className="px-5 py-4">
                    <div
                      className="h-3.5 skeleton-shimmer"
                      style={{ width: `${[72, 55, 65, 50, 80, 60, 70][j % 7]}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (!data.length) return <EmptyState title={emptyMessage} />;
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className={`${tableMinW} glass-table`}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-5 py-3 text-left${scrollable ? ' whitespace-nowrap' : ''}`} style={col.width ? { width: col.width } : {}}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((row, i) => (
              <tr
                key={row._id || `${page}-${i}`}
                className={onRowClick ? 'cursor-pointer' : ''}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-5 py-3 text-sm text-slate-700${scrollable ? ' whitespace-nowrap' : ''}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginated && (
        totalPages > 1 ? (
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        ) : serverPagination && totalCount > 0 ? (
          <div className="flex items-center justify-center mt-4 text-xs text-slate-500">
            Showing {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </div>
        ) : null
      )}
    </div>
  );
}

/* ─── Tab List (for sub-views within a page) ─── */
export function TabList({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 mb-4">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === t.id
              ? 'border-violet-600 text-violet-700'
              : 'border-transparent text-slate-500 hover:text-violet-600'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Searchable Select (dropdown with search) ─── */
export function SearchableSelect({ label, options = [], value, onChange, placeholder = 'Select...', className = '', error }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  const selected = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Close on outside click
  const handleBlur = (e) => {
    if (wrapRef.current && !wrapRef.current.contains(e.relatedTarget)) {
      setTimeout(() => setOpen(false), 150);
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`} ref={wrapRef} onBlur={handleBlur}>
      {label && <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>}
      <div className="relative">
        <button
          type="button"
          className={`w-full glass-input px-3.5 py-2.5 text-sm text-left flex items-center justify-between gap-2 ${error ? 'border-red-400' : ''}`}
          onClick={() => { setOpen(!open); setQuery(''); }}
        >
          <span className={selected ? 'text-slate-800' : 'text-slate-400'}>{selected ? selected.label : placeholder}</span>
          <ChevronRight size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white rounded-xl overflow-hidden shadow-xl border border-gray-200 animate-fade-in" style={{ maxHeight: 260 }}>
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full glass-input pl-8 pr-3 py-1.5 text-xs"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="overflow-auto" style={{ maxHeight: 200 }}>
              {placeholder && (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-xs text-left text-slate-400 hover:bg-violet-50 transition-colors"
                  onMouseDown={(e) => { e.preventDefault(); onChange({ target: { value: '' } }); setOpen(false); }}
                >
                  {placeholder}
                </button>
              )}
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-400 text-center">No results</p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`w-full px-3 py-2 text-xs text-left transition-colors ${
                      o.value === value
                        ? 'bg-violet-100 text-violet-700 font-medium'
                        : 'text-slate-700 hover:bg-violet-50 hover:text-violet-700'
                    }`}
                    onMouseDown={(e) => { e.preventDefault(); onChange({ target: { value: o.value } }); setOpen(false); setQuery(''); }}
                  >
                    {o.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

/* ─── CSV Import ─── */
export function CsvImport({ columns, onImport, sampleRows = [], label = 'Import CSV' }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const parseCSV = (text) => {
    const lines = text.replace(/\r/g, '').trim().split('\n').filter(Boolean);
    if (lines.length < 2) return { rows: [], error: 'File must have a header row and at least one data row.' };
    const parseRow = (line) => {
      const result = []; let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      result.push(cur.trim());
      return result;
    };
    const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
    const parsed = lines.slice(1).map((line) => {
      const vals = parseRow(line);
      const obj = {};
      columns.forEach((col) => {
        const hi = headers.findIndex((h) => h === col.key || h === col.csvKey);
        obj[col.key] = hi >= 0 ? vals[hi] || '' : '';
      });
      return obj;
    }).filter((r) => Object.values(r).some((v) => v));
    return { rows: parsed, error: '' };
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows: r, error } = parseCSV(ev.target.result);
      setParseError(error); setRows(r);
      if (!error && r.length) setOpen(true);
      else if (!error) setParseError('No data rows found in the file.');
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const hdrs = columns.map((c) => c.label).join(',');
    const sample = sampleRows.length
      ? sampleRows.map((r) => columns.map((c) => `"${(r[c.key] || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
      : columns.map(() => '').join(',');
    const blob = new Blob([`${hdrs}\n${sample}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'import-template.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    try { await onImport(rows); setOpen(false); setRows([]); setParseError(''); }
    finally { setImporting(false); }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" type="button" onClick={() => { setParseError(''); fileRef.current?.click(); }}>
          <Upload size={14} /> {label}
        </Button>
        <Button variant="icon" type="button" title="Download CSV template" onClick={downloadTemplate}>
          <Download size={14} />
        </Button>
      </div>
      {parseError && <p className="text-xs text-red-400 mt-1">{parseError}</p>}
      <Modal open={open} onClose={() => { setOpen(false); setRows([]); }} title={`Import Preview — ${rows.length} rows`} size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setOpen(false); setRows([]); }}>Cancel</Button>
            <Button onClick={handleImport} loading={importing}>
              <Upload size={14} /> Import {rows.length} rows
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Showing first 5 of {rows.length} rows. All will be imported.</p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full glass-table text-xs">
              <thead><tr>{columns.map((c) => <th key={c.key} className="px-3 py-2 text-left">{c.label}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-2 text-slate-700">
                        {row[c.key] || <span className="text-slate-400">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && <p className="text-xs text-slate-400">… and {rows.length - 5} more rows</p>}
        </div>
      </Modal>
    </>
  );
}
