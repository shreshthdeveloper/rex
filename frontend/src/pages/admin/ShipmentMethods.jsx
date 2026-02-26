import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, DataTable, ConfirmDialog, GlassCard, SearchInput, Badge } from '../../components/ui';
import { shipmentMethodsAPI } from '../../api';
import { Truck, Plus, Edit, Trash2 } from 'lucide-react';

const emptyForm = { name: '', description: '', cost: 0, isActive: true, paymentRequired: false };

export default function ShipmentMethods() {
  const toast = useToast();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const fetchMethods = useCallback(async () => {
    try {
      setLoading(true);
      const res = await shipmentMethodsAPI.list();
      setMethods(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load shipment methods');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (m) => {
    setEditing(m);
    setForm({
      name: m.name || '',
      description: m.description || '',
      cost: m.cost || 0,
      isActive: m.isActive !== false,
      paymentRequired: m.paymentRequired || false,
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (form.cost < 0) return toast.error('Cost cannot be negative');
    
    try {
      setSaving(true);
      if (editing) {
        await shipmentMethodsAPI.update(editing._id, form);
        toast.success('Shipment method updated');
      } else {
        await shipmentMethodsAPI.create(form);
        toast.success('Shipment method created');
      }
      closeModal();
      fetchMethods();
    } catch (err) {
      toast.error(err.message || 'Failed to save shipment method');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await shipmentMethodsAPI.delete(deleteTarget._id);
      toast.success('Shipment method deleted');
      setDeleteTarget(null);
      fetchMethods();
    } catch (err) {
      toast.error(err.message || 'Failed to delete shipment method');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = methods.filter((m) => {
    const q = search.toLowerCase();
    return m.name?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q);
  });

  const columns = [
    { key: 'name', label: 'Name', render: (r) => (
      <div className="flex items-center gap-2">
        <Truck size={14} className="text-violet-600" />
        <span className="text-slate-800 font-medium">{r.name}</span>
      </div>
    )},
    { key: 'description', label: 'Description', render: (r) => (
      <span className="text-slate-600 text-sm">{r.description || '—'}</span>
    )},
    { key: 'cost', label: 'Cost', render: (r) => (
      <span className="text-slate-800 font-medium">₹{r.cost?.toFixed(2) || '0.00'}</span>
    )},
    { key: 'paymentRequired', label: 'Payment Required', render: (r) => (
      r.paymentRequired ? <Badge color="blue">Yes</Badge> : <Badge color="gray">No</Badge>
    )},
    { key: 'isActive', label: 'Status', render: (r) => (
      r.isActive ? <Badge color="green">Active</Badge> : <Badge color="gray">Inactive</Badge>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipment Methods"
        subtitle="Manage delivery and shipment options"
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Method</Button>}
      />

      <GlassCard>
        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search shipment methods..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No shipment methods found" />
      </GlassCard>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Shipment Method' : 'Create Shipment Method'}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. Standard Delivery"
            required
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 resize-none"
              rows={3}
              value={form.description}
              onChange={set('description')}
              placeholder="Optional description"
            />
          </div>
          <Input
            label="Cost"
            type="number"
            min="0"
            step="0.01"
            value={form.cost}
            onChange={set('cost')}
            placeholder="0.00"
            required
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.paymentRequired} onChange={(e) => setForm((p) => ({ ...p, paymentRequired: e.target.checked }))} className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-transparent" />
            Payment Required
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-transparent" />
            Active
          </label>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Shipment Method"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
