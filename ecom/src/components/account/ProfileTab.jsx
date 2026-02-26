import { useState, useEffect } from 'react';
import { customerService } from '../../services/customerService';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function ProfileTab() {
  const { customer: authCustomer, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    customerService.getProfile()
      .then((p) => { setProfile(p); setForm({ name: p.name || '', phone: p.phone || '' }); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Name is required');
    setSaving(true);
    try {
      await customerService.updateProfile(form);
      toast.success('Profile updated');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (!pwForm.currentPassword || !pwForm.newPassword) return toast.error('Please fill all fields');
    if (pwForm.newPassword !== pwForm.confirm) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await customerService.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed. Please log in again.');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      setTimeout(logout, 1000);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Profile */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Email</label>
            <input value={profile?.email || ''} disabled className="input-field opacity-60" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
          </div>
          <button type="submit" disabled={saving} className="btn btn-primary btn-md">
            {saving ? 'Saving...' : 'Update Profile'}
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Change Password</h3>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Current Password</label>
            <input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">New Password</label>
            <input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Confirm Password</label>
            <input type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} className="input-field" />
          </div>
          <button type="submit" disabled={saving} className="btn btn-secondary btn-md">Change Password</button>
        </form>
      </div>
    </div>
  );
}
