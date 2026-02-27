import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { ecomSettingsAPI, ecomQueriesAPI, uploadAPI } from '../../api';
import {
  GlassCard, Button, Input, Loader, TabList, PageHeader,
} from '../../components/ui';
import {
  Megaphone, FileText, Globe,
  Plus, Trash2, GripVertical, Eye, EyeOff, Save,
  Upload, X, Layers, ShieldCheck, ToggleLeft, ToggleRight, MousePointerClick,
} from 'lucide-react';

const TABS = [
  { id: 'branding', label: 'Branding' },
  { id: 'banners', label: 'Banners' },
  { id: 'layout', label: 'Layout' },
  { id: 'marquee', label: 'Marquee & Alerts' },
  { id: 'terms', label: 'T&C & Docs' },
  { id: 'brand_policies', label: 'Brand Policies' },
  { id: 'footer', label: 'Footer & Social' },
  { id: 'queries', label: 'Queries' },
  { id: 'modals', label: 'Modal Settings' },
];

const MODAL_PAGES = [
  { value: 'all', label: 'All Pages' },
  { value: 'home', label: 'Home' },
  { value: 'products', label: 'Products' },
  { value: 'product_detail', label: 'Product Detail' },
  { value: 'cart', label: 'Cart' },
  { value: 'checkout', label: 'Checkout' },
  { value: 'account', label: 'Account' },
];

const defaultModal = {
  title: '', body: '', showOn: ['all'], trigger: 'on_load', triggerDelay: 0,
  frequency: 'once_per_session', isEnabled: true, formFields: [], buttons: [],
  bgColor: '', textColor: '', maxWidth: 'md',
};
const defaultModalButton = { label: '', action: 'close', url: '', style: 'primary' };
const defaultModalField = { label: '', placeholder: '', fieldType: 'text', options: [], required: false };

const defaultBanner = { title: '', subtitle: '', image: '', link: '', isActive: true, sortOrder: 0 };
const defaultDoc = { name: '', description: '', required: false };

const escapePolicyHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const hasPolicyHtmlTags = (value = '') => /<\/?[a-z][\s\S]*>/i.test(value);

