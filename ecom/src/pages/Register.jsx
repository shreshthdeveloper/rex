import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSettings } from '../api';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', termsAccepted: false });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requireTerms, setRequireTerms] = useState(false);
  const { registerUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    getSettings().then((r) => {
      if (r.data?.requireTermsOnSignup) setRequireTerms(true);
    }).catch(() => {});
  }, []);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error('Please fill all required fields');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (requireTerms && !form.termsAccepted) return toast.error('You must accept the terms and conditions');
    setLoading(true);
    try {
      await registerUser(form);
      toast.success('Account created!');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="glass-card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">Create Account</h1>
        <p className="text-sm text-gray-500 mb-6">Join our wholesale platform</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Full Name *</label>
            <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)}
              className="input-field" placeholder="John Doe" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Email *</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
              className="input-field" placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)}
              className="input-field" placeholder="+1 (555) 000-0000" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Password *</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)}
                className="input-field pr-10" placeholder="Min 6 characters" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {requireTerms && (
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={form.termsAccepted}
                onChange={(e) => update('termsAccepted', e.target.checked)}
                className="mt-1 accent-brand-500" />
              <span className="text-sm text-gray-400">
                I agree to the <span className="text-brand-400">Terms & Conditions</span>
              </span>
            </label>
          )}
          <button type="submit" disabled={loading} className="btn-primary mt-2 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
