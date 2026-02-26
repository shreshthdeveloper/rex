import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, Textarea, DataTable, Badge, GlassCard, SearchInput, Loader, TabList, Pagination } from '../../components/ui';
import { stockAPI, productsAPI, warehousesAPI } from '../../api';
import { Plus, Layers, ArrowLeftRight, CheckCircle, XCircle, Package, Trash2, Eye, Pencil } from 'lucide-react';
import ProductSearch from '../../components/ProductSearch';

const tabs = [
  { id: 'overview', label: 'Stock Overview' },
  { id: 'opening', label: 'Opening Stock' },
  { id: 'adjustments', label: 'Adjustments' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'movements', label: 'Movements' },
];

const adjTypeOpts = [
  { value: 'increase', label: 'Addition' },
  { value: 'decrease', label: 'Subtraction' },
];

const transferStatusColor = { pending: 'yellow', completed: 'green', cancelled: 'red', in_transit: 'cyan' };
const adjStatusColor = { pending: 'yellow', approved: 'green', cancelled: 'red' };

const emptyAdjustment = {
  warehouseId: '',
  adjustmentType: 'increase',
  reason: 'count_correction',
  notes: '',
  items: [], // [{ product, currentStock, qty }]
};
const emptyTransfer = {
  fromWarehouse: '',
  toWarehouse: '',
  notes: '',
  items: [], // [{ product, currentStock, qty }]
};

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
  const [adjustments, setAdjustments] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [movements, setMovements] = useState([]);


  // Adjustment modal (create)
  const [adjModalOpen, setAdjModalOpen] = useState(false);
  const [adjForm, setAdjForm] = useState(emptyAdjustment);
  const [savingAdj, setSavingAdj] = useState(false);

  // Adjustment view modal
  const [viewAdjOpen, setViewAdjOpen] = useState(false);
  const [viewAdjData, setViewAdjData] = useState(null);
  const [loadingAdjView, setLoadingAdjView] = useState(false);

  // Adjustment edit modal
  const [editAdjOpen, setEditAdjOpen] = useState(false);
  const [editAdjForm, setEditAdjForm] = useState(emptyAdjustment);
  const [editAdjId, setEditAdjId] = useState(null);
  const [savingEditAdj, setSavingEditAdj] = useState(false);

  // Transfer modal (create)
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState(emptyTransfer);
  const [savingTx, setSavingTx] = useState(false);

  // Transfer view modal
  const [viewTxOpen, setViewTxOpen] = useState(false);
  const [viewTxData, setViewTxData] = useState(null);
  const [loadingView, setLoadingView] = useState(false);

  // Transfer edit modal
  const [editTxOpen, setEditTxOpen] = useState(false);
  const [editTxForm, setEditTxForm] = useState(emptyTransfer);
  const [editTxId, setEditTxId] = useState(null);
  const [savingEditTx, setSavingEditTx] = useState(false);

  // Stock history modal (product movements)
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null); // { name, _id, warehouseId, warehouseName }
  const [historyMovements, setHistoryMovements] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

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

  const fetchAdjustments = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page };
      if (search) params.search = search;
      const res = await stockAPI.listAdjustments(params);
      setAdjustments(res.data?.adjustments || []);
      setTotalPages(res.data?.pagination?.pages || 1);
    } catch (err) { toast.error(err.message || 'Failed to load adjustments'); }
    finally { setLoading(false); }
  }, [page, search]);

  const fetchTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page };
      if (search) params.search = search;
      const res = await stockAPI.listTransfers(params);
      setTransfers(res.data?.transfers || []);
      setTotalPages(res.data?.pagination?.pages || 1);
    } catch (err) { toast.error(err.message || 'Failed to load transfers'); }
    finally { setLoading(false); }
  }, [page, search]);

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
    const fetchMap = { overview: fetchStock, adjustments: fetchAdjustments, transfers: fetchTransfers, movements: fetchMovements };
    fetchMap[activeTab]?.();
  }, [activeTab, fetchStock, fetchAdjustments, fetchTransfers, fetchMovements]);

  // ─── Adjustment Submit ───
  const handleAdjSubmit = async (e) => {
    e.preventDefault();
    if (!adjForm.warehouseId) return toast.error('Please select a warehouse');
    const validItems = adjForm.items.filter((i) => i.qty && Number(i.qty) > 0);
    if (!validItems.length) return toast.error('Add at least one product with a valid quantity');
    try {
      setSavingAdj(true);
      await stockAPI.bulkCreateAdjustment({
        warehouseId: adjForm.warehouseId,
        adjustmentType: adjForm.adjustmentType,
        reason: adjForm.reason,
        notes: adjForm.notes,
        items: validItems.map((i) => ({
          productId: i.product._id,
          adjustedQuantity: Number(i.qty),
        })),
      });
      toast.success('Adjustment batch created — pending approval');
      setAdjModalOpen(false);
      setAdjForm(emptyAdjustment);
      fetchAdjustments();
    } catch (err) { toast.error(err.message || 'Failed to create adjustments'); }
    finally { setSavingAdj(false); }
  };

  // ─── Product Search Select Handler (for adjustment modal) ───
  const handleAdjProductSelect = (selectedItems) => {
    setAdjForm((prev) => {
      const incoming = selectedItems.filter(
        (s) => !prev.items.find((existing) => existing.product._id === s.product._id)
      );
      if (incoming.length === 0) {
        toast.warning('Product(s) already added to the list');
        return prev;
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          ...incoming.map((s) => ({ product: s.product, currentStock: s.currentStock, qty: '' })),
        ],
      };
    });
  };

  const removeAdjItem = (productId) =>
    setAdjForm((prev) => ({ ...prev, items: prev.items.filter((i) => i.product._id !== productId) }));

  const updateAdjItemQty = (productId, qty) =>
    setAdjForm((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.product._id === productId ? { ...i, qty } : i)),
    }));

  // ─── Adjustment view / edit / approve / cancel handlers ───
  const openViewAdj = async (id) => {
    try {
      setLoadingAdjView(true);
      setViewAdjOpen(true);
      const res = await stockAPI.getAdjustment(id);
      setViewAdjData(res.data);
    } catch (err) { toast.error('Failed to load adjustment details'); setViewAdjOpen(false); }
    finally { setLoadingAdjView(false); }
  };

  const openEditAdj = async (record) => {
    try {
      setLoadingAdjView(true);
      const res = await stockAPI.getAdjustment(record._id);
      const b = res.data;
      setEditAdjId(b._id);
      setEditAdjForm({
        warehouseId:    b.warehouse?._id || b.warehouse,
        adjustmentType: b.adjustmentType,
        reason:         b.reason,
        notes:          b.notes || '',
        items: b.items.map((i) => ({
          product:      i.product,
          currentStock: 0, // refreshed by useEffect
          qty:          String(i.requestedQty),
        })),
      });
      setEditAdjOpen(true);
    } catch (err) { toast.error('Failed to load adjustment'); }
    finally { setLoadingAdjView(false); }
  };

  const handleApproveAdj = async (id) => {
    try {
      await stockAPI.approveAdjustment(id);
      toast.success('Adjustment approved — stock updated');
      fetchAdjustments();
    } catch (err) { toast.error(err.message || 'Failed to approve'); }
  };

  const handleCancelAdj = async (id) => {
    try {
      await stockAPI.cancelAdjustment(id);
      toast.success('Adjustment cancelled');
      fetchAdjustments();
    } catch (err) { toast.error(err.message || 'Failed to cancel'); }
  };

  const updateEditAdjItemQty = (productId, qty) =>
    setEditAdjForm((prev) => ({
      ...prev,
      items: prev.items.map((i) => {
        const id = i.product._id || i.product;
        return id === productId ? { ...i, qty } : i;
      }),
    }));

  const removeEditAdjItem = (productId) =>
    setEditAdjForm((prev) => ({
      ...prev,
      items: prev.items.filter((i) => (i.product._id || i.product) !== productId),
    }));

  const handleEditAdjProductSelect = (selectedItems) => {
    setEditAdjForm((prev) => {
      const incoming = selectedItems.filter(
        (s) => !prev.items.find((e) => (e.product._id || e.product) === s.product._id)
      );
      if (incoming.length === 0) { toast.warning('Product(s) already added'); return prev; }
      return {
        ...prev,
        items: [...prev.items, ...incoming.map((s) => ({ product: s.product, currentStock: s.currentStock, qty: '' }))],
      };
    });
  };

  const handleEditAdjSubmit = async (e) => {
    e.preventDefault();
    if (!editAdjForm.warehouseId) return toast.error('Select a warehouse');
    const validItems = editAdjForm.items.filter((i) => i.qty && Number(i.qty) > 0);
    if (!validItems.length) return toast.error('Add at least one product with a valid quantity');
    try {
      setSavingEditAdj(true);
      await stockAPI.updateAdjustment(editAdjId, {
        warehouseId:    editAdjForm.warehouseId,
        adjustmentType: editAdjForm.adjustmentType,
        reason:         editAdjForm.reason,
        notes:          editAdjForm.notes,
        items: validItems.map((i) => ({
          product:          i.product._id || i.product,
          adjustedQuantity: Number(i.qty),
        })),
      });
      toast.success('Adjustment updated');
      setEditAdjOpen(false);
      fetchAdjustments();
    } catch (err) { toast.error(err.message || 'Failed to update adjustment'); }
    finally { setSavingEditAdj(false); }
  };

  // ─── Transfer Submit ───
  const handleTxSubmit = async (e) => {
    e.preventDefault();
    if (!txForm.fromWarehouse) return toast.error('Please select a source warehouse');
    if (!txForm.toWarehouse) return toast.error('Please select a destination warehouse');
    if (txForm.fromWarehouse === txForm.toWarehouse) return toast.error('Source and destination warehouses must be different');
    const validItems = txForm.items.filter((i) => i.qty && Number(i.qty) > 0);
    if (!validItems.length) return toast.error('Add at least one product with a valid quantity');
    const payload = {
      fromWarehouse: txForm.fromWarehouse,
      toWarehouse:   txForm.toWarehouse,
      notes:         txForm.notes,
      items: validItems.map((i) => ({
        product:      i.product._id,
        requestedQty: Number(i.qty),
      })),
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

  // ─── Transfer Product Select Handler ───
  const handleTxProductSelect = (selectedItems) => {
    setTxForm((prev) => {
      const incoming = selectedItems.filter(
        (s) => !prev.items.find((existing) => existing.product._id === s.product._id)
      );
      if (incoming.length === 0) {
        toast.warning('Product(s) already added to the list');
        return prev;
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          ...incoming.map((s) => ({ product: s.product, currentStock: s.currentStock, qty: '' })),
        ],
      };
    });
  };

  const removeTxItemById = (productId) =>
    setTxForm((prev) => ({ ...prev, items: prev.items.filter((i) => i.product._id !== productId) }));

  const updateTxItemQty = (productId, qty) =>
    setTxForm((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.product._id === productId ? { ...i, qty } : i)),
    }));

  const updateEditTxItemQty = (productId, qty) =>
    setEditTxForm((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.product._id === productId ? { ...i, qty } : i)),
    }));

  const removeEditTxItem = (productId) =>
    setEditTxForm((prev) => ({ ...prev, items: prev.items.filter((i) => i.product._id !== productId) }));

  const handleEditTxProductSelect = (selectedItems) => {
    setEditTxForm((prev) => {
      const incoming = selectedItems.filter(
        (s) => !prev.items.find((existing) => existing.product._id === s.product._id)
      );
      if (incoming.length === 0) { toast.warning('Product(s) already added'); return prev; }
      return {
        ...prev,
        items: [...prev.items, ...incoming.map((s) => ({ product: s.product, currentStock: s.currentStock, qty: '' }))],
      };
    });
  };

  // ─── Re-fetch stock for existing items when adjustment warehouse changes ───
  useEffect(() => {
    if (!adjForm.warehouseId || adjForm.items.length === 0) return;
    let cancelled = false;
    stockAPI.list({ warehouse: adjForm.warehouseId, limit: 999 }).then((res) => {
      if (cancelled) return;
      const stocks = res.data?.stocks || [];
      const map = {};
      stocks.forEach((s) => { const pid = s.product?._id || s.product; if (pid) map[pid] = s.quantity ?? 0; });
      setAdjForm((prev) => ({
        ...prev,
        items: prev.items.map((item) => ({ ...item, currentStock: map[item.product._id] ?? 0 })),
      }));
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjForm.warehouseId]);

  // ─── Re-fetch stock for existing items when transfer fromWarehouse changes ───
  useEffect(() => {
    if (!txForm.fromWarehouse || txForm.items.length === 0) return;
    let cancelled = false;
    stockAPI.list({ warehouse: txForm.fromWarehouse, limit: 999 }).then((res) => {
      if (cancelled) return;
      const stocks = res.data?.stocks || [];
      const map = {};
      stocks.forEach((s) => { const pid = s.product?._id || s.product; if (pid) map[pid] = s.quantity ?? 0; });
      setTxForm((prev) => ({
        ...prev,
        items: prev.items.map((item) => ({ ...item, currentStock: map[item.product._id] ?? 0 })),
      }));
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txForm.fromWarehouse]);

  // ─── Re-fetch stock for existing items when EDIT transfer fromWarehouse changes ───
  useEffect(() => {
    if (!editTxForm.fromWarehouse || editTxForm.items.length === 0) return;
    let cancelled = false;
    stockAPI.list({ warehouse: editTxForm.fromWarehouse, limit: 999 }).then((res) => {
      if (cancelled) return;
      const stocks = res.data?.stocks || [];
      const map = {};
      stocks.forEach((s) => { const pid = s.product?._id || s.product; if (pid) map[pid] = s.quantity ?? 0; });
      setEditTxForm((prev) => ({
        ...prev,
        items: prev.items.map((item) => ({ ...item, currentStock: map[item.product._id] ?? 0 })),
      }));
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTxForm.fromWarehouse]);

  // ─── Re-fetch stock for existing items when EDIT adjustment warehouse changes ───
  useEffect(() => {
    if (!editAdjForm.warehouseId || editAdjForm.items.length === 0) return;
    let cancelled = false;
    stockAPI.list({ warehouse: editAdjForm.warehouseId, limit: 999 }).then((res) => {
      if (cancelled) return;
      const stocks = res.data?.stocks || [];
      const map = {};
      stocks.forEach((s) => { const pid = s.product?._id || s.product; if (pid) map[pid] = s.quantity ?? 0; });
      setEditAdjForm((prev) => ({
        ...prev,
        items: prev.items.map((item) => {
          const id = item.product?._id || item.product;
          return { ...item, currentStock: map[id] ?? 0 };
        }),
      }));
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editAdjForm.warehouseId]);

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

  const openViewTransfer = async (id) => {
    try {
      setLoadingView(true);
      setViewTxOpen(true);
      const res = await stockAPI.getTransfer(id);
      setViewTxData(res.data);
    } catch (err) { toast.error('Failed to load transfer details'); setViewTxOpen(false); }
    finally { setLoadingView(false); }
  };

  const openEditTransfer = async (record) => {
    try {
      setLoadingView(true);
      const res = await stockAPI.getTransfer(record._id);
      const t = res.data;
      setEditTxId(t._id);
      setEditTxForm({
        fromWarehouse: t.fromWarehouse?._id || t.fromWarehouse,
        toWarehouse:   t.toWarehouse?._id   || t.toWarehouse,
        notes:         t.notes || '',
        items: t.items.map((i) => ({
          product:      i.product,
          currentStock: 0, // will be refreshed by useEffect when fromWarehouse is set
          qty:          String(i.requestedQty),
        })),
      });
      setEditTxOpen(true);
    } catch (err) { toast.error('Failed to load transfer'); }
    finally { setLoadingView(false); }
  };

  const handleEditTxSubmit = async (e) => {
    e.preventDefault();
    if (!editTxForm.fromWarehouse) return toast.error('Select a source warehouse');
    if (!editTxForm.toWarehouse)   return toast.error('Select a destination warehouse');
    if (editTxForm.fromWarehouse === editTxForm.toWarehouse) return toast.error('Warehouses must be different');
    const validItems = editTxForm.items.filter((i) => i.qty && Number(i.qty) > 0);
    if (!validItems.length) return toast.error('Add at least one product with a valid quantity');
    try {
      setSavingEditTx(true);
      await stockAPI.updateTransfer(editTxId, {
        fromWarehouse: editTxForm.fromWarehouse,
        toWarehouse:   editTxForm.toWarehouse,
        notes:         editTxForm.notes,
        items: validItems.map((i) => ({ product: i.product._id, requestedQty: Number(i.qty) })),
      });
      toast.success('Transfer updated');
      setEditTxOpen(false);
      fetchTransfers();
    } catch (err) { toast.error(err.message || 'Failed to update transfer'); }
    finally { setSavingEditTx(false); }
  };

  // ─── Stock history handler ───
  const openStockHistory = async (row) => {
    setHistoryProduct({ name: row.product?.name || '?', productId: row.product?._id || row.product, warehouseName: row.warehouse?.name });
    setHistoryPage(1);
    setHistoryOpen(true);
    try {
      setLoadingHistory(true);
      const res = await stockAPI.productMovements(row.product?._id || row.product, { page: 1, limit: 20 });
      setHistoryMovements(res.data?.movements || []);
      setHistoryTotalPages(res.data?.pagination?.pages || 1);
    } catch { toast.error('Failed to load history'); }
    finally { setLoadingHistory(false); }
  };

  useEffect(() => {
    if (!historyOpen || !historyProduct) return;
    setLoadingHistory(true);
    stockAPI.productMovements(historyProduct.productId, { page: historyPage, limit: 20 })
      .then((res) => { setHistoryMovements(res.data?.movements || []); setHistoryTotalPages(res.data?.pagination?.pages || 1); })
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoadingHistory(false));
  }, [historyPage, historyOpen]);

  // (transfer item helpers moved to named handlers above)

  // ─── Column definitions ───
  const stockColumns = [
    {
      key: 'actions', label: '', render: (r) => (
        <button onClick={(e) => { e.stopPropagation(); openStockHistory(r); }} className="p-1 text-slate-400 hover:text-violet-600 rounded transition-colors" title="View history">
          <Eye size={16} />
        </button>
      ),
    },
    { key: 'product', label: 'Product', render: (r) => r.product?.name || r.product || '—' },
    { key: 'warehouse', label: 'Warehouse', render: (r) => r.warehouse?.name || r.warehouse || '—' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'reserved', label: 'Reserved', render: (r) => r.reservedQuantity ?? r.reserved ?? 0 },
    { key: 'available', label: 'Available', render: (r) => (r.quantity ?? 0) - (r.reservedQuantity ?? r.reserved ?? 0) },
    { key: 'reorderLevel', label: 'Reorder Level', render: (r) => r.reorderLevel ?? r.lowStockThreshold ?? '—' },
  ];

  const adjColumns = [
    { key: 'batchNumber', label: 'Ref #', render: (r) => r.batchNumber || r._id?.slice(-6) },
    {
      key: 'actions', label: 'Actions', render: (r) => (
        <div className="flex gap-1.5 items-center">
          <button onClick={(e) => { e.stopPropagation(); openViewAdj(r._id); }} className="p-1 text-slate-400 hover:text-violet-600 rounded transition-colors" title="View">
            <Eye size={16} />
          </button>
          {r.status === 'pending' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); openEditAdj(r); }} className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors" title="Edit">
                <Pencil size={16} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleApproveAdj(r._id); }} className="p-1 text-slate-400 hover:text-green-600 rounded transition-colors" title="Approve">
                <CheckCircle size={16} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleCancelAdj(r._id); }} className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors" title="Cancel">
                <XCircle size={16} />
              </button>
            </>
          )}
        </div>
      ),
    },
    { key: 'warehouse', label: 'Warehouse', render: (r) => r.warehouse?.name || '—' },
    { key: 'adjustmentType', label: 'Type', render: (r) => <Badge color={r.adjustmentType === 'increase' ? 'green' : 'red'}>{r.adjustmentType}</Badge> },
    { key: 'items', label: 'Items', render: (r) => r.items?.length || 0 },
    { key: 'reason', label: 'Reason', render: (r) => r.reason?.replace('_', ' ') || '—' },
    { key: 'status', label: 'Status', render: (r) => <Badge color={adjStatusColor[r.status] || 'yellow'}>{r.status}</Badge> },
    { key: 'createdAt', label: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
  ];

  const txColumns = [
    { key: 'transferNumber', label: 'Ref #', render: (r) => r.transferNumber || r._id?.slice(-6) },
    {
      key: 'actions', label: 'Actions', render: (r) => (
        <div className="flex gap-1.5 items-center">
          <button onClick={(e) => { e.stopPropagation(); openViewTransfer(r._id); }} className="p-1 text-slate-400 hover:text-violet-600 rounded transition-colors" title="View">
            <Eye size={16} />
          </button>
          {r.status === 'in_transit' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); openEditTransfer(r); }} className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors" title="Edit">
                <Pencil size={16} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleCompleteTransfer(r._id); }} className="p-1 text-slate-400 hover:text-green-600 rounded transition-colors" title="Complete">
                <CheckCircle size={16} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleCancelTransfer(r._id); }} className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors" title="Cancel">
                <XCircle size={16} />
              </button>
            </>
          )}
        </div>
      ),
    },
    { key: 'from', label: 'From', render: (r) => r.fromWarehouse?.name || '—' },
    { key: 'to', label: 'To', render: (r) => r.toWarehouse?.name || '—' },
    { key: 'items', label: 'Items', render: (r) => r.items?.length || 0 },
    { key: 'status', label: 'Status', render: (r) => <Badge color={transferStatusColor[r.status] || 'cyan'}>{r.status}</Badge> },
    { key: 'createdAt', label: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
  ];

  const mvTypeColor = { transfer_in: 'green', transfer_out: 'red', adjustment_in: 'blue', adjustment_out: 'orange', opening_stock: 'violet', sale: 'red', return: 'green' };
  const mvColumns = [
    { key: 'movementType', label: 'Type', render: (r) => <Badge color={mvTypeColor[r.movementType] || 'slate'}>{r.movementType?.replace(/_/g, ' ')}</Badge> },
    { key: 'product', label: 'Product', render: (r) => r.product?.name || '—' },
    { key: 'warehouse', label: 'Warehouse', render: (r) => r.warehouse?.name || '—' },
    { key: 'quantityChange', label: 'Qty', render: (r) => { const q = r.quantityChange; return <span className={q > 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>{q > 0 ? '+' : ''}{q ?? '—'}</span>; } },
    { key: 'from', label: 'From', render: (r) => r.fromWarehouse?.name || '—' },
    { key: 'to', label: 'To', render: (r) => r.toWarehouse?.name || '—' },
    { key: 'referenceNumber', label: 'Reference', render: (r) => r.referenceNumber || '—' },
    { key: 'createdAt', label: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleString() : '—' },
  ];

  // ─── Render sub-views ───
  const renderOverview = () => (
    <>
      <div className="flex items-center gap-3 mb-4">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search products..." />
      </div>
      <DataTable columns={stockColumns} data={stockList} loading={loading} emptyMessage="No stock records found" />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />

      {/* ── Product History Modal ── */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={`Movement History — ${historyProduct?.name || ''}`} size="xl">
        {loadingHistory ? (
          <div className="py-12 flex justify-center"><Loader /></div>
        ) : historyMovements.length === 0 ? (
          <p className="text-center text-slate-400 py-10 text-sm">No movements found for this product.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2.5 px-3 text-left">Type</th>
                    <th className="py-2.5 px-3 text-left">Warehouse</th>
                    <th className="py-2.5 px-3 text-center w-20">Before</th>
                    <th className="py-2.5 px-3 text-center w-20">Change</th>
                    <th className="py-2.5 px-3 text-center w-20">After</th>
                    <th className="py-2.5 px-3 text-left">Reference</th>
                    <th className="py-2.5 px-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historyMovements.map((m) => {
                    const typeColor = { transfer_in: 'green', transfer_out: 'red', adjustment_in: 'blue', adjustment_out: 'orange', opening_stock: 'violet', sale: 'red', return: 'green' };
                    return (
                      <tr key={m._id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3"><Badge color={typeColor[m.movementType] || 'slate'}>{m.movementType?.replace(/_/g, ' ')}</Badge></td>
                        <td className="py-2.5 px-3 text-slate-700">{m.warehouse?.name || '—'}</td>
                        <td className="py-2.5 px-3 text-center text-slate-500">{m.quantityBefore ?? '—'}</td>
                        <td className="py-2.5 px-3 text-center font-semibold">
                          <span className={m.quantityChange > 0 ? 'text-emerald-600' : 'text-red-500'}>
                            {m.quantityChange > 0 ? '+' : ''}{m.quantityChange}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-800">{m.quantityAfter ?? '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-xs">{m.referenceNumber || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-xs whitespace-nowrap">{m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={historyPage} totalPages={historyTotalPages} onPageChange={setHistoryPage} className="mt-3" />
          </>
        )}
      </Modal>
    </>
  );

  // ─── Bulk opening stock states ───
  const [bulkWhId, setBulkWhId] = useState('');
  // Items use product object from ProductSearch: { product: {_id, name, sku, ...}, quantity: '', supplierPrice: '' }
  const [bulkWhItems, setBulkWhItems] = useState([]);
  const [savingBulk, setSavingBulk] = useState(false);

  // Bulk by warehouse — ProductSearch handler
  const handleOpeningProductSelect = (selectedItems) => {
    setBulkWhItems(prev => {
      const incoming = selectedItems.filter(
        s => !prev.find(existing => existing.product._id === s.product._id)
      );
      if (incoming.length === 0) {
        toast.warning('Product(s) already added to the list');
        return prev;
      }
      return [
        ...prev,
        ...incoming.map(s => ({ product: s.product, quantity: '', supplierPrice: '' })),
      ];
    });
  };

  const updateBulkWhItem = (idx, key, val) => setBulkWhItems(p => { const items = [...p]; items[idx] = { ...items[idx], [key]: val }; return items; });
  const removeBulkWhItem = (idx) => setBulkWhItems(p => p.filter((_, i) => i !== idx));

  const handleBulkByWarehouse = async (e) => {
    e.preventDefault();
    if (!bulkWhId) return toast.error('Warehouse is required');
    const validItems = bulkWhItems.filter(i => i.product?._id && i.quantity);
    if (!validItems.length) return toast.error('Add at least one product with a quantity');
    try {
      setSavingBulk(true);
      const res = await stockAPI.bulkOpeningByWarehouse({
        warehouseId: bulkWhId,
        items: validItems.map(i => ({ productId: i.product._id, quantity: Number(i.quantity), supplierPrice: i.supplierPrice ? Number(i.supplierPrice) : undefined })),
      });
      const data = res.data;
      toast.success(`${data?.success?.length || 0} set, ${data?.skipped?.length || 0} skipped`);
      if (data?.skipped?.length) data.skipped.forEach(s => toast.error(`Skipped ${s.productId?.slice(-6) || 'item'}: ${s.reason}`));
      setBulkWhItems([]);
    } catch (err) { toast.error(err.message || 'Bulk opening stock failed'); }
    finally { setSavingBulk(false); }
  };

  const renderOpening = () => (
    <div className="space-y-6">
      {/* ── Bulk by Warehouse (primary) ── */}
      <GlassCard>
        <h3 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Layers size={20} className="text-violet-600" /> Set Opening Stock
        </h3>
        <p className="text-xs text-slate-500 mb-4">Select a warehouse, search for products, then fill in quantity and supplier price before saving.</p>
        <p className="text-xs text-amber-600 mb-4">Note: Opening stock can only be set once per SKU per warehouse. Duplicate entries will be skipped.</p>
        <form onSubmit={handleBulkByWarehouse} className="space-y-4">
          <div className="max-w-xs">
            <Select label="Warehouse *" options={warehouseOpts} placeholder="Select warehouse" value={bulkWhId}
              onChange={(e) => setBulkWhId(e.target.value)} />
          </div>
          <ProductSearch
            label="Search & Add Products"
            onSelect={handleOpeningProductSelect}
            placeholder="Search by name or SKU…"
          />
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2.5 px-3 text-left">Product</th>
                    <th className="py-2.5 px-3 text-center w-32">Quantity *</th>
                    <th className="py-2.5 px-3 text-center w-36">Supplier Price</th>
                    <th className="py-2.5 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bulkWhItems.length === 0 ? (
                    <tr><td colSpan={4} className="py-6 text-center text-slate-400 text-xs">Search and add products above</td></tr>
                  ) : bulkWhItems.map((item, idx) => (
                    <tr key={item.product._id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{item.product.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{item.product.sku}
                          {item.product.variantValue && <span className="ml-1 text-amber-500">· {item.product.variantValue}</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number" min="0"
                          className="w-full text-center border border-gray-200 rounded px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-400"
                          value={item.quantity}
                          onChange={(e) => updateBulkWhItem(idx, 'quantity', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number" min="0" step="0.01"
                          className="w-full text-center border border-gray-200 rounded px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-400"
                          value={item.supplierPrice}
                          onChange={(e) => updateBulkWhItem(idx, 'supplierPrice', e.target.value)}
                          placeholder="Optional"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button type="button" onClick={() => removeBulkWhItem(idx)} className="text-red-400 hover:text-red-600">
                          <XCircle size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={savingBulk} disabled={!bulkWhItems.length}>Save Opening Stock</Button>
          </div>
        </form>
      </GlassCard>

    </div>
  );

  const renderAdjustments = () => (
    <>
      <div className="flex items-center justify-between mb-4 gap-3">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search by ref# (ADJ-...)" className="max-w-xs" />
        <Button onClick={() => { setAdjForm(emptyAdjustment); setAdjModalOpen(true); }}>
          <Plus size={16} className="mr-1" /> New Adjustment
        </Button>
      </div>
      <DataTable columns={adjColumns} data={adjustments} loading={loading} emptyMessage="No adjustments found" />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />

      {/* ─── Create Adjustment Modal ─── */}
      <Modal open={adjModalOpen} onClose={() => setAdjModalOpen(false)} title="Create Stock Adjustment" size="xl">
        <form onSubmit={handleAdjSubmit} className="space-y-5">
          <Select
            label="Warehouse *"
            options={warehouseOpts}
            placeholder="Select warehouse"
            value={adjForm.warehouseId}
            onChange={(e) => setAdjForm((p) => ({ ...p, warehouseId: e.target.value }))}
          />
          <ProductSearch
            label="Search & Add Products"
            warehouseId={adjForm.warehouseId || undefined}
            onSelect={handleAdjProductSelect}
            placeholder={adjForm.warehouseId ? 'Search by name or SKU (shows stock)…' : 'Select a warehouse first…'}
            disabled={!adjForm.warehouseId}
          />
          {adjForm.items.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2.5 px-3 text-left">Product</th>
                    <th className="py-2.5 px-3 text-center w-28">Current Stock</th>
                    <th className="py-2.5 px-3 text-center w-28">Quantity</th>
                    <th className="py-2.5 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {adjForm.items.map((item) => (
                    <tr key={item.product._id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{item.product.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{item.product.sku}{item.product.variantValue && <span className="ml-1 text-amber-500">· {item.product.variantValue}</span>}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-semibold ${item.currentStock <= 0 ? 'text-red-500' : item.currentStock <= 10 ? 'text-amber-500' : 'text-emerald-600'}`}>{item.currentStock}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <input type="number" min="1" value={item.qty} onChange={(e) => updateAdjItemQty(item.product._id, e.target.value)} placeholder="Qty"
                          className="w-24 mx-auto block text-center text-slate-900 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button type="button" onClick={() => removeAdjItem(item.product._id)} className="text-red-400 hover:text-red-600 transition-colors p-1 rounded"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 border border-dashed border-gray-200 rounded-xl bg-gray-50">
              <Package size={28} className="mb-2 text-slate-300" />
              <p className="text-sm">No products added yet</p>
              <p className="text-xs mt-1">Use the search above to add products</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Select label="Adjustment Type *" options={adjTypeOpts} value={adjForm.adjustmentType}
              onChange={(e) => setAdjForm((p) => ({ ...p, adjustmentType: e.target.value }))} />
            <Select label="Reason *" options={[
              { value: 'count_correction', label: 'Count Correction' }, { value: 'damage', label: 'Damage' },
              { value: 'theft', label: 'Theft' }, { value: 'expiry', label: 'Expiry' }, { value: 'other', label: 'Other' },
            ]} value={adjForm.reason} onChange={(e) => setAdjForm((p) => ({ ...p, reason: e.target.value }))} />
          </div>
          <Textarea label="Notes" placeholder="Optional notes…" value={adjForm.notes} rows={2}
            onChange={(e) => setAdjForm((p) => ({ ...p, notes: e.target.value }))} />
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-xs text-slate-400">{adjForm.items.filter((i) => i.qty && Number(i.qty) > 0).length} of {adjForm.items.length} product(s) ready</span>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={() => setAdjModalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={savingAdj} disabled={!adjForm.warehouseId || adjForm.items.length === 0}>
                Submit for Approval{adjForm.items.filter((i) => i.qty && Number(i.qty) > 0).length > 0 ? ` (${adjForm.items.filter((i) => i.qty && Number(i.qty) > 0).length} items)` : ''}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ─── View Adjustment Modal ─── */}
      <Modal open={viewAdjOpen} onClose={() => { setViewAdjOpen(false); setViewAdjData(null); }} title="Adjustment Details" size="xl">
        {loadingAdjView ? (
          <div className="flex justify-center py-12"><Loader /></div>
        ) : viewAdjData ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ref #</p>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{viewAdjData.batchNumber}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</p>
                  <div className="mt-1"><Badge color={adjStatusColor[viewAdjData.status] || 'yellow'}>{viewAdjData.status}</Badge></div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Type</p>
                  <div className="mt-1"><Badge color={viewAdjData.adjustmentType === 'increase' ? 'green' : 'red'}>{viewAdjData.adjustmentType}</Badge></div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Reason</p>
                  <p className="text-sm text-slate-700 mt-0.5 capitalize">{viewAdjData.reason?.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Warehouse</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{viewAdjData.warehouse?.name || '—'}</p>
                  {viewAdjData.warehouse?.code && <p className="text-xs text-slate-400">{viewAdjData.warehouse.code}</p>}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Created</p>
                  <p className="text-sm text-slate-700 mt-0.5">{viewAdjData.createdAt ? new Date(viewAdjData.createdAt).toLocaleString() : '—'}</p>
                </div>
                {viewAdjData.approvedAt && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Approved At</p>
                    <p className="text-sm text-slate-700 mt-0.5">{new Date(viewAdjData.approvedAt).toLocaleString()}</p>
                  </div>
                )}
                {viewAdjData.notes && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Notes</p>
                    <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{viewAdjData.notes}</p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Items ({viewAdjData.items?.length || 0})</p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-2.5 px-3 text-left">Product</th>
                      <th className="py-2.5 px-3 text-center w-28">Requested Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(viewAdjData.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{item.product?.name || '—'}</div>
                          {item.product?.sku && <div className="text-xs text-slate-400 mt-0.5">{item.product.sku}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{item.requestedQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <div className="flex gap-2">
                {viewAdjData.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => { handleApproveAdj(viewAdjData._id); setViewAdjOpen(false); }}>
                      <CheckCircle size={14} className="mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => { handleCancelAdj(viewAdjData._id); setViewAdjOpen(false); }}>
                      <XCircle size={14} className="mr-1" /> Cancel
                    </Button>
                  </>
                )}
              </div>
              <Button variant="ghost" onClick={() => { setViewAdjOpen(false); setViewAdjData(null); }}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ─── Edit Adjustment Modal ─── */}
      <Modal open={editAdjOpen} onClose={() => setEditAdjOpen(false)} title="Edit Stock Adjustment" size="xl">
        <form onSubmit={handleEditAdjSubmit} className="space-y-5">
          <Select label="Warehouse *" options={warehouseOpts} placeholder="Select warehouse" value={editAdjForm.warehouseId}
            onChange={(e) => setEditAdjForm((p) => ({ ...p, warehouseId: e.target.value }))} />
          <ProductSearch label="Search & Add Products" warehouseId={editAdjForm.warehouseId || undefined}
            onSelect={handleEditAdjProductSelect}
            placeholder={editAdjForm.warehouseId ? 'Search by name or SKU…' : 'Select a warehouse first…'}
            disabled={!editAdjForm.warehouseId} />
          {editAdjForm.items.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2.5 px-3 text-left">Product</th>
                    <th className="py-2.5 px-3 text-center w-28">Current Stock</th>
                    <th className="py-2.5 px-3 text-center w-28">Quantity</th>
                    <th className="py-2.5 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {editAdjForm.items.map((item) => {
                    const pid = item.product?._id || item.product;
                    const name = item.product?.name || item.product;
                    const sku  = item.product?.sku;
                    return (
                      <tr key={pid} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{name}</div>
                          {sku && <div className="text-xs text-slate-400 mt-0.5">{sku}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`font-semibold ${item.currentStock <= 0 ? 'text-red-500' : item.currentStock <= 10 ? 'text-amber-500' : 'text-emerald-600'}`}>{item.currentStock}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <input type="number" min="1" value={item.qty} onChange={(e) => updateEditAdjItemQty(pid, e.target.value)} placeholder="Qty"
                            className="w-24 mx-auto block text-center text-slate-900 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button type="button" onClick={() => removeEditAdjItem(pid)} className="text-red-400 hover:text-red-600 transition-colors p-1 rounded"><Trash2 size={15} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 border border-dashed border-gray-200 rounded-xl bg-gray-50">
              <Package size={28} className="mb-2 text-slate-300" />
              <p className="text-sm">No products added yet</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Select label="Adjustment Type *" options={adjTypeOpts} value={editAdjForm.adjustmentType}
              onChange={(e) => setEditAdjForm((p) => ({ ...p, adjustmentType: e.target.value }))} />
            <Select label="Reason *" options={[
              { value: 'count_correction', label: 'Count Correction' }, { value: 'damage', label: 'Damage' },
              { value: 'theft', label: 'Theft' }, { value: 'expiry', label: 'Expiry' }, { value: 'other', label: 'Other' },
            ]} value={editAdjForm.reason} onChange={(e) => setEditAdjForm((p) => ({ ...p, reason: e.target.value }))} />
          </div>
          <Textarea label="Notes" placeholder="Optional notes…" value={editAdjForm.notes} rows={2}
            onChange={(e) => setEditAdjForm((p) => ({ ...p, notes: e.target.value }))} />
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-xs text-slate-400">{editAdjForm.items.filter((i) => i.qty && Number(i.qty) > 0).length} of {editAdjForm.items.length} product(s) ready</span>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={() => setEditAdjOpen(false)}>Cancel</Button>
              <Button type="submit" loading={savingEditAdj} disabled={!editAdjForm.warehouseId || editAdjForm.items.length === 0}>Save Changes</Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );

  const renderTransfers = () => (
    <>
      <div className="flex items-center justify-between mb-4 gap-3">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search by ref# (TRF-...)" className="max-w-xs" />
        <Button onClick={() => { setTxForm(emptyTransfer); setTxModalOpen(true); }}>
          <ArrowLeftRight size={16} className="mr-1" /> New Transfer
        </Button>
      </div>
      <DataTable columns={txColumns} data={transfers} loading={loading} emptyMessage="No transfers found" />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />

      <Modal open={txModalOpen} onClose={() => setTxModalOpen(false)} title="Create Stock Transfer" size="xl">
        <form onSubmit={handleTxSubmit} className="space-y-5">

          {/* ── 1. Warehouse Selection ── */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="From Warehouse *"
              options={warehouseOpts.filter((w) => w.value !== txForm.toWarehouse)}
              placeholder="Select source"
              value={txForm.fromWarehouse}
              onChange={(e) => setTxForm((p) => ({ ...p, fromWarehouse: e.target.value }))}
            />
            <Select
              label="To Warehouse *"
              options={warehouseOpts.filter((w) => w.value !== txForm.fromWarehouse)}
              placeholder="Select destination"
              value={txForm.toWarehouse}
              onChange={(e) => setTxForm((p) => ({ ...p, toWarehouse: e.target.value }))}
            />
          </div>

          {/* ── 2. Product Search (uses fromWarehouse for stock display) ── */}
          <ProductSearch
            label="Search & Add Products"
            warehouseId={txForm.fromWarehouse || undefined}
            onSelect={handleTxProductSelect}
            placeholder={
              !txForm.fromWarehouse
                ? 'Select a source warehouse first…'
                : 'Search by name or SKU (shows available stock)…'
            }
            disabled={!txForm.fromWarehouse}
          />

          {/* ── 3. Products Table ── */}
          {txForm.items.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2.5 px-3 text-left">Product</th>
                    <th className="py-2.5 px-3 text-center w-32">Stock in Source</th>
                    <th className="py-2.5 px-3 text-center w-28">Quantity</th>
                    <th className="py-2.5 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {txForm.items.map((item) => (
                    <tr key={item.product._id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{item.product.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {item.product.sku}
                          {item.product.variantValue && (
                            <span className="ml-1 text-amber-500">· {item.product.variantValue}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`font-semibold ${
                            item.currentStock <= 0
                              ? 'text-red-500'
                              : item.currentStock <= 10
                              ? 'text-amber-500'
                              : 'text-emerald-600'
                          }`}
                        >
                          {item.currentStock}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min="1"
                          max={item.currentStock || undefined}
                          value={item.qty}
                          onChange={(e) => updateTxItemQty(item.product._id, e.target.value)}
                          placeholder="Qty"
                          className="w-24 mx-auto block text-center text-slate-900 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeTxItemById(item.product._id)}
                          className="text-red-400 hover:text-red-600 transition-colors p-1 rounded"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 border border-dashed border-gray-200 rounded-xl bg-gray-50">
              <ArrowLeftRight size={28} className="mb-2 text-slate-300" />
              <p className="text-sm">No products added yet</p>
              <p className="text-xs mt-1">Use the search above to add products to transfer</p>
            </div>
          )}

          {/* ── 4. Notes ── */}
          <Textarea
            label="Notes"
            placeholder="Optional notes about this transfer…"
            value={txForm.notes}
            rows={2}
            onChange={(e) => setTxForm((p) => ({ ...p, notes: e.target.value }))}
          />

          {/* ── Actions ── */}
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-xs text-slate-400">
              {txForm.items.filter((i) => i.qty && Number(i.qty) > 0).length} of {txForm.items.length} product(s) ready
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={() => setTxModalOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                loading={savingTx}
                disabled={!txForm.fromWarehouse || !txForm.toWarehouse || txForm.items.length === 0}
              >
                Create Transfer{txForm.items.filter((i) => i.qty && Number(i.qty) > 0).length > 0
                  ? ` (${txForm.items.filter((i) => i.qty && Number(i.qty) > 0).length} items)`
                  : ''}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ─── View Transfer Modal ─── */}
      <Modal open={viewTxOpen} onClose={() => { setViewTxOpen(false); setViewTxData(null); }} title="Transfer Details" size="xl">
        {loadingView ? (
          <div className="flex justify-center py-12"><Loader /></div>
        ) : viewTxData ? (
          <div className="space-y-5">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ref #</p>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{viewTxData.transferNumber}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</p>
                  <div className="mt-1"><Badge color={transferStatusColor[viewTxData.status] || 'cyan'}>{viewTxData.status}</Badge></div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Date</p>
                  <p className="text-sm text-slate-700 mt-0.5">{viewTxData.createdAt ? new Date(viewTxData.createdAt).toLocaleString() : '—'}</p>
                </div>
                {viewTxData.completedAt && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Completed At</p>
                    <p className="text-sm text-slate-700 mt-0.5">{new Date(viewTxData.completedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">From Warehouse</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{viewTxData.fromWarehouse?.name || '—'}</p>
                  {viewTxData.fromWarehouse?.code && <p className="text-xs text-slate-400">{viewTxData.fromWarehouse.code}</p>}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">To Warehouse</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{viewTxData.toWarehouse?.name || '—'}</p>
                  {viewTxData.toWarehouse?.code && <p className="text-xs text-slate-400">{viewTxData.toWarehouse.code}</p>}
                </div>
                {viewTxData.notes && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Notes</p>
                    <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{viewTxData.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Items ({viewTxData.items?.length || 0})</p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-2.5 px-3 text-left">Product</th>
                      <th className="py-2.5 px-3 text-center w-28">Requested Qty</th>
                      <th className="py-2.5 px-3 text-center w-28">Transferred Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(viewTxData.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{item.product?.name || '—'}</div>
                          {item.product?.sku && <div className="text-xs text-slate-400 mt-0.5">{item.product.sku}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{item.requestedQty}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={item.transferredQty > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                            {item.transferredQty ?? 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <div className="flex gap-2">
                {viewTxData.status === 'in_transit' && (
                  <>
                    <Button size="sm" onClick={() => { handleCompleteTransfer(viewTxData._id); setViewTxOpen(false); }}>
                      <CheckCircle size={14} className="mr-1" /> Complete Transfer
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => { handleCancelTransfer(viewTxData._id); setViewTxOpen(false); }}>
                      <XCircle size={14} className="mr-1" /> Cancel Transfer
                    </Button>
                  </>
                )}
              </div>
              <Button variant="ghost" onClick={() => { setViewTxOpen(false); setViewTxData(null); }}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ─── Edit Transfer Modal ─── */}
      <Modal open={editTxOpen} onClose={() => setEditTxOpen(false)} title="Edit Stock Transfer" size="xl">
        <form onSubmit={handleEditTxSubmit} className="space-y-5">
          {/* ── Warehouses ── */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="From Warehouse *"
              options={warehouseOpts.filter((w) => w.value !== editTxForm.toWarehouse)}
              placeholder="Select source"
              value={editTxForm.fromWarehouse}
              onChange={(e) => setEditTxForm((p) => ({ ...p, fromWarehouse: e.target.value }))}
            />
            <Select
              label="To Warehouse *"
              options={warehouseOpts.filter((w) => w.value !== editTxForm.fromWarehouse)}
              placeholder="Select destination"
              value={editTxForm.toWarehouse}
              onChange={(e) => setEditTxForm((p) => ({ ...p, toWarehouse: e.target.value }))}
            />
          </div>

          {/* ── Product Search ── */}
          <ProductSearch
            label="Search & Add Products"
            warehouseId={editTxForm.fromWarehouse || undefined}
            onSelect={handleEditTxProductSelect}
            placeholder={!editTxForm.fromWarehouse ? 'Select a source warehouse first…' : 'Search by name or SKU…'}
            disabled={!editTxForm.fromWarehouse}
          />

          {/* ── Products Table ── */}
          {editTxForm.items.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2.5 px-3 text-left">Product</th>
                    <th className="py-2.5 px-3 text-center w-32">Stock in Source</th>
                    <th className="py-2.5 px-3 text-center w-28">Quantity</th>
                    <th className="py-2.5 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {editTxForm.items.map((item) => (
                    <tr key={item.product._id || item.product} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{item.product?.name || item.product}</div>
                        {item.product?.sku && <div className="text-xs text-slate-400 mt-0.5">{item.product.sku}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-semibold ${item.currentStock <= 0 ? 'text-red-500' : item.currentStock <= 10 ? 'text-amber-500' : 'text-emerald-600'}`}>
                          {item.currentStock}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => updateEditTxItemQty(item.product._id || item.product, e.target.value)}
                          placeholder="Qty"
                          className="w-24 mx-auto block text-center text-slate-900 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button type="button" onClick={() => removeEditTxItem(item.product._id || item.product)} className="text-red-400 hover:text-red-600 transition-colors p-1 rounded">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 border border-dashed border-gray-200 rounded-xl bg-gray-50">
              <ArrowLeftRight size={28} className="mb-2 text-slate-300" />
              <p className="text-sm">No products added yet</p>
            </div>
          )}

          {/* ── Notes ── */}
          <Textarea
            label="Notes"
            placeholder="Optional notes…"
            value={editTxForm.notes}
            rows={2}
            onChange={(e) => setEditTxForm((p) => ({ ...p, notes: e.target.value }))}
          />

          {/* ── Actions ── */}
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-xs text-slate-400">
              {editTxForm.items.filter((i) => i.qty && Number(i.qty) > 0).length} of {editTxForm.items.length} product(s) ready
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={() => setEditTxOpen(false)}>Cancel</Button>
              <Button type="submit" loading={savingEditTx} disabled={!editTxForm.fromWarehouse || !editTxForm.toWarehouse || editTxForm.items.length === 0}>
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );

  const renderMovements = () => (
    <>
      <div className="flex items-center gap-3 mb-4">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search by product name..." />
      </div>
      <DataTable columns={mvColumns} data={movements} loading={loading} emptyMessage="No movements found" />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
    </>
  );

  const viewMap = {
    overview: renderOverview,
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
