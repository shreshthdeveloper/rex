import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader, TabList, Textarea } from '../../components/ui';
import { suppliersAPI } from '../../api';
import { Plus, Edit, Trash2, Eye, Truck, Wallet, CreditCard, ArrowUpCircle, RefreshCw } from 'lucide-react';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online' },
];

const ADJUST_TYPES = [
  { value: 'debit_adjustment', label: 'Debit Adjustment' },
  { value: 'credit_adjustment', label: 'Credit Adjustment' },
];

const LEDGER_COLORS = {
  purchase_invoice: 'red', debit_note: 'red', debit_adjustment: 'red',
  payment: 'green', credit_note: 'green', credit_adjustment: 'green', balance_topup: 'green',
  balance_adjustment: 'amber', opening_balance: 'amber',
};

const DETAIL_TABS = [
  { id: 'ledger', label: 'Ledger' },
  { id: 'balance', label: 'Balance' },
  { id: 'payments', label: 'Payments' },
  { id: 'adjust', label: 'Adjust' },
  { id: 'purchase-orders', label: 'Purchase Orders' },
  { id: 'statement', label: 'Statement' },
];

const emptyForm = {
  name: '', email: '', phone: '', contactPerson: '',
  line1: '', city: '', state: '', zip: '', country: '',
  paymentTerms: '', taxId: '', openingBalance: '',
  isActive: true, notes: '',
};

const emptyPayment = { amount: '', paymentMethod: 'cash', reference: '', notes: '' };
const emptyAdjust = { type: 'debit_adjustment', amount: '', reason: '' };

