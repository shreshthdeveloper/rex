import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, DataTable, Badge, GlassCard, Loader, StatCard } from '../../components/ui';
import { reportsAPI } from '../../api';
import { ShoppingCart, DollarSign, Users, Package, TrendingUp, TrendingDown, Wallet, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0, totalRevenue: 0, totalCustomers: 0, totalProducts: 0,
    todayOrders: 0, todayRevenue: 0, todayCollected: 0,
    outstandingReceivable: 0, outstandingPayable: 0,
    lowStockCount: 0, pendingPOs: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsAPI.dashboard();
      const d = res.data || res;
      setStats({
        totalOrders: d.totalOrders || 0,
        totalRevenue: d.totalRevenue || 0,
        totalCustomers: d.totalCustomers || 0,
        totalProducts: d.totalProducts || 0,
        todayOrders: d.todayOrders || 0,
        todayRevenue: d.todayRevenue || 0,
        todayCollected: d.todayCollected || 0,
        outstandingReceivable: d.outstandingReceivable || 0,
        outstandingPayable: d.outstandingPayable || 0,
        lowStockCount: d.lowStockCount || 0,
        pendingPOs: d.pendingPOs || 0,
      });
      setRecentOrders(d.recentOrders || []);
      setTopProducts(d.topProducts || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const orderColumns = [
    { key: 'orderNumber', label: 'Order #', render: (r) => <span className="text-violet-600 font-medium">{r.orderNumber || r._id?.slice(-6)}</span> },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name || r.customerName || '—' },
    { key: 'totalAmount', label: 'Amount', render: (r) => <span className="font-medium">₹{(r.totalAmount || r.grandTotal || 0).toLocaleString()}</span> },
    { key: 'status', label: 'Status', render: (r) => {
      const colors = { pending: 'amber', confirmed: 'blue', processing: 'cyan', shipped: 'purple', delivered: 'green', cancelled: 'red' };
      return <Badge color={colors[r.status] || 'gray'}>{r.status || '—'}</Badge>;
    }},
    { key: 'createdAt', label: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
  ];

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Overview of your store" />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Orders" value={stats.totalOrders.toLocaleString()} icon={ShoppingCart} color="cyan" />
        <StatCard label="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} color="green" />
        <StatCard label="Customers" value={stats.totalCustomers.toLocaleString()} icon={Users} color="purple" />
        <StatCard label="Products" value={stats.totalProducts.toLocaleString()} icon={Package} color="amber" />
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Orders" value={stats.todayOrders.toLocaleString()} icon={ShoppingCart} color="cyan" />
        <StatCard label="Today's Revenue" value={`₹${stats.todayRevenue.toLocaleString()}`} icon={DollarSign} color="green" />
        <StatCard label="Cash Collected Today" value={`₹${stats.todayCollected.toLocaleString()}`} icon={Wallet} color="green" />
        <StatCard label="Outstanding Receivable" value={`₹${stats.outstandingReceivable.toLocaleString()}`} icon={TrendingUp} color="amber" />
      </div>

      {/* Operational Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Outstanding Payable" value={`₹${stats.outstandingPayable.toLocaleString()}`} icon={TrendingDown} color="red" />
        {stats.pendingPOs > 0 && <StatCard label="Pending POs" value={stats.pendingPOs} icon={Package} color="amber" />}
        {stats.lowStockCount > 0 && <StatCard label="Low Stock Items" value={stats.lowStockCount} icon={AlertTriangle} color="red" />}
      </div>

      {/* Top Products */}
      {topProducts.length > 0 && (
        <GlassCard>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Top Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topProducts.slice(0, 6).map((p, i) => (
              <div key={p._id || i} className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 border border-violet-100">
                <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 font-medium truncate">{p.name || p.productName || '—'}</p>
                  <p className="text-xs text-slate-500">{p.totalSold || p.quantity || 0} sold</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Recent Orders */}
      <GlassCard>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent Orders</h2>
        <DataTable columns={orderColumns} data={recentOrders} emptyMessage="No recent orders" />
      </GlassCard>
    </div>
  );
}
