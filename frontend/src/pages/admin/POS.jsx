import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Input, Select, Modal, GlassCard, Badge, Textarea } from '../../components/ui';
import { ordersAPI, customersAPI, productsAPI, warehousesAPI } from '../../api';
import { Trash2, Zap, Search, Package, ShoppingCart } from 'lucide-react';

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
  { value: 'wallet', label: 'Wallet' },
];

function fmtCurrency(v) {
  return '$' + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function POS() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  // Form state
  const [customer, setCustomer] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');

  // Discount & Tax at order level
  const [discountType, setDiscountType] = useState('flat');
  const [discountValue, setDiscountValue] = useState(0);

  // Dropdown options
  const [customerOpts, setCustomerOpts] = useState([]);
  const [warehouseOpts, setWarehouseOpts] = useState([]);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef(null);

  // Variant selection modal
  const [variantModal, setVariantModal] = useState(null); // { product, variants, stocks }
  const [selectedVariants, setSelectedVariants] = useState({});

  // Stock cache
  const [stockCache, setStockCache] = useState({});

  // Load dropdown data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [customers, warehouses] = await Promise.all([
          customersAPI.list(), warehousesAPI.list(),
        ]);
        setCustomerOpts((customers.data?.customers || []).map((c) => ({ value: c._id, label: c.name })));
        setWarehouseOpts((warehouses.data || []).map((w) => ({ value: w._id, label: w.name })));
      } catch {
        toast.error('Failed to load data');
      }
    };
    loadData();
  }, []);

  // Debounced product search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!productSearch.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await productsAPI.list({ search: productSearch, limit: 20 });
        setSearchResults(res.data?.products || []);
      } catch { /* silent */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [productSearch]);

  // Fetch stock for a product
  const fetchStock = useCallback(async (productId) => {
    if (stockCache[productId]) return stockCache[productId];
    try {
      const res = await productsAPI.getStock(productId);
      const stocks = res.data || [];
      const total = stocks.reduce((s, st) => s + (st.quantity || 0), 0);
      const byWarehouse = {};
      stocks.forEach(s => {
        const wId = String(s.warehouse?._id || s.warehouse || '');
        byWarehouse[wId] = s.quantity || 0;
      });
      const data = { total, byWarehouse };
      setStockCache(prev => ({ ...prev, [productId]: data }));
      return data;
    } catch { return { total: 0, byWarehouse: {} }; }
  }, [stockCache]);

  // Handle clicking a product from search results
  const handleProductClick = async (product) => {
    if (product.type === 'parent') {
      // Fetch full product detail (includes variants & stocks)
      try {
        const res = await productsAPI.get(product._id);
        const detail = res.data;
        const vars = detail?.variants || [];
        const stks = detail?.stocks || [];
        if (vars.length === 0) {
          toast.error('This parent product has no variants');
          return;
        }
        setVariantModal({ product, variants: vars, stocks: stks });
        setSelectedVariants({});
      } catch {
        toast.error('Failed to load variants');
      }
    } else {
      // Single product — add directly
      addItemToCart(product);
    }
    setProductSearch('');
    setSearchResults([]);
  };

  // Add item to cart
  const addItemToCart = (product) => {
    const existing = items.findIndex(i => i.productId === product._id);
    if (existing >= 0) {
      setItems(prev => prev.map((it, idx) => idx === existing ? { ...it, quantity: it.quantity + 1 } : it));
    } else {
      const stockInfo = stockCache[product._id];
      const whStock = warehouse && stockInfo?.byWarehouse?.[warehouse] || stockInfo?.total || 0;
      setItems(prev => [...prev, {
        productId: product._id,
        name: product.name,
        sku: product.sku,
        barcodeValue: product.barcodeValue || '',
        unitPrice: product.basePrice || 0,
        quantity: 1,
        discountPercent: 0,
        taxPercent: 0,
        stock: whStock,
      }]);
      fetchStock(product._id);
    }
  };

  // Add selected variants from modal
  const handleAddVariants = () => {
    const selected = Object.entries(selectedVariants).filter(([, v]) => v);
    if (!selected.length) return toast.error('Select at least one variant');
    for (const [variantId] of selected) {
      const variant = variantModal.variants.find(v => v._id === variantId);
      if (variant) addItemToCart(variant);
    }
    setVariantModal(null);
    setSelectedVariants({});
  };

  // Update item
  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  // Remove item
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  // Calculate line total
  const calcLineTotal = (item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discountPercent) || 0;
    const tax = Number(item.taxPercent) || 0;
    const afterDisc = price * (1 - disc / 100);
    const afterTax = afterDisc * (1 + tax / 100);
    return afterTax * qty;
  };

  const subtotal = items.reduce((s, i) => s + calcLineTotal(i), 0);
  const calculatedDiscount = discountType === 'percentage' ? (subtotal * Number(discountValue || 0) / 100) : Number(discountValue || 0);
  const total = Math.max(0, subtotal - calculatedDiscount);

  const handleSubmit = async () => {
    if (!customer) return toast.error('Customer is required');
    if (!warehouse) return toast.error('Warehouse is required');
    if (!items.length) return toast.error('At least one item is required');
    try {
      setSaving(true);
      await ordersAPI.posOrder({
        customerId: customer,
        warehouseId: warehouse,
        items: items.map(i => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          discountType: 'percentage',
          discountValue: Number(i.discountPercent) || 0,
        })),
        paymentMethod,
        discountType,
        discountValue: Number(discountValue) || 0,
        notes,
      });
      toast.success('POS order created successfully');
      setItems([]);
      setNotes('');
      setDiscountValue(0);
    } catch (err) {
      toast.error(err.message || 'POS order failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Point of Sale"
        subtitle="Quick order processing"
        actions={
          <Button onClick={handleSubmit} disabled={saving}>
            <Zap size={16} className="mr-1" />
            {saving ? 'Processing…' : 'Complete Order'}
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <GlassCard className="p-4">
          <Select label="Customer *" options={[{ value: '', label: 'Select customer' }, ...customerOpts]} value={customer} onChange={(e) => setCustomer(e.target.value)} />
        </GlassCard>
        <GlassCard className="p-4">
          <Select label="Warehouse *" options={[{ value: '', label: 'Select warehouse' }, ...warehouseOpts]} value={warehouse} onChange={(e) => setWarehouse(e.target.value)} />
        </GlassCard>
        <GlassCard className="p-4">
          <Select label="Payment Method" options={PAY_METHODS} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} />
        </GlassCard>
      </div>

      {/* ── Products Section ── */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <ShoppingCart size={20} className="text-violet-600" /> Products
          </h3>
        </div>

        {/* Product Search */}
        <div className="relative mb-4">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white focus-within:border-violet-400 transition-colors">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or barcode…"
              className="flex-1 outline-none text-sm text-slate-700 bg-transparent"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            {searching && <span className="text-xs text-violet-500">Searching…</span>}
          </div>
          {searchResults.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
              {searchResults.map(p => (
                <button
                  key={p._id}
                  onClick={() => handleProductClick(p)}
                  className="w-full text-left px-4 py-2.5 hover:bg-violet-50 flex items-center justify-between border-b border-gray-50 last:border-0 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {p.images?.[0]?.url ? (
                      <img src={p.images[0].url} alt="" className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <Package size={16} className="text-violet-400" />
                    )}
                    <div>
                      <span className="text-sm font-medium text-slate-800">{p.name}</span>
                      <span className="text-xs text-gray-500 ml-2">{p.sku}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.type === 'parent' ? (
                      <Badge color="purple">Parent</Badge>
                    ) : (
                      <span className="text-sm font-medium text-violet-600">{fmtCurrency(p.basePrice)}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-gray-200 text-xs uppercase">
                <th className="py-2 text-left w-8">#</th>
                <th className="py-2 text-left">Product</th>
                <th className="py-2 text-center w-20">QTY</th>
                <th className="py-2 text-center w-24">Unit Price</th>
                <th className="py-2 text-center w-20">DISC %</th>
                <th className="py-2 text-center w-20">TAX %</th>
                <th className="py-2 text-right w-28">Subtotal</th>
                <th className="py-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="8" className="py-8 text-center text-gray-400">Search and add products above</td></tr>
              ) : items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2 text-slate-500">{idx + 1}</td>
                  <td className="py-2">
                    <div>
                      <span className="text-slate-800 font-medium">{item.name}</span>
                      <div className="text-xs text-gray-500">{item.sku}{item.barcodeValue ? ` • ${item.barcodeValue}` : ''}</div>
                      {item.stock !== undefined && <span className="text-xs text-green-600">Stock: {item.stock}</span>}
                    </div>
                  </td>
                  <td className="py-2 text-center">
                    <input type="number" min="1" className="w-16 text-center border border-gray-200 rounded px-1 py-1 text-sm" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value) || 1)} />
                  </td>
                  <td className="py-2 text-center">
                    <input type="number" min="0" step="0.01" className="w-20 text-center border border-gray-200 rounded px-1 py-1 text-sm" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} />
                  </td>
                  <td className="py-2 text-center">
                    <input type="number" min="0" max="100" className="w-16 text-center border border-gray-200 rounded px-1 py-1 text-sm" value={item.discountPercent} onChange={(e) => updateItem(idx, 'discountPercent', e.target.value)} />
                  </td>
                  <td className="py-2 text-center">
                    <input type="number" min="0" className="w-16 text-center border border-gray-200 rounded px-1 py-1 text-sm" value={item.taxPercent} onChange={(e) => updateItem(idx, 'taxPercent', e.target.value)} />
                  </td>
                  <td className="py-2 text-right font-medium text-slate-800">{fmtCurrency(calcLineTotal(item))}</td>
                  <td className="py-2 text-center">
                    <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > 0 && (
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
              <span className="text-sm text-slate-500">Items: {items.length}</span>
              <span className="text-lg font-semibold text-slate-800">Total: {fmtCurrency(subtotal)}</span>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ── Discount & Tax ── */}
      {items.length > 0 && (
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Discount & Tax</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase mb-1 block">Discount Type</label>
              <Select options={[{ value: 'flat', label: 'Fixed Amount' }, { value: 'percentage', label: 'Percentage' }]} value={discountType} onChange={(e) => setDiscountType(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase mb-1 block">Discount Amount</label>
              <Input type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase mb-1 block">Calculated Discount</label>
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-600 font-medium">-{fmtCurrency(calculatedDiscount)}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase mb-1 block">Grand Total</label>
              <div className="px-3 py-2 bg-green-50 border border-green-200 rounded text-green-700 font-bold text-lg">{fmtCurrency(total)}</div>
            </div>
          </div>
          <div className="mt-4">
            <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes for the sale…" />
          </div>
        </GlassCard>
      )}

      {/* ── Variant Selection Modal ── */}
      <Modal open={!!variantModal} onClose={() => setVariantModal(null)} title="Select Variants" size="lg">
        {variantModal && (
          <div>
            <p className="text-sm text-slate-500 mb-4">
              {variantModal.product.name} — {variantModal.variants.length} variant{variantModal.variants.length !== 1 ? 's' : ''} available
            </p>
            <div className="flex gap-3 mb-4">
              <button onClick={() => setSelectedVariants(variantModal.variants.reduce((a, v) => ({ ...a, [v._id]: true }), {}))} className="text-sm text-violet-600 hover:underline font-medium">Select All</button>
              <button onClick={() => setSelectedVariants({})} className="text-sm text-slate-500 hover:underline font-medium">Deselect All</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-slate-500 text-xs uppercase">
                  <th className="py-2 text-left w-10"></th>
                  <th className="py-2 text-left">Variant</th>
                  <th className="py-2 text-left">SKU</th>
                  <th className="py-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {variantModal.variants.map(v => {
                  const vStocks = variantModal.stocks?.filter(s => String(s.product) === String(v._id) || String(s.product?._id) === String(v._id));
                  const whStock = warehouse ? vStocks?.find(s => String(s.warehouse?._id || s.warehouse) === warehouse)?.quantity : null;
                  return (
                    <tr key={v._id} className="border-b border-gray-50 hover:bg-violet-50/50 cursor-pointer" onClick={() => setSelectedVariants(prev => ({ ...prev, [v._id]: !prev[v._id] }))}>
                      <td className="py-3">
                        <input type="checkbox" checked={!!selectedVariants[v._id]} onChange={() => {}} className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                      </td>
                      <td className="py-3">
                        <span className="text-slate-800 font-medium">{v.variantValue || v.name}</span>
                        {whStock !== null && whStock !== undefined && <span className="text-xs text-green-600 ml-2">Stock: {whStock}</span>}
                      </td>
                      <td className="py-3 font-mono text-xs text-gray-500">{v.sku}</td>
                      <td className="py-3 text-right font-medium text-slate-800">{fmtCurrency(v.basePrice)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setVariantModal(null)}>Cancel</Button>
              <Button onClick={handleAddVariants}>
                Add {Object.values(selectedVariants).filter(Boolean).length} Variant{Object.values(selectedVariants).filter(Boolean).length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}