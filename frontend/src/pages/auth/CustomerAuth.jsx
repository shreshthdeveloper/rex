import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { storeAPI } from '../../api';
import { UserCircle, Loader2, FileText, Upload, Check, ChevronLeft, Eye, EyeOff } from 'lucide-react';

export default function CustomerAuth() {
  const { orgSlug } = useParams();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [settings, setSettings] = useState(null);

  const { customerLogin, customerRegister } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  /* Load store settings for T&C + required documents */
  useEffect(() => {
    (async () => {
      try {
        const res = await storeAPI.settings(orgSlug);
        const s = res.data;
        setSettings(s);
        if (s?.requiredDocuments?.length) {
          setDocuments(s.requiredDocuments.map((d) => ({ name: d.name, description: d.description, required: d.required, fileUrl: '' })));
        }
      } catch {
        /* settings optional — ignore */
      }
    })();
  }, [orgSlug]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleDocChange = (idx, val) => {
    setDocuments((d) => d.map((doc, i) => i === idx ? { ...doc, fileUrl: val } : doc));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await customerLogin(orgSlug, form.email, form.password);
      } else {
        /* Validate T&C */
        if (settings?.requireTermsOnSignup && !termsAccepted) {
          toast.error('Please accept the Terms & Conditions');
          setLoading(false);
          return;
        }
        /* Validate required documents */
        const missingDoc = documents.find((d) => d.required && !d.fileUrl);
        if (missingDoc) {
          toast.error(`Please provide: ${missingDoc.name}`);
          setLoading(false);
          return;
        }
        await customerRegister(orgSlug, {
          ...form,
          termsAccepted: termsAccepted || undefined,
          documents: documents.filter((d) => d.fileUrl).map((d) => ({ name: d.name, fileUrl: d.fileUrl })),
        });
      }
      toast.success(isLogin ? 'Welcome back!' : 'Account created!');
      navigate(`/store/${orgSlug}/portal`);
    } catch (err) {
      toast.error(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const primary = settings?.primaryColor || '#06b6d4';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full blur-[180px]" style={{ background: `${primary}08` }} />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[160px]" style={{ background: `${primary}05` }} />
      </div>

      <div className="w-full max-w-md relative">
        {/* Back to store link */}
        <Link
          to={`/store/${orgSlug}`}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-slate-800 transition-colors mb-6"
        >
          <ChevronLeft size={14} /> Back to store
        </Link>

        <div className="rounded-2xl border border-violet-200 bg-white/95 backdrop-blur-xl p-8 shadow-2xl">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            {settings?.logo ? (
              <img src={settings.logo} alt="" className="h-12 w-12 rounded-2xl object-cover mb-4 shadow-lg" />
            ) : (
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${primary}, ${primary}99)`, boxShadow: `0 8px 30px ${primary}25` }}
              >
                <UserCircle size={28} className="text-slate-800" />
              </div>
            )}
            <h1 className="text-xl font-bold text-slate-800">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {settings?.storeName || orgSlug}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Full Name</label>
                  <input type="text" value={form.name} onChange={set('name')} className="w-full glass-input px-4 py-3 text-sm rounded-xl" required />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Phone</label>
                  <input type="text" value={form.phone} onChange={set('phone')} className="w-full glass-input px-4 py-3 text-sm rounded-xl" />
                </div>
              </>
            )}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={set('email')} className="w-full glass-input px-4 py-3 text-sm rounded-xl" required />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  className="w-full glass-input px-4 py-3 pr-10 text-sm rounded-xl"
                  required
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-slate-800">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* ─── Document Upload (Register only) ─── */}
            {!isLogin && documents.length > 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Upload size={12} /> Required Documents
                </p>
                {documents.map((doc, i) => (
                  <div key={i} className="rounded-lg border border-violet-100 bg-violet-50/50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                        <FileText size={12} style={{ color: primary }} />
                        {doc.name}
                        {doc.required && <span className="text-red-400 text-[10px]">*</span>}
                      </span>
                      {doc.fileUrl && <Check size={14} className="text-green-400" />}
                    </div>
                    {doc.description && <p className="text-[10px] text-gray-500">{doc.description}</p>}
                    <input
                      type="url"
                      placeholder="Paste document URL..."
                      value={doc.fileUrl}
                      onChange={(e) => handleDocChange(i, e.target.value)}
                      className="w-full glass-input px-3 py-2 text-xs rounded-lg"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ─── Terms & Conditions (Register only) ─── */}
            {!isLogin && settings?.requireTermsOnSignup && settings?.termsAndConditions && (
              <div className="pt-2 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
                        termsAccepted
                          ? 'border-transparent'
                          : 'border-violet-200 group-hover:border-violet-300'
                      }`}
                      style={termsAccepted ? { background: primary, borderColor: primary } : {}}
                    >
                      {termsAccepted && <Check size={13} className="text-slate-800" />}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 leading-relaxed">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="underline hover:no-underline"
                      style={{ color: primary }}
                    >
                      Terms & Conditions
                    </button>
                  </span>
                </label>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-slate-800 flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 mt-2"
              style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd)`, boxShadow: `0 4px 20px ${primary}30` }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setTermsAccepted(false); }}
              className="text-xs text-gray-500 hover:text-slate-800 transition-colors"
            >
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <span style={{ color: primary }}>{isLogin ? 'Register' : 'Sign In'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Terms Modal ─── */}
      {showTerms && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTerms(false)} />
          <div className="relative w-full max-w-lg max-h-[80vh] rounded-2xl border border-violet-200 bg-white backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-violet-100">
              <h3 className="text-lg font-bold text-slate-800">Terms & Conditions</h3>
              <button onClick={() => setShowTerms(false)} className="text-gray-500 hover:text-slate-800 transition-colors text-sm">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="text-sm text-slate-600 leading-relaxed prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: settings.termsAndConditions }} />
            </div>
            <div className="p-4 border-t border-violet-100">
              <button
                onClick={() => { setTermsAccepted(true); setShowTerms(false); }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-slate-800 transition-all hover:brightness-110"
                style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd)` }}
              >
                I Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
