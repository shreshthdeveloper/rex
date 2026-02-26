import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Textarea } from '../../components/ui';
import { brandsAPI } from '../../api';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';

const emptyForm = { name: '', description: '', image: '', isActive: true, hideFromGuests: false, hideFromCustomers: false };

export default function Brands() {
  const toast = useToast();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const fetchBrands = useCallback(async () => {
    try {
      setLoading(true);
      const res = await brandsAPI.list();
      setBrands(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load brands');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (b) => {
    setEditing(b);
    setForm({ name: b.name || '', description: b.description || '', image: b.image || '', isActive: b.isActive !== false, hideFromGuests: b.hideFromGuests || false, hideFromCustomers: b.hideFromCustomers || false });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Brand name is required');
    try {
      setSaving(true);
      if (editing) {
        await brandsAPI.update(editing._id, form);
        toast.success('Brand updated');
      } else {
        await brandsAPI.create(form);
        toast.success('Brand created');
      }
      closeModal();
      fetchBrands();
    } catch (err) {
      toast.error(err.message || 'Failed to save brand');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await brandsAPI.delete(deleteTarget._id);
      toast.success('Brand deleted');
      setDeleteTarget(null);
      fetchBrands();
    } catch (err) {
      toast.error(err.message || 'Failed to delete brand');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = brands.filter((b) => {
    const q = search.toLowerCase();
    return b.name?.toLowerCase().includes(q);
  });

  const columns = [
    { key: 'name', label: 'Brand', render: (r) => (
      <div className="flex items-center gap-2">
        {r.image ? (
          <img src={r.image} alt={r.name} className="w-8 h-8 rounded object-cover border border-violet-100" />
        ) : (
          <Tag size={14} className="text-violet-600" />
        )}
        <span className="text-slate-800 font-medium">{r.name}</span>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" onClick={() => openEdit(r)}><Edit size={16} /></Button>
        <Button variant="icon" onClick={() => setDeleteTarget(r)}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
    { key: 'description', label: 'Description', render: (r) => (
      <span className="text-slate-500 text-sm">{r.description || '—'}</span>
    )},
    { key: 'isActive', label: 'Status', render: (r) => (
      <Badge color={r.isActive !== false ? 'green' : 'red'}>{r.isActive !== false ? 'Active' : 'Inactive'}</Badge>
    )},
    { key: 'hideFromGuests', label: 'Hide Guests', render: (r) => (
      <Badge color={r.hideFromGuests ? 'red' : 'green'}>{r.hideFromGuests ? 'ON' : 'OFF'}</Badge>
    )},
    { key: 'hideFromCustomers', label: 'Hide Customers', render: (r) => (
      <Badge color={r.hideFromCustomers ? 'red' : 'green'}>{r.hideFromCustomers ? 'ON' : 'OFF'}</Badge>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brands"
        subtitle="Manage product brands"
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Brand</Button>}
      />

      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search brands..." className="max-w-xs" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No brands found" />
      </GlassCard>

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Brand' : 'Create Brand'} size="md"
        footer={<><Button variant="ghost" onClick={closeModal}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={set('name')} placeholder="Brand name" />
          <Textarea label="Description" value={form.description} onChange={set('description')} placeholder="Brand description" rows={2} />
          <Input label="Image URL" value={form.image} onChange={set('image')} placeholder="https://..." />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-transparent" />
            <span className="text-sm text-slate-600">Active</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.hideFromGuests} onChange={(e) => setForm((p) => ({ ...p, hideFromGuests: e.target.checked }))} className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-transparent" />
            <span className="text-sm text-slate-600">Hide from Guests</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.hideFromCustomers} onChange={(e) => setForm((p) => ({ ...p, hideFromCustomers: e.target.checked }))} className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-transparent" />
            <span className="text-sm text-slate-600">Hide from Customers</span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Brand"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        loading={deleting}
      />
    </div>
  );
}
