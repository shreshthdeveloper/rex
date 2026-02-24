import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, GlassCard, SearchInput, Loader, TabList, Pagination } from '../../components/ui';
import { stockAPI, productsAPI, warehousesAPI } from '../../api';
import { Plus, Layers, ArrowLeftRight, AlertTriangle, BarChart3, CheckCircle, XCircle, Package } from 'lucide-react';

const tabs = [
  { id: 'overview', label: 'Stock Overview' },
  { id: 'low', label: 'Low Stock' },
  { id: 'opening', label: 'Opening Stock' },
  { id: 'adjustments', label: 'Adjustments' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'movements', label: 'Movements' },
];

const adjTypeOpts = [
  { value: 'increase', label: 'Addition' },
  { value: 'decrease', label: 'Subtraction' },
];

const transferStatusColor = { pending: 'yellow', completed: 'green', cancelled: 'red' };

const emptyOpening = { productId: '', warehouseId: '', quantity: '', costPrice: '' };
const emptyAdjustment = { productId: '', warehouseId: '', adjustmentType: 'increase', adjustedQuantity: '', reason: 'count_correction' };
const emptyTransfer = { fromWarehouse: '', toWarehouse: '', items: [{ product: '', quantity: '' }] };

export default function StockManagement() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Shared data
  const [productOpts, setProductOpts] = useState([]);
  const [warehouseOpts, setWarehouseOpts] = useState([]);

  // Tab data
  const [stockList, setStockList] = useState([]);
  const [lowStockList, setLowStockList] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [movements, setMovements] = useState([]);

  // Opening stock form
  const [openingForm, setOpeningForm] = useState(emptyOpening);
  const [savingOpening, setSavingOpening] = useState(false);

  // Adjustment modal
  const [adjModalOpen, setAdjModalOpen] = useState(false);
  const [adjForm, setAdjForm] = useState(emptyAdjustment);
  const [savingAdj, setSavingAdj] = useState(false);

  // Transfer modal
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState(emptyTransfer);
  const [savingTx, setSavingTx] = useState(false);

  // Load dropdown options on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, wRes] = await Promise.all([productsAPI.list(), warehousesAPI.list()]);
        setProductOpts((pRes.data?.products || []).map((p) => ({ value: p._id, label: p.name })));
        setWarehouseOpts((wRes.data || []).map((w) => ({ value: w._id, label: w.name })));
      } catch { /* silent */ }
    };
    load();
  }, []);

  // Fetchers per tab
  const fetchStock = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page };
      if (search) params.search = search;
      const res = await stockAPI.list(params);
      setStockList(res.data?.stocks || []);
      setTotalPages(res.data?.pagination?.pages || 1);
    } catch (err) { toast.error(err.message || 'Failed to load stock'); }
    finally { setLoading(false); }
  }, [page, search]);

  const fetchLowStock = useCallback(async () => {
    try {
      setLoading(true);
      const res = await stockAPI.lowStock({ page });
      setLowStockList(res.data || []);
      setTotalPages(1);
    } catch (err) { toast.error(err.message || 'Failed to load low stock'); }
    finally { setLoading(false); }
  }, [page]);

  const fetchAdjustments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await stockAPI.listAdjustments({ page });
      setAdjustments(res.data?.adjustments || []);
      setTotalPages(res.data?.pagination?.pages || 1);
    } catch (err) { toast.error(err.message || 'Failed to load adjustments'); }
    finally { setLoading(false); }
  }, [page]);

  const fetchTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await stockAPI.listTransfers({ page });
      setTransfers(res.data?.transfers || []);
      setTotalPages(res.data?.pagination?.pages || 1);
    } catch (err) { toast.error(err.message || 'Failed to load transfers'); }
    finally { setLoading(false); }
  }, [page]);

  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page };
      if (search) params.search = search;
      const res = await stockAPI.movements(params);
      setMovements(res.data?.movements || []);
      setTotalPages(res.data?.pagination?.pages || 1);
    } catch (err) { toast.error(err.message || 'Failed to load movements'); }
    finally { setLoading(false); }
  }, [page, search]);

  // Fetch data when tab or page changes
  useEffect(() => {
    setPage(1);
    setSearch('');
  }, [activeTab]);

  useEffect(() => {
    const fetchMap = { overview: fetchStock, low: fetchLowStock, adjustments: fetchAdjustments, transfers: fetchTransfers, movements: fetchMovements };
    fetchMap[activeTab]?.();
  }, [activeTab, fetchStock, fetchLowStock, fetchAdjustments, fetchTransfers, fetchMovements]);

  // ─── Opening Stock Submit ───
  const handleOpeningSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingOpening(true);
      await stockAPI.setOpening({ ...openingForm, quantity: Number(openingForm.quantity), costPrice: Number(openingForm.costPrice) });
      toast.success('Opening stock set successfully');
      setOpeningForm(emptyOpening);
    } catch (err) { toast.error(err.message || 'Failed to set opening stock'); }
    finally { setSavingOpening(false); }
  };

  // ─── Adjustment Submit ───
  const handleAdjSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingAdj(true);
      await stockAPI.createAdjustment({ ...adjForm, adjustedQuantity: Number(adjForm.adjustedQuantity) });
      toast.success('Adjustment created');
      setAdjModalOpen(false);
      setAdjForm(emptyAdjustment);
      fetchAdjustments();
    } catch (err) { toast.error(err.message || 'Failed to create adjustment'); }
    finally { setSavingAdj(false); }
  };

  // ─── Transfer Submit ───
  const handleTxSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      fromWarehouse: txForm.fromWarehouse,
      toWarehouse: txForm.toWarehouse,
      items: txForm.items.filter((i) => i.product && i.quantity).map((i) => ({ product: i.product, quantity: Number(i.quantity) })),
    };
    try {
      setSavingTx(true);
      await stockAPI.createTransfer(payload);
      toast.success('Transfer created');
      setTxModalOpen(false);
      setTxForm(emptyTransfer);
      fetchTransfers();
    } catch (err) { toast.error(err.message || 'Failed to create transfer'); }
    finally { setSavingTx(false); }
  };

  const handleCompleteTransfer = async (id) => {
    try {
      await stockAPI.completeTransfer(id);
      toast.success('Transfer completed');
      fetchTransfers();
    } catch (err) { toast.error(err.message || 'Failed to complete transfer'); }
  };

  const handleCancelTransfer = async (id) => {
    try {
      await stockAPI.cancelTransfer(id);
      toast.success('Transfer cancelled');
      fetchTransfers();
    } catch (err) { toast.error(err.message || 'Failed to cancel transfer'); }
  };

  // ─── Transfer form item helpers ───
  const addTxItem = () => setTxForm((p) => ({ ...p, items: [...p.items, { product: '', quantity: '' }] }));
  const updateTxItem = (idx, key, val) => setTxForm((p) => {
    const items = [...p.items];
    items[idx] = { ...items[idx], [key]: val };
    return { ...p, items };
  });
  const removeTxItem = (idx) => setTxForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  // ─── Column definitions ───
  const stockColumns = [
    { key: 'product', label: 'Product', render: (r) => r.product?.name || r.product || '—' },
    { key: 'warehouse', label: 'Warehouse', render: (r) => r.warehouse?.name || r.warehouse || '—' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'reserved', label: 'Reserved', render: (r) => r.reservedQuantity ?? r.reserved ?? 0 },
    { key: 'available', label: 'Available', render: (r) => (r.quantity ?? 0) - (r.reservedQuantity ?? r.reserved ?? 0) },
    { key: 'reorderLevel', label: 'Reorder Level', render: (r) => r.reorderLevel ?? r.lowStockThreshold ?? '—' },
  ];

  const adjColumns = [
    { key: 'adjustmentNumber', label: 'Ref #', render: (r) => r.adjustmentNumber || r._id?.slice(-6) },
    { key: 'product', label: 'Product', render: (r) => r.product?.name || '—' },
    { key: 'warehouse', label: 'Warehouse', render: (r) => r.warehouse?.name || '—' },
    { key: 'adjustmentType', label: 'Type', render: (r) => <Badge color={r.adjustmentType === 'increase' ? 'green' : 'red'}>{r.adjustmentType}</Badge> },
    { key: 'adjustedQuantity', label: 'Qty' },
    { key: 'reason', label: 'Reason', render: (r) => r.reason || '—' },
    { key: 'createdAt', label: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
  ];

  const txColumns = [
    { key: 'transferNumber', label: 'Ref #', render: (r) => r.transferNumber || r._id?.slice(-6) },
    {
      key: 'actions', label: 'Actions', render: (r) => r.status === 'pending' ? (
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleCompleteTransfer(r._id); }} className="text-green-400 hover:text-green-300" title="Complete">
            <CheckCircle size={18} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleCancelTransfer(r._id); }} className="text-red-400 hover:text-red-300" title="Cancel">
            <XCircle size={18} />
          </button>
        </div>
      ) : '—',
    },
    { key: 'from', label: 'From', render: (r) => r.fromWarehouse?.name || '—' },
    { key: 'to', label: 'To', render: (r) => r.toWarehouse?.name || '—' },
    { key: 'items', label: 'Items', render: (r) => r.items?.length || 0 },
    { key: 'status', label: 'Status', render: (r) => <Badge color={transferStatusColor[r.status] || 'cyan'}>{r.status}</Badge> },
    { key: 'createdAt', label: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
  ];

  const mvColumns = [
    { key: 'type', label: 'Type', render: (r) => <Badge color="violet">{r.type}</Badge> },
    { key: 'product', label: 'Product', render: (r) => r.product?.name || '—' },
    { key: 'warehouse', label: 'Warehouse', render: (r) => r.warehouse?.name || '—' },
    { key: 'quantity', label: 'Qty', render: (r) => r.quantity ?? '—' },
    { key: 'from', label: 'From', render: (r) => r.fromWarehouse?.name || r.from || '—' },
    { key: 'to', label: 'To', render: (r) => r.toWarehouse?.name || r.to || '—' },
    { key: 'reference', label: 'Reference', render: (r) => r.reference || r.referenceId || '—' },
    { key: 'createdAt', label: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleString() : '—' },
  ];

  // ─── Render sub-views ───
  const renderOverview = () => (
    <>
      <div className="flex items-center gap-3 mb-4">
        <SearchInput value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search products..." />
      </div>
      <DataTable columns={stockColumns} data={stockList} loading={loading} emptyMessage="No stock records found" />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
    </>
  );

  const renderLowStock = () => (
    <>
      <div className="flex items-center gap-2 mb-4 text-amber-600">
        <AlertTriangle size={18} />
        <span className="text-sm font-medium">Products below reorder level</span>
      </div>
      <DataTable columns={stockColumns} data={lowStockList} loading={loading} emptyMessage="No low stock alerts" />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
    </>
  );

  // ─── Bulk opening stock states ───
  const [openingMode, setOpeningMode] = useState('single'); // 'single' | 'byWarehouse' | 'byProduct'
  const [bulkWhId, setBulkWhId] = useState('');
  const [bulkWhItems, setBulkWhItems] = useState([{ productId: '', quantity: '', warehousePrice: '' }]);
  const [bulkProdId, setBulkProdId] = useState('');
  const [bulkProdWarehouses, setBulkProdWarehouses] = useState([{ warehouseId: '', quantity: '', warehousePrice: '' }]);
  const [savingBulk, setSavingBulk] = useState(false);

  // Bulk by warehouse helpers
  const addBulkWhItem = () => setBulkWhItems(p => [...p, { productId: '', quantity: '', warehousePrice: '' }]);
  const updateBulkWhItem = (idx, key, val) => setBulkWhItems(p => { const items = [...p]; items[idx] = { ...items[idx], [key]: val }; return items; });
  const removeBulkWhItem = (idx) => setBulkWhItems(p => p.filter((_, i) => i !== idx));

  // Bulk by product helpers
  const addBulkProdWh = () => setBulkProdWarehouses(p => [...p, { warehouseId: '', quantity: '', warehousePrice: '' }]);
  const updateBulkProdWh = (idx, key, val) => setBulkProdWarehouses(p => { const items = [...p]; items[idx] = { ...items[idx], [key]: val }; return items; });
  const removeBulkProdWh = (idx) => setBulkProdWarehouses(p => p.filter((_, i) => i !== idx));

  const handleBulkByWarehouse = async (e) => {
    e.preventDefault();
    if (!bulkWhId) return toast.error('Warehouse is required');
    const validItems = bulkWhItems.filter(i => i.productId && i.quantity);
    if (!validItems.length) return toast.error('At least one product with quantity is required');
    try {
      setSavingBulk(true);
      const res = await stockAPI.bulkOpeningByWarehouse({
        warehouseId: bulkWhId,
        items: validItems.map(i => ({ productId: i.productId, quantity: Number(i.quantity), warehousePrice: i.warehousePrice ? Number(i.warehousePrice) : undefined })),
      });
      const data = res.data;
      toast.success(`${data?.success?.length || 0} set, ${data?.skipped?.length || 0} skipped`);
      if (data?.skipped?.length) data.skipped.forEach(s => toast.error(`Skipped ${s.productId?.slice(-6) || 'item'}: ${s.reason}`));
      setBulkWhItems([{ productId: '', quantity: '', warehousePrice: '' }]);
    } catch (err) { toast.error(err.message || 'Bulk opening stock failed'); }
    finally { setSavingBulk(false); }
  };

  const handleBulkByProduct = async (e) => {
    e.preventDefault();
    if (!bulkProdId) return toast.error('Product is required');
    const validWhs = bulkProdWarehouses.filter(w => w.warehouseId && w.quantity);
    if (!validWhs.length) return toast.error('At least one warehouse with quantity is required');
    try {
      setSavingBulk(true);
      const res = await stockAPI.bulkOpeningByProduct({
        productId: bulkProdId,
        warehouses: validWhs.map(w => ({ warehouseId: w.warehouseId, quantity: Number(w.quantity), warehousePrice: w.warehousePrice ? Number(w.warehousePrice) : undefined })),
      });
      const data = res.data;
      toast.success(`${data?.success?.length || 0} set, ${data?.skipped?.length || 0} skipped`);
      if (data?.skipped?.length) data.skipped.forEach(s => toast.error(`Skipped: ${s.reason}`));
      setBulkProdWarehouses([{ warehouseId: '', quantity: '', warehousePrice: '' }]);
    } catch (err) { toast.error(err.message || 'Bulk opening stock failed'); }
    finally { setSavingBulk(false); }
  };

  const renderOpening = () => (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        {[{ id: 'single', label: 'Single SKU' }, { id: 'byWarehouse', label: 'Bulk by Warehouse' }, { id: 'byProduct', label: 'Bulk by Product' }].map(m => (
          <button
            key={m.id}
            onClick={() => setOpeningMode(m.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${openingMode === m.id ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-gray-200 hover:bg-violet-50'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {openingMode === 'single' && (
        <GlassCard className="max-w-lg">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Package size={20} className="text-violet-600" /> Set Opening Stock
          </h3>
          <p className="text-xs text-amber-600 mb-3">Note: Opening stock can only be set once per SKU per warehouse.</p>
          <form onSubmit={handleOpeningSubmit} className="space-y-4">
            <Select label="Product" options={productOpts} placeholder="Select product" value={openingForm.productId}
              onChange={(e) => setOpeningForm((p) => ({ ...p, productId: e.target.value }))} />
            <Select label="Warehouse" options={warehouseOpts} placeholder="Select warehouse" value={openingForm.warehouseId}
              onChange={(e) => setOpeningForm((p) => ({ ...p, warehouseId: e.target.value }))} />
            <Input label="Quantity" type="number" min="0" value={openingForm.quantity}
              onChange={(e) => setOpeningForm((p) => ({ ...p, quantity: e.target.value }))} />
            <Input label="Cost Price" type="number" min="0" step="0.01" value={openingForm.costPrice}
              onChange={(e) => setOpeningForm((p) => ({ ...p, costPrice: e.target.value }))} />
            <Button type="submit" loading={savingOpening}>Set Opening Stock</Button>
          </form>
        </GlassCard>
      )}

      {openingMode === 'byWarehouse' && (
        <GlassCard>
          <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <Layers size={20} className="text-violet-600" /> Bulk Opening Stock by Warehouse
          </h3>
          <p className="text-xs text-slate-500 mb-4">Select a warehouse and add opening inventory for multiple SKUs at once.</p>
          <form onSubmit={handleBulkByWarehouse} className="space-y-4">
            <div className="max-w-xs">
              <Select label="Warehouse *" options={warehouseOpts} placeholder="Select warehouse" value={bulkWhId}
                onChange={(e) => setBulkWhId(e.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 border-b text-xs uppercase">
                    <th className="py-2 text-left">Product</th>
                    <th className="py-2 text-center w-28">Quantity</th>
                    <th className="py-2 text-center w-32">Cost Price</th>
                    <th className="py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {bulkWhItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2 pr-2">
                        <Select options={productOpts} value={item.productId} onChange={(e) => updateBulkWhItem(idx, 'productId', e.target.value)} />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min="0" className="w-full text-center border border-gray-200 rounded px-2 py-1.5 text-sm" value={item.quantity} onChange={(e) => updateBulkWhItem(idx, 'quantity', e.target.value)} />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min="0" step="0.01" className="w-full text-center border border-gray-200 rounded px-2 py-1.5 text-sm" value={item.warehousePrice} onChange={(e) => updateBulkWhItem(idx, 'warehousePrice', e.target.value)} placeholder="Optional" />
                      </td>
                      <td className="py-2 text-center">
                        {bulkWhItems.length > 1 && <button type="button" onClick={() => removeBulkWhItem(idx)} className="text-red-400 hover:text-red-600"><XCircle size={16} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={addBulkWhItem}><Plus size={14} className="mr-1" /> Add Row</Button>
              <Button type="submit" loading={savingBulk}>Save All</Button>
            </div>
          </form>
        </GlassCard>
      )}

      {openingMode === 'byProduct' && (
        <GlassCard>
          <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <Package size={20} className="text-violet-600" /> Bulk Opening Stock by Product
          </h3>
          <p className="text-xs text-slate-500 mb-4">Select a product and set opening stock across multiple warehouses at once.</p>
          <form onSubmit={handleBulkByProduct} className="space-y-4">
            <div className="max-w-xs">
              <Select label="Product *" options={productOpts} placeholder="Select product" value={bulkProdId}
                onChange={(e) => setBulkProdId(e.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 border-b text-xs uppercase">
                    <th className="py-2 text-left">Warehouse</th>
                    <th className="py-2 text-center w-28">Quantity</th>
                    <th className="py-2 text-center w-32">Cost Price</th>
                    <th className="py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {bulkProdWarehouses.map((wh, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2 pr-2">
                        <Select options={warehouseOpts} value={wh.warehouseId} onChange={(e) => updateBulkProdWh(idx, 'warehouseId', e.target.value)} />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min="0" className="w-full text-center border border-gray-200 rounded px-2 py-1.5 text-sm" value={wh.quantity} onChange={(e) => updateBulkProdWh(idx, 'quantity', e.target.value)} />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min="0" step="0.01" className="w-full text-center border border-gray-200 rounded px-2 py-1.5 text-sm" value={wh.warehousePrice} onChange={(e) => updateBulkProdWh(idx, 'warehousePrice', e.target.value)} placeholder="Optional" />
                      </td>
                      <td className="py-2 text-center">
                        {bulkProdWarehouses.length > 1 && <button type="button" onClick={() => removeBulkProdWh(idx)} className="text-red-400 hover:text-red-600"><XCircle size={16} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={addBulkProdWh}><Plus size={14} className="mr-1" /> Add Row</Button>
              <Button type="submit" loading={savingBulk}>Save All</Button>
            </div>
          </form>
        </GlassCard>
      )}
    </div>
  );

  const renderAdjustments = () => (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setAdjForm(emptyAdjustment); setAdjModalOpen(true); }}>
          <Plus size={16} className="mr-1" /> New Adjustment
        </Button>
      </div>
      <DataTable columns={adjColumns} data={adjustments} loading={loading} emptyMessage="No adjustments found" />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />

      <Modal open={adjModalOpen} onClose={() => setAdjModalOpen(false)} title="Create Stock Adjustment">
        <form onSubmit={handleAdjSubmit} className="space-y-4">
          <Select label="Product" options={productOpts} placeholder="Select product" value={adjForm.productId}
            onChange={(e) => setAdjForm((p) => ({ ...p, productId: e.target.value }))} />
          <Select label="Warehouse" options={warehouseOpts} placeholder="Select warehouse" value={adjForm.warehouseId}
            onChange={(e) => setAdjForm((p) => ({ ...p, warehouseId: e.target.value }))} />
          <Select label="Adjustment Type" options={adjTypeOpts} value={adjForm.adjustmentType}
            onChange={(e) => setAdjForm((p) => ({ ...p, adjustmentType: e.target.value }))} />
          <Input label="Quantity" type="number" min="1" value={adjForm.adjustedQuantity}
            onChange={(e) => setAdjForm((p) => ({ ...p, adjustedQuantity: e.target.value }))} />
          <Select label="Reason" options={[
            { value: 'damage', label: 'Damage' },
            { value: 'theft', label: 'Theft' },
            { value: 'count_correction', label: 'Count Correction' },
            { value: 'expiry', label: 'Expiry' },
            { value: 'other', label: 'Other' },
          ]} value={adjForm.reason}
            onChange={(e) => setAdjForm((p) => ({ ...p, reason: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setAdjModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={savingAdj}>Create Adjustment</Button>
          </div>
        </form>
      </Modal>
    </>
  );

  const renderTransfers = () => (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setTxForm(emptyTransfer); setTxModalOpen(true); }}>
          <ArrowLeftRight size={16} className="mr-1" /> New Transfer
        </Button>
      </div>
      <DataTable columns={txColumns} data={transfers} loading={loading} emptyMessage="No transfers found" />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />

      <Modal open={txModalOpen} onClose={() => setTxModalOpen(false)} title="Create Stock Transfer" size="lg">
        <form onSubmit={handleTxSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="From Warehouse" options={warehouseOpts} placeholder="Select source" value={txForm.fromWarehouse}
              onChange={(e) => setTxForm((p) => ({ ...p, fromWarehouse: e.target.value }))} />
            <Select label="To Warehouse" options={warehouseOpts} placeholder="Select destination" value={txForm.toWarehouse}
              onChange={(e) => setTxForm((p) => ({ ...p, toWarehouse: e.target.value }))} />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-600">Items</label>
            {txForm.items.map((item, idx) => (
              <div key={idx} className="flex items-end gap-3">
                <div className="flex-1">
                  <Select label={idx === 0 ? 'Product' : ''} options={productOpts} placeholder="Select product" value={item.product}
                    onChange={(e) => updateTxItem(idx, 'product', e.target.value)} />
                </div>
                <div className="w-28">
                  <Input label={idx === 0 ? 'Qty' : ''} type="number" min="1" value={item.quantity}
                    onChange={(e) => updateTxItem(idx, 'quantity', e.target.value)} />
                </div>
                {txForm.items.length > 1 && (
                  <button type="button" onClick={() => removeTxItem(idx)} className="text-red-400 hover:text-red-300 pb-2">
                    <XCircle size={18} />
                  </button>
                )}
              </div>
            ))}
            <Button variant="ghost" type="button" size="sm" onClick={addTxItem}>
              <Plus size={14} className="mr-1" /> Add Item
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setTxModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={savingTx}>Create Transfer</Button>
          </div>
        </form>
      </Modal>
    </>
  );

  const renderMovements = () => (
    <>
      <div className="flex items-center gap-3 mb-4">
        <SearchInput value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search movements..." />
      </div>
      <DataTable columns={mvColumns} data={movements} loading={loading} emptyMessage="No movements found" />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
    </>
  );

  const viewMap = {
    overview: renderOverview,
    low: renderLowStock,
    opening: renderOpening,
    adjustments: renderAdjustments,
    transfers: renderTransfers,
    movements: renderMovements,
  };

  return (
    <div>
      <PageHeader
        title="Stock Management"
        subtitle="Track inventory, transfers, and adjustments"
        actions={
          <div className="flex gap-2">
            {activeTab === 'adjustments' && (
              <Button onClick={() => { setAdjForm(emptyAdjustment); setAdjModalOpen(true); }}>
                <Plus size={16} className="mr-1" /> New Adjustment
              </Button>
            )}
            {activeTab === 'transfers' && (
              <Button onClick={() => { setTxForm(emptyTransfer); setTxModalOpen(true); }}>
                <ArrowLeftRight size={16} className="mr-1" /> New Transfer
              </Button>
            )}
          </div>
        }
      />

      <TabList tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <div className="mt-2">
        {viewMap[activeTab]?.()}
      </div>
    </div>
  );
}
