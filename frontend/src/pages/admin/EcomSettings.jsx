import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { ecomSettingsAPI, uploadAPI } from '../../api';
import {
  GlassCard, Button, Input, Loader, TabList, PageHeader,
} from '../../components/ui';
import {
  Settings, Palette, Image, Layout, Megaphone, FileText, Globe,
  Plus, Trash2, GripVertical, Eye, EyeOff, Save, ChevronDown, ChevronUp,
  Upload, X,
} from 'lucide-react';

const TABS = [
  { id: 'branding', label: 'Branding' },
  { id: 'banners', label: 'Banners' },
  { id: 'layout', label: 'Layout' },
  { id: 'marquee', label: 'Marquee & Alerts' },
  { id: 'terms', label: 'T&C & Docs' },
  { id: 'footer', label: 'Footer & Social' },
];

const defaultBanner = { title: '', subtitle: '', image: '', link: '', isActive: true, sortOrder: 0 };
const defaultDoc = { name: '', description: '', required: false };

/* ─── Reusable Image Upload Component ─── */
function ImageUpload({ label, value, onChange, className = '' }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadAPI.upload(file);
      onChange(res.data?.url || '');
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="text-xs font-medium text-slate-500 block">{label}</label>}
      <div
        className={`relative rounded-xl border-2 border-dashed transition-colors ${
          dragOver ? 'border-cyan-400 bg-cyan-500/5' : 'border-violet-100 hover:border-violet-200'
        } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {value ? (
          <div className="relative group">
            <img
              src={value}
              alt={label || 'Preview'}
              className="w-full h-28 object-contain rounded-xl bg-violet-50/50"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
              <button
                onClick={() => inputRef.current?.click()}
                className="px-3 py-1.5 text-[10px] font-medium bg-violet-100 backdrop-blur-sm rounded-lg text-slate-800 hover:bg-violet-200 transition-colors"
              >
                <Upload size={12} className="inline mr-1" /> Replace
              </button>
              <button
                onClick={() => onChange('')}
                className="px-3 py-1.5 text-[10px] font-medium bg-red-500/30 backdrop-blur-sm rounded-lg text-red-300 hover:bg-red-500/40 transition-colors"
              >
                <X size={12} className="inline mr-1" /> Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full py-6 flex flex-col items-center gap-2 text-gray-500 hover:text-slate-600 transition-colors"
          >
            {uploading ? (
              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload size={20} className="text-gray-600" />
            )}
            <span className="text-xs">{uploading ? 'Uploading...' : 'Click or drag image here'}</span>
            <span className="text-[10px] text-gray-600">JPG, PNG, WebP, SVG • Max 5MB</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ''; }}
      />
      {/* Fallback URL input */}
      <Input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste image URL..."
        className="mt-1"
      />
    </div>
  );
}

export default function EcomSettings() {
  const toast = useToast();
  const [tab, setTab] = useState('branding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ecomSettingsAPI.get();
      setData(res.data || {});
    } catch (err) {
      toast.error(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const set = (key, val) => setData((d) => ({ ...d, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      await ecomSettingsAPI.update(data);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  /* ─── Banner helpers ─── */
  const banners = data.banners || [];
  const setBanners = (fn) => set('banners', typeof fn === 'function' ? fn(banners) : fn);
  const addBanner = () => setBanners((b) => [...b, { ...defaultBanner, sortOrder: b.length }]);
  const removeBanner = (i) => setBanners((b) => b.filter((_, idx) => idx !== i));
  const updateBanner = (i, key, val) => setBanners((b) => b.map((bn, idx) => idx === i ? { ...bn, [key]: val } : bn));

  /* ─── Section helpers ─── */
  const sections = data.sections || [];
  const setSections = (fn) => set('sections', typeof fn === 'function' ? fn(sections) : fn);
  const addSection = () => setSections((s) => [...s, { type: 'featured', title: '', maxProducts: 8, isActive: true, sortOrder: s.length }]);
  const removeSection = (i) => setSections((s) => s.filter((_, idx) => idx !== i));
  const updateSection = (i, key, val) => setSections((s) => s.map((sec, idx) => idx === i ? { ...sec, [key]: val } : sec));

  /* ─── Required docs helpers ─── */
  const requiredDocs = data.requiredDocuments || [];
  const setDocs = (fn) => set('requiredDocuments', typeof fn === 'function' ? fn(requiredDocs) : fn);
  const addDoc = () => setDocs((d) => [...d, { ...defaultDoc }]);
  const removeDoc = (i) => setDocs((d) => d.filter((_, idx) => idx !== i));
  const updateDoc = (i, key, val) => setDocs((d) => d.map((doc, idx) => idx === i ? { ...doc, [key]: val } : doc));

  /* ─── Color picker helper ─── */
  const ColorPicker = ({ label, colorKey }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={data[colorKey] || '#06b6d4'}
          onChange={(e) => set(colorKey, e.target.value)}
          className="w-9 h-9 rounded-lg border border-violet-100 cursor-pointer bg-transparent"
        />
        <input
          type="text"
          value={data[colorKey] || '#06b6d4'}
          onChange={(e) => set(colorKey, e.target.value)}
          className="glass-input px-3 py-2 text-xs font-mono w-28 rounded-lg"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="E-commerce Settings"
        subtitle="Configure your storefront"
        actions={
          <Button onClick={save} loading={saving}>
            <Save size={14} /> Save Settings
          </Button>
        }
      />

      <TabList tabs={TABS} active={tab} onChange={setTab} />

      {/* ══════════ BRANDING ══════════ */}
      {tab === 'branding' && (
        <GlassCard>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Store Name" value={data.storeName || ''} onChange={(e) => set('storeName', e.target.value)} />
            <Input label="Tagline" value={data.tagline || ''} onChange={(e) => set('tagline', e.target.value)} />
            <ImageUpload label="Brand Logo" value={data.logo || ''} onChange={(v) => set('logo', v)} />
            <ImageUpload label="Favicon" value={data.favicon || ''} onChange={(v) => set('favicon', v)} />
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-500 mb-2 block">Theme</label>
              <div className="flex flex-wrap gap-2">
                {['glass', 'modern', 'minimal', 'bold'].map((t) => (
                  <button
                    key={t}
                    onClick={() => set('theme', t)}
                    className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors capitalize ${
                      data.theme === t
                        ? 'bg-cyan-500/20 text-violet-600 border-cyan-500/30'
                        : 'text-slate-500 border-violet-100 hover:border-violet-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <ColorPicker label="Primary Color" colorKey="primaryColor" />
            <ColorPicker label="Secondary Color" colorKey="secondaryColor" />
            <ColorPicker label="Accent Color" colorKey="accentColor" />
          </div>
        </GlassCard>
      )}

      {/* ══════════ BANNERS ══════════ */}
      {tab === 'banners' && (
        <div className="space-y-4">
          {banners.map((b, i) => (
            <GlassCard key={i}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-gray-600" />
                  <span className="text-sm font-medium text-slate-800">Banner {i + 1}</span>
                  <button
                    onClick={() => updateBanner(i, 'isActive', !b.isActive)}
                    className={`ml-2 text-[10px] px-2 py-0.5 rounded-full border ${
                      b.isActive ? 'text-green-400 border-green-500/20 bg-green-500/10' : 'text-gray-500 border-violet-100'
                    }`}
                  >
                    {b.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <button onClick={() => removeBanner(i)} className="text-red-400/60 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Title" value={b.title} onChange={(e) => updateBanner(i, 'title', e.target.value)} />
                <Input label="Subtitle" value={b.subtitle} onChange={(e) => updateBanner(i, 'subtitle', e.target.value)} />
                <ImageUpload label="Banner Image" value={b.image} onChange={(v) => updateBanner(i, 'image', v)} />
                <Input label="Link" value={b.link} onChange={(e) => updateBanner(i, 'link', e.target.value)} placeholder="/store/slug/products/..." />
              </div>
              {b.image && (
                <div className="mt-3">
                  <img src={b.image} alt="Preview" className="h-20 rounded-lg object-cover" onError={(e) => e.target.style.display = 'none'} />
                </div>
              )}
            </GlassCard>
          ))}
          <Button variant="ghost" onClick={addBanner}><Plus size={14} /> Add Banner</Button>
        </div>
      )}

      {/* ══════════ LAYOUT ══════════ */}
      {tab === 'layout' && (
        <GlassCard>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Products Per Row</label>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => set('productsPerRow', n)}
                    className={`w-10 h-10 rounded-lg text-xs font-medium border transition-colors ${
                      (data.productsPerRow || 4) === n
                        ? 'bg-cyan-500/20 text-violet-600 border-cyan-500/30'
                        : 'text-slate-500 border-violet-100 hover:border-violet-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Products Per Page</label>
              <div className="flex gap-2">
                {[4, 8, 12, 16, 24, 48].map((n) => (
                  <button
                    key={n}
                    onClick={() => set('productsPerPage', n)}
                    className={`px-3 h-10 rounded-lg text-xs font-medium border transition-colors ${
                      (data.productsPerPage || 12) === n
                        ? 'bg-cyan-500/20 text-violet-600 border-cyan-500/30'
                        : 'text-slate-500 border-violet-100 hover:border-violet-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={data.showFeatured !== false} onChange={(e) => set('showFeatured', e.target.checked)} className="accent-cyan-400" />
                <span className="text-sm text-slate-600">Show Featured Section</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={data.showCategories !== false} onChange={(e) => set('showCategories', e.target.checked)} className="accent-cyan-400" />
                <span className="text-sm text-slate-600">Show Category Filter</span>
              </label>
            </div>
          </div>

          {/* ─── Custom Sections ─── */}
          <div className="mt-6 pt-4 border-t border-violet-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">Custom Sections</h3>
              <Button variant="ghost" size="sm" onClick={addSection}><Plus size={12} /> Add Section</Button>
            </div>
            {sections.length === 0 && <p className="text-xs text-gray-500">No custom sections. Add one above.</p>}
            <div className="space-y-3">
              {sections.map((sec, i) => (
                <div key={i} className="p-3 rounded-lg border border-violet-100 bg-violet-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical size={12} className="text-gray-600" />
                      <span className="text-xs font-medium text-slate-800">Section {i + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateSection(i, 'isActive', !sec.isActive)} className="text-xs text-gray-500 hover:text-slate-800">
                        {sec.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button onClick={() => removeSection(i)} className="text-red-400/60 hover:text-red-400"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <select
                      value={sec.type}
                      onChange={(e) => updateSection(i, 'type', e.target.value)}
                      className="glass-input px-3 py-2 text-xs rounded-lg appearance-none bg-transparent"
                    >
                      <option value="featured" className="bg-white">Featured</option>
                      <option value="new_arrivals" className="bg-white">New Arrivals</option>
                      <option value="sale" className="bg-white">Sale</option>
                      <option value="category" className="bg-white">By Category</option>
                      <option value="custom" className="bg-white">Custom</option>
                    </select>
                    <Input value={sec.title || ''} onChange={(e) => updateSection(i, 'title', e.target.value)} placeholder="Section Title" />
                    <Input type="number" value={sec.maxProducts || 8} onChange={(e) => updateSection(i, 'maxProducts', Number(e.target.value))} placeholder="Max products" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      )}

      {/* ══════════ MARQUEE & ALERTS ══════════ */}
      {tab === 'marquee' && (
        <GlassCard>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Megaphone size={14} className="text-violet-600" /> Marquee Text</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={data.marqueeEnabled || false} onChange={(e) => set('marqueeEnabled', e.target.checked)} className="accent-cyan-400" />
                  <span className="text-xs text-slate-500">Enable</span>
                </label>
              </div>
              <Input
                value={data.marqueeText || ''}
                onChange={(e) => set('marqueeText', e.target.value)}
                placeholder="🔥 Free shipping on all orders above ₹999!"
              />
              {data.marqueeEnabled && data.marqueeText && (
                <div className="mt-3 text-xs text-violet-600 overflow-hidden rounded-lg border border-cyan-500/10 p-2 bg-cyan-500/5">
                  <div className="animate-marquee whitespace-nowrap">{data.marqueeText} &nbsp;&nbsp;•&nbsp;&nbsp; {data.marqueeText}</div>
                </div>
              )}
            </div>

            <div className="border-t border-violet-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-800">Sale Alert Banner</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={data.saleAlertEnabled || false} onChange={(e) => set('saleAlertEnabled', e.target.checked)} className="accent-cyan-400" />
                  <span className="text-xs text-slate-500">Enable</span>
                </label>
              </div>
              <Input
                value={data.saleAlertText || ''}
                onChange={(e) => set('saleAlertText', e.target.value)}
                placeholder="🎉 Mega Sale — Up to 50% off!"
              />
            </div>
          </div>
        </GlassCard>
      )}

      {/* ══════════ T&C & DOCUMENTS ══════════ */}
      {tab === 'terms' && (
        <div className="space-y-4">
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><FileText size={14} className="text-violet-600" /> Terms & Conditions</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={data.requireTermsOnSignup || false} onChange={(e) => set('requireTermsOnSignup', e.target.checked)} className="accent-cyan-400" />
                <span className="text-xs text-slate-500">Require on Signup</span>
              </label>
            </div>
            <textarea
              value={data.termsAndConditions || ''}
              onChange={(e) => set('termsAndConditions', e.target.value)}
              rows={8}
              className="w-full glass-input p-4 text-sm rounded-lg resize-y"
              placeholder="Enter your terms and conditions (supports HTML)..."
            />
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">Required Documents</h3>
              <Button variant="ghost" size="sm" onClick={addDoc}><Plus size={12} /> Add</Button>
            </div>
            {requiredDocs.length === 0 && <p className="text-xs text-gray-500">No documents required for signup.</p>}
            <div className="space-y-3">
              {requiredDocs.map((doc, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-violet-100 bg-violet-50/50">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input value={doc.name} onChange={(e) => updateDoc(i, 'name', e.target.value)} placeholder="Document name" />
                    <Input value={doc.description || ''} onChange={(e) => updateDoc(i, 'description', e.target.value)} placeholder="Description" />
                    <label className="flex items-center gap-2 self-center cursor-pointer">
                      <input type="checkbox" checked={doc.required || false} onChange={(e) => updateDoc(i, 'required', e.target.checked)} className="accent-cyan-400" />
                      <span className="text-xs text-slate-500">Required</span>
                    </label>
                  </div>
                  <button onClick={() => removeDoc(i)} className="text-red-400/60 hover:text-red-400 mt-2"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ══════════ FOOTER & SOCIAL ══════════ */}
      {tab === 'footer' && (
        <GlassCard>
          <div className="space-y-6">
            <Input label="Footer Text" value={data.footerText || ''} onChange={(e) => set('footerText', e.target.value)} placeholder="© 2025 Your Store. All rights reserved." />

            <div className="border-t border-violet-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-4"><Globe size={14} className="text-violet-600" /> Social Links</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {['facebook', 'instagram', 'twitter', 'youtube'].map((platform) => (
                  <Input
                    key={platform}
                    label={platform.charAt(0).toUpperCase() + platform.slice(1)}
                    value={data.socialLinks?.[platform] || ''}
                    onChange={(e) => set('socialLinks', { ...(data.socialLinks || {}), [platform]: e.target.value })}
                    placeholder={`https://${platform}.com/...`}
                  />
                ))}
              </div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