const formatPolicyPreviewHtml = (raw = '') => {
  const content = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!content) return '';
  if (hasPolicyHtmlTags(content)) return content;

  const blocks = content.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const htmlBlocks = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      htmlBlocks.push(`<ul>${lines
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter(Boolean)
        .map((item) => `<li>${escapePolicyHtml(item)}</li>`)
        .join('')}</ul>`);
      continue;
    }

    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      htmlBlocks.push(`<ol>${lines
        .map((line) => line.replace(/^\d+\.\s+/, '').trim())
        .filter(Boolean)
        .map((item) => `<li>${escapePolicyHtml(item)}</li>`)
        .join('')}</ol>`);
      continue;
    }

    if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
      const line = lines[0];
      const level = line.match(/^#+/)[0].length;
      const text = line.replace(/^#{1,3}\s+/, '').trim();
      const tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      htmlBlocks.push(`<${tag}>${escapePolicyHtml(text)}</${tag}>`);
      continue;
    }

    htmlBlocks.push(`<p>${lines.map(escapePolicyHtml).join('<br/>')}</p>`);
  }

  return htmlBlocks.join('');
};

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
  const [queriesLoading, setQueriesLoading] = useState(false);
  const [queries, setQueries] = useState([]);
  const [queryStatus, setQueryStatus] = useState('');
  const [querySearch, setQuerySearch] = useState('');

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

  const loadQueries = useCallback(async () => {
    setQueriesLoading(true);
    try {
      const res = await ecomQueriesAPI.list({ page: 1, limit: 100, status: queryStatus || undefined, search: querySearch || undefined });
      setQueries(res.data?.queries || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load queries');
    } finally {
      setQueriesLoading(false);
    }
  }, [queryStatus, querySearch]);

  useEffect(() => {
    if (tab === 'queries') loadQueries();
  }, [tab, loadQueries]);

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

  const wallBanners = data.wallBanners || [];
  const setWallBanners = (fn) => set('wallBanners', typeof fn === 'function' ? fn(wallBanners) : fn);
  const addWallBanner = () => setWallBanners((b) => [...b, { ...defaultBanner, sortOrder: b.length }]);
  const removeWallBanner = (i) => setWallBanners((b) => b.filter((_, idx) => idx !== i));
  const updateWallBanner = (i, key, val) => setWallBanners((b) => b.map((bn, idx) => idx === i ? { ...bn, [key]: val } : bn));

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
          <GlassCard>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-800">Carousel Banners</h3>
              <p className="text-xs text-slate-400 mt-0.5">Main homepage slider banners.</p>
            </div>
          </GlassCard>

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

          <GlassCard>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-800">Wall Banners</h3>
              <p className="text-xs text-slate-400 mt-0.5">Shown on homepage right after the carousel as a vertical line of banners.</p>
            </div>
          </GlassCard>

          {wallBanners.map((b, i) => (
            <GlassCard key={`wall-${i}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-gray-600" />
                  <span className="text-sm font-medium text-slate-800">Wall Banner {i + 1}</span>
                  <button
                    onClick={() => updateWallBanner(i, 'isActive', !b.isActive)}
                    className={`ml-2 text-[10px] px-2 py-0.5 rounded-full border ${
                      b.isActive ? 'text-green-400 border-green-500/20 bg-green-500/10' : 'text-gray-500 border-violet-100'
                    }`}
                  >
                    {b.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <button onClick={() => removeWallBanner(i)} className="text-red-400/60 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Title" value={b.title} onChange={(e) => updateWallBanner(i, 'title', e.target.value)} />
                <Input label="Subtitle" value={b.subtitle} onChange={(e) => updateWallBanner(i, 'subtitle', e.target.value)} />
                <ImageUpload label="Wall Banner Image" value={b.image} onChange={(v) => updateWallBanner(i, 'image', v)} />
                <Input label="Link" value={b.link} onChange={(e) => updateWallBanner(i, 'link', e.target.value)} placeholder="/store/slug/products/..." />
              </div>
              {b.image && (
                <div className="mt-3">
                  <img src={b.image} alt="Preview" className="h-20 rounded-lg object-cover" onError={(e) => e.target.style.display = 'none'} />
                </div>
              )}
            </GlassCard>
          ))}
          <Button variant="ghost" onClick={addWallBanner}><Plus size={14} /> Add Wall Banner</Button>
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

      {/* ══════════ BRAND POLICIES ══════════ */}
      {tab === 'brand_policies' && (
        <div className="space-y-4">
          {[
            { key: 'termsContent', label: 'Terms & Conditions', hint: 'Content for the /terms-and-conditions page' },
            { key: 'returnRefundContent', label: 'Return & Refund Policy', hint: 'Content for the /return-and-refund-policy page' },
            { key: 'privacyContent', label: 'Privacy Policy', hint: 'Content for the /privacy-policy page' },
            { key: 'contactContent', label: 'Contact Us (Info Block)', hint: 'Custom info text shown in the Contact Us page (email/address etc.)' },
            { key: 'aboutUsContent', label: 'About Us', hint: 'Content for the /about-us page' },
          ].map(({ key, label, hint }) => (
            <GlassCard key={key}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <FileText size={14} className="text-violet-600" /> {label}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{hint}. Supports HTML and plain text formatting.</p>
                </div>
                {data[key] && (
                  <button
                    type="button"
                    onClick={() => set(key, '')}
                    className="text-xs text-red-400/70 hover:text-red-400 flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Clear
                  </button>
                )}
              </div>
              <textarea
                value={data[key] || ''}
                onChange={(e) => set(key, e.target.value)}
                rows={10}
                className="w-full glass-input p-4 text-sm rounded-lg resize-y font-mono"
                placeholder={`Enter ${label} content (HTML, or plain text with line breaks, bullets like - item, numbered lists, and # headings)...`}
              />
              {data[key] && (
                <details className="mt-2">
                  <summary className="text-xs text-slate-400 cursor-pointer select-none hover:text-slate-600">Preview rendered HTML</summary>
                  <div
                    className="mt-2 p-4 rounded-lg border border-violet-100 bg-violet-50/30 text-sm prose prose-sm max-w-none text-slate-700"
                    dangerouslySetInnerHTML={{ __html: formatPolicyPreviewHtml(data[key]) }}
                  />
                </details>
              )}
            </GlassCard>
          ))}
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

      {/* ══════════ QUERIES ══════════ */}
      {tab === 'queries' && (
        <GlassCard>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <Input label="Search" value={querySearch} onChange={(e) => setQuerySearch(e.target.value)} placeholder="Search name, email, subject..." />
              <div className="w-full md:w-52">
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Status</label>
                <select value={queryStatus} onChange={(e) => setQueryStatus(e.target.value)} className="glass-input w-full px-3 py-2 text-sm rounded-lg">
                  <option value="">All</option>
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <Button onClick={loadQueries} variant="ghost">Refresh</Button>
            </div>

            {queriesLoading ? (
              <Loader />
            ) : queries.length === 0 ? (
              <p className="text-sm text-slate-500">No messages found.</p>
            ) : (
              <div className="space-y-3">
                {queries.map((q) => (
                  <div key={q._id} className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{q.subject || 'General Inquiry'}</div>
                        <div className="text-xs text-slate-500">{q.name} • {q.email}{q.phone ? ` • ${q.phone}` : ''}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{new Date(q.createdAt).toLocaleString('en-IN')}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={q.status}
                          onChange={async (e) => {
                            try {
                              await ecomQueriesAPI.updateStatus(q._id, e.target.value);
                              setQueries((prev) => prev.map((item) => item._id === q._id ? { ...item, status: e.target.value } : item));
                              toast.success('Status updated');
                            } catch (err) {
                              toast.error(err.message || 'Failed to update status');
                            }
                          }}
                          className="glass-input px-3 py-1.5 text-xs rounded-lg"
                        >
                          <option value="new">New</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{q.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ══════════ MODAL SETTINGS ══════════ */}
      {tab === 'modals' && (
        <div className="space-y-4">

          {/* Age Verification */}
          <GlassCard>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-4"><ShieldCheck size={14} className="text-violet-600" /> Age Verification</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => set('ageVerificationEnabled', !data.ageVerificationEnabled)}
                  className={`text-2xl ${data.ageVerificationEnabled ? 'text-cyan-500' : 'text-slate-300'}`}
                >
                  {data.ageVerificationEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
                <span className="text-sm font-medium text-slate-700">Enable Age Verification Gate</span>
              </div>
              {data.ageVerificationEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <Input
                    label="Modal Title"
                    value={data.ageVerificationTitle || ''}
                    onChange={(e) => set('ageVerificationTitle', e.target.value)}
                    placeholder="Age Verification Required"
                  />
                  <Input
                    label="Minimum Age"
                    type="number"
                    value={data.ageVerificationMinAge ?? 18}
                    onChange={(e) => set('ageVerificationMinAge', Number(e.target.value))}
                    min={1} max={99}
                  />
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-slate-500 block mb-1">Verification Message</label>
                    <textarea
                      value={data.ageVerificationMessage || ''}
                      onChange={(e) => set('ageVerificationMessage', e.target.value)}
                      rows={2}
                      className="w-full glass-input p-3 text-sm rounded-lg resize-none"
                      placeholder="You must be at least 18 years old to access this website..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-slate-500 block mb-1">Lockout Message (shown on locked page)</label>
                    <textarea
                      value={data.ageVerificationLockMessage || ''}
                      onChange={(e) => set('ageVerificationLockMessage', e.target.value)}
                      rows={2}
                      className="w-full glass-input p-3 text-sm rounded-lg resize-none"
                      placeholder="Access to this website is restricted to users aged 18 and above."
                    />
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Custom Modals List */}
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Layers size={14} className="text-violet-600" /> Custom Modals</h3>
              <Button variant="ghost" size="sm" onClick={() => set('modals', [...(data.modals || []), { ...defaultModal }])}>
                <Plus size={12} /> Add Modal
              </Button>
            </div>

            {(!data.modals || data.modals.length === 0) && (
              <p className="text-xs text-gray-500">No custom modals yet. Click "Add Modal" to create one.</p>
            )}

            <div className="space-y-4">
              {(data.modals || []).map((modal, mi) => {
                const updateModal = (key, val) => {
                  const updated = [...data.modals];
                  updated[mi] = { ...updated[mi], [key]: val };
                  set('modals', updated);
                };
                const removeModal = () => {
                  set('modals', data.modals.filter((_, i) => i !== mi));
                };

                return (
                  <div key={mi} className="border border-violet-100 rounded-xl bg-violet-50/30 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-violet-50/60 border-b border-violet-100">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => updateModal('isEnabled', !modal.isEnabled)}
                          className={`${modal.isEnabled ? 'text-cyan-500' : 'text-slate-300'}`}
                        >
                          {modal.isEnabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                        </button>
                        <span className="text-sm font-semibold text-slate-800">{modal.title || `Modal ${mi + 1}`}</span>
                        {!modal.isEnabled && <span className="text-[10px] bg-slate-200 text-slate-500 rounded-full px-2 py-0.5">Disabled</span>}
                      </div>
                      <button onClick={removeModal} className="text-red-400/60 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-4">
                      {/* Basic */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          label="Title"
                          value={modal.title || ''}
                          onChange={(e) => updateModal('title', e.target.value)}
                          placeholder="Modal Title"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-slate-500 block mb-1">Trigger</label>
                            <select value={modal.trigger || 'on_load'} onChange={(e) => updateModal('trigger', e.target.value)} className="glass-input w-full px-3 py-2 text-sm rounded-lg">
                              <option value="on_load">On Page Load</option>
                              <option value="on_exit">On Exit Intent</option>
                              <option value="on_scroll">On Scroll</option>
                              <option value="manual">Manual / API</option>
                            </select>
                          </div>
                          <Input
                            label="Delay (ms)"
                            type="number"
                            min={0}
                            value={modal.triggerDelay ?? 0}
                            onChange={(e) => updateModal('triggerDelay', Number(e.target.value))}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1">Body / Message</label>
                        <textarea
                          value={modal.body || ''}
                          onChange={(e) => updateModal('body', e.target.value)}
                          rows={2}
                          className="w-full glass-input p-3 text-sm rounded-lg resize-none"
                          placeholder="Modal content / message..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-500 block mb-1">Frequency</label>
                          <select value={modal.frequency || 'once_per_session'} onChange={(e) => updateModal('frequency', e.target.value)} className="glass-input w-full px-3 py-2 text-sm rounded-lg">
                            <option value="every_visit">Every Visit</option>
                            <option value="once_per_session">Once Per Session</option>
                            <option value="once">Once Ever</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 block mb-1">Max Width</label>
                          <select value={modal.maxWidth || 'md'} onChange={(e) => updateModal('maxWidth', e.target.value)} className="glass-input w-full px-3 py-2 text-sm rounded-lg">
                            <option value="sm">Small</option>
                            <option value="md">Medium</option>
                            <option value="lg">Large</option>
                            <option value="xl">X-Large</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 block mb-1">Background Color</label>
                          <Input value={modal.bgColor || ''} onChange={(e) => updateModal('bgColor', e.target.value)} placeholder="#ffffff or css color" />
                        </div>
                      </div>

                      {/* Show On Pages */}
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-2">Show On Pages</label>
                        <div className="flex flex-wrap gap-2">
                          {MODAL_PAGES.map((pg) => {
                            const isChecked = (modal.showOn || ['all']).includes(pg.value);
                            return (
                              <label key={pg.value} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                                isChecked ? 'bg-cyan-500 text-white border-cyan-500' : 'border-violet-200 text-slate-600 hover:border-cyan-300'
                              }`}>
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const cur = modal.showOn || ['all'];
                                    const next = e.target.checked ? [...cur, pg.value] : cur.filter((v) => v !== pg.value);
                                    updateModal('showOn', next.length ? next : ['all']);
                                  }}
                                />
                                {pg.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="border-t border-violet-100 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1"><MousePointerClick size={12} /> Buttons</span>
                          <button
                            type="button"
                            className="text-xs text-cyan-600 hover:underline"
                            onClick={() => updateModal('buttons', [...(modal.buttons || []), { ...defaultModalButton }])}
                          >
                            + Add Button
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(modal.buttons || []).map((btn, bi) => {
                            const updateBtn = (k, v) => {
                              const arr = [...modal.buttons];
                              arr[bi] = { ...arr[bi], [k]: v };
                              updateModal('buttons', arr);
                            };
                            return (
                              <div key={bi} className="grid grid-cols-4 gap-2 items-center">
                                <Input value={btn.label || ''} onChange={(e) => updateBtn('label', e.target.value)} placeholder="Label" />
                                <select value={btn.action || 'close'} onChange={(e) => updateBtn('action', e.target.value)} className="glass-input px-3 py-2 text-sm rounded-lg">
                                  <option value="close">Close</option>
                                  <option value="submit">Submit Form</option>
                                  <option value="decline">Decline / Lockout</option>
                                  <option value="url">Open URL</option>
                                </select>
                                <select value={btn.style || 'primary'} onChange={(e) => updateBtn('style', e.target.value)} className="glass-input px-3 py-2 text-sm rounded-lg">
                                  <option value="primary">Primary</option>
                                  <option value="secondary">Secondary</option>
                                  <option value="danger">Danger</option>
                                  <option value="outline">Outline</option>
                                </select>
                                <button
                                  onClick={() => updateModal('buttons', modal.buttons.filter((_, i) => i !== bi))}
                                  className="text-red-400/60 hover:text-red-400 flex justify-center"
                                ><Trash2 size={14} /></button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Form Fields */}
                      <div className="border-t border-violet-100 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-700">Collect Info (Form Fields)</span>
                          <button
                            type="button"
                            className="text-xs text-cyan-600 hover:underline"
                            onClick={() => updateModal('formFields', [...(modal.formFields || []), { ...defaultModalField }])}
                          >
                            + Add Field
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(modal.formFields || []).map((field, fi) => {
                            const updateField = (k, v) => {
                              const arr = [...modal.formFields];
                              arr[fi] = { ...arr[fi], [k]: v };
                              updateModal('formFields', arr);
                            };
                            return (
                              <div key={fi} className="grid grid-cols-4 gap-2 items-center">
                                <Input value={field.label || ''} onChange={(e) => updateField('label', e.target.value)} placeholder="Field Label" />
                                <Input value={field.placeholder || ''} onChange={(e) => updateField('placeholder', e.target.value)} placeholder="Placeholder" />
                                <select value={field.fieldType || 'text'} onChange={(e) => updateField('fieldType', e.target.value)} className="glass-input px-3 py-2 text-sm rounded-lg">
                                  <option value="text">Text</option>
                                  <option value="email">Email</option>
                                  <option value="phone">Phone</option>
                                  <option value="checkbox">Checkbox</option>
                                  <option value="select">Select</option>
                                  <option value="textarea">Textarea</option>
                                </select>
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                                    <input type="checkbox" checked={field.required || false} onChange={(e) => updateField('required', e.target.checked)} className="accent-cyan-400" />
                                    Req.
                                  </label>
                                  <button
                                    onClick={() => updateModal('formFields', modal.formFields.filter((_, i) => i !== fi))}
                                    className="text-red-400/60 hover:text-red-400"
                                  ><Trash2 size={14} /></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
