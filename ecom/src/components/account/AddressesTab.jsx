import { useState, useEffect } from 'react';
import { customerService } from '../../services/customerService';
import { MapPin, Plus, Trash2, Edit, Star } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AddressesTab() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ label: '', line1: '', city: '', state: '', zip: '', country: '', isDefault: false });

  const load = () => {
    setLoading(true);
    customerService.listAddresses()
      .then(setAddresses)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ label: '', line1: '', city: '', state: '', zip: '', country: '', isDefault: false });
    setEditId(null);
    setShowForm(false);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.line1) return toast.error('Address line is required');
    try {
      if (editId) {
        await customerService.updateAddress(editId, form);
        toast.success('Address updated');
      } else {
        await customerService.addAddress(form);
        toast.success('Address added');
      }
      resetForm();
      load();
    } catch (e) { toast.error(e.message); }
  };

  const del = async (id) => {
    if (!confirm('Delete this address?')) return;
    try {
      await customerService.deleteAddress(id);
      toast.success('Address removed');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const edit = (addr) => {
    setForm({ label: addr.label, line1: addr.line1, city: addr.city, state: addr.state, zip: addr.zip, country: addr.country, isDefault: addr.isDefault });
    setEditId(addr._id);
    setShowForm(true);
  };

  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Your Addresses</h3>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" /> Add Address
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={save} className="card p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Label</label>
              <input value={form.label} onChange={(e) => set('label', e.target.value)} className="input-field" placeholder="Home, Office..." />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Address Line *</label>
              <input value={form.line1} onChange={(e) => set('line1', e.target.value)} className="input-field" placeholder="Street address" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">City</label>
              <input value={form.city} onChange={(e) => set('city', e.target.value)} className="input-field" placeholder="City" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">State</label>
              <input value={form.state} onChange={(e) => set('state', e.target.value)} className="input-field" placeholder="State" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">ZIP Code</label>
              <input value={form.zip} onChange={(e) => set('zip', e.target.value)} className="input-field" placeholder="ZIP" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Country</label>
              <input value={form.country} onChange={(e) => set('country', e.target.value)} className="input-field" placeholder="Country" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} className="accent-[var(--color-brand)]" />
            Set as default
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm">{editId ? 'Update' : 'Add'}</button>
            <button type="button" onClick={resetForm} className="btn btn-secondary btn-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="skeleton h-20 rounded-lg" />)}</div>
      ) : addresses.length === 0 ? (
        <p className="text-center py-10" style={{ color: 'var(--color-content-secondary)' }}>No addresses saved yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((a) => (
            <div key={a._id} className="card p-4 flex gap-3">
              <MapPin className="w-5 h-5 shrink-0 mt-0.5" style={{ color: a.isDefault ? 'var(--color-brand)' : 'var(--color-content-tertiary)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{a.label || 'Address'}</span>
                  {a.isDefault && <Star className="w-3 h-3" style={{ color: 'var(--color-brand)' }} fill="var(--color-brand)" />}
                </div>
                <p className="text-sm" style={{ color: 'var(--color-content-secondary)' }}>
                  {a.line1}{a.city ? `, ${a.city}` : ''}{a.state ? `, ${a.state}` : ''}{a.zip ? ` ${a.zip}` : ''}{a.country ? `, ${a.country}` : ''}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => edit(a)} className="btn btn-ghost btn-sm"><Edit className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(a._id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--color-status-error)' }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
