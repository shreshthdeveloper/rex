import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, DataTable, ConfirmDialog, GlassCard, SearchInput, Loader, Textarea } from '../../components/ui';
import { barcodeTypesAPI } from '../../api';
import { Barcode, Plus, Edit, Trash2 } from 'lucide-react';

const emptyForm = { name: '', description: '' };

export default function BarcodeTypes() {
  const toast = useToast();
  const [barcodeTypes, setBarcodeTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const fetchBarcodeTypes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await barcodeTypesAPI.list();
      setBarcodeTypes(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load barcode types');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchBarcodeTypes(); }, [fetchBarcodeTypes]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (b) => { setEditing(b); setForm({ name: b.name || '', description: b.description || '' }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      setSaving(true);
      if (editing) {
        await barcodeTypesAPI.update(editing._id, form);
        toast.success('Barcode type updated');
      } else {
        await barcodeTypesAPI.create(form);
        toast.success('Barcode type created');
      }
      closeModal();
      fetchBarcodeTypes();
    } catch (err) {
      toast.error(err.message || 'Failed to save barcode type');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await barcodeTypesAPI.delete(deleteTarget._id);
      toast.success('Barcode type deleted');
      setDeleteTarget(null);
      fetchBarcodeTypes();
    } catch (err) {
      toast.error(err.message || 'Failed to delete barcode type');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = barcodeTypes.filter((b) => {
    const q = search.toLowerCase();
    return b.name?.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q);
  });

  const columns = [
    { key: 'name', label: 'Name', render: (r) => (
      <div className="flex items-center gap-2">
        <Barcode size={14} className="text-violet-600" />
        <span className="text-slate-800 font-medium">{r.name}</span>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
    { key: 'description', label: 'Description', render: (r) => <span className="text-slate-500">{r.description || '—'}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Barcode Types"
        subtitle="Manage barcode formats"
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Barcode Type</Button>}
      />

      <GlassCard>
        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search barcode types..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No barcode types found" />
      </GlassCard>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Barcode Type' : 'Create Barcode Type'}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={set('name')} placeholder="e.g. EAN-13" />
          <Textarea label="Description" value={form.description} onChange={set('description')} placeholder="Optional description" />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Barcode Type"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
