import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader, TabList, Textarea, StatCard, Pagination, CsvImport } from '../../components/ui';
import { couponsAPI } from '../../api';
import { Tag, Plus, Edit, Trash2, CheckCircle, Percent } from 'lucide-react';

const emptyForm = {
  code: '', description: '', discountType: 'percentage', discountValue: '',
  minimumOrderAmount: '', maximumDiscount: '', validFrom: '', validTo: '',
  usageLimit: '', isActive: true, applicableProducts: [], applicableCategories: [],
};

export default function Coupons() {
  const toast = useToast();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [validateCode, setValidateCode] = useState('');
  const [validateAmount, setValidateAmount] = useState('');
  const [validateResult, setValidateResult] = useState(null);
  const [validating, setValidating] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const res = await couponsAPI.list();
      setCoupons(res.data?.coupons || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      code: c.code || '', description: c.description || '',
      discountType: c.discountType || 'percentage', discountValue: c.discountValue || '',
      minimumOrderAmount: c.minimumOrderAmount || '', maximumDiscount: c.maximumDiscount || '',
      validFrom: c.validFrom ? c.validFrom.slice(0, 10) : '', validTo: c.validTo ? c.validTo.slice(0, 10) : '',
      usageLimit: c.usageLimit || '', isActive: c.isActive ?? true,
      applicableProducts: c.applicableProducts || [], applicableCategories: c.applicableCategories || [],
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.code.trim()) return toast.error('Coupon code is required');
    if (!form.discountValue) return toast.error('Discount value is required');
    try {
      setSaving(true);
      const payload = { ...form, discountValue: Number(form.discountValue), minimumOrderAmount: Number(form.minimumOrderAmount) || 0, maximumDiscount: Number(form.maximumDiscount) || 0, usageLimit: Number(form.usageLimit) || 0 };
      if (editing) {
        await couponsAPI.update(editing._id, payload);
        toast.success('Coupon updated');
      } else {
        await couponsAPI.create(payload);
        toast.success('Coupon created');
      }
      closeModal();
      fetchCoupons();
    } catch (err) {
      toast.error(err.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await couponsAPI.delete(deleteTarget._id);
      toast.success('Coupon deleted');
      setDeleteTarget(null);
      fetchCoupons();
    } catch (err) {
      toast.error(err.message || 'Failed to delete coupon');
    } finally {
      setDeleting(false);
    }
  };

  const handleValidate = async () => {
    if (!validateCode.trim()) return toast.error('Enter a coupon code');
    if (!validateAmount) return toast.error('Enter an order amount');
    try {
      setValidating(true);
      const res = await couponsAPI.validate({ code: validateCode, orderAmount: Number(validateAmount) });
      setValidateResult(res.data || res);
      toast.success('Coupon validated');
    } catch (err) {
      setValidateResult({ valid: false, message: err.message || 'Invalid coupon' });
      toast.error(err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const filtered = coupons.filter((c) => {
    const q = search.toLowerCase();
    return c.code?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q);
  });

  const columns = [
    { key: 'code', label: 'Code', render: (r) => (
      <div className="flex items-center gap-2">
        <Tag size={14} className="text-violet-600" />
        <span className="text-slate-800 font-medium font-mono">{r.code}</span>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
    { key: 'discount', label: 'Discount', render: (r) => (
      <span className="text-slate-600">
        {r.discountType === 'percentage' ? `${r.discountValue}%` : `₹${r.discountValue}`}
      </span>
    )},
    { key: 'minOrder', label: 'Min Order', render: (r) => <span className="text-slate-600">₹{r.minimumOrderAmount || 0}</span> },
    { key: 'usage', label: 'Usage', render: (r) => <span className="text-slate-500">{r.usedCount || 0} / {r.usageLimit || '∞'}</span> },
    { key: 'validity', label: 'Valid Period', render: (r) => (
      <span className="text-slate-500 text-xs">
        {r.validFrom ? new Date(r.validFrom).toLocaleDateString() : '—'} → {r.validTo ? new Date(r.validTo).toLocaleDateString() : '—'}
      </span>
    )},
    { key: 'status', label: 'Status', render: (r) => (
      <Badge color={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Coupons" subtitle="Manage discount coupons" actions={
        <div className="flex items-center gap-2">
          <CsvImport
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'discount_type', label: 'Discount Type (percentage/fixed)' },
              { key: 'discount_value', label: 'Discount Value' },
              { key: 'min_order', label: 'Min Order Amount' },
              { key: 'max_discount', label: 'Max Discount' },
              { key: 'usage_limit', label: 'Usage Limit' },
              { key: 'valid_from', label: 'Valid From (YYYY-MM-DD)' },
              { key: 'valid_to', label: 'Valid To (YYYY-MM-DD)' },
              { key: 'description', label: 'Description' },
            ]}
            sampleRows={[{ code: 'SAVE10', discount_type: 'percentage', discount_value: '10', min_order: '500', max_discount: '200', usage_limit: '100', valid_from: '2025-01-01', valid_to: '2025-12-31', description: '10% off' }]}
            onImport={async (rows) => {
              let ok = 0, fail = 0;
              for (const row of rows) {
                if (!row.code?.trim() || !row.discount_value) { fail++; continue; }
                try {
                  await couponsAPI.create({
                    code: row.code.trim().toUpperCase(),
                    discountType: ['percentage', 'fixed'].includes(row.discount_type) ? row.discount_type : 'percentage',
                    discountValue: Number(row.discount_value) || 0,
                    minimumOrderAmount: Number(row.min_order) || 0,
                    maximumDiscount: Number(row.max_discount) || 0,
                    usageLimit: Number(row.usage_limit) || 0,
                    validFrom: row.valid_from || null,
                    validTo: row.valid_to || null,
                    description: row.description || '',
                    isActive: true,
                  });
                  ok++;
                } catch { fail++; }
              }
              toast.success(`Imported ${ok} coupon${ok !== 1 ? 's' : ''}${fail ? `, ${fail} skipped` : ''}`);
              fetchCoupons();
            }}
            label="Import CSV"
          />
          <Button onClick={openCreate}><Plus size={16} /> Add Coupon</Button>
        </div>
      } />

      <GlassCard>
        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search coupons..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No coupons found" />
      </GlassCard>

      {/* Validate Coupon Tester */}
      <GlassCard>
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle size={18} className="text-violet-600" /> Coupon Validator</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <Input label="Coupon Code" value={validateCode} onChange={(e) => setValidateCode(e.target.value)} placeholder="SUMMER20" />
          <Input label="Order Amount" type="number" value={validateAmount} onChange={(e) => setValidateAmount(e.target.value)} placeholder="1000" />
          <Button onClick={handleValidate} loading={validating}><Percent size={16} /> Validate</Button>
        </div>
        {validateResult && (
          <div className={`mt-4 p-4 rounded-xl border ${validateResult.valid !== false ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
            <p className={`text-sm font-medium ${validateResult.valid !== false ? 'text-emerald-400' : 'text-red-400'}`}>
              {validateResult.valid !== false ? '✓ Coupon is valid' : '✗ Invalid coupon'}
            </p>
            {validateResult.discount != null && <p className="text-slate-600 text-sm mt-1">Discount: ₹{validateResult.discount}</p>}
            {validateResult.message && <p className="text-slate-500 text-xs mt-1">{validateResult.message}</p>}
          </div>
        )}
      </GlassCard>

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Coupon' : 'Create Coupon'} size="lg" footer={
        <><Button variant="ghost" onClick={closeModal}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button></>
      }>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Coupon Code" value={form.code} onChange={set('code')} placeholder="SUMMER20" />
          <Select label="Discount Type" value={form.discountType} onChange={set('discountType')} options={[{ value: 'percentage', label: 'Percentage' }, { value: 'fixed', label: 'Fixed Amount' }]} />
          <Input label="Discount Value" type="number" value={form.discountValue} onChange={set('discountValue')} placeholder="10" />
          <Input label="Minimum Order Amount" type="number" value={form.minimumOrderAmount} onChange={set('minimumOrderAmount')} placeholder="500" />
          {form.discountType === 'percentage' && (
            <Input label="Maximum Discount" type="number" value={form.maximumDiscount} onChange={set('maximumDiscount')} placeholder="200" />
          )}
          <Input label="Usage Limit" type="number" value={form.usageLimit} onChange={set('usageLimit')} placeholder="100" />
          <Input label="Valid From" type="date" value={form.validFrom} onChange={set('validFrom')} />
          <Input label="Valid To" type="date" value={form.validTo} onChange={set('validTo')} />
          <div className="col-span-2">
            <Textarea label="Description" value={form.description} onChange={set('description')} placeholder="Coupon description..." />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="coupon-active" checked={form.isActive} onChange={set('isActive')} className="accent-cyan-400" />
            <label htmlFor="coupon-active" className="text-sm text-slate-600">Active</label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Coupon" message={`Delete coupon "${deleteTarget?.code}"? This cannot be undone.`} loading={deleting} />
    </div>
  );
}
