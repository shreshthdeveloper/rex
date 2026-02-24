import { useState, useEffect, useCallback } from 'react';
import { superadminAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import {
  PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog,
  GlassCard, SearchInput, Loader
} from '../../components/ui';
import { Plus, Users, Trash2, Edit, Eye } from 'lucide-react';

export default function Organizations() {
  const toast = useToast();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const [showAdmins, setShowAdmins] = useState(null);
  const [showDelete, setShowDelete] = useState(null);
  const [form, setForm] = useState({ name: '', plan: 'basic' });
  const [saving, setSaving] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [search, setSearch] = useState('');

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await superadminAPI.listOrgs();
      setOrgs(res.data?.organizations || res.data || []);
    } catch (err) {
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await superadminAPI.createOrg(form);
      toast.success('Organization created');
      setShowCreate(false);
      setForm({ name: '', plan: 'basic' });
      fetchOrgs();
    } catch (err) {
      toast.error(err?.message || 'Failed to create org');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await superadminAPI.updateOrg(showEdit._id, form);
      toast.success('Organization updated');
      setShowEdit(null);
      fetchOrgs();
    } catch (err) {
      toast.error(err?.message || 'Failed to update org');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await superadminAPI.deleteOrg(showDelete._id);
      toast.success('Organization deleted');
      setShowDelete(null);
      fetchOrgs();
    } catch (err) {
      toast.error(err?.message || 'Failed to delete org');
    } finally {
      setSaving(false);
    }
  };

  const openAdmins = async (org) => {
    setShowAdmins(org);
    try {
      const res = await superadminAPI.listOrgAdmins(org._id);
      setAdmins(res.data || []);
    } catch {
      setAdmins([]);
    }
  };

  const handleCreateAdmin = async () => {
    setSaving(true);
    try {
      await superadminAPI.createOrgAdmin(showAdmins._id, adminForm);
      toast.success('Admin user created');
      setAdminForm({ name: '', email: '', password: '', role: 'admin' });
      const res = await superadminAPI.listOrgAdmins(showAdmins._id);
      setAdmins(res.data || []);
    } catch (err) {
      toast.error(err?.message || 'Failed to create admin');
    } finally {
      setSaving(false);
    }
  };

  const filtered = orgs.filter(o =>
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.slug?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'slug', label: 'Slug', render: (r) => <span className="text-violet-600/80 font-mono text-xs">{r.slug}</span> },
    { key: 'plan', label: 'Plan', render: (r) => <Badge color={r.plan === 'enterprise' ? 'purple' : r.plan === 'pro' ? 'cyan' : 'gray'}>{r.plan}</Badge> },
    { key: 'isActive', label: 'Status', render: (r) => <Badge color={r.isActive !== false ? 'green' : 'red'}>{r.isActive !== false ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', label: 'Actions', render: (r) => (
        <div className="flex items-center gap-1">
          <Button variant="icon" onClick={(e) => { e.stopPropagation(); openAdmins(r); }}><Users size={15} /></Button>
          <Button variant="icon" onClick={(e) => { e.stopPropagation(); setShowEdit(r); setForm({ name: r.name, plan: r.plan }); }}><Edit size={15} /></Button>
          <Button variant="icon" onClick={(e) => { e.stopPropagation(); setShowDelete(r); }}><Trash2 size={15} className="text-red-400" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Organizations"
        subtitle="Manage all tenant organizations"
        actions={
          <div className="flex items-center gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search orgs..." />
            <Button variant="primary" onClick={() => { setForm({ name: '', plan: 'basic' }); setShowCreate(true); }}>
              <Plus size={16} /> New Organization
            </Button>
          </div>
        }
      />

      <GlassCard>
        <DataTable columns={columns} data={filtered} loading={loading} />
      </GlassCard>

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Organization"
        footer={<><Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate} loading={saving}>Create</Button></>}
      >
        <div className="space-y-4">
          <Input label="Organization Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select label="Plan" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} options={[
            { value: 'basic', label: 'Basic' }, { value: 'pro', label: 'Pro' }, { value: 'enterprise', label: 'Enterprise' },
          ]} />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!showEdit}
        onClose={() => setShowEdit(null)}
        title="Edit Organization"
        footer={<><Button variant="ghost" onClick={() => setShowEdit(null)}>Cancel</Button><Button onClick={handleUpdate} loading={saving}>Save</Button></>}
      >
        <div className="space-y-4">
          <Input label="Organization Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Plan" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} options={[
            { value: 'basic', label: 'Basic' }, { value: 'pro', label: 'Pro' }, { value: 'enterprise', label: 'Enterprise' },
          ]} />
        </div>
      </Modal>

      {/* Admins Modal */}
      <Modal
        open={!!showAdmins}
        onClose={() => setShowAdmins(null)}
        title={`Admins – ${showAdmins?.name}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Existing admins */}
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a._id} className="flex items-center justify-between p-3 rounded-lg bg-violet-50/50 border border-violet-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">{a.name}</p>
                  <p className="text-xs text-slate-500">{a.email} · {a.role}</p>
                </div>
                <Badge color={a.isActive !== false ? 'green' : 'red'}>{a.isActive !== false ? 'Active' : 'Inactive'}</Badge>
              </div>
            ))}
            {admins.length === 0 && <p className="text-sm text-gray-500">No admin users yet.</p>}
          </div>

          {/* Create admin form */}
          <div className="border-t border-violet-100 pt-4">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">Add Admin User</h4>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} />
              <Input label="Email" type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} />
              <Input label="Password" type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
              <Select label="Role" value={adminForm.role} onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })} options={[
                { value: 'admin', label: 'Admin' }, { value: 'manager', label: 'Manager' },
                { value: 'cashier', label: 'Cashier' }, { value: 'warehouse_staff', label: 'Warehouse Staff' },
                { value: 'accountant', label: 'Accountant' },
              ]} />
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={handleCreateAdmin} loading={saving} size="sm"><Plus size={14} /> Add Admin</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!showDelete}
        onClose={() => setShowDelete(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete Organization"
        message={`Are you sure you want to delete "${showDelete?.name}"? This will soft-delete the organization.`}
      />
    </div>
  );
}
