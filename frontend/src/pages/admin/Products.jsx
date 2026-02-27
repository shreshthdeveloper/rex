import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader, Textarea, CsvImport } from '../../components/ui';
import { productsAPI, categoriesAPI, unitsAPI, taxSlabsAPI, warehousesAPI, barcodeTypesAPI, brandsAPI, stockAPI, uploadAPI } from '../../api';
import { Plus, Edit, Trash2, Eye, Image, Layers, RefreshCw, Warehouse, CheckCheck, Camera, X } from 'lucide-react';

const emptyForm = {
  name: '', sku: '', description: '', type: 'single',
  categories: [], brand: '', unit: '', taxSlab: '', barcodeType: '', barcodeValue: '',
  costPrice: '', basePrice: '', compareAtPrice: '',
  lowStockThreshold: '', isFeatured: false, isActive: true, tags: '',
  variantAttribute: '',
};

const emptyVariantRow = { variantValue: '', name: '', sku: '', costPrice: '', basePrice: '', _autoName: true, _autoSku: true, openingQty: '', images: [], _removedImageIds: [] };

const typeOptions = [
  { value: 'single', label: 'Single' },
  { value: 'parent', label: 'Parent' },
];

const generateSlug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const PAGE_SIZE = 20;

const generateRandomSku = (prefix = '') => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const pfx = prefix
    ? prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'PRD'
    : 'PRD';
  return `${pfx}-${rand}`;
};

const productInitialColor = (name) => {
  const palette = [
    'bg-violet-100 text-violet-700', 'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700',
    'bg-indigo-100 text-indigo-700', 'bg-pink-100 text-pink-700',
  ];
  return palette[(name?.charCodeAt(0) || 0) % palette.length];
};

