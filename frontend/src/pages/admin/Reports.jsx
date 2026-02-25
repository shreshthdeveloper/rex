import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader, TabList, Textarea, StatCard, Pagination } from '../../components/ui';
import { reportsAPI, transactionLogAPI } from '../../api';
import { BarChart3, TrendingUp, TrendingDown, Package, Users, Truck, DollarSign, ArrowUpDown, BookOpen } from 'lucide-react';

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sales', label: 'Sales' },
  { id: 'stock', label: 'Stock Report' },
  { id: 'customerAging', label: 'Customer Aging' },
  { id: 'supplierAging', label: 'Supplier Aging' },
  { id: 'profitLoss', label: 'Profit & Loss' },
  { id: 'cashFlow', label: 'Cash Flow' },
  { id: 'transactionLog', label: 'Transaction Log' },
];

const today = new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

export default function Reports() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  // Dashboard
  const [dashData, setDashData] = useState(null);

  // Sales
  const [salesData, setSalesData] = useState([]);
  const [salesStart, setSalesStart] = useState(thirtyDaysAgo);
  const [salesEnd, setSalesEnd] = useState(today);

  // Stock
  const [stockData, setStockData] = useState([]);

  // Customer Aging
  const [customerAgingData, setCustomerAgingData] = useState([]);

  // Supplier Aging
  const [supplierAgingData, setSupplierAgingData] = useState([]);

  // Profit & Loss
  const [plData, setPlData] = useState(null);
  const [plStart, setPlStart] = useState(thirtyDaysAgo);
  const [plEnd, setPlEnd] = useState(today);

  // Cash Flow
  const [cashFlowData, setCashFlowData] = useState(null);
  const [cfStart, setCfStart] = useState(thirtyDaysAgo);
  const [cfEnd, setCfEnd] = useState(today);
  const [cfGroupBy, setCfGroupBy] = useState('daily');

  // Transaction Log
  const [txnLogData, setTxnLogData] = useState([]);
  const [txnLogPagination, setTxnLogPagination] = useState(null);
  const [txnLogPage, setTxnLogPage] = useState(1);
  const [txnPartyType, setTxnPartyType] = useState('');
  const [txnEventType, setTxnEventType] = useState('');
  const [txnDirection, setTxnDirection] = useState('');
  const [txnStart, setTxnStart] = useState(thirtyDaysAgo);
  const [txnEnd, setTxnEnd] = useState(today);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsAPI.dashboard();
      setDashData(res.data || res);
    } catch (err) {
      toast.error(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsAPI.sales({ startDate: salesStart, endDate: salesEnd });
      setSalesData(res.data?.summary || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [toast, salesStart, salesEnd]);

  const fetchStock = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsAPI.stock();
      setStockData(res.data?.stock || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load stock report');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchCustomerAging = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsAPI.customerAging();
      setCustomerAgingData(res.data?.customers || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load customer aging');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchSupplierAging = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsAPI.supplierAging();
      setSupplierAgingData(res.data?.suppliers || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load supplier aging');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchProfitLoss = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsAPI.profitLoss({ startDate: plStart, endDate: plEnd });
      setPlData(res.data || res);
    } catch (err) {
      toast.error(err.message || 'Failed to load profit & loss');
    } finally {
      setLoading(false);
    }
  }, [toast, plStart, plEnd]);

  const fetchCashFlow = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsAPI.cashFlow({ startDate: cfStart, endDate: cfEnd, groupBy: cfGroupBy });
      setCashFlowData(res.data || res);
    } catch (err) {
      toast.error(err.message || 'Failed to load cash flow');
    } finally {
      setLoading(false);
    }
  }, [toast, cfStart, cfEnd, cfGroupBy]);

  const fetchTransactionLog = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: txnLogPage, limit: 25 };
      if (txnPartyType) params.partyType = txnPartyType;
      if (txnEventType) params.eventType = txnEventType;
      if (txnDirection) params.direction = txnDirection;
      if (txnStart) params.startDate = txnStart;
      if (txnEnd) params.endDate = txnEnd;
      const res = await transactionLogAPI.list(params);
      setTxnLogData(res.data?.entries || []);
      setTxnLogPagination(res.data?.pagination || null);
    } catch (err) {
      toast.error(err.message || 'Failed to load transaction log');
    } finally {
      setLoading(false);
    }
  }, [toast, txnLogPage, txnPartyType, txnEventType, txnDirection, txnStart, txnEnd]);

  useEffect(() => {
    const loaders = { dashboard: fetchDashboard, sales: fetchSales, stock: fetchStock, customerAging: fetchCustomerAging, supplierAging: fetchSupplierAging, profitLoss: fetchProfitLoss, cashFlow: fetchCashFlow, transactionLog: fetchTransactionLog };
    loaders[activeTab]?.();
  }, [activeTab, fetchDashboard, fetchSales, fetchStock, fetchCustomerAging, fetchSupplierAging, fetchProfitLoss, fetchCashFlow, fetchTransactionLog]);

  /* ─── Sales Columns ─── */
  const salesColumns = [
    { key: 'date', label: 'Date', render: (r) => <span className="text-slate-600">{r.date ? new Date(r.date).toLocaleDateString() : r._id}</span> },
    { key: 'orders', label: 'Orders', render: (r) => <span className="text-slate-800 font-medium">{r.orders || r.count || 0}</span> },
    { key: 'revenue', label: 'Revenue', render: (r) => <span className="text-emerald-400 font-mono">₹{Number(r.revenue || r.total || 0).toFixed(2)}</span> },
    { key: 'avgOrder', label: 'Avg Order', render: (r) => <span className="text-slate-500 font-mono">₹{Number(r.avgOrder || r.average || 0).toFixed(2)}</span> },
  ];

  /* ─── Stock Columns ─── */
  const stockColumns = [
    { key: 'product', label: 'Product', render: (r) => (
      <div className="flex items-center gap-2"><Package size={14} className="text-violet-600" /><span className="text-slate-800 font-medium">{r.productName || r.product?.name || r.name || '—'}</span></div>
    )},
    { key: 'sku', label: 'SKU', render: (r) => <span className="text-slate-500 font-mono text-xs">{r.sku || '—'}</span> },
    { key: 'quantity', label: 'Stock', render: (r) => (
      <Badge color={(r.quantity || r.stock || 0) <= (r.reorderLevel || 10) ? 'red' : 'green'}>{r.quantity || r.stock || 0}</Badge>
    )},
    { key: 'warehouse', label: 'Warehouse', render: (r) => <span className="text-slate-500">{r.warehouseName || r.warehouse?.name || '—'}</span> },
  ];

  /* ─── Customer Aging Columns ─── */
  const customerAgingColumns = [
    { key: 'customer', label: 'Customer', render: (r) => (
      <div className="flex items-center gap-2"><Users size={14} className="text-violet-600" /><span className="text-slate-800 font-medium">{r.customerName || r.customer?.name || r.name || '—'}</span></div>
    )},
    { key: 'current', label: 'Current', render: (r) => <span className="text-emerald-400 font-mono">₹{Number(r.current || 0).toFixed(2)}</span> },
    { key: '30days', label: '1-30 Days', render: (r) => <span className="text-slate-600 font-mono">₹{Number(r['30days'] || r.thirtyDays || 0).toFixed(2)}</span> },
    { key: '60days', label: '31-60 Days', render: (r) => <span className="text-amber-400 font-mono">₹{Number(r['60days'] || r.sixtyDays || 0).toFixed(2)}</span> },
    { key: '90days', label: '61-90 Days', render: (r) => <span className="text-red-400 font-mono">₹{Number(r['90days'] || r.ninetyDays || 0).toFixed(2)}</span> },
    { key: 'over90', label: '90+ Days', render: (r) => <span className="text-red-500 font-mono font-bold">₹{Number(r.over90 || r.overNinetyDays || 0).toFixed(2)}</span> },
    { key: 'total', label: 'Total', render: (r) => <span className="text-slate-800 font-mono font-bold">₹{Number(r.total || 0).toFixed(2)}</span> },
  ];

  /* ─── Supplier Aging Columns ─── */
  const supplierAgingColumns = [
    { key: 'supplier', label: 'Supplier', render: (r) => (
      <div className="flex items-center gap-2"><Truck size={14} className="text-violet-600" /><span className="text-slate-800 font-medium">{r.supplierName || r.supplier?.name || r.name || '—'}</span></div>
    )},
    { key: 'current', label: 'Current', render: (r) => <span className="text-emerald-400 font-mono">₹{Number(r.current || 0).toFixed(2)}</span> },
    { key: '30days', label: '1-30 Days', render: (r) => <span className="text-slate-600 font-mono">₹{Number(r['30days'] || r.thirtyDays || 0).toFixed(2)}</span> },
    { key: '60days', label: '31-60 Days', render: (r) => <span className="text-amber-400 font-mono">₹{Number(r['60days'] || r.sixtyDays || 0).toFixed(2)}</span> },
    { key: '90days', label: '61-90 Days', render: (r) => <span className="text-red-400 font-mono">₹{Number(r['90days'] || r.ninetyDays || 0).toFixed(2)}</span> },
    { key: 'over90', label: '90+ Days', render: (r) => <span className="text-red-500 font-mono font-bold">₹{Number(r.over90 || r.overNinetyDays || 0).toFixed(2)}</span> },
    { key: 'total', label: 'Total', render: (r) => <span className="text-slate-800 font-mono font-bold">₹{Number(r.total || 0).toFixed(2)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Analytics & business insights" />
      <TabList tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        loading ? <Loader /> : dashData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Revenue" value={`₹${Number(dashData.totalRevenue || 0).toLocaleString()}`} icon={DollarSign} color="green" />
            <StatCard label="Total Orders" value={dashData.totalOrders || 0} icon={BarChart3} color="cyan" />
            <StatCard label="Total Customers" value={dashData.totalCustomers || 0} icon={Users} color="purple" />
            <StatCard label="Total Products" value={dashData.totalProducts || 0} icon={Package} color="amber" />
            {dashData.pendingPOs != null && <StatCard label="Pending POs" value={dashData.pendingPOs} icon={TrendingUp} color="amber" />}
            {dashData.lowStockCount != null && <StatCard label="Low Stock Items" value={dashData.lowStockCount} icon={Package} color="red" />}
            {dashData.todayRevenue != null && <StatCard label="Today's Revenue" value={`₹${Number(dashData.todayRevenue).toLocaleString()}`} icon={DollarSign} color="green" />}
            {dashData.todayOrders != null && <StatCard label="Today's Orders" value={dashData.todayOrders} icon={BarChart3} color="cyan" />}
            {dashData.outstandingReceivable != null && <StatCard label="Receivable" value={`₹${Number(dashData.outstandingReceivable).toLocaleString()}`} icon={TrendingUp} color="amber" />}
            {dashData.outstandingPayable != null && <StatCard label="Payable" value={`₹${Number(dashData.outstandingPayable).toLocaleString()}`} icon={TrendingDown} color="red" />}
            {dashData.todayCollected != null && <StatCard label="Collected Today" value={`₹${Number(dashData.todayCollected).toLocaleString()}`} icon={DollarSign} color="green" />}
          </div>
        )
      )}

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <GlassCard>
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <Input label="Start Date" type="date" value={salesStart} onChange={(e) => setSalesStart(e.target.value)} />
            <Input label="End Date" type="date" value={salesEnd} onChange={(e) => setSalesEnd(e.target.value)} />
            <Button onClick={fetchSales}><TrendingUp size={16} /> Load</Button>
          </div>
          <DataTable columns={salesColumns} data={Array.isArray(salesData) ? salesData : []} loading={loading} emptyMessage="No sales data" />
          {!Array.isArray(salesData) && salesData && !loading && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <StatCard label="Total Revenue" value={`₹${Number(salesData.totalRevenue || 0).toLocaleString()}`} icon={DollarSign} color="green" />
              <StatCard label="Total Orders" value={salesData.totalOrders || 0} icon={BarChart3} color="cyan" />
              {salesData.avgOrderValue != null && <StatCard label="Avg Order Value" value={`₹${Number(salesData.avgOrderValue).toFixed(2)}`} icon={TrendingUp} color="purple" />}
            </div>
          )}
        </GlassCard>
      )}

      {/* Stock Tab */}
      {activeTab === 'stock' && (
        <GlassCard>
          <DataTable columns={stockColumns} data={stockData} loading={loading} emptyMessage="No stock data" />
        </GlassCard>
      )}

      {/* Customer Aging Tab */}
      {activeTab === 'customerAging' && (
        <GlassCard>
          <DataTable columns={customerAgingColumns} data={customerAgingData} loading={loading} emptyMessage="No customer aging data" />
        </GlassCard>
      )}

      {/* Supplier Aging Tab */}
      {activeTab === 'supplierAging' && (
        <GlassCard>
          <DataTable columns={supplierAgingColumns} data={supplierAgingData} loading={loading} emptyMessage="No supplier aging data" />
        </GlassCard>
      )}

      {/* Profit & Loss Tab */}
      {activeTab === 'profitLoss' && (
        <GlassCard>
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <Input label="Start Date" type="date" value={plStart} onChange={(e) => setPlStart(e.target.value)} />
            <Input label="End Date" type="date" value={plEnd} onChange={(e) => setPlEnd(e.target.value)} />
            <Button onClick={fetchProfitLoss}><DollarSign size={16} /> Load</Button>
          </div>
          {loading ? <Loader /> : plData && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Revenue" value={`₹${Number(plData.totalRevenue || plData.revenue || 0).toLocaleString()}`} icon={TrendingUp} color="green" />
                <StatCard label="Total Cost" value={`₹${Number(plData.totalCost || plData.cost || 0).toLocaleString()}`} icon={DollarSign} color="red" />
                <StatCard label="Gross Profit" value={`₹${Number(plData.grossProfit || plData.profit || 0).toLocaleString()}`} icon={DollarSign} color="cyan" />
                {plData.margin != null && <StatCard label="Margin" value={`${Number(plData.margin).toFixed(1)}%`} icon={BarChart3} color="purple" />}
              </div>
              {plData.lineItems && Array.isArray(plData.lineItems) && (
                <DataTable
                  columns={[
                    { key: 'label', label: 'Item', render: (r) => <span className="text-slate-800">{r.label || r.name || r.category || '—'}</span> },
                    { key: 'revenue', label: 'Revenue', render: (r) => <span className="text-emerald-400 font-mono">₹{Number(r.revenue || 0).toFixed(2)}</span> },
                    { key: 'cost', label: 'Cost', render: (r) => <span className="text-red-400 font-mono">₹{Number(r.cost || 0).toFixed(2)}</span> },
                    { key: 'profit', label: 'Profit', render: (r) => <span className={`font-mono font-bold ${(r.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>₹{Number(r.profit || 0).toFixed(2)}</span> },
                  ]}
                  data={plData.lineItems}
                  emptyMessage="No line items"
                />
              )}
            </>
          )}
        </GlassCard>
      )}

      {/* Cash Flow Tab */}
      {activeTab === 'cashFlow' && (
        <GlassCard>
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <Input label="Start Date" type="date" value={cfStart} onChange={(e) => setCfStart(e.target.value)} />
            <Input label="End Date" type="date" value={cfEnd} onChange={(e) => setCfEnd(e.target.value)} />
            <Select label="Group By" value={cfGroupBy} onChange={(e) => setCfGroupBy(e.target.value)}
              options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
            <Button onClick={fetchCashFlow}><ArrowUpDown size={16} /> Load</Button>
          </div>
          {loading ? <Loader /> : cashFlowData && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <StatCard label="Total Inflow" value={`₹${Number(cashFlowData.totals?.inflow || 0).toLocaleString()}`} icon={TrendingUp} color="green" />
                <StatCard label="Total Outflow" value={`₹${Number(cashFlowData.totals?.outflow || 0).toLocaleString()}`} icon={TrendingDown} color="red" />
                <StatCard label="Net Cash Flow" value={`₹${Number(cashFlowData.totals?.net || 0).toLocaleString()}`} icon={DollarSign}
                  color={(cashFlowData.totals?.net || 0) >= 0 ? 'green' : 'red'} />
              </div>
              <DataTable
                columns={[
                  { key: 'period', label: 'Period', render: (r) => <span className="text-slate-800 font-medium">{r.period}</span> },
                  { key: 'inflow', label: 'Inflow', render: (r) => <span className="text-emerald-400 font-mono">₹{Number(r.inflow || 0).toFixed(2)}</span> },
                  { key: 'outflow', label: 'Outflow', render: (r) => <span className="text-red-400 font-mono">₹{Number(r.outflow || 0).toFixed(2)}</span> },
                  { key: 'net', label: 'Net', render: (r) => <span className={`font-mono font-bold ${(r.net || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>₹{Number(r.net || 0).toFixed(2)}</span> },
                  { key: 'transactions', label: 'Transactions', render: (r) => <span className="text-slate-500">{r.transactions || 0}</span> },
                ]}
                data={cashFlowData.rows || []}
                emptyMessage="No cash flow data for this period"
              />
            </>
          )}
        </GlassCard>
      )}

      {/* Transaction Log Tab */}
      {activeTab === 'transactionLog' && (
        <GlassCard>
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <Select label="Party Type" value={txnPartyType} onChange={(e) => { setTxnPartyType(e.target.value); setTxnLogPage(1); }}
              options={[{ value: 'customer', label: 'Customer' }, { value: 'supplier', label: 'Supplier' }]} placeholder="All" className="w-36" />
            <Select label="Direction" value={txnDirection} onChange={(e) => { setTxnDirection(e.target.value); setTxnLogPage(1); }}
              options={[{ value: 'in', label: 'Inflow' }, { value: 'out', label: 'Outflow' }]} placeholder="All" className="w-36" />
            <Select label="Event Type" value={txnEventType} onChange={(e) => { setTxnEventType(e.target.value); setTxnLogPage(1); }}
              options={[
                { value: 'sale_invoice', label: 'Sale Invoice' },
                { value: 'sale_payment', label: 'Sale Payment' },
                { value: 'sale_return', label: 'Sale Return' },
                { value: 'customer_topup', label: 'Customer Topup' },
                { value: 'customer_adjustment', label: 'Customer Adj.' },
                { value: 'customer_opening', label: 'Customer Opening' },
                { value: 'purchase_invoice', label: 'Purchase Invoice' },
                { value: 'purchase_payment', label: 'Purchase Payment' },
                { value: 'purchase_return', label: 'Purchase Return' },
                { value: 'supplier_adjustment', label: 'Supplier Adj.' },
                { value: 'supplier_opening', label: 'Supplier Opening' },
              ]} placeholder="All" className="w-44" />
            <Input label="Start Date" type="date" value={txnStart} onChange={(e) => { setTxnStart(e.target.value); setTxnLogPage(1); }} />
            <Input label="End Date" type="date" value={txnEnd} onChange={(e) => { setTxnEnd(e.target.value); setTxnLogPage(1); }} />
            <Button onClick={fetchTransactionLog}><BookOpen size={16} /> Load</Button>
          </div>
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => <span className="text-slate-600 text-xs">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</span> },
              { key: 'eventType', label: 'Event', render: (r) => <Badge color={r.direction === 'in' ? 'green' : 'red'}>{(r.eventType || '').replace(/_/g, ' ')}</Badge> },
              { key: 'partyName', label: 'Party', render: (r) => (
                <div><span className="text-slate-800 text-sm">{r.partyName || '—'}</span><span className="text-slate-400 text-xs ml-1">({r.partyType})</span></div>
              )},
              { key: 'sourceNumber', label: 'Reference', render: (r) => <span className="text-violet-600 font-mono text-xs">{r.sourceNumber || '—'}</span> },
              { key: 'amount', label: 'Amount', render: (r) => (
                <span className={`font-mono font-bold ${r.direction === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.direction === 'in' ? '+' : '-'}₹{Number(r.amount || 0).toFixed(2)}
                </span>
              )},
              { key: 'narration', label: 'Narration', render: (r) => <span className="text-slate-500 text-xs truncate max-w-[200px] block">{r.narration || '—'}</span> },
            ]}
            data={txnLogData}
            loading={loading}
            emptyMessage="No transaction log entries"
          />
          {txnLogPagination && txnLogPagination.totalPages > 1 && (
            <div className="mt-4">
              <Pagination page={txnLogPage} totalPages={txnLogPagination.totalPages} onPageChange={setTxnLogPage} />
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}