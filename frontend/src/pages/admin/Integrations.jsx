import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { integrationsAPI } from '../../api';
import {
  GlassCard, Button, Input, Badge, PageHeader, Loader, ConfirmDialog,
} from '../../components/ui';
import {
  Plug, Power, PowerOff, Save, Eye, EyeOff, ExternalLink, RefreshCw,
} from 'lucide-react';

const AVAILABLE_INTEGRATIONS = [
  {
    slug: 'dispatch',
    displayName: 'Dispatch',
    logo: 'https://dispatch.distrx.io/assets/main_logo-5gthJQ7w.jpeg',
    description: 'Delivery management & dispatch tracking. Send orders to Dispatch for last-mile delivery.',
    webhookUrl: 'https://dispatch.distrx.io/api/zapier/webhook',
  },
];

export default function Integrations() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integrations, setIntegrations] = useState([]);
  const [editSlug, setEditSlug] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await integrationsAPI.list();
      setIntegrations(res.data || []);
    } catch {
      // no integrations yet
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getSaved = (slug) => integrations.find((i) => i.slug === slug);

  const handleToggle = async (slug) => {
    const saved = getSaved(slug);
    if (!saved) {
      // First time — create with inactive
      try {
        const def = AVAILABLE_INTEGRATIONS.find((a) => a.slug === slug);
        await integrationsAPI.upsert({
          slug,
          displayName: def.displayName,
          logo: def.logo,
          webhookUrl: def.webhookUrl,
          isActive: true,
        });
        toast.success('Integration activated');
        load();
      } catch (err) {
        toast.error(err?.message || 'Failed');
      }
      return;
    }
    try {
      await integrationsAPI.toggle(slug);
      toast.success(`Integration ${saved.isActive ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    }
  };

  const handleSaveKey = async (slug) => {
    if (!apiKey.trim()) { toast.error('Enter an API key'); return; }
    setSaving(true);
    try {
      const def = AVAILABLE_INTEGRATIONS.find((a) => a.slug === slug);
      const saved = getSaved(slug);
      await integrationsAPI.upsert({
        slug,
        displayName: def.displayName,
        logo: def.logo,
        webhookUrl: def.webhookUrl,
        isActive: saved?.isActive ?? false,
        apiKey: apiKey.trim(),
      });
      toast.success('API key saved');
      setEditSlug(null);
      setApiKey('');
      setShowKey(false);
      load();
    } catch (err) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (slug) => {
    const saved = getSaved(slug);
    setEditSlug(slug);
    setApiKey(saved?.apiKey || '');
    setShowKey(false);
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Plug}
        title="Integrations"
        subtitle="Connect third-party apps to extend your platform"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {AVAILABLE_INTEGRATIONS.map((app) => {
          const saved = getSaved(app.slug);
          const isActive = saved?.isActive || false;
          const hasKey = !!saved?.apiKey;

          return (
            <GlassCard key={app.slug} className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-start gap-4">
                <img
                  src={app.logo}
                  alt={app.displayName}
                  className="w-14 h-14 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-800 truncate">{app.displayName}</h3>
                    <Badge variant={isActive ? 'success' : 'default'}>
                      {isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{app.description}</p>
                </div>
              </div>

              {/* Status & Key info */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {hasKey ? (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    API key configured
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    No API key set
                  </span>
                )}
              </div>

              {/* API Key Edit */}
              {editSlug === app.slug && (
                <div className="space-y-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="relative">
                    <Input
                      label="API Key"
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" loading={saving} onClick={() => handleSaveKey(app.slug)}>
                      <Save size={14} /> Save Key
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditSlug(null); setApiKey(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant={isActive ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() => handleToggle(app.slug)}
                >
                  {isActive ? <PowerOff size={14} /> : <Power size={14} />}
                  {isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(app.slug)}>
                  {editSlug === app.slug ? 'Close' : 'Configure'}
                </Button>
                {app.webhookUrl && (
                  <a
                    href={app.webhookUrl.replace('/api/zapier/webhook', '')}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-slate-400 hover:text-violet-600 transition-colors"
                    title="Open app"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Info Section */}
      <GlassCard className="mt-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">How Dispatch Integration Works</h4>
        <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
          <li>Activate the integration and add your Dispatch API key</li>
          <li>When an order is placed/processed, you can send delivery details to Dispatch</li>
          <li>Dispatch receives: customer name, phone, pickup location, delivery address, priority & notes</li>
          <li>Manage your deliveries at <a href="https://dispatch.distrx.io" target="_blank" rel="noreferrer" className="text-violet-600 hover:underline">dispatch.distrx.io</a></li>
        </ul>
      </GlassCard>
    </div>
  );
}
