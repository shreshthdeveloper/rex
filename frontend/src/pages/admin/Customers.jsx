import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader, TabList, Textarea, CsvImport } from '../../components/ui';
import { customersAPI } from '../../api';
import { Plus, Edit, Trash2, Eye, UserCircle, Wallet, ArrowUpCircle, ArrowDownCircle, FileText, ShoppingCart, CreditCard, Receipt } from 'lucide-react';

const TIERS = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'vip', label: 'VIP' },
  { value: 'custom', label: 'Custom' },
];

const TIER_COLORS = { retail: 'gray', wholesale: 'cyan', vip: 'purple', custom: 'amber' };

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online' },
];

const ADJUST_TYPES = [
  { value: 'credit_adjustment', label: 'Credit Adjustment' },
  { value: 'debit_adjustment', label: 'Debit Adjustment' },
];

const LEDGER_COLORS = {
  invoice: 'red', debit_note: 'red',
  payment: 'green', credit_note: 'green', balance_topup: 'green',
  balance_adjustment: 'amber', opening_balance: 'amber',
};

const DETAIL_TABS = [
  { id: 'ledger', label: 'Ledger' },
  { id: 'balance', label: 'Balance' },
  { id: 'topup', label: 'Topup' },
  { id: 'adjust', label: 'Adjust' },
  { id: 'statement', label: 'Statement' },
  { id: 'orders', label: 'Orders' },
  { id: 'payments', label: 'Payments' },
  { id: 'topups', label: 'Topups' },
];

const emptyForm = {
  name: '', companyName: '', email: '', phone: '', password: '',
  gstNumber: '', paymentTerms: '', website: '',
  line1: '', city: '', state: '', zip: '', country: '',
  tier: 'retail', creditLimit: '', openingBalance: '',
  isActive: true, notes: '',
};

const emptyTopup = { amount: '', paymentMethod: 'cash', reference: '', notes: '' };
const emptyAdjust = { type: 'credit_adjustment', amount: '', reason: '' };

