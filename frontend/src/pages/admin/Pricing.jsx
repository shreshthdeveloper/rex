import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader, TabList, Textarea, StatCard, Pagination } from '../../components/ui';
import { pricingAPI, productsAPI, customersAPI } from '../../api';
import { DollarSign, Plus, Edit, Trash2, Calculator } from 'lucide-react';

const emptyForm = { product: '', tier: 'retail', price: '', minQuantity: '1' };
const tierOptions = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'vip', label: 'VIP' },
];
const tierColors = { retail: 'cyan', wholesale: 'purple', vip: 'amber' };

export default function Pricing() {
  const toast = useToast();
  const [tierPrices, setTierPrices] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Price resolver state
  const [resolveForm, setResolveForm] = useState({ productId: '', warehouseId: '', customerId: '', quantity: '1' });
  const [resolveResult, setResolveResult] = useState(null);
  const [resolving, setResolving] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setR = (k) => (e) => setResolveForm((p) => ({ ...p, [k]: e.target.value }));

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tpRes, pRes, cRes] = await Promise.all([
        pricingAPI.listTierPrices(),
        productsAPI.list(),
        customersAPI.list(),
      ]);
      setTierPrices(tpRes.data?.tierPrices || []);
      setProducts(pRes.data?.products || []);
      setCustomers(cRes.data?.customers || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const productOpts = products.map((p) => ({ value: p._id, label: p.name }));
  const customerOpts = [{ value: '', label: 'None / Walk-in' }, ...customers.map((c) => ({ value: c._id, label: c.name }))];
  const productName = (id) => products.find((p) => p._id === id)?.name || id;

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (tp) => {
    setEditing(tp);
    setForm({
      product: tp.product?._id || tp.product || '',
      tier: tp.tier || 'retail',
      price: tp.price || '',
      minQuantity: tp.minQuantity || '1',
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.product) return toast.error('Product is required');
    if (!form.price) return toast.error('Price is required');
    try {
      setSaving(true);
      const payload = { ...form, price: Number(form.price), minQuantity: Number(form.minQuantity) || 1 };
      if (editing) {
        await pricingAPI.updateTierPrice(editing._id, payload);
        toast.success('Tier price updated');
      } else {
        await pricingAPI.createTierPrice(payload);
        toast.success('Tier price created');
      }
      closeModal();
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save tier price');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await pricingAPI.deleteTierPrice(deleteTarget._id);
      toast.success('Tier price deleted');
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete tier price');
    } finally {
      setDeleting(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveForm.productId) return toast.error('Select a product');
    try {
      setResolving(true);
      const res = await pricingAPI.resolve({ ...resolveForm, quantity: Number(resolveForm.quantity) || 1 });
      setResolveResult(res.data || res);
      toast.success('Price resolved');
    } catch (err) {
      setResolveResult(null);
      toast.error(err.message || 'Failed to resolve price');
    } finally {
      setResolving(false);
    }
  };

  const filtered = tierPrices.filter((tp) => {
    const q = search.toLowerCase();
    const pName = (tp.product?.name || productName(tp.product) || '').toLowerCase();
    return pName.includes(q) || tp.tier?.toLowerCase().includes(q);
  });

  const columns = [
    { key: 'product', label: 'Product', render: (r) => (
      <div className="flex items-center gap-2">
        <DollarSign size={14} className="text-violet-600" />
        <span className="text-slate-800 font-medium">{r.product?.name || productName(r.product)}</span>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
    { key: 'tier', label: 'Tier', render: (r) => <Badge color={tierColors[r.tier] || 'cyan'}>{r.tier}</Badge> },
    { key: 'price', label: 'Price', render: (r) => <span className="text-slate-600 font-mono">₹{Number(r.price).toFixed(2)}</span> },
    { key: 'minQuantity', label: 'Min Qty', render: (r) => <span className="text-slate-500">{r.minQuantity || 1}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Pricing" subtitle="Manage tier prices & resolve pricing" actions={<Button onClick={openCreate}><Plus size={16} /> Add Tier Price</Button>} />

      <GlassCard>
        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by product or tier..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No tier prices found" />
      </GlassCard>

      {/* Price Resolver */}
      <GlassCard>
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2"><Calculator size={18} className="text-violet-600" /> Price Resolver</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <Select label="Product" value={resolveForm.productId} onChange={setR('productId')} options={productOpts} placeholder="Select product" />
          <Input label="Warehouse ID" value={resolveForm.warehouseId} onChange={setR('warehouseId')} placeholder="Optional" />
          <Select label="Customer" value={resolveForm.customerId} onChange={setR('customerId')} options={customerOpts} placeholder="Optional" />
          <Input label="Quantity" type="number" value={resolveForm.quantity} onChange={setR('quantity')} placeholder="1" />
        </div>
        <div className="mt-3">
          <Button onClick={handleResolve} loading={resolving}><Calculator size={16} /> Resolve Price</Button>
        </div>
        {resolveResult && (
          <div className="mt-4 p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {resolveResult.basePrice != null && (
                <div><p className="text-xs text-slate-500 uppercase">Base Price</p><p className="text-lg font-bold text-slate-800">₹{Number(resolveResult.basePrice).toFixed(2)}</p></div>
              )}
              {resolveResult.tierPrice != null && (
                <div><p className="text-xs text-slate-500 uppercase">Tier Price</p><p className="text-lg font-bold text-violet-600">₹{Number(resolveResult.tierPrice).toFixed(2)}</p></div>
              )}
              {resolveResult.finalPrice != null && (
                <div><p className="text-xs text-slate-500 uppercase">Final Price</p><p className="text-lg font-bold text-emerald-400">₹{Number(resolveResult.finalPrice).toFixed(2)}</p></div>
              )}
              {resolveResult.tier && (
                <div><p className="text-xs text-slate-500 uppercase">Applied Tier</p><Badge color={tierColors[resolveResult.tier] || 'cyan'}>{resolveResult.tier}</Badge></div>
              )}
            </div>
            {resolveResult.breakdown && (
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                {Object.entries(resolveResult.breakdown).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span>{k}</span><span className="text-slate-600">₹{Number(v).toFixed(2)}</span></div>
                ))}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Tier Price' : 'Create Tier Price'} footer={
        <><Button variant="ghost" onClick={closeModal}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <Select label="Product" value={form.product} onChange={set('product')} options={productOpts} placeholder="Select product" />
          <Select label="Tier" value={form.tier} onChange={set('tier')} options={tierOptions} />
          <Input label="Price" type="number" value={form.price} onChange={set('price')} placeholder="100" />
          <Input label="Min Quantity" type="number" value={form.minQuantity} onChange={set('minQuantity')} placeholder="1" />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Tier Price" message={`Delete this tier price? This cannot be undone.`} loading={deleting} />
    </div>
  );
}
