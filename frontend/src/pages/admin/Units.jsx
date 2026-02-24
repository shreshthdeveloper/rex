import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, DataTable, ConfirmDialog, GlassCard, SearchInput, Loader } from '../../components/ui';
import { unitsAPI } from '../../api';
import { Ruler, Plus, Edit, Trash2 } from 'lucide-react';

const emptyForm = { name: '', shortName: '' };

export default function Units() {
  const toast = useToast();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const fetchUnits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await unitsAPI.list();
      setUnits(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load units');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name || '', shortName: u.shortName || '' }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.shortName.trim()) return toast.error('Short name is required');
    try {
      setSaving(true);
      if (editing) {
        await unitsAPI.update(editing._id, form);
        toast.success('Unit updated');
      } else {
        await unitsAPI.create(form);
        toast.success('Unit created');
      }
      closeModal();
      fetchUnits();
    } catch (err) {
      toast.error(err.message || 'Failed to save unit');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await unitsAPI.delete(deleteTarget._id);
      toast.success('Unit deleted');
      setDeleteTarget(null);
      fetchUnits();
    } catch (err) {
      toast.error(err.message || 'Failed to delete unit');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = units.filter((u) => {
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.shortName?.toLowerCase().includes(q);
  });

  const columns = [
    { key: 'name', label: 'Name', render: (r) => (
      <div className="flex items-center gap-2">
        <Ruler size={14} className="text-violet-600" />
        <span className="text-slate-800 font-medium">{r.name}</span>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
    { key: 'shortName', label: 'Short Name', render: (r) => <span className="text-slate-600 font-mono text-xs">{r.shortName}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Units"
        subtitle="Manage measurement units"
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Unit</Button>}
      />

      <GlassCard>
        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search units..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No units found" />
      </GlassCard>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Unit' : 'Create Unit'}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={set('name')} placeholder="e.g. Kilogram" />
          <Input label="Short Name" value={form.shortName} onChange={set('shortName')} placeholder="e.g. kg" />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Unit"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