function fmtCurrency(v) {
  return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '-';
  const date = new Date(d);
  return (
    <span>
      <span className="block">{date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
      <span className="block text-xs text-slate-400">{date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
    </span>
  );
}

export default function Suppliers() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Detail modal
  const [detailSupplier, setDetailSupplier] = useState(null);
  const [detailTab, setDetailTab] = useState('ledger');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState([]);
  const [balanceData, setBalanceData] = useState(null);

  // Payment / Adjust forms
  const [payForm, setPayForm] = useState(emptyPayment);
  const [adjustForm, setAdjustForm] = useState(emptyAdjust);
  const [actionSaving, setActionSaving] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  /* ───── FETCH LIST ───── */
  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await suppliersAPI.list();
      setSuppliers(res.data?.suppliers || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  /* ───── CREATE / EDIT ───── */
  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name || '', email: s.email || '', phone: s.phone || '',
      contactPerson: s.contactPerson || '',
      line1: s.address?.line1 || '', city: s.address?.city || '',
      state: s.address?.state || '', zip: s.address?.zip || '',
      country: s.address?.country || '',
      paymentTerms: s.paymentTerms || '', taxId: s.taxId || '', openingBalance: '',
      isActive: s.isActive !== false, notes: s.notes || '',
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      setSaving(true);
      const payload = {
        name: form.name, email: form.email, phone: form.phone,
        contactPerson: form.contactPerson,
        address: { line1: form.line1, city: form.city, state: form.state, zip: form.zip, country: form.country },
        paymentTerms: form.paymentTerms, taxId: form.taxId,
        isActive: form.isActive, notes: form.notes,
      };
      if (!editing && form.openingBalance) payload.openingBalance = Number(form.openingBalance);

      if (editing) {
        await suppliersAPI.update(editing._id, payload);
        toast.success('Supplier updated');
      } else {
        await suppliersAPI.create(payload);
        toast.success('Supplier created');
      }
      closeModal();
      fetchSuppliers();
    } catch (err) {
      toast.error(err.message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  /* ───── DELETE ───── */
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await suppliersAPI.delete(deleteTarget._id);
      toast.success('Supplier deleted');
      setDeleteTarget(null);
      fetchSuppliers();
    } catch (err) {
      toast.error(err.message || 'Failed to delete supplier');
    } finally {
      setDeleting(false);
    }
  };

  /* ───── DETAIL MODAL ───── */
  const openDetail = async (s) => {
    setDetailSupplier(s);
    setDetailTab('ledger');
    setPayForm(emptyPayment);
    setAdjustForm(emptyAdjust);
    fetchDetailTab('ledger', s._id);
  };
  const closeDetail = () => { setDetailSupplier(null); setDetailData([]); setBalanceData(null); };

  const fetchDetailTab = useCallback(async (tab, id) => {
    const sid = id || detailSupplier?._id;
    if (!sid) return;
    setDetailLoading(true);
    setDetailData([]);
    setBalanceData(null);
    try {
      let res;
      switch (tab) {
        case 'ledger':          res = await suppliersAPI.getLedger(sid);          setDetailData(res.data?.entries || []); break;
        case 'balance':         res = await suppliersAPI.getBalance(sid);         setBalanceData(res.data || res); break;
        case 'purchase-orders': res = await suppliersAPI.getPurchaseOrders(sid);  setDetailData(res.data?.purchaseOrders || []); break;
        case 'statement':       res = await suppliersAPI.getStatement(sid);       setDetailData(res.data?.entries || []); break;
        default: break;
      }
    } catch (err) {
      toast.error(err.message || `Failed to load ${tab}`);
    } finally {
      setDetailLoading(false);
    }
  }, [detailSupplier, toast]);

  const onDetailTabChange = (tab) => {
    setDetailTab(tab);
    if (!['payments', 'adjust'].includes(tab)) fetchDetailTab(tab);
  };

  /* ───── PAYMENT ───── */
  const handlePayment = async () => {
    if (!payForm.amount || Number(payForm.amount) <= 0) return toast.error('Enter a valid amount');
    try {
      setActionSaving(true);
      await suppliersAPI.recordPayment(detailSupplier._id, {
        amount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod,
        reference: payForm.reference,
        notes: payForm.notes,
      });
      toast.success('Payment recorded');
      setPayForm(emptyPayment);
      fetchDetailTab('ledger', detailSupplier._id);
      setDetailTab('ledger');
      fetchSuppliers();
    } catch (err) {
      toast.error(err.message || 'Failed to record payment');
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
      await suppliersAPI.adjust(detailSupplier._id, {
        type: adjustForm.type,
        amount: Number(adjustForm.amount),
        reason: adjustForm.reason,
      });
      toast.success('Adjustment recorded');
      setAdjustForm(emptyAdjust);
      fetchDetailTab('ledger', detailSupplier._id);
      setDetailTab('ledger');
      fetchSuppliers();
    } catch (err) {
      toast.error(err.message || 'Failed to record adjustment');
    } finally {
      setActionSaving(false);
    }
  };

  /* ───── FILTER ───── */
  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.phone?.includes(q) || s.contactPerson?.toLowerCase().includes(q);
  });

  /* ───── LIST COLUMNS ───── */
  const columns = [
    { key: 'name', label: 'Supplier', render: (r) => (
      <div className="flex items-center gap-2">
        <Truck size={18} className="text-violet-600 shrink-0" />
        <div>
          <span className="text-slate-800 font-medium">{r.name}</span>
          {r.contactPerson && <p className="text-xs text-slate-500">{r.contactPerson}</p>}
        </div>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" title="View details" onClick={(e) => { e.stopPropagation(); openDetail(r); }}><Eye size={16} /></Button>
        <Button variant="icon" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>
        <Button variant="icon" title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
    { key: 'email', label: 'Email', render: (r) => r.email || '-' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '-' },
    { key: 'currentBalance', label: 'Balance', render: (r) => (
      <span className={Number(r.currentBalance) > 0 ? 'text-amber-400' : Number(r.currentBalance) < 0 ? 'text-emerald-400' : 'text-slate-500'}>
        {fmtCurrency(r.currentBalance)}
      </span>
    )},
    { key: 'isActive', label: 'Status', render: (r) => <Badge color={r.isActive !== false ? 'green' : 'red'}>{r.isActive !== false ? 'Active' : 'Inactive'}</Badge> },
  ];

  /* ───── DETAIL TABLES ───── */
  const ledgerColumns = [
    { key: 'date', label: 'Date', render: (r) => fmtDateTime(r.date || r.createdAt) },
    { key: 'ref', label: 'Ref #', render: (r) => r.referenceNumber ? <span className="text-violet-600 font-mono text-xs">{r.referenceNumber}</span> : <span className="text-slate-400">—</span> },
    { key: 'type', label: 'Type', render: (r) => <Badge color={LEDGER_COLORS[r.transactionType] || 'gray'}>{r.transactionType}</Badge> },
    { key: 'description', label: 'Description', render: (r) => r.narration || '-' },
    { key: 'debit', label: 'Debit', render: (r) => r.debit ? <span className="text-red-400">{fmtCurrency(r.debit)}</span> : '-' },
    { key: 'credit', label: 'Credit', render: (r) => r.credit ? <span className="text-emerald-400">{fmtCurrency(r.credit)}</span> : '-' },
    { key: 'balanceAfter', label: 'Balance', render: (r) => fmtCurrency(r.balanceAfter) },
  ];

  const statementColumns = [
    { key: 'date', label: 'Date', render: (r) => fmtDateTime(r.date || r.createdAt) },
    { key: 'ref', label: 'Ref #', render: (r) => r.referenceNumber ? <span className="text-violet-600 font-mono text-xs">{r.referenceNumber}</span> : <span className="text-slate-400">—</span> },
    { key: 'type', label: 'Type', render: (r) => <Badge color={LEDGER_COLORS[r.transactionType] || 'gray'}>{r.transactionType}</Badge> },
    { key: 'description', label: 'Description', render: (r) => r.narration || '-' },
    { key: 'debit', label: 'Debit', render: (r) => r.debit ? <span className="text-red-400">{fmtCurrency(r.debit)}</span> : '-' },
    { key: 'credit', label: 'Credit', render: (r) => r.credit ? <span className="text-emerald-400">{fmtCurrency(r.credit)}</span> : '-' },
    { key: 'balanceAfter', label: 'Balance', render: (r) => fmtCurrency(r.balanceAfter ?? r.runningBalance) },
  ];

  const poColumns = [
    { key: 'poNumber', label: 'PO #', render: (r) => <span className="text-slate-800 font-medium">{r.poNumber || r._id}</span> },
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.createdAt) },
    { key: 'grandTotal', label: 'Amount', render: (r) => fmtCurrency(r.grandTotal ?? r.totalAmount) },
    { key: 'status', label: 'Status', render: (r) => {
      const c = { draft: 'gray', sent: 'blue', ordered: 'amber', partial: 'purple', received: 'green', cancelled: 'red' };
      return <Badge color={c[r.status] || 'gray'}>{r.status}</Badge>;
    }},
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
                <p className={`text-2xl font-bold mt-1 ${Number(balanceData?.currentBalance ?? balanceData?.balance) > 0 ? 'text-amber-400' : Number(balanceData?.currentBalance ?? balanceData?.balance) < 0 ? 'text-emerald-400' : 'text-slate-800'}`}>
                  {fmtCurrency(balanceData?.currentBalance ?? balanceData?.balance)}
                </p>
              </GlassCard>
              <GlassCard className="text-center">
                <CreditCard size={28} className="text-purple-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500 uppercase tracking-wide">Total Purchases</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{fmtCurrency(balanceData?.totalPurchases)}</p>
              </GlassCard>
              <GlassCard className="text-center">
                <ArrowUpCircle size={28} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500 uppercase tracking-wide">Total Payments</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{fmtCurrency(balanceData?.totalPayments)}</p>
              </GlassCard>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Positive balance = we owe them &nbsp;|&nbsp; Negative balance = advance credit
            </p>
            <div className="text-center">
              <Button size="sm" variant="ghost" onClick={async () => {
                try {
                  const res = await suppliersAPI.reconcile(detailSupplier._id);
                  const d = res.data || res;
                  if (d.match) {
                    toast.success('Balance is accurate — no drift detected');
                  } else {
                    toast.success(`Balance corrected: ₹${d.stored} → ₹${d.computed} (drift: ₹${d.diff})`);
                    // refresh balance display
                    try { const r = await suppliersAPI.getBalance(detailSupplier._id); setBalanceData(r.data || r); } catch {}
                  }
                } catch (err) { toast.error(err.message || 'Reconciliation failed'); }
              }}><RefreshCw size={14} /> Reconcile Balance</Button>
            </div>
          </div>
        );

      case 'payments':
        return (
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard size={20} className="text-emerald-400" />
              <h4 className="text-slate-800 font-medium">Record Payment</h4>
            </div>
            <Input label="Amount" type="number" min="0" step="0.01" value={payForm.amount}
              onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            <Select label="Payment Method" value={payForm.paymentMethod}
              onChange={(e) => setPayForm((p) => ({ ...p, paymentMethod: e.target.value }))} options={PAYMENT_METHODS} />
            <Input label="Reference" value={payForm.reference}
              onChange={(e) => setPayForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Receipt / txn number" />
            <Textarea label="Notes" value={payForm.notes}
              onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
            <Button onClick={handlePayment} loading={actionSaving} className="w-full">
              <CreditCard size={16} /> Submit Payment
            </Button>
          </div>
        );

      case 'adjust':
        return (
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpCircle size={20} className="text-amber-400" />
              <h4 className="text-slate-800 font-medium">Balance Adjustment</h4>
            </div>
            <Select label="Adjustment Type" value={adjustForm.type}
              onChange={(e) => setAdjustForm((p) => ({ ...p, type: e.target.value }))} options={ADJUST_TYPES} />
            <Input label="Amount" type="number" min="0" step="0.01" value={adjustForm.amount}
              onChange={(e) => setAdjustForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            <Textarea label="Reason" value={adjustForm.reason}
              onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))} placeholder="Reason for adjustment (required)" />
            <Button onClick={handleAdjust} loading={actionSaving} className="w-full">
              <ArrowUpCircle size={16} /> Submit Adjustment
            </Button>
          </div>
        );

      case 'purchase-orders':
        return <DataTable columns={poColumns} data={detailData} loading={detailLoading} emptyMessage="No purchase orders found" />;

      case 'statement':
        return <DataTable columns={statementColumns} data={detailData} loading={detailLoading} emptyMessage="No statement entries" />;

      default:
        return null;
    }
  };

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        subtitle="Manage suppliers, payments & ledger"
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Supplier</Button>}
      />

      <GlassCard>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search suppliers..." className="flex-1 max-w-sm" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} onRowClick={openDetail} emptyMessage="No suppliers found" />
      </GlassCard>

      {/* ───── Create / Edit Modal ───── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Supplier' : 'Create Supplier'}
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
              <Input label="Name" value={form.name} onChange={set('name')} placeholder="Supplier name" />
              <Input label="Contact Person" value={form.contactPerson} onChange={set('contactPerson')} placeholder="Contact person" />
              <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="email@example.com" />
              <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="+1 234 567 890" />
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
              <Input label="Payment Terms" value={form.paymentTerms} onChange={set('paymentTerms')} placeholder="e.g. Net 30" />
              <Input label="Tax ID" value={form.taxId} onChange={set('taxId')} placeholder="Tax ID / GST" />
              {!editing && (
                <Input label="Opening Balance" type="number" step="0.01" value={form.openingBalance} onChange={set('openingBalance')} placeholder="0.00" />
              )}
            </div>
          </div>

          {/* Notes */}
          <Textarea label="Notes" value={form.notes} onChange={set('notes')} placeholder="Internal notes about this supplier" />
        </div>
      </Modal>

      {/* ───── Detail Modal ───── */}
      <Modal
        open={!!detailSupplier}
        onClose={closeDetail}
        title={detailSupplier?.name || 'Supplier Details'}
        size="xl"
      >
        {detailSupplier && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-violet-100">
              <div className="flex items-center gap-2">
                <Truck size={24} className="text-violet-600" />
                <div>
                  <p className="text-slate-800 font-medium">{detailSupplier.name}</p>
                  <p className="text-xs text-slate-500">{detailSupplier.contactPerson || detailSupplier.email || '-'}</p>
                </div>
              </div>
              <Badge color={detailSupplier.isActive !== false ? 'green' : 'red'}>{detailSupplier.isActive !== false ? 'Active' : 'Inactive'}</Badge>
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-500">Balance</p>
                <p className={`text-lg font-bold ${Number(detailSupplier.currentBalance) > 0 ? 'text-amber-400' : Number(detailSupplier.currentBalance) < 0 ? 'text-emerald-400' : 'text-slate-800'}`}>
                  {fmtCurrency(detailSupplier.currentBalance)}
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
        title="Delete Supplier"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
