import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader } from '../../components/ui';
import { warehousesAPI } from '../../api';
import { Warehouse as WarehouseIcon, Plus, Edit, Trash2, Eye, Package, Layers } from 'lucide-react';

const emptyForm = {
  name: '', code: '', location: '', contactPerson: '', phone: '',
  isActive: true,
};

export default function Warehouses() {
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Stock & movements modals
  const [stockModal, setStockModal] = useState(false);
  const [stockData, setStockData] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockWarehouse, setStockWarehouse] = useState(null);
  const [movementsModal, setMovementsModal] = useState(false);
  const [movementsData, setMovementsData] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsWarehouse, setMovementsWarehouse] = useState(null);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setChecked = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.checked }));

  const fetchWarehouses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await warehousesAPI.list();
      setWarehouses(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (w) => {
    setEditing(w);
    setForm({
      name: w.name || '',
      code: w.code || '',
      location: w.location || '',
      contactPerson: w.contactPerson || '',
      phone: w.phone || '',
      isActive: w.isActive !== false,
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.code.trim()) return toast.error('Code is required');
    try {
      setSaving(true);
      if (editing) {
        await warehousesAPI.update(editing._id, form);
        toast.success('Warehouse updated');
      } else {
        await warehousesAPI.create(form);
        toast.success('Warehouse created');
      }
      closeModal();
      fetchWarehouses();
    } catch (err) {
      toast.error(err.message || 'Failed to save warehouse');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await warehousesAPI.delete(deleteTarget._id);
      toast.success('Warehouse deleted');
      setDeleteTarget(null);
      fetchWarehouses();
    } catch (err) {
      toast.error(err.message || 'Failed to delete warehouse');
    } finally {
      setDeleting(false);
    }
  };

  const viewStock = async (w) => {
    setStockWarehouse(w);
    setStockModal(true);
    setStockLoading(true);
    try {
      const res = await warehousesAPI.getStock(w._id);
      setStockData(res.data?.stocks || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load stock');
    } finally {
      setStockLoading(false);
    }
  };

  const viewMovements = async (w) => {
    setMovementsWarehouse(w);
    setMovementsModal(true);
    setMovementsLoading(true);
    try {
      const res = await warehousesAPI.getMovements(w._id);
      setMovementsData(res.data?.movements || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load movements');
    } finally {
      setMovementsLoading(false);
    }
  };

  const filtered = warehouses.filter((w) => {
    const q = search.toLowerCase();
    return w.name?.toLowerCase().includes(q) || w.code?.toLowerCase().includes(q) || w.address?.city?.toLowerCase().includes(q);
  });

  const columns = [
    { key: 'name', label: 'Name', render: (r) => (
      <div className="flex items-center gap-2">
        <WarehouseIcon size={14} className="text-violet-600" />
        <span className="text-slate-800 font-medium">{r.name}</span>
        {r.isDefault && <Badge color="amber">Default</Badge>}
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" title="View Stock" onClick={(e) => { e.stopPropagation(); viewStock(r); }}>
          <Package size={16} className="text-emerald-400" />
        </Button>
        <Button variant="icon" title="View Movements" onClick={(e) => { e.stopPropagation(); viewMovements(r); }}>
          <Layers size={16} className="text-purple-400" />
        </Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
    { key: 'code', label: 'Code', render: (r) => <span className="text-slate-600 font-mono text-xs">{r.code}</span> },
    { key: 'address', label: 'Location', render: (r) => {
      return <span className="text-slate-500">{r.location || '—'}</span>;
    }},
    { key: 'isActive', label: 'Status', render: (r) => <Badge color={r.isActive !== false ? 'green' : 'red'}>{r.isActive !== false ? 'Active' : 'Inactive'}</Badge> },
  ];

  const stockColumns = [
    { key: 'product', label: 'Product', render: (r) => <span className="text-slate-800 font-medium">{r.product?.name || r.productName || '—'}</span> },
    { key: 'sku', label: 'SKU', render: (r) => <span className="text-slate-500 font-mono text-xs">{r.product?.sku || r.sku || '—'}</span> },
    { key: 'quantity', label: 'Qty', render: (r) => <span className="text-violet-500 font-semibold">{r.quantity ?? r.stock ?? 0}</span> },
    { key: 'reservedQuantity', label: 'Reserved', render: (r) => <span className="text-amber-400">{r.reservedQuantity ?? 0}</span> },
  ];

  const movementColumns = [
    { key: 'product', label: 'Product', render: (r) => <span className="text-slate-800">{r.product?.name || r.productName || '—'}</span> },
    { key: 'type', label: 'Type', render: (r) => {
      const colors = { in: 'green', out: 'red', transfer: 'purple', adjustment: 'amber' };
      return <Badge color={colors[r.type] || 'gray'}>{r.type || '—'}</Badge>;
    }},
    { key: 'quantity', label: 'Qty', render: (r) => <span className="font-medium">{r.quantity ?? 0}</span> },
    { key: 'reason', label: 'Reason', render: (r) => <span className="text-slate-500">{r.reason || r.reference || '—'}</span> },
    { key: 'createdAt', label: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        subtitle="Manage storage locations"
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Warehouse</Button>}
      />

      <GlassCard>
        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search warehouses..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No warehouses found" />
      </GlassCard>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Warehouse' : 'Create Warehouse'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={set('name')} placeholder="Warehouse name" />
            <Input label="Code" value={form.code} onChange={set('code')} placeholder="e.g. WH-001" />
          </div>
          <Input label="Location" value={form.location} onChange={set('location')} placeholder="Location / address" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Person" value={form.contactPerson} onChange={set('contactPerson')} placeholder="Contact person name" />
            <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="Phone number" />
          </div>
          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={setChecked('isActive')} className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-transparent" />
              <span className="text-sm text-slate-600">Active</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* Stock Modal */}
      <Modal
        open={stockModal}
        onClose={() => { setStockModal(false); setStockData([]); }}
        title={`Stock — ${stockWarehouse?.name || ''}`}
        size="lg"
      >
        <DataTable columns={stockColumns} data={stockData} loading={stockLoading} emptyMessage="No stock data" />
      </Modal>

      {/* Movements Modal */}
      <Modal
        open={movementsModal}
        onClose={() => { setMovementsModal(false); setMovementsData([]); }}
        title={`Movements — ${movementsWarehouse?.name || ''}`}
        size="xl"
      >
        <DataTable columns={movementColumns} data={movementsData} loading={movementsLoading} emptyMessage="No movements found" />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Warehouse"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