function fmtCurrency(v) {
  return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Customers() {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('');

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Detail modal
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [detailTab, setDetailTab] = useState('ledger');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState([]);
  const [balanceData, setBalanceData] = useState(null);
  const [liveBalance, setLiveBalance] = useState(null);

  // Topup / Adjust forms
  const [topupForm, setTopupForm] = useState(emptyTopup);
  const [adjustForm, setAdjustForm] = useState(emptyAdjust);
  const [actionSaving, setActionSaving] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  /* ───── FETCH LIST ───── */
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await customersAPI.list();
      setCustomers(res.data?.customers || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  /* ───── CREATE / EDIT ───── */
  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || '', companyName: c.companyName || '', email: c.email || '', phone: c.phone || '', password: '',
      gstNumber: c.gstNumber || '', paymentTerms: c.paymentTerms || '', website: c.website || '',
      line1: c.addresses?.[0]?.line1 || '', city: c.addresses?.[0]?.city || '',
      state: c.addresses?.[0]?.state || '', zip: c.addresses?.[0]?.zip || '',
      country: c.addresses?.[0]?.country || '',
      tier: c.tier || 'retail', creditLimit: c.creditLimit ?? '', openingBalance: '',
      isActive: c.isActive !== false, notes: c.notes || '',
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name and email are required');
    if (!editing && !form.password.trim()) return toast.error('Password is required for new customers');
    try {
      setSaving(true);
      const payload = {
        name: form.name, companyName: form.companyName, email: form.email, phone: form.phone,
        gstNumber: form.gstNumber, paymentTerms: form.paymentTerms, website: form.website,
        addresses: [{ label: 'Default', line1: form.line1, city: form.city, state: form.state, zip: form.zip, country: form.country, isDefault: true }],
        tier: form.tier, creditLimit: Number(form.creditLimit) || 0,
        isActive: form.isActive, notes: form.notes,
      };
      if (!editing) {
        payload.password = form.password;
        if (form.openingBalance) payload.openingBalance = Number(form.openingBalance);
      }
      if (editing && form.password) payload.password = form.password;

      if (editing) {
        await customersAPI.update(editing._id, payload);
        toast.success('Customer updated');
      } else {
        await customersAPI.create(payload);
        toast.success('Customer created');
      }
      closeModal();
      fetchCustomers();
    } catch (err) {
      toast.error(err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  /* ───── DELETE ───── */
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await customersAPI.delete(deleteTarget._id);
      toast.success('Customer deleted');
      setDeleteTarget(null);
      fetchCustomers();
    } catch (err) {
      toast.error(err.message || 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  /* ───── DETAIL MODAL ───── */
  const refreshLiveBalance = async (id) => {
    try {
      const res = await customersAPI.getBalance(id);
      setLiveBalance(res.data?.currentBalance ?? res.data?.balance ?? null);
    } catch { /* non-critical */ }
  };

  const openDetail = async (c) => {
    setDetailCustomer(c);
    setDetailTab('ledger');
    setTopupForm(emptyTopup);
    setAdjustForm(emptyAdjust);
    setLiveBalance(null);
    fetchDetailTab('ledger', c._id);
    refreshLiveBalance(c._id);
  };
  const closeDetail = () => { setDetailCustomer(null); setDetailData([]); setBalanceData(null); setLiveBalance(null); };

  const fetchDetailTab = useCallback(async (tab, id) => {
    const cid = id || detailCustomer?._id;
    if (!cid) return;
    setDetailLoading(true);
    setDetailData([]);
    setBalanceData(null);
    try {
      let res;
      switch (tab) {
        case 'ledger':    res = await customersAPI.getLedger(cid, { limit: 200 });    setDetailData(res.data?.entries || []); break;
        case 'balance':   res = await customersAPI.getBalance(cid);  setBalanceData(res.data || res); break;
        case 'statement': res = await customersAPI.getStatement(cid); setDetailData(res.data?.entries || []); break;
        case 'orders':    res = await customersAPI.getOrders(cid);   setDetailData(res.data?.orders || []); break;
        case 'payments':  res = await customersAPI.getPayments(cid); setDetailData(res.data?.payments || []); break;
        case 'topups':    res = await customersAPI.getTopups(cid);   setDetailData(res.data?.topups || []); break;
        default: break;
      }
    } catch (err) {
      toast.error(err.message || `Failed to load ${tab}`);
    } finally {
      setDetailLoading(false);
    }
  }, [detailCustomer, toast]);

  const onDetailTabChange = (tab) => {
    setDetailTab(tab);
    if (!['topup', 'adjust'].includes(tab)) fetchDetailTab(tab);
  };

  /* ───── TOPUP ───── */
  const handleTopup = async () => {
    if (!topupForm.amount || Number(topupForm.amount) <= 0) return toast.error('Enter a valid amount');
    try {
      setActionSaving(true);
      await customersAPI.topup(detailCustomer._id, {
        amount: Number(topupForm.amount),
        method: topupForm.paymentMethod,
        reference: topupForm.reference,
        narration: topupForm.notes,
      });
      toast.success('Topup recorded');
      setTopupForm(emptyTopup);
      fetchDetailTab('ledger', detailCustomer._id);
      setDetailTab('ledger');
      refreshLiveBalance(detailCustomer._id);
      fetchCustomers();
    } catch (err) {
      toast.error(err.message || 'Failed to record topup');
    } finally {
      setActionSaving(false);
    }
  };

  /* ───── ADJUST ───── */
  const handleAdjust = async () => {
    if (!adjustForm.amount || Number(adjustForm.amount) <= 0) return toast.error('Enter a valid amount');
    if (!adjustForm.reason.trim()) return toast.error('Reason is required');
    try {
      setActionSaving(true);
      await customersAPI.adjust(detailCustomer._id, {
        type: adjustForm.type,
        amount: Number(adjustForm.amount),
        narration: adjustForm.reason,
      });
      toast.success('Adjustment recorded');
      setAdjustForm(emptyAdjust);
      fetchDetailTab('ledger', detailCustomer._id);
      setDetailTab('ledger');
      refreshLiveBalance(detailCustomer._id);
      fetchCustomers();
    } catch (err) {
      toast.error(err.message || 'Failed to record adjustment');
    } finally {
      setActionSaving(false);
    }
  };

  /* ───── CSV IMPORT ───── */
  const CUSTOMER_CSV_COLS = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'tier', label: 'Tier (retail/wholesale/vip)' },
    { key: 'creditLimit', label: 'Credit Limit' },
    { key: 'notes', label: 'Notes' },
  ];
  const CUSTOMER_CSV_SAMPLE = [
    { name: 'John Doe', email: 'john@example.com', phone: '+1-555-0001', tier: 'retail', creditLimit: '1000', notes: '' },
    { name: 'Jane Smith', email: 'jane@example.com', phone: '+1-555-0002', tier: 'wholesale', creditLimit: '5000', notes: 'Bulk buyer' },
  ];
  const handleCsvImport = async (rows) => {
    let ok = 0, fail = 0;
    for (const row of rows) {
      if (!row.name?.trim() || !row.email?.trim()) { fail++; continue; }
      try {
        await customersAPI.create({
          name: row.name.trim(), email: row.email.trim(), phone: row.phone || '',
          tier: ['retail','wholesale','vip','custom'].includes(row.tier) ? row.tier : 'retail',
          creditLimit: Number(row.creditLimit) || 0,
          notes: row.notes || '', password: 'Password@123', addresses: [], isActive: true,
        });
        ok++;
      } catch { fail++; }
    }
    toast.success(`Imported ${ok} customers${fail ? `, ${fail} skipped` : ''}`);
    fetchCustomers();
  };

  /* ───── FILTER ───── */
  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q);
    const matchTier = !filterTier || c.tier === filterTier;
    return matchSearch && matchTier;
  });

  /* ───── LIST COLUMNS ───── */
  const columns = [
    { key: 'name', label: 'Name', render: (r) => (
      <div className="flex items-center gap-2">
        <UserCircle size={18} className="text-violet-600 shrink-0" />
        <span className="text-slate-800 font-medium">{r.name}</span>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" title="View details" onClick={(e) => { e.stopPropagation(); openDetail(r); }}><Eye size={16} /></Button>
        <Button variant="icon" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>
        <Button variant="icon" title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '-' },
    { key: 'tier', label: 'Tier', render: (r) => <Badge color={TIER_COLORS[r.tier] || 'gray'}>{r.tier}</Badge> },
    { key: 'currentBalance', label: 'Balance', render: (r) => (
      <span className={Number(r.currentBalance) > 0 ? 'text-red-400' : Number(r.currentBalance) < 0 ? 'text-emerald-400' : 'text-slate-500'}>
        {fmtCurrency(r.currentBalance)}
      </span>
    )},
    { key: 'isActive', label: 'Status', render: (r) => <Badge color={r.isActive !== false ? 'green' : 'red'}>{r.isActive !== false ? 'Active' : 'Inactive'}</Badge> },
  ];

  /* ───── DETAIL SUB-TABLE COLUMNS ───── */
  const ledgerColumns = [
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date || r.createdAt) },
    { key: 'type', label: 'Type', render: (r) => <Badge color={LEDGER_COLORS[r.transactionType] || 'gray'}>{r.transactionType}</Badge> },
    { key: 'description', label: 'Description', render: (r) => r.narration || '-' },
    { key: 'debit', label: 'Debit', render: (r) => r.debit ? <span className="text-red-400">{fmtCurrency(r.debit)}</span> : '-' },
    { key: 'credit', label: 'Credit', render: (r) => r.credit ? <span className="text-emerald-400">{fmtCurrency(r.credit)}</span> : '-' },
    { key: 'balanceAfter', label: 'Balance', render: (r) => fmtCurrency(r.balanceAfter) },
  ];

  const statementColumns = [
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date || r.createdAt) },
    { key: 'type', label: 'Type', render: (r) => <Badge color={LEDGER_COLORS[r.transactionType] || 'gray'}>{r.transactionType}</Badge> },
    { key: 'description', label: 'Description', render: (r) => r.narration || r.referenceNumber || '-' },
    { key: 'debit', label: 'Debit', render: (r) => r.debit ? <span className="text-red-400">{fmtCurrency(r.debit)}</span> : '-' },
    { key: 'credit', label: 'Credit', render: (r) => r.credit ? <span className="text-emerald-400">{fmtCurrency(r.credit)}</span> : '-' },
    { key: 'balanceAfter', label: 'Balance', render: (r) => fmtCurrency(r.balanceAfter) },
  ];

  const ordersColumns = [
    { key: 'orderNumber', label: 'Order #', render: (r) => <span className="text-slate-800 font-medium">{r.orderNumber || r._id}</span> },
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.createdAt) },
    { key: 'totalAmount', label: 'Amount', render: (r) => fmtCurrency(r.totalAmount ?? r.grandTotal) },
    { key: 'status', label: 'Status', render: (r) => <Badge color={r.status === 'completed' ? 'green' : r.status === 'cancelled' ? 'red' : 'amber'}>{r.status}</Badge> },
  ];

  const paymentsColumns = [
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date || r.createdAt) },
    { key: 'amount', label: 'Amount', render: (r) => <span className="text-emerald-400">{fmtCurrency(r.amount)}</span> },
    { key: 'paymentMethod', label: 'Method', render: (r) => r.paymentMethod || '-' },
    { key: 'reference', label: 'Reference', render: (r) => r.reference || '-' },
  ];

  const topupsColumns = [
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date || r.createdAt) },
    { key: 'amount', label: 'Amount', render: (r) => <span className="text-emerald-400">{fmtCurrency(r.amount)}</span> },
    { key: 'paymentMethod', label: 'Method', render: (r) => r.paymentMethod || '-' },
    { key: 'reference', label: 'Reference', render: (r) => r.reference || '-' },
    { key: 'notes', label: 'Notes', render: (r) => r.notes || '-' },
  ];

  /* ───── DETAIL TAB CONTENT ───── */
  const renderDetailContent = () => {
    switch (detailTab) {
      case 'ledger':
        return <DataTable columns={ledgerColumns} data={detailData} loading={detailLoading} emptyMessage="No ledger entries" />;

      case 'balance':
        if (detailLoading) return <Loader />;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <GlassCard className="text-center">
                <Wallet size={28} className="text-violet-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500 uppercase tracking-wide">Current Balance</p>
                <p className={`text-2xl font-bold mt-1 ${Number(balanceData?.currentBalance ?? balanceData?.balance) > 0 ? 'text-red-400' : Number(balanceData?.currentBalance ?? balanceData?.balance) < 0 ? 'text-emerald-400' : 'text-slate-800'}`}>
                  {fmtCurrency(balanceData?.currentBalance ?? balanceData?.balance)}
                </p>
              </GlassCard>
              <GlassCard className="text-center">
                <CreditCard size={28} className="text-amber-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500 uppercase tracking-wide">Credit Limit</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{fmtCurrency(balanceData?.creditLimit ?? detailCustomer?.creditLimit)}</p>
              </GlassCard>
              <GlassCard className="text-center">
                <Receipt size={28} className="text-purple-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500 uppercase tracking-wide">Total Orders</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{balanceData?.totalOrders ?? '-'}</p>
              </GlassCard>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Positive balance = customer owes us &nbsp;|&nbsp; Negative balance = advance / credit
            </p>
          </div>
        );

      case 'topup':
        return (
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpCircle size={20} className="text-emerald-400" />
              <h4 className="text-slate-800 font-medium">Record Topup</h4>
            </div>
            <Input label="Amount" type="number" min="0" step="0.01" value={topupForm.amount}
              onChange={(e) => setTopupForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            <Select label="Payment Method" value={topupForm.paymentMethod}
              onChange={(e) => setTopupForm((p) => ({ ...p, paymentMethod: e.target.value }))} options={PAYMENT_METHODS} />
            <Input label="Reference" value={topupForm.reference}
              onChange={(e) => setTopupForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Receipt / txn number" />
            <Textarea label="Notes" value={topupForm.notes}
              onChange={(e) => setTopupForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
            <Button onClick={handleTopup} loading={actionSaving} className="w-full">
              <ArrowUpCircle size={16} /> Submit Topup
            </Button>
          </div>
        );

      case 'adjust':
        return (
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownCircle size={20} className="text-amber-400" />
              <h4 className="text-slate-800 font-medium">Balance Adjustment</h4>
            </div>
            <Select label="Adjustment Type" value={adjustForm.type}
              onChange={(e) => setAdjustForm((p) => ({ ...p, type: e.target.value }))} options={ADJUST_TYPES} />
            <Input label="Amount" type="number" min="0" step="0.01" value={adjustForm.amount}
              onChange={(e) => setAdjustForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            <Textarea label="Reason" value={adjustForm.reason}
              onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))} placeholder="Reason for adjustment (required)" />
            <Button onClick={handleAdjust} loading={actionSaving} className="w-full">
              <ArrowDownCircle size={16} /> Submit Adjustment
            </Button>
          </div>
        );

      case 'statement':
        return <DataTable columns={statementColumns} data={detailData} loading={detailLoading} emptyMessage="No statement entries" />;

      case 'orders':
        return <DataTable columns={ordersColumns} data={detailData} loading={detailLoading} emptyMessage="No orders found" />;

      case 'payments':
        return <DataTable columns={paymentsColumns} data={detailData} loading={detailLoading} emptyMessage="No payments found" />;

      case 'topups':
        return <DataTable columns={topupsColumns} data={detailData} loading={detailLoading} emptyMessage="No topups found" />;

      default:
        return null;
    }
  };

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Manage customers, balances & ledger"
        actions={
          <div className="flex items-center gap-2">
            <CsvImport columns={CUSTOMER_CSV_COLS} onImport={handleCsvImport} sampleRows={CUSTOMER_CSV_SAMPLE} />
            <Button onClick={openCreate}><Plus size={16} /> Add Customer</Button>
          </div>
        }
      />

      <GlassCard>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search customers..." className="flex-1 max-w-sm" />
          <Select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            options={TIERS}
            placeholder="All Tiers"
            className="w-40"
          />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} onRowClick={openDetail} emptyMessage="No customers found" />
      </GlassCard>

      {/* ───── Create / Edit Modal ───── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Customer' : 'Create Customer'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Basic Info */}
          <div>
            <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Basic Info</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Name" value={form.name} onChange={set('name')} placeholder="Customer name" />
              <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="email@example.com" />
              <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="+1 234 567 890" />
              <Input label="Company Name" value={form.companyName} onChange={set('companyName')} placeholder="Company / Business name" />
              <Input
                label={editing ? 'New Password (leave blank to keep)' : 'Password'}
                type="password" value={form.password} onChange={set('password')} placeholder="••••••••"
              />
              <Input label="GST / Tax Number" value={form.gstNumber} onChange={set('gstNumber')} placeholder="GST / Tax ID" />
              <Input label="Website" value={form.website} onChange={set('website')} placeholder="https://" />
              <Input label="Payment Terms" value={form.paymentTerms} onChange={set('paymentTerms')} placeholder="e.g. Net 30" />
            </div>
          </div>

          {/* Address */}
          <div>
            <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Address</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Address Line" value={form.line1} onChange={set('line1')} placeholder="Street address" className="sm:col-span-2" />
              <Input label="City" value={form.city} onChange={set('city')} placeholder="City" />
              <Input label="State" value={form.state} onChange={set('state')} placeholder="State" />
              <Input label="Zip Code" value={form.zip} onChange={set('zip')} placeholder="Zip" />
              <Input label="Country" value={form.country} onChange={set('country')} placeholder="Country" />
            </div>
          </div>

          {/* Financial */}
          <div>
            <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Financial</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="Tier" value={form.tier} onChange={set('tier')} options={TIERS} />
              <Input label="Credit Limit" type="number" min="0" step="0.01" value={form.creditLimit} onChange={set('creditLimit')} placeholder="0.00" />
              {!editing && (
                <Input label="Opening Balance" type="number" step="0.01" value={form.openingBalance} onChange={set('openingBalance')} placeholder="0.00" />
              )}
            </div>
          </div>

          {/* Notes */}
          <Textarea label="Notes" value={form.notes} onChange={set('notes')} placeholder="Internal notes about this customer" />
        </div>
      </Modal>

      {/* ───── Detail Modal ───── */}
      <Modal
        open={!!detailCustomer}
        onClose={closeDetail}
        title={detailCustomer?.name || 'Customer Details'}
        size="xl"
      >
        {detailCustomer && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-violet-100">
              <div className="flex items-center gap-2">
                <UserCircle size={24} className="text-violet-600" />
                <div>
                  <p className="text-slate-800 font-medium">{detailCustomer.name}</p>
                  <p className="text-xs text-slate-500">{detailCustomer.email}</p>
                </div>
              </div>
              <Badge color={TIER_COLORS[detailCustomer.tier] || 'gray'}>{detailCustomer.tier}</Badge>
              <Badge color={detailCustomer.isActive !== false ? 'green' : 'red'}>{detailCustomer.isActive !== false ? 'Active' : 'Inactive'}</Badge>
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-500">Balance</p>
                <p className={`text-lg font-bold ${Number(liveBalance ?? detailCustomer.currentBalance) > 0 ? 'text-red-400' : Number(liveBalance ?? detailCustomer.currentBalance) < 0 ? 'text-emerald-400' : 'text-slate-800'}`}>
                  {fmtCurrency(liveBalance ?? detailCustomer.currentBalance)}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <TabList tabs={DETAIL_TABS} active={detailTab} onChange={onDetailTabChange} />
            {renderDetailContent()}
          </div>
        )}
      </Modal>

      {/* ───── Delete Confirm ───── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
