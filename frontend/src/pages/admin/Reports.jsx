import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader, TabList, Textarea, StatCard, Pagination } from '../../components/ui';
import { reportsAPI } from '../../api';
import { BarChart3, TrendingUp, Package, Users, Truck, DollarSign } from 'lucide-react';

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sales', label: 'Sales' },
  { id: 'stock', label: 'Stock Report' },
  { id: 'customerAging', label: 'Customer Aging' },
  { id: 'supplierAging', label: 'Supplier Aging' },
  { id: 'profitLoss', label: 'Profit & Loss' },
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

  useEffect(() => {
    const loaders = { dashboard: fetchDashboard, sales: fetchSales, stock: fetchStock, customerAging: fetchCustomerAging, supplierAging: fetchSupplierAging, profitLoss: fetchProfitLoss };
    loaders[activeTab]?.();
  }, [activeTab, fetchDashboard, fetchSales, fetchStock, fetchCustomerAging, fetchSupplierAging, fetchProfitLoss]);

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
    </div>
  );
}
