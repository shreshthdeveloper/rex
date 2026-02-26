import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldOff } from 'lucide-react';

const LOCK_KEY = 'age_locked';

export default function LockedPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // If they somehow land here without being locked, send them back
    if (sessionStorage.getItem(LOCK_KEY) !== 'true') {
      navigate('/', { replace: true });
    }
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Icon */}
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'color-mix(in srgb, var(--color-status-error, #ef4444) 12%, transparent)' }}
      >
        <Lock
          className="w-12 h-12"
          style={{ color: 'var(--color-status-error, #ef4444)' }}
        />
      </div>

      <h1 className="text-4xl font-extrabold mb-3">Access Denied</h1>

      <p
        className="text-lg max-w-md mb-2"
        style={{ color: 'var(--color-content-secondary)' }}
      >
        This website is restricted to adults only.
      </p>

      <p
        className="text-sm max-w-sm mb-10"
        style={{ color: 'var(--color-content-tertiary)' }}
      >
        You have indicated that you do not meet the minimum age requirement to access this content.
        Access has been denied for this session.
      </p>

      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm"
        style={{
          background: 'color-mix(in srgb, var(--color-status-error, #ef4444) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-status-error, #ef4444) 30%, transparent)',
          color: 'var(--color-status-error, #ef4444)',
        }}
      >
        <ShieldOff className="w-4 h-4" />
        Access Restricted — Age Requirement Not Met
      </div>
    </div>
  );
}
