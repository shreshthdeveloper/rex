import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader, Textarea, CsvImport } from '../../components/ui';
import { categoriesAPI } from '../../api';
import { FolderTree, Plus, Edit, Trash2, GripVertical, ArrowUpDown, Image } from 'lucide-react';

const emptyForm = { name: '', slug: '', description: '', parentCategory: '', image: '', sortOrder: 0, isActive: true, hideFromCustomers: false, hideFromGuests: false };

export default function Categories() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState([]);
  const [reordering, setReordering] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setChecked = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.checked }));

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await categoriesAPI.list();
      setCategories(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || '',
      slug: c.slug || '',
      description: c.description || '',
      parentCategory: c.parentCategory?._id || c.parentCategory || '',
      image: c.image || '',
      sortOrder: c.sortOrder || 0,
      isActive: c.isActive !== false,
      hideFromCustomers: !!c.hideFromCustomers,
      hideFromGuests: !!c.hideFromGuests,
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const generateSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleNameChange = (e) => {
    const name = e.target.value;
    setForm((p) => ({ ...p, name, slug: editing ? p.slug : generateSlug(name) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      setSaving(true);
      const payload = { ...form, sortOrder: Number(form.sortOrder) || 0 };
      if (!payload.parentCategory) delete payload.parentCategory;
      if (editing) {
        await categoriesAPI.update(editing._id, payload);
        toast.success('Category updated');
      } else {
        await categoriesAPI.create(payload);
        toast.success('Category created');
      }
      closeModal();
      fetchCategories();
    } catch (err) {
      toast.error(err.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await categoriesAPI.delete(deleteTarget._id);
      toast.success('Category deleted');
      setDeleteTarget(null);
      fetchCategories();
    } catch (err) {
      toast.error(err.message || 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const openReorder = () => {
    setReorderList(categories.map((c, i) => ({ id: c._id, name: c.name, sortOrder: c.sortOrder ?? i })));
    setReorderMode(true);
  };

  const moveItem = (index, direction) => {
    setReorderList((prev) => {
      const arr = [...prev];
      const target = index + direction;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr.map((item, i) => ({ ...item, sortOrder: i }));
    });
  };

  const saveReorder = async () => {
    try {
      setReordering(true);
      await categoriesAPI.reorder({ items: reorderList.map((r) => ({ id: r.id, sortOrder: r.sortOrder })) });
      toast.success('Categories reordered');
      setReorderMode(false);
      fetchCategories();
    } catch (err) {
      toast.error(err.message || 'Failed to reorder');
    } finally {
      setReordering(false);
    }
  };

  const parentMap = {};
  categories.forEach((c) => { parentMap[c._id] = c.name; });

  /* ─── CSV Import ─── */
  const CSV_COLUMNS = [
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'image', label: 'Image URL' },
    { key: 'isActive', label: 'Active (true/false)' },
  ];
  const CSV_SAMPLE = [
    { name: 'Electronics', description: 'Electronic products', image: 'https://picsum.photos/seed/elec/400/400', isActive: 'true' },
    { name: 'Clothing', description: 'Apparel items', image: 'https://picsum.photos/seed/cloth/400/400', isActive: 'true' },
  ];
  const handleCsvImport = async (rows) => {
    let ok = 0, fail = 0;
    for (const row of rows) {
      if (!row.name?.trim()) { fail++; continue; }
      try {
        await categoriesAPI.create({
          name: row.name.trim(), description: row.description || '',
          image: row.image || '', isActive: row.isActive?.toLowerCase() !== 'false',
        });
        ok++;
      } catch { fail++; }
    }
    toast.success(`Imported ${ok} categories${fail ? `, ${fail} failed` : ''}`);
    fetchCategories();
  };

  const parentOptions = categories
    .filter((c) => !editing || c._id !== editing._id)
    .map((c) => ({ value: c._id, label: c.name }));

  const filtered = categories.filter((c) => {
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.slug?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q);
  });

  const columns = [
    { key: 'img', label: '', render: (r) => r.image ? (
      <img src={r.image} alt={r.name} className="w-10 h-10 rounded-lg object-cover border border-violet-100 shrink-0"
        onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
    ) : (
      <div className="w-10 h-10 rounded-lg bg-violet-50/50 border border-violet-100 flex items-center justify-center shrink-0">
        <FolderTree size={14} className="text-gray-600" />
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
    { key: 'name', label: 'Name', render: (r) => (
      <div className="flex items-center gap-2">
        {(r.parentCategory?._id || r.parentCategory) && <span className="text-gray-600 text-xs">└</span>}
        <span className="text-slate-800 font-medium">{r.name}</span>
      </div>
    )},
    { key: 'slug', label: 'Slug', render: (r) => <span className="text-slate-500 text-xs font-mono">{r.slug}</span> },
    { key: 'parent', label: 'Parent', render: (r) => {
      const pid = r.parentCategory?._id || r.parentCategory;
      return pid ? <Badge color="purple">{r.parentCategory?.name || parentMap[pid] || 'Parent'}</Badge> : <span className="text-gray-600">—</span>;
    }},
    { key: 'sortOrder', label: 'Order', render: (r) => <span className="text-slate-500">{r.sortOrder ?? '—'}</span> },
    { key: 'hideFromCustomers', label: 'Hide Customers', render: (r) => <Badge color={r.hideFromCustomers ? 'red' : 'green'}>{r.hideFromCustomers ? 'ON' : 'OFF'}</Badge> },
    { key: 'hideFromGuests', label: 'Hide Guests', render: (r) => <Badge color={r.hideFromGuests ? 'red' : 'green'}>{r.hideFromGuests ? 'ON' : 'OFF'}</Badge> },
    { key: 'isActive', label: 'Status', render: (r) => <Badge color={r.isActive !== false ? 'green' : 'red'}>{r.isActive !== false ? 'Active' : 'Inactive'}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        subtitle="Manage product categories"
        actions={
          <div className="flex items-center gap-2">
            <CsvImport columns={CSV_COLUMNS} onImport={handleCsvImport} sampleRows={CSV_SAMPLE} />
            <Button variant="ghost" onClick={openReorder}><ArrowUpDown size={16} /> Reorder</Button>
            <Button onClick={openCreate}><Plus size={16} /> Add Category</Button>
          </div>
        }
      />

      <GlassCard>
        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search categories..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No categories found" />
      </GlassCard>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Category' : 'Create Category'}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={handleNameChange} placeholder="Category name" />
          <Input label="Slug" value={form.slug} onChange={set('slug')} placeholder="auto-generated" />
          <Textarea label="Description" value={form.description} onChange={set('description')} placeholder="Optional description" />
          <Select label="Parent Category" value={form.parentCategory} onChange={set('parentCategory')} options={parentOptions} placeholder="None (root category)" />
          <div className="space-y-2">
            <Input label="Image URL" value={form.image} onChange={set('image')} placeholder="https://picsum.photos/seed/cat/400/400" />
            {form.image && (
              <div className="flex items-center gap-3">
                <img src={form.image} alt="preview" className="w-16 h-16 rounded-lg object-cover border border-violet-100"
                  onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                <span className="text-xs text-gray-500">Image preview</span>
              </div>
            )}
          </div>
          <Input label="Sort Order" type="number" value={form.sortOrder} onChange={set('sortOrder')} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={setChecked('isActive')} className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-transparent" />
            <span className="text-sm text-slate-600">Active</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.hideFromCustomers} onChange={setChecked('hideFromCustomers')} className="w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-400 bg-transparent" />
            <span className="text-sm text-slate-600">Hide from Customers</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.hideFromGuests} onChange={setChecked('hideFromGuests')} className="w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-400 bg-transparent" />
            <span className="text-sm text-slate-600">Hide from Guests</span>
          </label>
        </div>
      </Modal>

      {/* Reorder Modal */}
      <Modal
        open={reorderMode}
        onClose={() => setReorderMode(false)}
        title="Reorder Categories"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReorderMode(false)}>Cancel</Button>
            <Button onClick={saveReorder} loading={reordering}>Save Order</Button>
          </>
        }
      >
        <div className="space-y-1">
          {reorderList.map((item, i) => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-violet-50/50 border border-violet-100">
              <GripVertical size={16} className="text-gray-600" />
              <span className="flex-1 text-sm text-slate-800">{item.name}</span>
              <div className="flex gap-1">
                <Button variant="icon" onClick={() => moveItem(i, -1)} disabled={i === 0}>
                  <ArrowUpDown size={14} className="rotate-180" />
                </Button>
                <Button variant="icon" onClick={() => moveItem(i, 1)} disabled={i === reorderList.length - 1}>
                  <ArrowUpDown size={14} />
                </Button>
              </div>
              <span className="text-xs text-gray-500 w-6 text-right">{item.sortOrder}</span>
            </div>
          ))}
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
