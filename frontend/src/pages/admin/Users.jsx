import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader } from '../../components/ui';
import { usersAPI } from '../../api';
import { Users as UsersIcon, Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'warehouse_staff', label: 'Warehouse Staff' },
  { value: 'accountant', label: 'Accountant' },
];

const ROLE_COLORS = { admin: 'cyan', manager: 'purple', cashier: 'amber', warehouse_staff: 'blue', accountant: 'green' };

const emptyForm = { name: '', email: '', password: '', role: 'cashier' };

export default function Users() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await usersAPI.list();
      setUsers(res.data?.users || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name and email are required');
    if (!editing && !form.password.trim()) return toast.error('Password is required for new users');
    try {
      setSaving(true);
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;
      if (editing) {
        await usersAPI.update(editing._id, payload);
        toast.success('User updated');
      } else {
        await usersAPI.create(payload);
        toast.success('User created');
      }
      closeModal();
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await usersAPI.delete(deleteTarget._id);
      toast.success('User deleted');
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (u) => {
    try {
      await usersAPI.toggleActive(u._id);
      toast.success(`User ${u.isActive ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to toggle user');
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q);
  });

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <span className="text-slate-800 font-medium">{r.name}</span> },
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" title="Toggle active" onClick={(e) => { e.stopPropagation(); handleToggle(r); }}>
          {r.isActive ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} className="text-gray-500" />}
        </Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (r) => <Badge color={ROLE_COLORS[r.role] || 'gray'}>{r.role}</Badge> },
    { key: 'isActive', label: 'Status', render: (r) => <Badge color={r.isActive ? 'green' : 'red'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Manage admin panel users"
        actions={<Button onClick={openCreate}><Plus size={16} /> Add User</Button>}
      />

      <GlassCard>
        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search users..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No users found" />
      </GlassCard>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit User' : 'Create User'}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={set('name')} placeholder="Full name" />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="user@example.com" />
          <Input label={editing ? 'New Password (leave blank to keep)' : 'Password'} type="password" value={form.password} onChange={set('password')} placeholder="••••••••" />
          <Select label="Role" value={form.role} onChange={set('role')} options={ROLES} />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
