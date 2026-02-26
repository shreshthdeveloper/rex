import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { catalogService } from '../services/catalogService';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '', termsAccepted: false });
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    catalogService.getSettings().then(setSettings).catch(() => {});
  }, []);

  if (isAuthenticated) { navigate('/account', { replace: true }); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error('Please fill in required fields');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (settings?.requireTermsOnSignup && !form.termsAccepted) return toast.error('Please accept the terms and conditions');

    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        termsAccepted: form.termsAccepted,
      });
      toast.success('Registration successful!');
      navigate('/account');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="container-main py-16 flex items-center justify-center">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)' }}>
            <UserPlus className="w-6 h-6" style={{ color: 'var(--color-brand)' }} />
          </div>
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-content-secondary)' }}>Register to start ordering</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name *</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className="input-field" placeholder="John Doe" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input-field" placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input-field" placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password *</label>
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} className="input-field" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm Password *</label>
            <input type="password" value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} className="input-field" placeholder="••••••••" />
          </div>

          {settings?.requireTermsOnSignup && (
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.termsAccepted} onChange={(e) => set('termsAccepted', e.target.checked)} className="mt-0.5 accent-[var(--color-brand)]" />
              <span style={{ color: 'var(--color-content-secondary)' }}>
                I accept the <span className="underline" style={{ color: 'var(--color-brand)' }}>Terms and Conditions</span>
              </span>
            </label>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="text-sm text-center mt-6" style={{ color: 'var(--color-content-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" className="font-medium" style={{ color: 'var(--color-brand)' }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
