import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, DataTable, ConfirmDialog, GlassCard, SearchInput, Loader } from '../../components/ui';
import { taxSlabsAPI } from '../../api';
import { Receipt, Plus, Edit, Trash2 } from 'lucide-react';

const emptyForm = { name: '', rate: '' };

export default function TaxSlabs() {
  const toast = useToast();
  const [taxSlabs, setTaxSlabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const fetchTaxSlabs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await taxSlabsAPI.list();
      setTaxSlabs(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load tax slabs');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchTaxSlabs(); }, [fetchTaxSlabs]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (t) => { setEditing(t); setForm({ name: t.name || '', rate: t.rate?.toString() || '' }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (form.rate === '' || isNaN(Number(form.rate))) return toast.error('Valid rate is required');
    try {
      setSaving(true);
      const payload = { name: form.name, rate: Number(form.rate) };
      if (editing) {
        await taxSlabsAPI.update(editing._id, payload);
        toast.success('Tax slab updated');
      } else {
        await taxSlabsAPI.create(payload);
        toast.success('Tax slab created');
      }
      closeModal();
      fetchTaxSlabs();
    } catch (err) {
      toast.error(err.message || 'Failed to save tax slab');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await taxSlabsAPI.delete(deleteTarget._id);
      toast.success('Tax slab deleted');
      setDeleteTarget(null);
      fetchTaxSlabs();
    } catch (err) {
      toast.error(err.message || 'Failed to delete tax slab');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = taxSlabs.filter((t) => {
    const q = search.toLowerCase();
    return t.name?.toLowerCase().includes(q) || t.rate?.toString().includes(q);
  });

  const columns = [
    { key: 'name', label: 'Name', render: (r) => (
      <div className="flex items-center gap-2">
        <Receipt size={14} className="text-violet-600" />
        <span className="text-slate-800 font-medium">{r.name}</span>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
    { key: 'rate', label: 'Rate', render: (r) => <span className="text-violet-500 font-semibold">{r.rate}%</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax Slabs"
        subtitle="Manage tax rates"
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Tax Slab</Button>}
      />

      <GlassCard>
        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search tax slabs..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No tax slabs found" />
      </GlassCard>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Tax Slab' : 'Create Tax Slab'}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={set('name')} placeholder="e.g. GST 18%" />
          <Input label="Rate (%)" type="number" value={form.rate} onChange={set('rate')} placeholder="e.g. 18" min="0" max="100" step="0.01" />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Tax Slab"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