export default function Products() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });
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
  const [variants, setVariants] = useState([]);
  const [images, setImages] = useState([]);
  const [stock, setStock] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Dropdown options
  const [categoryOpts, setCategoryOpts] = useState([]);
  const [unitOpts, setUnitOpts] = useState([]);
  const [taxSlabOpts, setTaxSlabOpts] = useState([]);
  const [barcodeTypeOpts, setBarcodeTypeOpts] = useState([]);
  const [brandOpts, setBrandOpts] = useState([]);

  // Stock summary & modal
  const [stockSummary, setStockSummary] = useState({});
  const [stockModalProduct, setStockModalProduct] = useState(null);

  // Opening stock on create
  const [warehouseList, setWarehouseList] = useState([]);
  const [openingStockRows, setOpeningStockRows] = useState([]);
  const [parentOpeningWhId, setParentOpeningWhId] = useState('');
  // Per-warehouse per-variant qty map: { [warehouseId]: { [sku]: qty } }
  const [variantOpeningStock, setVariantOpeningStock] = useState({});

  // Variant image panel expand/collapse
  const [expandedVariantImageIdx, setExpandedVariantImageIdx] = useState(null);

  // Product image management in create/edit form
  const [formImages, setFormImages] = useState([]);       // { url, altText, isPrimary, _existingId }
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageInputMode, setImageInputMode] = useState('upload'); // 'upload' | 'url'
  const [productUrlInput, setProductUrlInput] = useState('');
  const productFileRef = useRef(null);
  const skuEditedRef = useRef(false); // tracks if user manually edited SKU

  // Variant image upload
  const [uploadingVariantIdx, setUploadingVariantIdx] = useState(null);
  const variantFileRef = useRef(null);

  // Parent stock modal: lazy-loaded variant list
  const [stockModalVariants, setStockModalVariants] = useState([]);
  const [stockModalLoading, setStockModalLoading] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setChecked = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.checked }));

  // Load dropdown options once
  useEffect(() => {
    const load = async () => {
      try {
        const [cats, units, taxes, barcodes, brands, whs] = await Promise.all([
          categoriesAPI.list(), unitsAPI.list(), taxSlabsAPI.list(), barcodeTypesAPI.list(), brandsAPI.list(),
          warehousesAPI.list(),
        ]);
        setCategoryOpts((cats.data || []).map((c) => ({ value: c._id, label: c.name })));
        setUnitOpts((units.data || []).map((u) => ({ value: u._id, label: u.name })));
        setTaxSlabOpts((taxes.data || []).map((t) => ({ value: t._id, label: `${t.name} (${t.rate}%)` })));
        setBarcodeTypeOpts((barcodes.data || []).map((b) => ({ value: b._id, label: b.name })));
        setBrandOpts((brands.data || []).map((b) => ({ value: b._id, label: b.name })));
        const warehouses = whs.data?.warehouses || whs.data || [];
        setWarehouseList(warehouses);
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
      params.page = page;
      params.limit = PAGE_SIZE;
      const [res, stockRes] = await Promise.all([
        productsAPI.list(params),
        productsAPI.stockSummary(),
      ]);
      setProducts(res.data?.products || []);
      setPagination(res.data?.pagination || { total: 0, page, pages: 1, limit: PAGE_SIZE });
      setStockSummary(stockRes.data || {});
    } catch (err) {
      toast.error(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterCat, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(1); }, [search, filterType, filterCat]);

  // When stock modal opens on a parent product, lazy-load its variants
  useEffect(() => {
    if (stockModalProduct?.type === 'parent') {
      setStockModalLoading(true);
      productsAPI.get(stockModalProduct._id)
        .then(res => setStockModalVariants(res.data?.variants || []))
        .catch(() => setStockModalVariants([]))
        .finally(() => setStockModalLoading(false));
    } else {
      setStockModalVariants([]);
    }
  }, [stockModalProduct]);

  const openCreate = () => {
    setEditing(null);
    skuEditedRef.current = false;
    setForm(emptyForm);
    setFormVariants([]);
    setRemovedVariantIds([]);
    setFormImages([]);
    setRemovedImageIds([]);
    setImageInputMode('upload');
    setProductUrlInput('');
    setOpeningStockRows(warehouseList.map(w => ({ warehouseId: w._id, warehouseName: w.name, warehouseCode: w.code, quantity: '' })));
    setParentOpeningWhId(warehouseList[0]?._id || '');
    setVariantOpeningStock({});
    setModalOpen(true);
  };
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
          images: (v.images || []).map(img => ({ url: img.url, _existingId: img._id || null })),
          _removedImageIds: [],
        })));
      } catch { setFormVariants([]); }
    } else {
      setFormVariants([]);
    }
    setFormImages((p.images || []).map(img => ({ url: img.url, altText: img.altText || '', isPrimary: !!img.isPrimary, _existingId: img._id })));
    setRemovedImageIds([]);
    skuEditedRef.current = true;
    setImageInputMode('upload');
    setProductUrlInput('');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); setFormVariants([]); setRemovedVariantIds([]); setFormImages([]); setRemovedImageIds([]); setOpeningStockRows([]); setParentOpeningWhId(''); setVariantOpeningStock({}); setImageInputMode('upload'); setProductUrlInput(''); };

  /* ───── INLINE VARIANT HELPERS ───── */
  const addFormVariant = () => setFormVariants(prev => [
    ...prev,
    {
      ...emptyVariantRow,
      costPrice: form.costPrice || '',
      basePrice: form.basePrice || '',
      sku: generateRandomSku(form.sku || form.name),
      openingQty: '',
    },
  ]);

  // Copy an opening stock column value across all variant rows
  const copyOpeningToAll = (field, value) => {
    setFormVariants(prev => prev.map(v => ({ ...v, [field]: value })));
  };
  const removeFormVariant = (idx) => {
    const v = formVariants[idx];
    if (v._existing && v._id) setRemovedVariantIds(prev => [...prev, v._id]);
    setFormVariants(prev => prev.filter((_, i) => i !== idx));
  };
  const updateFormVariant = (idx, field, value) => {
    setFormVariants(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (next[idx]._existing) next[idx]._modified = true;
      if (field === 'variantValue' && value && !next[idx]._existing) {
        if (next[idx]._autoName) next[idx].name = `${form.name} - ${value}`;
      }
      if (field === 'name') next[idx]._autoName = false;
      if (field === 'sku') next[idx]._autoSku = false;
      return next;
    });
  };

  // Copy a cost/price field to all variant rows (marks existing as modified)
  const copyVariantToAll = (field, value) => {
    setFormVariants(prev => prev.map(v => ({ ...v, [field]: value, ...(v._existing ? { _modified: true } : {}) })));
  };

  /* ───── IMAGE UPLOAD HELPERS ───── */
  const handleProductImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const res = await uploadAPI.upload(file);
      const url = res.data?.url;
      if (url) setFormImages(prev => [...prev, { url, altText: '', isPrimary: prev.length === 0, _existingId: null }]);
    } catch { toast.error('Image upload failed'); }
    finally { setUploadingImage(false); if (productFileRef.current) productFileRef.current.value = ''; }
  };

  const handleRemoveFormImage = (existingId, pendingIdx) => {
    if (existingId) {
      setRemovedImageIds(prev => [...prev, existingId]);
      setFormImages(prev => prev.filter(img => img._existingId !== existingId));
    } else {
      setFormImages(prev => prev.filter((_, i) => i !== pendingIdx));
    }
  };

  const handleAddImageUrl = () => {
    const url = productUrlInput.trim();
    if (!url) return;
    setFormImages(prev => [...prev, { url, altText: '', isPrimary: prev.length === 0, _existingId: null }]);
    setProductUrlInput('');
  };

  const handleVariantImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || uploadingVariantIdx === null) return;
    const idx = uploadingVariantIdx;
    try {
      setUploadingImage(true);
      const res = await uploadAPI.upload(file);
      const url = res.data?.url;
      if (url) {
        setFormVariants(prev => {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            images: [...(next[idx].images || []), { url, _existingId: null }],
            ...(next[idx]._existing ? { _modified: true } : {}),
          };
          return next;
        });
      }
    } catch { toast.error('Image upload failed'); }
    finally { setUploadingImage(false); setUploadingVariantIdx(null); if (variantFileRef.current) variantFileRef.current.value = ''; }
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

      // Handle product-level images (removals + new uploads)
      if (parentId) {
        for (const imgId of removedImageIds) {
          try { await productsAPI.removeImage(parentId, imgId); } catch { /* silent */ }
        }
        const pendingImages = formImages.filter(img => !img._existingId);
        if (pendingImages.length > 0) {
          try {
            await productsAPI.addImages(parentId, {
              images: pendingImages.map(img => ({ url: img.url, altText: img.altText || '', isPrimary: img.isPrimary || false })),
            });
          } catch { /* silent */ }
        }
      }

      // Handle variants for parent products
      // skuToVariantId maps newly created variant SKUs → their DB _id for opening stock
      const skuToVariantId = {};
      if (form.type === 'parent' && parentId) {
        // Delete removed existing variants
        for (const vid of removedVariantIds) {
          try { await productsAPI.deleteVariant(parentId, vid); } catch { /* skip */ }
        }
        // Create new variants — capture each returned _id keyed by sku
        const newVars = formVariants.filter(v => !v._existing);
        let created = 0;
        for (const v of newVars) {
          try {
            const varRes = await productsAPI.addVariant(parentId, {
              name: v.name, sku: v.sku,
              variantAttribute: form.variantAttribute,
              variantValue: v.variantValue,
              costPrice: Number(v.costPrice) || 0,
              basePrice: Number(v.basePrice) || 0,
              slug: generateSlug(v.name),
            });
            created++;
            const variantId = varRes.data?._id;
            if (variantId && v.sku) skuToVariantId[v.sku] = variantId;
            // Save variant images (multiple supported)
            const pendingVarImages = (v.images || []).filter(img => !img._existingId);
            if (variantId && pendingVarImages.length > 0) {
              try { await productsAPI.addImages(variantId, { images: pendingVarImages.map((img, i) => ({ url: img.url, isPrimary: i === 0 })) }); } catch { /* silent */ }
            }
          } catch (err) {
            toast.error(`Variant "${v.name}": ${err.message || 'Failed'}`);
          }
        }
        if (created > 0) toast.success(`${created} variant(s) created`);

        // Update modified existing variants
        const modifiedVars = formVariants.filter(v => v._existing && v._modified && v._id);
        let updated = 0;
        for (const v of modifiedVars) {
          try {
            await productsAPI.updateVariant(parentId, v._id, {
              name: v.name,
              costPrice: Number(v.costPrice) || 0,
              basePrice: Number(v.basePrice) || 0,
            });
            // Handle variant image changes (remove deleted, add new)
            for (const imgId of (v._removedImageIds || [])) {
              try { await productsAPI.removeImage(v._id, imgId); } catch { /* silent */ }
            }
            const pendingVarImages = (v.images || []).filter(img => !img._existingId);
            if (pendingVarImages.length > 0) {
              try { await productsAPI.addImages(v._id, { images: pendingVarImages.map((img, i) => ({ url: img.url, isPrimary: i === 0 && !(v.images || []).some(img2 => img2._existingId) })) }); } catch { /* silent */ }
            }
            updated++;
          } catch (err) {
            toast.error(`Update "${v.name}": ${err.message || 'Failed'}`);
          }
        }
        if (updated > 0) toast.success(`${updated} variant(s) updated`);
      }

      // Save opening stock for new single products (per warehouse, bulk call per warehouse)
      if (!editing && form.type !== 'parent' && parentId) {
        const filledRows = openingStockRows.filter(r => r.quantity !== '' && Number(r.quantity) > 0);
        let stockSaved = 0;
        for (const row of filledRows) {
          try {
            await stockAPI.bulkOpeningByWarehouse({
              warehouseId: row.warehouseId,
              items: [{
                productId: parentId,
                quantity: Number(row.quantity),
              }],
            });
            stockSaved++;
          } catch (err) {
            toast.error(`Opening stock for ${row.warehouseName}: ${err.message || 'Failed'}`);
          }
        }
        if (stockSaved > 0) toast.success(`Opening stock saved for ${stockSaved} warehouse${stockSaved !== 1 ? 's' : ''}`);
      }

      // Save opening stock for new parent product variants — one bulk call per warehouse
      if (!editing && form.type === 'parent' && parentId && Object.keys(skuToVariantId).length > 0) {
        let variantStockSaved = 0;
        for (const [whId, skuQtyMap] of Object.entries(variantOpeningStock)) {
          const items = Object.entries(skuQtyMap)
            .filter(([, qty]) => qty !== '' && Number(qty) > 0)
            .map(([sku, qty]) => ({ productId: skuToVariantId[sku], quantity: Number(qty) }))
            .filter(i => i.productId);
          if (!items.length) continue;
          try {
            await stockAPI.bulkOpeningByWarehouse({ warehouseId: whId, items });
            variantStockSaved++;
          } catch (err) {
            toast.error(`Opening stock: ${err.message || 'Failed to save'}`);
          }
        }
        if (variantStockSaved > 0) toast.success(`Variant opening stock saved for ${variantStockSaved} warehouse${variantStockSaved !== 1 ? 's' : ''}`);
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
      <div className="flex items-center gap-3 min-w-0">
        {r.images?.[0]?.url ? (
          <img src={r.images[0].url} alt={r.images[0].altText || r.name} className="w-9 h-9 rounded-xl object-cover border border-slate-100 flex-shrink-0 shadow-sm" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
        ) : (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${productInitialColor(r.name)}`}>
            {(r.name?.[0] || '?').toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <span className="text-slate-800 font-semibold text-sm block truncate">{r.name}</span>
          {r.type === 'variant' && r.parentProduct && (
            <span className="text-[10px] text-violet-400 truncate block">↳ {r.parentProduct?.name || 'parent'}</span>
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
    { key: 'sku', label: 'SKU', render: (r) => (
      <span className="font-mono text-xs bg-slate-50 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md">{r.sku || '—'}</span>
    )},
    { key: 'brand', label: 'Brand', render: (r) => (
      r.brand?.name
        ? <span className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">{r.brand.name}</span>
        : <span className="text-slate-300 text-xs">—</span>
    )},
    { key: 'type', label: 'Type', render: (r) => {
      const cfg = { parent: ['purple', 'Parent'], single: ['blue', 'Single'], variant: ['gray', 'Variant'] };
      const [color, label] = cfg[r.type] || ['gray', r.type];
      return <Badge color={color}>{label}</Badge>;
    }},
    { key: 'categories', label: 'Category', render: (r) => (
      r.categories?.[0]?.name
        ? <span className="text-xs text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">{r.categories[0].name}</span>
        : <span className="text-slate-300 text-xs">—</span>
    )},
    { key: 'costPrice', label: 'Cost', render: (r) => (
      r.type === 'parent'
        ? <span className="text-xs text-slate-400 italic">Variable</span>
        : <span className="text-slate-500 text-xs font-mono">₹{Number(r.costPrice || 0).toLocaleString()}</span>
    )},
    { key: 'basePrice', label: 'Price', render: (r) => (
      r.type === 'parent'
        ? <span className="text-xs text-slate-400 italic">Variable</span>
        : <span className="text-slate-800 font-semibold text-sm">₹{Number(r.basePrice || 0).toLocaleString()}</span>
    )},
    { key: 'stock', label: 'Stock', render: (r) => {
      const s = stockSummary[r._id];
      const total = s?.total ?? 0;
      const isLow = total > 0 && total <= (r.lowStockThreshold || 10);
      return (
        <button
          onClick={(e) => { e.stopPropagation(); setStockModalProduct(r); }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hover:scale-105 active:scale-95 ${
            total === 0
              ? 'text-red-500 border-red-200 bg-red-50 hover:bg-red-100'
              : isLow
              ? 'text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100'
              : 'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
          }`}
          title="Click for warehouse details"
        >
          <Warehouse size={10} />
          {total === 0 ? 'No stock' : total}
        </button>
      );
    }},
    { key: 'isActive', label: 'Status', render: (r) => (
      <Badge color={r.isActive !== false ? 'green' : 'red'}>{r.isActive !== false ? 'Active' : 'Inactive'}</Badge>
    )},
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
        {/* Quick stats */}
        {!loading && products.length > 0 && (
          <div className="flex items-center gap-6 mb-5 pb-4 border-b border-slate-100">
            {[
              { label: 'Total', value: products.length, dot: 'bg-slate-400', text: 'text-slate-700' },
              { label: 'Active', value: products.filter(p => p.isActive !== false).length, dot: 'bg-emerald-400', text: 'text-emerald-700' },
              { label: 'Parents', value: products.filter(p => p.type === 'parent').length, dot: 'bg-violet-400', text: 'text-violet-700' },
              { label: 'Singles', value: products.filter(p => p.type === 'single').length, dot: 'bg-blue-400', text: 'text-blue-700' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                <span className={`font-bold ${s.text}`}>{s.value}</span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search products..." className="max-w-xs" />
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            options={[{ value: 'single', label: 'Single' }, { value: 'parent', label: 'Parent' }]}
            placeholder="All Types" className="w-36" />
          <Select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
            options={categoryOpts} placeholder="All Categories" className="w-44" />
        </div>
        <DataTable
          columns={columns}
          data={products}
          loading={loading}
          emptyMessage="No products found"
          scrollable
          serverPagination
          currentPage={page}
          totalItems={pagination.total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </GlassCard>

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Product' : 'Create Product'} size="wide"
        footer={<><Button variant="ghost" onClick={closeModal}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button></>}
      >
        <div className="space-y-5">
          <div>
            <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-3">Basic Info</h4>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" value={form.name} onChange={(e) => {
                const name = e.target.value;
                setForm((p) => ({
                  ...p,
                  name,
                  ...(!skuEditedRef.current && !editing ? { sku: generateRandomSku(name) } : {}),
                }));
              }} placeholder="Product name" />
              <div className="col-span-2">
                <div className="flex gap-1.5 items-end">
                  <Input label="SKU" value={form.sku} onChange={(e) => { skuEditedRef.current = true; set('sku')(e); }} placeholder="PRD-001" className="flex-1" />
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
              <div className="col-span-2 flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-700">Status</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{form.isActive ? 'Active — visible to customers' : 'Inactive — hidden from customers'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${form.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
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

          {/* ── Opening Stock Section (create only, single type) ── */}
          {!editing && form.type !== 'parent' && (
            <div>
              <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-1">
                <Warehouse size={14} className="inline mr-1" />Opening Stock
              </h4>
              <p className="text-[11px] text-slate-400 mb-3">Set initial stock per warehouse. Leave quantity empty to skip that warehouse.</p>
              {openingStockRows.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No warehouses found. Add warehouses first.</p>
              ) : (
                <div className="rounded-lg border border-slate-200/60 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/60">
                        <th className="py-2 px-3 text-left font-semibold text-slate-500 uppercase tracking-wide">Warehouse</th>
                        <th className="py-2 px-3 text-center font-semibold text-slate-500 uppercase tracking-wide w-28">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openingStockRows.map((row, idx) => (
                        <tr key={row.warehouseId} className="border-b border-slate-100 last:border-0 hover:bg-violet-50/30 transition-colors">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <Warehouse size={12} className="text-violet-500 flex-shrink-0" />
                              <span className="font-medium text-slate-700">{row.warehouseName}</span>
                              {row.warehouseCode && <span className="text-slate-400 text-[10px]">({row.warehouseCode})</span>}
                            </div>
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="number" min="0" step="1"
                              value={row.quantity}
                              onChange={(e) => setOpeningStockRows(prev => prev.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))}
                              placeholder="—"
                              className="w-full text-center bg-transparent border border-slate-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/30 placeholder-slate-300"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
            </div>
          </div>

          {/* ── Images Section ── */}
          <div>
            <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-3">
              <Image size={14} className="inline mr-1" />Images
            </h4>
            {/* Mode toggle */}
            <div className="flex gap-1 mb-2 border border-slate-200 rounded-lg p-0.5 w-fit">
              <button type="button"
                className={`px-3 py-1 text-xs rounded-md transition-colors ${imageInputMode === 'upload' ? 'bg-violet-100 text-violet-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setImageInputMode('upload')}>
                Upload file
              </button>
              <button type="button"
                className={`px-3 py-1 text-xs rounded-md transition-colors ${imageInputMode === 'url' ? 'bg-violet-100 text-violet-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setImageInputMode('url')}>
                Image URL
              </button>
            </div>
            {imageInputMode === 'url' && (
              <div className="flex gap-2 mb-2">
                <input
                  type="url"
                  value={productUrlInput}
                  onChange={(e) => setProductUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 glass-input px-3 py-2 text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddImageUrl(); } }}
                />
                <button type="button" onClick={handleAddImageUrl}
                  className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium">
                  Add
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {formImages.map((img, i) => (
                <div key={img._existingId || `p-${i}`} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 group flex items-center justify-center">
                  <img src={img.url} alt={img.altText || ''} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                  {img.isPrimary && <span className="absolute bottom-0 left-0 right-0 text-center text-[8px] bg-emerald-500/80 text-white py-0.5">Primary</span>}
                  <button type="button" onClick={() => handleRemoveFormImage(img._existingId, i)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={9} />
                  </button>
                </div>
              ))}
              {imageInputMode === 'upload' && (
                <button type="button" onClick={() => productFileRef.current?.click()} disabled={uploadingImage}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 hover:border-violet-400 flex flex-col items-center justify-center text-slate-400 hover:text-violet-500 transition-colors disabled:opacity-50">
                  <Camera size={16} />
                  <span className="text-[9px] mt-0.5">{uploadingImage ? '…' : 'Upload'}</span>
                </button>
              )}
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
                  <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 font-medium px-1 mb-1">
                    <span className="col-span-1"></span>
                    <span className="col-span-2">Value</span>
                    <span className="col-span-2">Name</span>
                    <span className="col-span-2">SKU</span>
                    <span className="col-span-2">Cost</span>
                    <span className="col-span-2">Price</span>
                    <span className="col-span-1"></span>
                  </div>
                  {formVariants.map((v, idx) => (
                    <div key={idx} className={`rounded-lg border transition-colors ${
                      v._existing && v._modified
                        ? 'bg-amber-50/60 border-amber-200'
                        : v._existing
                        ? 'bg-violet-50/50 border-violet-100'
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      {/* Main row */}
                      <div className="grid grid-cols-12 gap-2 items-center p-2">
                        <div className="col-span-1 flex items-center justify-center">
                          {v.images?.[0]?.url ? (
                            <img src={v.images[0].url} alt={v.name} className="w-8 h-8 rounded-lg object-cover border border-violet-100 flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-300 text-[10px] font-bold flex-shrink-0">
                              {(v.name?.[0] || v.variantValue?.[0] || '?').toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2">
                          <Input value={v.variantValue} onChange={(e) => updateFormVariant(idx, 'variantValue', e.target.value)} placeholder="Red" disabled={v._existing} />
                        </div>
                        <div className="col-span-2">
                          <Input value={v.name} onChange={(e) => updateFormVariant(idx, 'name', e.target.value)} placeholder="Product - Red" />
                        </div>
                        <div className="col-span-2">
                          <Input value={v.sku} onChange={(e) => updateFormVariant(idx, 'sku', e.target.value)} placeholder="PRD-RED" disabled={v._existing} />
                        </div>
                        <div className="col-span-2">
                          <div className="flex items-center gap-1">
                            <Input type="number" value={v.costPrice} onChange={(e) => updateFormVariant(idx, 'costPrice', e.target.value)} />
                            <button type="button" title="Apply to all rows" onClick={() => copyVariantToAll('costPrice', v.costPrice)} className="flex-shrink-0 text-violet-300 hover:text-violet-600 transition-colors p-0.5 rounded hover:bg-violet-50"><CheckCheck size={12} /></button>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="flex items-center gap-1">
                            <Input type="number" value={v.basePrice} onChange={(e) => updateFormVariant(idx, 'basePrice', e.target.value)} />
                            <button type="button" title="Apply to all rows" onClick={() => copyVariantToAll('basePrice', v.basePrice)} className="flex-shrink-0 text-violet-300 hover:text-violet-600 transition-colors p-0.5 rounded hover:bg-violet-50"><CheckCheck size={12} /></button>
                          </div>
                        </div>
                        <div className="col-span-1 flex justify-center items-center gap-1">
                          {/* Camera button: shows image count, toggles image panel */}
                          <button type="button"
                            title={`${(v.images || []).length} image(s) — click to manage`}
                            onClick={() => setExpandedVariantImageIdx(expandedVariantImageIdx === idx ? null : idx)}
                            className={`relative p-0.5 rounded transition-colors flex-shrink-0 ${(v.images || []).length > 0 ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-400 hover:text-violet-500'}`}>
                            <Camera size={13} />
                            {(v.images || []).length > 0 && (
                              <span className="absolute -top-1 -right-1 min-w-[12px] h-3 px-0.5 bg-emerald-500 text-white text-[8px] font-bold flex items-center justify-center rounded-full leading-none">
                                {v.images.length}
                              </span>
                            )}
                          </button>
                          <Button size="xs" variant="ghost" className="text-red-400" onClick={() => { removeFormVariant(idx); if (expandedVariantImageIdx === idx) setExpandedVariantImageIdx(null); }}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                      {/* Expandable image panel */}
                      {expandedVariantImageIdx === idx && (
                        <div className="px-3 pb-3 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-2 flex-wrap">
                            {(v.images || []).map((img, imgIdx) => (
                              <div key={imgIdx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 group flex items-center justify-center flex-shrink-0">
                                <img src={img.url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                                <button type="button"
                                  onClick={() => {
                                    const updated = (v.images || []).filter((_, i) => i !== imgIdx);
                                    const removedIds = img._existingId ? [...(v._removedImageIds || []), img._existingId] : (v._removedImageIds || []);
                                    setFormVariants(prev => {
                                      const next = [...prev];
                                      next[idx] = { ...next[idx], images: updated, _removedImageIds: removedIds, ...(next[idx]._existing ? { _modified: true } : {}) };
                                      return next;
                                    });
                                  }}
                                  className="absolute inset-0 bg-red-500/70 text-white items-center justify-center hidden group-hover:flex text-[10px]">
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                            {/* Add image button */}
                            <button type="button"
                              onClick={() => { setUploadingVariantIdx(idx); variantFileRef.current?.click(); }}
                              disabled={uploadingImage}
                              className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-300 hover:border-violet-400 flex flex-col items-center justify-center text-slate-400 hover:text-violet-500 transition-colors disabled:opacity-50 flex-shrink-0">
                              <Camera size={12} />
                              <span className="text-[8px] mt-0.5">{uploadingImage && uploadingVariantIdx === idx ? '…' : 'Add'}</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1.5">Images are uploaded immediately and attached to the variant on save.</p>
                        </div>
                      )}
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

          {/* ── Opening Stock for Parent variants (create only) ── */}
          {!editing && form.type === 'parent' && formVariants.filter(v => !v._existing).length > 0 && (
            <div>
              {/* Section header + warehouse picker */}
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
                  <Warehouse size={14} className="inline mr-1" />Opening Stock
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Warehouse:</span>
                  <select
                    value={parentOpeningWhId}
                    onChange={(e) => setParentOpeningWhId(e.target.value)}
                    className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/30"
                  >
                    <option value="">— select —</option>
                    {warehouseList.map(w => (
                      <option key={w._id} value={w._id}>{w.name}{w.code ? ` (${w.code})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Select a warehouse, enter quantities, then switch to another warehouse to add stock there — your values are saved per warehouse. Click <CheckCheck size={11} className="inline mx-0.5 text-violet-500" /> to apply a value to all rows.
              </p>

              {!parentOpeningWhId ? (
                <p className="text-xs text-amber-500 italic">Select a warehouse above to enable opening stock entry.</p>
              ) : (
                <div className="rounded-lg border border-slate-200/60 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/60">
                        <th className="py-2 px-3 text-left font-semibold text-slate-500 uppercase tracking-wide">Variant</th>
                        <th className="py-2 px-3 text-center font-semibold text-slate-500 uppercase tracking-wide w-36">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formVariants.filter(v => !v._existing).map((v, idx) => {
                        const curQty = variantOpeningStock[parentOpeningWhId]?.[v.sku] ?? '';
                        return (
                          <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-violet-50/20 transition-colors">
                            <td className="py-2 px-3">
                              <span className="font-medium text-slate-700">{v.name || '—'}</span>
                              {v.variantValue && <span className="ml-1.5 text-[10px] text-violet-500 bg-violet-50 border border-violet-100 rounded px-1 py-0.5">{v.variantValue}</span>}
                              <span className="block text-[10px] text-slate-400 font-mono">{v.sku}</span>
                            </td>
                            <td className="py-1.5 px-3">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number" min="0" step="1"
                                  value={curQty}
                                  onChange={(e) => setVariantOpeningStock(prev => ({
                                    ...prev,
                                    [parentOpeningWhId]: { ...(prev[parentOpeningWhId] || {}), [v.sku]: e.target.value },
                                  }))}
                                  placeholder="—"
                                  className="w-full text-center bg-transparent border border-slate-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/30 placeholder-slate-300"
                                />
                                <button
                                  type="button"
                                  title="Apply this quantity to all rows for this warehouse"
                                  onClick={() => {
                                    const allSkus = formVariants.filter(fv => !fv._existing).reduce((acc, fv) => {
                                      acc[fv.sku] = curQty;
                                      return acc;
                                    }, {});
                                    setVariantOpeningStock(prev => ({
                                      ...prev,
                                      [parentOpeningWhId]: { ...(prev[parentOpeningWhId] || {}), ...allSkus },
                                    }));
                                  }}
                                  className="flex-shrink-0 text-violet-400 hover:text-violet-600 transition-colors p-0.5 rounded hover:bg-violet-50"
                                >
                                  <CheckCheck size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Summary of filled warehouses */}
              {Object.entries(variantOpeningStock).some(([, m]) => Object.values(m).some(q => q !== '' && Number(q) > 0)) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(variantOpeningStock).map(([whId, skuMap]) => {
                    const filled = Object.values(skuMap).filter(q => q !== '' && Number(q) > 0).length;
                    if (!filled) return null;
                    const wh = warehouseList.find(w => w._id === whId);
                    return (
                      <span key={whId} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${whId === parentOpeningWhId ? 'bg-violet-100 text-violet-700 border-violet-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {wh?.name || whId}: {filled} variant{filled !== 1 ? 's' : ''}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {/* Hidden file inputs for image uploads */}
          <input ref={productFileRef} type="file" accept="image/*" onChange={handleProductImageUpload} className="hidden" />
          <input ref={variantFileRef} type="file" accept="image/*" onChange={handleVariantImageUpload} className="hidden" />
        </div>
      </Modal>

      {/* View Product Detail Modal */}
      <Modal open={!!viewProduct} onClose={closeView} title={viewProduct?.name || 'Product Detail'} size="view">
        {viewLoading ? <Loader /> : viewProduct && (
          <div className="space-y-6">

            {/* ── Info Grid ── */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-slate-400 w-28 flex-shrink-0">SKU</span>
                <span className="text-slate-800 font-mono">{viewProduct.sku || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-400 w-28 flex-shrink-0">Type</span>
                <Badge color="blue">{viewProduct.type}</Badge>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-400 w-28 flex-shrink-0">Status</span>
                <Badge color={viewProduct.isActive !== false ? 'green' : 'red'}>{viewProduct.isActive !== false ? 'Active' : 'Inactive'}</Badge>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-400 w-28 flex-shrink-0">Categories</span>
                <span className="text-slate-800">{viewProduct.categories?.map(c => c.name).join(', ') || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-400 w-28 flex-shrink-0">Brand</span>
                <span className="text-slate-800">{viewProduct.brand?.name || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-400 w-28 flex-shrink-0">Unit</span>
                <span className="text-slate-800">{viewProduct.unit?.name || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-400 w-28 flex-shrink-0">Tax Slab</span>
                <span className="text-slate-800">{viewProduct.taxSlab?.name || '—'}</span>
              </div>
              {viewProduct.tags?.length > 0 && (
                <div className="flex gap-2 col-span-2">
                  <span className="text-slate-400 w-28 flex-shrink-0">Tags</span>
                  <span className="text-slate-800">{viewProduct.tags.join(', ')}</span>
                </div>
              )}
              {viewProduct.description && (
                <div className="flex gap-2 col-span-2">
                  <span className="text-slate-400 w-28 flex-shrink-0">Description</span>
                  <span className="text-slate-600 text-xs leading-relaxed">{viewProduct.description}</span>
                </div>
              )}
            </div>

            {/* ── Pricing – single & variant only ── */}
            {viewProduct.type !== 'parent' && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Pricing</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-lg bg-violet-50/60 border border-violet-100 px-4 py-3">
                    <p className="text-[10px] text-slate-400 uppercase mb-0.5">Base Price</p>
                    <p className="text-slate-800 font-semibold">₹{viewProduct.basePrice ?? '—'}</p>
                  </div>
                  <div className="rounded-lg bg-violet-50/60 border border-violet-100 px-4 py-3">
                    <p className="text-[10px] text-slate-400 uppercase mb-0.5">Cost Price</p>
                    <p className="text-slate-800 font-semibold">₹{viewProduct.costPrice ?? '—'}</p>
                  </div>
                  <div className="rounded-lg bg-violet-50/60 border border-violet-100 px-4 py-3">
                    <p className="text-[10px] text-slate-400 uppercase mb-0.5">Compare At</p>
                    <p className="text-slate-800 font-semibold">₹{viewProduct.compareAtPrice ?? '—'}</p>
                  </div>
                  <div className="rounded-lg bg-violet-50/60 border border-violet-100 px-4 py-3">
                    <p className="text-[10px] text-slate-400 uppercase mb-0.5">Low Stock</p>
                    <p className="text-slate-800 font-semibold">{viewProduct.lowStockThreshold ?? '—'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Variants Table – parent only ── */}
            {viewProduct.type === 'parent' && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Variants ({variants.length})</h4>
                {variants.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-violet-100">
                    <table className="w-full text-sm">
                      <thead className="bg-violet-50/70">
                        <tr>
                          <th className="text-left text-xs text-slate-500 font-medium px-3 py-2 w-14">Image</th>
                          <th className="text-left text-xs text-slate-500 font-medium px-3 py-2">Name</th>
                          <th className="text-left text-xs text-slate-500 font-medium px-3 py-2">SKU</th>
                          <th className="text-left text-xs text-slate-500 font-medium px-3 py-2">Attribute</th>
                          <th className="text-right text-xs text-slate-500 font-medium px-3 py-2">Cost</th>
                          <th className="text-right text-xs text-slate-500 font-medium px-3 py-2">Price</th>
                          <th className="w-8 px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-violet-50">
                        {variants.map((v) => (
                          <tr key={v._id} className="hover:bg-violet-50/40 transition-colors">
                            <td className="px-3 py-2">
                              {v.images?.[0]?.url ? (
                                <img src={v.images[0].url} alt={v.name} className="w-9 h-9 rounded-lg object-cover border border-violet-100" onError={(e) => { e.target.style.display = 'none'; }} />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-300 text-xs font-bold">
                                  {(v.name?.[0] || '?').toUpperCase()}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-800 font-medium">{v.name}</td>
                            <td className="px-3 py-2 text-slate-500 font-mono text-xs">{v.sku}</td>
                            <td className="px-3 py-2">
                              {v.variantAttribute ? (
                                <Badge color="purple">{v.variantAttribute}: {v.variantValue}</Badge>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">₹{v.costPrice ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-violet-600 font-medium">₹{v.basePrice ?? '—'}</td>
                            <td className="px-3 py-2">
                              <Button size="xs" variant="ghost" className="text-red-400" onClick={() => handleDeleteVariant(v._id)}>
                                <Trash2 size={13} />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-slate-400 text-sm italic">No variants found.</p>}
              </div>
            )}

            {/* ── Stock by Variant & Warehouse – parent only ── */}
            {viewProduct.type === 'parent' && variants.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Stock by Variant & Warehouse</h4>
                {(() => {
                  // Collect unique warehouses
                  const warehouses = [...new Set(stock.map(s => s.warehouse?.name || s.warehouseName || 'Unknown'))].sort();
                  if (warehouses.length === 0) return <p className="text-slate-400 text-sm italic">No stock data available.</p>;

                  // Helper to get stock for variant and warehouse
                  const getStock = (variantId, warehouseName) => {
                    return stock.find((s) => {
                      // product may be returned as `product` (ObjectId or populated object), `productId`, or `product._id`.
                      const prodId = s.product?._id?.toString?.() || s.product?.toString?.() || s.productId || s.product;
                      const warehouseNameLocal = s.warehouse?.name || s.warehouseName || '';
                      return prodId && prodId.toString() === variantId.toString() && warehouseNameLocal === warehouseName;
                    });
                  };

                  return (
                    <div className="overflow-x-auto rounded-lg border border-violet-100">
                      <table className="w-full text-sm">
                        <thead className="bg-violet-50/70">
                          <tr>
                            <th className="text-left text-xs text-slate-500 font-medium px-3 py-2">Variant</th>
                            {warehouses.map(w => (
                              <th key={w} className="text-center text-xs text-slate-500 font-medium px-3 py-2">{w}</th>
                            ))}
                            <th className="text-center text-xs text-slate-500 font-medium px-3 py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-violet-50">
                          {variants.map((v) => {
                            const variantStocks = warehouses.map(w => getStock(v._id, w));
                            const totalQty = variantStocks.reduce((sum, s) => sum + (s?.quantity ?? 0), 0);
                            const totalReserved = variantStocks.reduce((sum, s) => sum + (s?.reservedQuantity ?? s?.reserved ?? 0), 0);
                            return (
                              <tr key={v._id} className="hover:bg-violet-50/40 transition-colors">
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    {v.images?.[0]?.url ? (
                                      <img src={v.images[0].url} alt={v.name} className="w-6 h-6 rounded object-cover border border-violet-100 flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                                    ) : (
                                      <div className="w-6 h-6 rounded bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-300 text-[10px] font-bold flex-shrink-0">
                                        {(v.name?.[0] || '?').toUpperCase()}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="text-slate-800 font-medium text-xs truncate">{v.name}</div>
                                      <div className="text-slate-400 font-mono text-[10px]">{v.sku}</div>
                                    </div>
                                  </div>
                                </td>
                                {warehouses.map(w => {
                                  const s = getStock(v._id, w);
                                  const qty = s?.quantity ?? s?.qty ?? 0;
                                  const res = s?.reservedQuantity ?? s?.reserved ?? 0;
                                  const avail = qty - res;
                                  return (
                                    <td key={w} className="px-3 py-2 text-center" title={qty > 0 || res > 0 ? `Qty: ${qty}  ·  Reserved: ${res}  ·  Available: ${avail}` : 'No stock'}>
                                      {qty > 0 ? (
                                        <div className="text-slate-800 font-medium">{qty}</div>
                                      ) : (
                                        <span className="text-slate-300">—</span>
                                      )}
                                      {res > 0 && (
                                        <div className="text-amber-500 text-[10px]">({res})</div>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2 text-center" title={`Total — Qty: ${totalQty}  ·  Reserved: ${totalReserved}  ·  Available: ${totalQty - totalReserved}`}>
                                  {totalQty > 0 ? (
                                    <div className="text-emerald-600 font-medium">{totalQty}</div>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                  {totalReserved > 0 && (
                                    <div className="text-amber-500 text-[10px]">({totalReserved})</div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-violet-50/50 border-t border-violet-100">
                          <tr>
                            <td className="px-3 py-2 text-xs text-slate-500 font-medium">Total per Warehouse</td>
                            {warehouses.map(w => {
                              const warehouseTotalQty = variants.reduce((sum, v) => {
                                const s = getStock(v._id, w);
                                return sum + (s?.quantity ?? 0);
                              }, 0);
                              const warehouseTotalReserved = variants.reduce((sum, v) => {
                                const s = getStock(v._id, w);
                                return sum + (s?.reservedQuantity ?? s?.reserved ?? 0);
                              }, 0);
                              return (
                                <td key={w} className="px-3 py-2 text-center" title={`${w} — Qty: ${warehouseTotalQty}  ·  Reserved: ${warehouseTotalReserved}  ·  Available: ${warehouseTotalQty - warehouseTotalReserved}`}>
                                  {warehouseTotalQty > 0 ? (
                                    <div className="text-slate-800 font-medium">{warehouseTotalQty}</div>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                  {warehouseTotalReserved > 0 && (
                                    <div className="text-amber-500 text-[10px]">({warehouseTotalReserved})</div>
                                  )}
                                </td>
                              );
                            })}
                            {(() => {
                              const grandQty = stock.reduce((sum, s) => sum + (s.quantity ?? 0), 0);
                              const grandRes = stock.reduce((sum, s) => sum + (s.reservedQuantity ?? s.reserved ?? 0), 0);
                              return (
                                <td className="px-3 py-2 text-center" title={`Grand Total — Qty: ${grandQty}  ·  Reserved: ${grandRes}  ·  Available: ${grandQty - grandRes}`}>
                                  <div className="text-emerald-600 font-medium">{grandQty}</div>
                                  {grandRes > 0 && (
                                    <div className="text-amber-500 text-[10px]">({grandRes})</div>
                                  )}
                                </td>
                              );
                            })()}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Stock by Warehouse – single & variant only ── */}
            {viewProduct.type !== 'parent' && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Stock by Warehouse</h4>
                {stock.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-violet-100">
                    <table className="w-full text-sm">
                      <thead className="bg-violet-50/70">
                        <tr>
                          <th className="text-left text-xs text-slate-500 font-medium px-3 py-2">Warehouse</th>
                          <th className="text-right text-xs text-slate-500 font-medium px-3 py-2">Qty</th>
                          <th className="text-right text-xs text-slate-500 font-medium px-3 py-2">Reserved</th>
                          <th className="text-right text-xs text-slate-500 font-medium px-3 py-2">Available</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-violet-50">
                        {stock.map((s, i) => (
                          <tr key={i} className="hover:bg-violet-50/40">
                            <td className="px-3 py-2 text-slate-800">{s.warehouse?.name || s.warehouseName || 'Warehouse'}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-800">{s.quantity ?? 0}</td>
                            <td className="px-3 py-2 text-right text-amber-500">{s.reservedQuantity ?? s.reserved ?? 0}</td>
                            <td className="px-3 py-2 text-right font-medium text-emerald-500">{(s.quantity ?? 0) - (s.reservedQuantity ?? s.reserved ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-slate-400 text-sm italic">No stock data available.</p>}
              </div>
            )}

            {/* ── Product Images – all types ── */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Product Images ({images.length})</h4>
              {images.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {images.map((img, i) => (
                    <div key={img._id || i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-violet-100 bg-violet-50/50 flex items-center justify-center group flex-shrink-0">
                      <img src={img.url} alt={img.altText || ''} className="w-full h-full object-cover" />
                      {img.isPrimary && <span className="absolute top-0.5 left-0.5 bg-violet-500 text-white text-[8px] font-semibold px-1 py-0.5 rounded">Primary</span>}
                      <button
                        className="absolute inset-0 bg-red-500/60 hover:bg-red-500/80 items-center justify-center hidden group-hover:flex transition-all"
                        onClick={() => handleRemoveImage(img._id)}
                      >
                        <Trash2 size={14} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-400 text-sm italic">No images uploaded.</p>}
            </div>

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
      <Modal open={!!stockModalProduct} onClose={() => setStockModalProduct(null)} title={`Stock — ${stockModalProduct?.name || ''}`} size={stockModalProduct?.type === 'parent' ? 'lg' : 'md'}>
        {stockModalProduct && (() => {
          // ── Parent product: per-variant breakdown ──
          if (stockModalProduct.type === 'parent') {
            const parentTotal = stockSummary[stockModalProduct._id]?.total ?? 0;
            return stockModalLoading ? (
              <div className="flex justify-center py-10"><Loader /></div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">Total across all variants</span>
                  <span className={`text-sm font-bold ${parentTotal > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                    {parentTotal > 0 ? `${parentTotal} units` : 'Out of Stock'}
                  </span>
                </div>
                {stockModalVariants.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6 italic">No variants found.</p>
                ) : stockModalVariants.map(v => {
                  const vs = stockSummary[v._id];
                  return (
                    <div key={v._id} className="rounded-lg border border-violet-100 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 bg-violet-50/60">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800 truncate">{v.name}</span>
                            {v.variantValue && <span className="text-[10px] text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 flex-shrink-0">{v.variantValue}</span>}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{v.sku}</span>
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ml-4 ${(vs?.total ?? 0) > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                          {vs?.total ?? 0} units
                        </span>
                      </div>
                      {vs?.warehouses?.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {vs.warehouses.map((w, i) => (
                            <div key={w.warehouseId || i} className="flex items-center justify-between px-3 py-2">
                              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                <Warehouse size={11} className="text-violet-400 flex-shrink-0" />
                                <span>{w.warehouseName}</span>
                                {w.warehouseCode && <span className="text-slate-400">({w.warehouseCode})</span>}
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-slate-500">Qty: <span className={`font-medium ${w.quantity > 0 ? 'text-emerald-500' : 'text-red-400'}`}>{w.quantity}</span></span>
                                {w.reserved > 0 && <span className="text-slate-500">Reserved: <span className="text-amber-500">{w.reserved}</span></span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 px-3 py-2 italic">No stock assigned</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }

          // ── Single / variant product: warehouse breakdown ──
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
