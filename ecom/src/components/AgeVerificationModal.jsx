import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { catalogService } from '../services/catalogService';

const SESSION_KEY = 'age_verified';
const LOCK_KEY = 'age_locked';

export default function AgeVerificationModal() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (sessionStorage.getItem(LOCK_KEY) === 'true') {
      navigate('/locked', { replace: true });
      return;
    }
    if (sessionStorage.getItem(SESSION_KEY) === 'true') return;

    catalogService.getSettings()
      .then((s) => {
        if (s?.ageVerificationEnabled) {
          setSettings(s);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleConfirm = () => {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setVisible(false);
  };

  const handleDecline = () => {
    sessionStorage.setItem(LOCK_KEY, 'true');
    setVisible(false);
    navigate('/locked', { replace: true });
  };

  if (!visible || !settings) return null;

  const title = settings.ageVerificationTitle || 'Age Verification Required';
  const message = settings.ageVerificationMessage || 'You must be at least 18 years old to access this website. Please confirm your age to continue.';
  const minAge = settings.ageVerificationMinAge || 18;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-[fadeInScale_0.3s_ease-out]"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Brand image header */}
        <div
          className="relative h-36 flex items-center justify-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg, var(--color-brand), color-mix(in srgb, var(--color-brand) 60%, #000))' }}
        >
          {settings?.logo && (
            <img src={settings.logo} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
          )}
          <div className="relative flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-extrabold bg-white/20 border-2 border-white/40 text-white"
              style={{ boxShadow: '0 0 30px rgba(255,255,255,0.15)' }}
            >
              {minAge}+
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pt-5 pb-3 text-center">
          <ShieldCheck className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--color-brand)' }} />
          <h2 className="text-xl font-bold mb-2">{title}</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-content-secondary)' }}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 space-y-2.5">
          <button
            onClick={handleConfirm}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'var(--color-brand)' }}
          >
            Yes, I'm {minAge} or Older
          </button>
          <button
            onClick={handleDecline}
            className="w-full py-3 rounded-xl font-semibold transition-colors active:scale-[0.98]"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-content-secondary)',
            }}
          >
            No, I'm Under {minAge}
          </button>
          <p className="text-center text-[11px] pt-1" style={{ color: 'var(--color-content-tertiary)' }}>
            By entering this site, you agree to our Terms &amp; Conditions.
          </p>
        </div>
      </div>
    </div>
  );
}
