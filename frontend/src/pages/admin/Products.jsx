import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader, TabList, Textarea, CsvImport } from '../../components/ui';
import { productsAPI, categoriesAPI, unitsAPI, taxSlabsAPI, warehousesAPI, barcodeTypesAPI, brandsAPI } from '../../api';
import { Plus, Edit, Trash2, Eye, Package, Image, Layers, ArrowRight, RefreshCw, Warehouse } from 'lucide-react';

const emptyForm = {
  name: '', sku: '', description: '', type: 'single',
  categories: [], brand: '', unit: '', taxSlab: '', barcodeType: '', barcodeValue: '',
  costPrice: '', basePrice: '', compareAtPrice: '',
  lowStockThreshold: '', isFeatured: false, isActive: true, tags: '',
  variantAttribute: '',
};

const emptyVariantRow = { variantValue: '', name: '', sku: '', costPrice: '', basePrice: '', _autoName: true, _autoSku: true };

const typeOptions = [
  { value: 'single', label: 'Single' },
  { value: 'parent', label: 'Parent' },
];

const generateSlug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const generateRandomSku = (prefix = '') => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const pfx = prefix
    ? prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'PRD'
    : 'PRD';
  return `${pfx}-${rand}`;
};

export default function Products() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Inline variants for parent products (create/edit form)
  const [formVariants, setFormVariants] = useState([]);
  const [removedVariantIds, setRemovedVariantIds] = useState([]);

  // View modal
  const [viewProduct, setViewProduct] = useState(null);
  const [viewTab, setViewTab] = useState('variants');
  const [variants, setVariants] = useState([]);
  const [images, setImages] = useState([]);
  const [stock, setStock] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Add variant / image forms
  const [variantForm, setVariantForm] = useState({ name: '', sku: '', variantAttribute: '', variantValue: '', costPrice: '', basePrice: '' });
  const [imageForm, setImageForm] = useState({ url: '', altText: '', isPrimary: false });
  const [addingVariant, setAddingVariant] = useState(false);
  const [addingImage, setAddingImage] = useState(false);

  // Dropdown options
  const [categoryOpts, setCategoryOpts] = useState([]);
  const [unitOpts, setUnitOpts] = useState([]);
  const [taxSlabOpts, setTaxSlabOpts] = useState([]);
  const [barcodeTypeOpts, setBarcodeTypeOpts] = useState([]);
  const [brandOpts, setBrandOpts] = useState([]);

  // Stock summary & modal
  const [stockSummary, setStockSummary] = useState({});
  const [stockModalProduct, setStockModalProduct] = useState(null);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setChecked = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.checked }));

  // Load dropdown options once
  useEffect(() => {
    const load = async () => {
      try {
        const [cats, units, taxes, barcodes, brands] = await Promise.all([
          categoriesAPI.list(), unitsAPI.list(), taxSlabsAPI.list(), barcodeTypesAPI.list(), brandsAPI.list(),
        ]);
        setCategoryOpts((cats.data || []).map((c) => ({ value: c._id, label: c.name })));
        setUnitOpts((units.data || []).map((u) => ({ value: u._id, label: u.name })));
        setTaxSlabOpts((taxes.data || []).map((t) => ({ value: t._id, label: `${t.name} (${t.rate}%)` })));
        setBarcodeTypeOpts((barcodes.data || []).map((b) => ({ value: b._id, label: b.name })));
        setBrandOpts((brands.data || []).map((b) => ({ value: b._id, label: b.name })));
      } catch { /* silent */ }
    };
    load();
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      if (filterCat) params.category = filterCat;
      const [res, stockRes] = await Promise.all([
        productsAPI.list(params),
        productsAPI.stockSummary(),
      ]);
      setProducts(res.data?.products || []);
      setStockSummary(stockRes.data || {});
    } catch (err) {
      toast.error(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [toast, search, filterType, filterCat]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormVariants([]); setRemovedVariantIds([]); setModalOpen(true); };
  const openEdit = async (p) => {
    setEditing(p);
    setForm({
      name: p.name || '', sku: p.sku || '', description: p.description || '', type: p.type || 'single',
      categories: (p.categories || []).map(c => c._id || c), brand: p.brand?._id || p.brand || '',
      unit: p.unit?._id || p.unit || '',
      taxSlab: p.taxSlab?._id || p.taxSlab || '', barcodeType: p.barcodeType?._id || p.barcodeType || '',
      barcodeValue: p.barcodeValue || '',
      costPrice: p.costPrice ?? '', basePrice: p.basePrice ?? '',
      compareAtPrice: p.compareAtPrice ?? '',
      lowStockThreshold: p.lowStockThreshold ?? '', isFeatured: !!p.isFeatured, isActive: p.isActive !== false,
      tags: (p.tags || []).join(', '),
      variantAttribute: p.variantAttribute || '',
    });
    setRemovedVariantIds([]);
    if (p.type === 'parent') {
      try {
        const res = await productsAPI.get(p._id);
        setFormVariants((res.data?.variants || []).map(v => ({
          _id: v._id, name: v.name || '', sku: v.sku || '',
          variantValue: v.variantValue || '',
          costPrice: v.costPrice ?? '', basePrice: v.basePrice ?? '',
          _existing: true, _autoName: false, _autoSku: false,
        })));
      } catch { setFormVariants([]); }
    } else {
      setFormVariants([]);
    }
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); setFormVariants([]); setRemovedVariantIds([]); };

  /* ───── INLINE VARIANT HELPERS ───── */
  const addFormVariant = () => setFormVariants(prev => [
    ...prev,
    {
      ...emptyVariantRow,
      costPrice: form.costPrice || '',
      basePrice: form.basePrice || '',
      sku: generateRandomSku(form.sku || form.name),
    },
  ]);
  const removeFormVariant = (idx) => {
    const v = formVariants[idx];
    if (v._existing && v._id) setRemovedVariantIds(prev => [...prev, v._id]);
    setFormVariants(prev => prev.filter((_, i) => i !== idx));
  };
  const updateFormVariant = (idx, field, value) => {
    setFormVariants(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'variantValue' && value && !next[idx]._existing) {
        if (next[idx]._autoName) next[idx].name = `${form.name} - ${value}`;
        // SKU stays random (only regenerate if still at default random)
      }
      if (field === 'name') next[idx]._autoName = false;
      if (field === 'sku') next[idx]._autoSku = false;
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.sku.trim()) return toast.error('SKU is required');
    if (form.type === 'parent' && formVariants.length > 0) {
      const bad = formVariants.find(v => !v.name?.trim() || !v.sku?.trim());
      if (bad) return toast.error('All variants need a name and SKU');
    }
    try {
      setSaving(true);
      const payload = {
        ...form,
        slug: generateSlug(form.name),
        costPrice: Number(form.costPrice) || 0,
        basePrice: Number(form.basePrice) || 0,
        compareAtPrice: Number(form.compareAtPrice) || 0,
        lowStockThreshold: Number(form.lowStockThreshold) || 0,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      };
      if (!payload.categories?.length) delete payload.categories;
      ['unit', 'taxSlab', 'barcodeType', 'brand'].forEach((k) => { if (!payload[k]) delete payload[k]; });
      if (form.type !== 'parent') delete payload.variantAttribute;

      let parentId;
      if (editing) {
        await productsAPI.update(editing._id, payload);
        parentId = editing._id;
        toast.success('Product updated');
      } else {
        const res = await productsAPI.create(payload);
        parentId = res.data?._id;
        toast.success('Product created');
      }

      // Handle variants for parent products
      if (form.type === 'parent' && parentId) {
        // Delete removed existing variants
        for (const vid of removedVariantIds) {
          try { await productsAPI.deleteVariant(parentId, vid); } catch { /* skip */ }
        }
        // Create new variants
        const newVars = formVariants.filter(v => !v._existing);
        let created = 0;
        for (const v of newVars) {
          try {
            await productsAPI.addVariant(parentId, {
              name: v.name, sku: v.sku,
              variantAttribute: form.variantAttribute,
              variantValue: v.variantValue,
              costPrice: Number(v.costPrice) || 0,
              basePrice: Number(v.basePrice) || 0,
              slug: generateSlug(v.name),
            });
            created++;
          } catch (err) {
            toast.error(`Variant "${v.name}": ${err.message || 'Failed'}`);
          }
        }
        if (created > 0) toast.success(`${created} variant(s) created`);
      }

      closeModal();
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await productsAPI.delete(deleteTarget._id);
      toast.success('Product deleted');
      setDeleteTarget(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  // View product detail
  const openView = async (p) => {
    setViewProduct(p);
    setViewTab('variants');
    setVariants([]);
    setImages(p.images || []);
    setStock([]);
    setViewLoading(true);
    try {
      const full = await productsAPI.get(p._id);
      const prod = full.data?.product || full.data;
      setViewProduct(prod);
      setImages(prod?.images || []);
      setVariants(full.data?.variants || []);
      setStock(full.data?.stocks || []);
    } catch { /* silent */ }
    setViewLoading(false);
  };
  const closeView = () => { setViewProduct(null); };

  const handleAddVariant = async () => {
    if (!variantForm.name.trim() || !variantForm.sku.trim()) return toast.error('Name and SKU required');
    try {
      setAddingVariant(true);
      await productsAPI.addVariant(viewProduct._id, {
        ...variantForm,
        slug: generateSlug(variantForm.name),
        costPrice: Number(variantForm.costPrice) || 0,
        basePrice: Number(variantForm.basePrice) || 0,
      });
      toast.success('Variant added');
      setVariantForm({ name: '', sku: '', variantAttribute: '', variantValue: '', costPrice: '', basePrice: '' });
      const fullRes = await productsAPI.get(viewProduct._id);
      setVariants(fullRes.data?.variants || []);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to add variant');
    } finally {
      setAddingVariant(false);
    }
  };

  const handleAddImage = async () => {
    if (!imageForm.url.trim()) return toast.error('Image URL required');
    try {
      setAddingImage(true);
      await productsAPI.addImages(viewProduct._id, { images: [imageForm] });
      toast.success('Image added');
      setImageForm({ url: '', altText: '', isPrimary: false });
      const full = await productsAPI.get(viewProduct._id);
      setImages((full.data?.product || full.data)?.images || []);
    } catch (err) {
      toast.error(err.message || 'Failed to add image');
    } finally {
      setAddingImage(false);
    }
  };

  const handleDeleteVariant = async (variantId) => {
    try {
      await productsAPI.deleteVariant(viewProduct._id, variantId);
      toast.success('Variant deleted');
      setVariants(prev => prev.filter(v => v._id !== variantId));
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to delete variant');
    }
  };

  const handleRemoveImage = async (imageId) => {
    try {
      await productsAPI.removeImage(viewProduct._id, imageId);
      toast.success('Image removed');
      setImages(prev => prev.filter(img => img._id !== imageId));
    } catch (err) {
      toast.error(err.message || 'Failed to remove image');
    }
  };

  // Filters
  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
  });

  const PRODUCT_CSV_COLS = [
    { key: 'name', label: 'Name' },
    { key: 'sku', label: 'SKU' },
    { key: 'description', label: 'Description' },
    { key: 'type', label: 'Type (single/parent/variant)' },
    { key: 'parent_sku', label: 'Parent SKU (for variants)' },
    { key: 'variant_attribute', label: 'Variant Attribute (e.g. Color)' },
    { key: 'variant_value', label: 'Variant Value (e.g. Red)' },
    { key: 'base_price', label: 'Base Price' },
    { key: 'cost_price', label: 'Cost Price' },
    { key: 'compare_at_price', label: 'Compare At Price' },
    { key: 'tags', label: 'Tags (comma-separated)' },
  ];
  const PRODUCT_CSV_SAMPLE = [
    { name: 'T-Shirt', sku: 'TS-001', description: 'Basic T-Shirt', type: 'parent', parent_sku: '', variant_attribute: '', variant_value: '', base_price: '499', cost_price: '200', compare_at_price: '599', tags: 'clothing,new' },
    { name: 'T-Shirt - Red', sku: 'TS-001-RED', description: 'Red T-Shirt', type: 'variant', parent_sku: 'TS-001', variant_attribute: 'Color', variant_value: 'Red', base_price: '499', cost_price: '200', compare_at_price: '599', tags: '' },
    { name: 'T-Shirt - Blue', sku: 'TS-001-BLU', description: 'Blue T-Shirt', type: 'variant', parent_sku: 'TS-001', variant_attribute: 'Color', variant_value: 'Blue', base_price: '499', cost_price: '200', compare_at_price: '599', tags: '' },
    { name: 'Sample Widget', sku: 'WGT-001', description: 'A sample widget', type: 'single', parent_sku: '', variant_attribute: '', variant_value: '', base_price: '299', cost_price: '150', compare_at_price: '349', tags: 'new,featured' },
  ];
  const handleCsvImport = async (rows) => {
    let ok = 0, fail = 0;

    // Pass 1: Create single & parent products first
    const nonVariants = rows.filter((r) => r.type !== 'variant');
    const variantRows = rows.filter((r) => r.type === 'variant');

    for (const row of nonVariants) {
      if (!row.name?.trim() || !row.sku?.trim()) { fail++; continue; }
      try {
        await productsAPI.create({
          name: row.name.trim(), sku: row.sku.trim(),
          description: row.description || '',
          type: ['single', 'parent'].includes(row.type) ? row.type : 'single',
          basePrice: Number(row.base_price) || 0,
          costPrice: Number(row.cost_price) || 0,
          compareAtPrice: Number(row.compare_at_price) || 0,
          tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
          isActive: true,
        });
        ok++;
      } catch { fail++; }
    }

    // Pass 2: Fetch all products to resolve parent SKU → ID
    let allProducts = [];
    if (variantRows.length > 0) {
      try {
        const res = await productsAPI.list({ limit: 9999 });
        allProducts = res.data?.products || [];
      } catch { /* silent */ }
    }

    // Pass 3: Create variants linked to parents
    for (const row of variantRows) {
      if (!row.name?.trim() || !row.sku?.trim() || !row.parent_sku?.trim()) { fail++; continue; }
      const parent = allProducts.find((p) => p.sku === row.parent_sku.trim());
      if (!parent) { fail++; continue; }
      try {
        await productsAPI.addVariant(parent._id, {
          name: row.name.trim(), sku: row.sku.trim(),
          description: row.description || '',
          variantAttribute: row.variant_attribute || '',
          variantValue: row.variant_value || '',
          basePrice: Number(row.base_price) || 0,
          costPrice: Number(row.cost_price) || 0,
          compareAtPrice: Number(row.compare_at_price) || 0,
          tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
          isActive: true,
        });
        ok++;
      } catch { fail++; }
    }

    toast.success(`Imported ${ok} product${ok !== 1 ? 's' : ''}${fail ? `, ${fail} skipped` : ''}`);
    fetchProducts();
  };

  const columns = [
    { key: 'name', label: 'Product', render: (r) => (
      <div className="flex items-center gap-2">
        {r.images?.[0]?.url ? (
          <img src={r.images[0].url} alt={r.images[0].altText || r.name} className="w-8 h-8 rounded object-cover border border-violet-100" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
        ) : (
          <Package size={14} className="text-violet-600" />
        )}
        <div>
          <span className="text-slate-800 font-medium">{r.name}</span>
          {r.type === 'variant' && r.parentProduct && (
            <span className="block text-[10px] text-purple-400">↳ variant of {r.parentProduct?.name || 'parent'}</span>
          )}
        </div>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); openView(r); }}><Eye size={16} /></Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>
        <Button variant="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>
      </div>
    )},
    { key: 'sku', label: 'SKU Code', render: (r) => (
      <span className="font-mono text-xs text-violet-600/80">{r.sku || '—'}</span>
    )},
    { key: 'brand', label: 'Brand', render: (r) => (
      <span className="text-slate-500">{r.brand?.name || '—'}</span>
    )},
    { key: 'type', label: 'Type', render: (r) => (
      <Badge color={r.type === 'parent' ? 'purple' : 'gray'}>{r.type}</Badge>
    )},
    { key: 'categories', label: 'Category', render: (r) => (
      <span className="text-slate-500">{r.categories?.[0]?.name || '—'}</span>
    )},
    { key: 'costPrice', label: 'Cost', render: (r) => (
      r.type === 'parent' ? <span className="text-gray-400 text-xs">—</span> : <span className="text-gray-500 text-xs">₹{Number(r.costPrice || 0).toLocaleString()}</span>
    )},
    { key: 'basePrice', label: 'Price', render: (r) => (
      r.type === 'parent' ? <span className="text-gray-400 text-xs">—</span> : <span className="text-slate-800 font-medium">₹{Number(r.basePrice || 0).toLocaleString()}</span>
    )},
    { key: 'stock', label: 'Stock', render: (r) => {
      const s = stockSummary[r._id];
      const total = s?.total ?? 0;
      const inStock = total > 0;
      return (
        <button
          onClick={(e) => { e.stopPropagation(); setStockModalProduct(r); }}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
            inStock
              ? 'text-green-400 border-green-500/20 bg-green-500/10 hover:bg-green-500/20'
              : 'text-red-400 border-red-500/20 bg-red-500/10 hover:bg-red-500/20'
          }`}
          title="Click for warehouse details"
        >
          <Warehouse size={10} />
          {inStock ? total : 'Out of Stock'}
        </button>
      );
    }},
    { key: 'isActive', label: 'Status', render: (r) => (
      <Badge color={r.isActive !== false ? 'green' : 'red'}>{r.isActive !== false ? 'Active' : 'Inactive'}</Badge>
    )},
  ];

  const viewTabs = [
    { id: 'variants', label: 'Variants' },
    { id: 'images', label: 'Images' },
    { id: 'stock', label: 'Stock' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        subtitle="Manage products, variants & images"
        actions={
          <div className="flex items-center gap-2">
            <CsvImport columns={PRODUCT_CSV_COLS} onImport={handleCsvImport} sampleRows={PRODUCT_CSV_SAMPLE} label="Import CSV" />
            <Button onClick={openCreate}><Plus size={16} /> Add Product</Button>
          </div>
        }
      />

      <GlassCard>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search products..." className="max-w-xs" />
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            options={[{ value: 'single', label: 'Single' }, { value: 'parent', label: 'Parent' }]}
            placeholder="All Types" className="w-36" />
          <Select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
            options={categoryOpts} placeholder="All Categories" className="w-44" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No products found" />
      </GlassCard>

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Product' : 'Create Product'} size="lg"
        footer={<><Button variant="ghost" onClick={closeModal}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button></>}
      >
        <div className="space-y-5">
          <div>
            <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-3">Basic Info</h4>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Product name" />
              <div className="col-span-2">
                <div className="flex gap-1.5 items-end">
                  <Input label="SKU" value={form.sku} onChange={set('sku')} placeholder="PRD-001" className="flex-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Generate random SKU"
                    onClick={() => setForm(p => ({ ...p, sku: generateRandomSku(p.name) }))}
                    className="mb-0 flex-shrink-0"
                  >
                    <RefreshCw size={13} />
                  </Button>
                </div>
              </div>
              <div className="col-span-2"><Textarea label="Description" value={form.description} onChange={set('description')} placeholder="Product description" /></div>
              <Select label="Type" value={form.type} onChange={set('type')} options={typeOptions} />
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-3">Classification</h4>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Category" value={form.categories?.[0] || ''} onChange={(e) => setForm(p => ({ ...p, categories: e.target.value ? [e.target.value] : [] }))} options={categoryOpts} placeholder="Select category" />
              <Select label="Brand" value={form.brand} onChange={set('brand')} options={brandOpts} placeholder="Select brand" />
              <Select label="Unit" value={form.unit} onChange={set('unit')} options={unitOpts} placeholder="Select unit" />
              <Select label="Tax Slab" value={form.taxSlab} onChange={set('taxSlab')} options={taxSlabOpts} placeholder="Select tax slab" />
              <Select label="Barcode Type" value={form.barcodeType} onChange={set('barcodeType')} options={barcodeTypeOpts} placeholder="Select type" />
              <Input label="Barcode Value" value={form.barcodeValue} onChange={set('barcodeValue')} placeholder="Barcode value" />
            </div>
          </div>
          {form.type !== 'parent' && (
          <div>
            <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-3">Pricing</h4>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cost Price" type="number" value={form.costPrice} onChange={set('costPrice')} placeholder="0" />
              <Input label="Base Price" type="number" value={form.basePrice} onChange={set('basePrice')} placeholder="0" />
              <Input label="Compare At Price" type="number" value={form.compareAtPrice} onChange={set('compareAtPrice')} placeholder="0" />
            </div>
          </div>
          )}
          {form.type === 'parent' && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Parent products are not sellable directly. Pricing is set on each variant instead.
            </p>
          )}
          <div>
            <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-3">Settings</h4>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Low Stock Threshold" type="number" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} placeholder="10" />
              <Input label="Tags (comma separated)" value={form.tags} onChange={set('tags')} placeholder="electronics, sale" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isFeatured} onChange={setChecked('isFeatured')} className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-transparent" />
                <span className="text-sm text-slate-600">Featured</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={setChecked('isActive')} className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-transparent" />
                <span className="text-sm text-slate-600">Active</span>
              </label>
            </div>
          </div>

          {/* ── Variants Section (only for parent type) ── */}
          {form.type === 'parent' && (
            <div>
              <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-3">
                <Layers size={14} className="inline mr-1" />Variants
              </h4>
              <Input label="Variant Attribute (shared)" value={form.variantAttribute} onChange={set('variantAttribute')} placeholder="e.g. Color, Size, Material" className="mb-4 max-w-xs" />

              {formVariants.length > 0 && (
                <div className="space-y-2 mb-3">
                  {/* Column headers */}
                  <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 font-medium px-1">
                    <span className="col-span-2">Value</span>
                    <span className="col-span-3">Name</span>
                    <span className="col-span-3">SKU</span>
                    <span className="col-span-1">Cost</span>
                    <span className="col-span-2">Price</span>
                    <span className="col-span-1"></span>
                  </div>
                  {formVariants.map((v, idx) => (
                    <div key={idx} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg ${v._existing ? 'bg-violet-50/50 border border-violet-100' : 'bg-cyan-500/[0.04] border border-cyan-500/[0.1]'}`}>
                      <div className="col-span-2">
                        <Input value={v.variantValue} onChange={(e) => updateFormVariant(idx, 'variantValue', e.target.value)} placeholder="Red" disabled={v._existing} />
                      </div>
                      <div className="col-span-3">
                        <Input value={v.name} onChange={(e) => updateFormVariant(idx, 'name', e.target.value)} placeholder="Product - Red" disabled={v._existing} />
                      </div>
                      <div className="col-span-3">
                        <Input value={v.sku} onChange={(e) => updateFormVariant(idx, 'sku', e.target.value)} placeholder="PRD-RED" disabled={v._existing} />
                      </div>
                      <div className="col-span-1">
                        <Input type="number" value={v.costPrice} onChange={(e) => updateFormVariant(idx, 'costPrice', e.target.value)} disabled={v._existing} />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" value={v.basePrice} onChange={(e) => updateFormVariant(idx, 'basePrice', e.target.value)} disabled={v._existing} />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <Button size="xs" variant="ghost" className="text-red-400" onClick={() => removeFormVariant(idx)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button size="sm" variant="ghost" onClick={addFormVariant}>
                <Plus size={14} className="mr-1" /> Add Variant
              </Button>

              {formVariants.length === 0 && (
                <p className="text-xs text-gray-500 mt-2">Click "Add Variant" to create variants for this parent product.</p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* View Product Detail Modal */}
      <Modal open={!!viewProduct} onClose={closeView} title={viewProduct?.name || 'Product Detail'} size="lg">
        {viewLoading ? <Loader /> : viewProduct && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-gray-500">SKU:</span> <span className="text-slate-800 ml-1">{viewProduct.sku}</span></div>
              <div><span className="text-gray-500">Type:</span> <Badge color="blue" className="ml-1">{viewProduct.type}</Badge></div>
              <div><span className="text-gray-500">Category:</span> <span className="text-slate-800 ml-1">{viewProduct.categories?.[0]?.name || '—'}</span></div>
              <div><span className="text-gray-500">Base Price:</span> <span className="text-violet-600 ml-1">₹{viewProduct.basePrice}</span></div>
              <div><span className="text-gray-500">Cost:</span> <span className="text-slate-800 ml-1">₹{viewProduct.costPrice}</span></div>
              <div><span className="text-gray-500">Compare At:</span> <span className="text-slate-800 ml-1">₹{viewProduct.compareAtPrice}</span></div>
            </div>

            <TabList tabs={viewTabs} active={viewTab} onChange={setViewTab} />

            {viewTab === 'variants' && (
              <div className="space-y-3">
                {variants.length > 0 ? (
                  <div className="space-y-2">
                    {variants.map((v) => (
                      <div key={v._id} className="flex items-center justify-between p-3 rounded-lg bg-violet-50/50 border border-violet-100">
                        <div>
                          <span className="text-slate-800 text-sm font-medium">{v.name}</span>
                          <span className="text-gray-500 text-xs ml-2">{v.sku}</span>
                          {v.variantAttribute && <Badge color="purple" className="ml-2">{v.variantAttribute}: {v.variantValue}</Badge>}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right text-xs">
                            <span className="text-gray-500">Cost: ₹{v.costPrice}</span>
                            <span className="text-violet-600 ml-3 font-medium">₹{v.basePrice}</span>
                          </div>
                          <Button size="xs" variant="ghost" className="text-red-400" onClick={() => handleDeleteVariant(v._id)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-500 text-sm">No variants yet.</p>}
                {viewProduct.type === 'parent' && (
                  <div className="pt-3 border-t border-violet-100">
                    <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Add Variant</h5>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Name" value={variantForm.name} onChange={(e) => setVariantForm((p) => ({ ...p, name: e.target.value }))} />
                      <Input placeholder="SKU" value={variantForm.sku} onChange={(e) => setVariantForm((p) => ({ ...p, sku: e.target.value }))} />
                      <Input placeholder="Attribute (e.g. color)" value={variantForm.variantAttribute} onChange={(e) => setVariantForm((p) => ({ ...p, variantAttribute: e.target.value }))} />
                      <Input placeholder="Value (e.g. Red)" value={variantForm.variantValue} onChange={(e) => setVariantForm((p) => ({ ...p, variantValue: e.target.value }))} />
                      <Input placeholder="Cost Price" type="number" value={variantForm.costPrice} onChange={(e) => setVariantForm((p) => ({ ...p, costPrice: e.target.value }))} />
                      <Input placeholder="Base Price" type="number" value={variantForm.basePrice} onChange={(e) => setVariantForm((p) => ({ ...p, basePrice: e.target.value }))} />
                    </div>
                    <Button className="mt-2" onClick={handleAddVariant} loading={addingVariant}><Layers size={14} /> Add Variant</Button>
                  </div>
                )}
              </div>
            )}

            {viewTab === 'images' && (
              <div className="space-y-3">
                {images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {images.map((img, i) => (
                      <div key={img._id || i} className="relative rounded-lg overflow-hidden border border-violet-100 bg-violet-50/50 aspect-square flex items-center justify-center group">
                        <img src={img.url} alt={img.altText || ''} className="max-h-full max-w-full object-contain" />
                        {img.isPrimary && <Badge color="cyan" className="absolute top-1 right-1 text-[10px]">Primary</Badge>}
                        <button
                          className="absolute top-1 left-1 bg-red-500/80 hover:bg-red-500 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveImage(img._id)}
                        >
                          <Trash2 size={12} className="text-slate-800" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-500 text-sm">No images yet.</p>}
                <div className="pt-3 border-t border-violet-100">
                  <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Add Image</h5>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Image URL" value={imageForm.url} onChange={(e) => setImageForm((p) => ({ ...p, url: e.target.value }))} />
                    <Input placeholder="Alt text" value={imageForm.altText} onChange={(e) => setImageForm((p) => ({ ...p, altText: e.target.value }))} />
                    <label className="flex items-center gap-2 cursor-pointer self-center">
                      <input type="checkbox" checked={imageForm.isPrimary} onChange={(e) => setImageForm((p) => ({ ...p, isPrimary: e.target.checked }))} className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-transparent" />
                      <span className="text-sm text-slate-600">Primary</span>
                    </label>
                  </div>
                  <Button className="mt-2" onClick={handleAddImage} loading={addingImage}><Image size={14} /> Add Image</Button>
                </div>
              </div>
            )}

            {viewTab === 'stock' && (
              <div className="space-y-2">
                {stock.length > 0 ? stock.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-violet-50/50 border border-violet-100">
                    <span className="text-slate-800 text-sm">{s.warehouse?.name || s.warehouseName || 'Warehouse'}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-500">Qty: <span className="text-slate-800 font-medium">{s.quantity ?? s.qty ?? 0}</span></span>
                      <span className="text-slate-500">Reserved: <span className="text-yellow-400">{s.reserved ?? 0}</span></span>
                    </div>
                  </div>
                )) : <p className="text-gray-500 text-sm">No stock data available.</p>}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />

      {/* Stock per Warehouse Modal */}
      <Modal open={!!stockModalProduct} onClose={() => setStockModalProduct(null)} title={`Stock — ${stockModalProduct?.name || ''}`} size="md">
        {stockModalProduct && (() => {
          const s = stockSummary[stockModalProduct._id];
          if (!s || !s.warehouses?.length) {
            return (
              <div className="text-center py-8">
                <Warehouse size={36} className="mx-auto text-gray-700 mb-3" />
                <p className="text-sm text-gray-500">No stock data available</p>
                <p className="text-[10px] text-gray-600 mt-1">Stock has not been set for this product in any warehouse.</p>
              </div>
            );
          }
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs text-gray-500">Combined Total</span>
                <span className={`text-sm font-bold ${s.total > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {s.total > 0 ? `${s.total} units` : 'Out of Stock'}
                </span>
              </div>
              {s.warehouses.map((w, i) => (
                <div key={w.warehouseId || i} className="flex items-center justify-between p-3 rounded-lg bg-violet-50/50 border border-violet-100">
                  <div className="flex items-center gap-2">
                    <Warehouse size={14} className="text-violet-600" />
                    <div>
                      <span className="text-slate-800 text-sm font-medium">{w.warehouseName}</span>
                      {w.warehouseCode && <span className="text-gray-600 text-xs ml-2">({w.warehouseCode})</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">Qty: <span className={`font-medium ${w.quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>{w.quantity}</span></span>
                    {w.reserved > 0 && <span className="text-slate-500">Reserved: <span className="text-yellow-400">{w.reserved}</span></span>}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
