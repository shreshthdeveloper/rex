import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader, TabList, Textarea, Pagination } from '../../components/ui';
import { purchaseOrdersAPI, suppliersAPI, productsAPI, warehousesAPI } from '../../api';
import { Plus, Edit, Trash2, Eye, FileText, ClipboardCheck, CheckCircle, XCircle, Package, RotateCcw } from 'lucide-react';

const STATUS_OPTS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'partial', label: 'Partial' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLOR = { draft: 'gray', sent: 'blue', ordered: 'amber', partial: 'purple', received: 'green', cancelled: 'red' };
const GRN_STATUS_COLOR = { pending: 'amber', approved: 'green', rejected: 'red' };
const STATUS_FLOW = ['draft', 'sent', 'ordered'];

const DETAIL_TABS = [
  { id: 'details', label: 'Details' },
  { id: 'status', label: 'Status' },
  { id: 'grn', label: 'GRN' },
  { id: 'returns', label: 'Returns' },
];

const emptyItem = { product: '', quantity: 1, unitCost: '' };
const emptyForm = { supplier: '', warehouse: '', items: [{ ...emptyItem }], discount: 0, shippingCost: 0, notes: '', expectedDate: '' };
const emptyGRN = { receivedDate: '', items: [], notes: '' };
const emptyReturn = { items: [{ product: '', quantity: 1, unitCost: '', reason: '' }], notes: '' };

function fmtCurrency(v) {
  return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PurchaseOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Dropdown options
  const [supplierOpts, setSupplierOpts] = useState([]);
  const [productOpts, setProductOpts] = useState([]);
  const [warehouseOpts, setWarehouseOpts] = useState([]);
  const [productMap, setProductMap] = useState({});

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Detail modal
  const [detailPO, setDetailPO] = useState(null);
  const [detailTab, setDetailTab] = useState('details');
  const [detailLoading, setDetailLoading] = useState(false);
  const [grnList, setGrnList] = useState([]);
  const [returnList, setReturnList] = useState([]);

  // GRN modal
  const [grnModalOpen, setGrnModalOpen] = useState(false);
  const [grnForm, setGrnForm] = useState(emptyGRN);
  const [grnSaving, setGrnSaving] = useState(false);

  // Return form
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnForm, setReturnForm] = useState(emptyReturn);
  const [returnSaving, setReturnSaving] = useState(false);

  // Status update
  const [statusSaving, setStatusSaving] = useState(false);

  // Load dropdown options
  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, pRes, wRes] = await Promise.all([suppliersAPI.list(), productsAPI.list(), warehousesAPI.list()]);
        setSupplierOpts((sRes.data?.suppliers || []).map((s) => ({ value: s._id, label: s.name })));
        const prods = pRes.data?.products || [];
        setProductOpts(prods.map((p) => ({ value: p._id, label: `${p.name} (${p.sku})` })));
        const pMap = {};
        prods.forEach((p) => { pMap[p._id] = p; });
        setProductMap(pMap);
        setWarehouseOpts((wRes.data || []).map((w) => ({ value: w._id, label: w.name })));
      } catch { /* silent */ }
    };
    load();
  }, []);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  /* ───── FETCH LIST ───── */
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      const res = await purchaseOrdersAPI.list(params);
      setOrders(res.data?.purchaseOrders || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  /* ───── CREATE / EDIT ───── */
  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, items: [{ ...emptyItem }] }); setModalOpen(true); };
  const openEdit = (o) => {
    setEditing(o);
    setForm({
      supplier: o.supplier?._id || o.supplier || '',
      warehouse: o.warehouse?._id || o.warehouse || '',
      items: (o.items || []).map((i) => ({ product: i.product?._id || i.product || '', quantity: i.quantity, unitCost: i.unitCost })),
      discount: o.discount || 0, shippingCost: o.shippingCost || 0,
      notes: o.notes || '', expectedDate: o.expectedDate ? o.expectedDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const setItemField = (idx, k) => (e) => {
    const val = e.target.value;
    setForm((p) => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [k]: val };
      if (k === 'product' && productMap[val]) {
        items[idx].unitCost = productMap[val].costPrice || productMap[val].basePrice || '';
      }
      return { ...p, items };
    });
  };
  const addItem = () => setForm((p) => ({ ...p, items: [...p.items, { ...emptyItem }] }));
  const removeItem = (idx) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const calcLineTotal = (item) => (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);
  const calcSubtotal = (items) => items.reduce((s, i) => s + calcLineTotal(i), 0);

  const handleSave = async () => {
    if (!form.supplier) return toast.error('Supplier is required');
    if (!form.warehouse) return toast.error('Warehouse is required');
    if (!form.items.length || !form.items[0].product) return toast.error('At least one item is required');
    try {
      setSaving(true);
      const payload = {
        supplier: form.supplier, warehouse: form.warehouse,
        items: form.items.map((i) => ({ product: i.product, quantity: Number(i.quantity), unitCost: Number(i.unitCost) })),
        discount: Number(form.discount) || 0, shippingCost: Number(form.shippingCost) || 0,
        notes: form.notes, expectedDate: form.expectedDate || undefined,
      };
      if (editing) {
        await purchaseOrdersAPI.update(editing._id, payload);
        toast.success('Purchase order updated');
      } else {
        await purchaseOrdersAPI.create(payload);
        toast.success('Purchase order created');
      }
      closeModal();
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to save purchase order');
    } finally {
      setSaving(false);
    }
  };

  /* ───── DELETE ───── */
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await purchaseOrdersAPI.delete(deleteTarget._id);
      toast.success('Purchase order deleted');
      setDeleteTarget(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to delete purchase order');
    } finally {
      setDeleting(false);
    }
  };

  /* ───── DETAIL MODAL ───── */
  const openDetail = async (o) => {
    try {
      const res = await purchaseOrdersAPI.get(o._id);
      setDetailPO(res.data || o);
    } catch { setDetailPO(o); }
    setDetailTab('details');
    setGrnList([]);
    setReturnList([]);
  };
  const closeDetail = () => { setDetailPO(null); setGrnList([]); setReturnList([]); };

  const fetchDetailTab = useCallback(async (tab, po) => {
    const o = po || detailPO;
    if (!o) return;
    setDetailLoading(true);
    try {
      if (tab === 'grn') {
        const res = await purchaseOrdersAPI.listGRN({ purchaseOrder: o._id });
        setGrnList(res.data?.grns || []);
      } else if (tab === 'returns') {
        const res = await purchaseOrdersAPI.listReturns({ purchaseOrder: o._id });
        setReturnList(res.data?.purchaseReturns || []);
      }
    } catch (err) {
      toast.error(err.message || `Failed to load ${tab}`);
    } finally {
      setDetailLoading(false);
    }
  }, [detailPO, toast]);

  const onDetailTabChange = (tab) => {
    setDetailTab(tab);
    if (['grn', 'returns'].includes(tab)) fetchDetailTab(tab);
  };

  /* ───── STATUS UPDATE ───── */
  const advanceStatus = async (nextStatus) => {
    try {
      setStatusSaving(true);
      await purchaseOrdersAPI.updateStatus(detailPO._id, { status: nextStatus });
      toast.success(`Status updated to ${nextStatus}`);
      const res = await purchaseOrdersAPI.get(detailPO._id);
      setDetailPO(res.data || { ...detailPO, status: nextStatus });
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  };

  /* ───── GRN ───── */
  const openGRNModal = () => {
    const items = (detailPO?.items || []).map((i) => ({
      product: i.product?._id || i.product,
      name: i.name || productMap[i.product?._id || i.product]?.name || '',
      receivedQty: 0, acceptedQty: 0, rejectedQty: 0,
    }));
    setGrnForm({ receivedDate: new Date().toISOString().slice(0, 10), items, notes: '' });
    setGrnModalOpen(true);
  };
  const closeGRNModal = () => { setGrnModalOpen(false); setGrnForm(emptyGRN); };

  const setGrnItemField = (idx, k) => (e) => {
    const val = Number(e.target.value) || 0;
    setGrnForm((p) => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [k]: val };
      return { ...p, items };
    });
  };

  const handleCreateGRN = async () => {
    try {
      setGrnSaving(true);
      await purchaseOrdersAPI.createGRN({
        purchaseOrder: detailPO._id,
        receivedDate: grnForm.receivedDate,
        items: grnForm.items.map((i) => ({ product: i.product, receivedQty: i.receivedQty, acceptedQty: i.acceptedQty, rejectedQty: i.rejectedQty })),
        notes: grnForm.notes,
      });
      toast.success('GRN created');
      closeGRNModal();
      fetchDetailTab('grn');
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to create GRN');
    } finally {
      setGrnSaving(false);
    }
  };

  const handleGRNAction = async (grnId, action) => {
    try {
      if (action === 'approve') await purchaseOrdersAPI.approveGRN(grnId);
      else await purchaseOrdersAPI.rejectGRN(grnId);
      toast.success(`GRN ${action}d`);
      fetchDetailTab('grn');
      fetchOrders();
    } catch (err) {
      toast.error(err.message || `Failed to ${action} GRN`);
    }
  };

  /* ───── RETURNS ───── */
  const openReturnModal = () => {
    const items = (detailPO?.items || []).map((i) => ({
      product: i.product?._id || i.product,
      name: i.name || productMap[i.product?._id || i.product]?.name || '',
      quantity: 0, unitCost: i.unitCost || 0, reason: '',
    }));
    setReturnForm({ items, notes: '' });
    setReturnModalOpen(true);
  };
  const closeReturnModal = () => { setReturnModalOpen(false); setReturnForm(emptyReturn); };

  const setReturnItemField = (idx, k) => (e) => {
    setReturnForm((p) => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [k]: e.target.value };
      return { ...p, items };
    });
  };

  const handleCreateReturn = async () => {
    const validItems = returnForm.items.filter((i) => Number(i.quantity) > 0);
    if (!validItems.length) return toast.error('At least one item with quantity is required');
    try {
      setReturnSaving(true);
      await purchaseOrdersAPI.createReturn({
        purchaseOrder: detailPO._id,
        supplier: detailPO.supplier?._id || detailPO.supplier,
        warehouse: detailPO.warehouse?._id || detailPO.warehouse,
        items: validItems.map((i) => ({ product: i.product, quantity: Number(i.quantity), unitCost: Number(i.unitCost), reason: i.reason })),
        notes: returnForm.notes,
      });
      toast.success('Return created');
      closeReturnModal();
      fetchDetailTab('returns');
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to create return');
    } finally {
      setReturnSaving(false);
    }
  };

  /* ───── FILTER ───── */
  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = o.poNumber?.toLowerCase().includes(q) || o.supplier?.name?.toLowerCase().includes(q);
    const matchStatus = !filterStatus || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  /* ───── LIST COLUMNS ───── */
  const columns = [
    { key: 'poNumber', label: 'PO #', render: (r) => (
      <div className="flex items-center gap-2">
        <FileText size={18} className="text-violet-600 shrink-0" />
        <span className="text-slate-800 font-medium">{r.poNumber || r._id}</span>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-1">
        <Button variant="icon" title="View details" onClick={(e) => { e.stopPropagation(); openDetail(r); }}><Eye size={16} /></Button>
        {r.status === 'draft' && <Button variant="icon" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit size={16} /></Button>}
        {r.status === 'draft' && <Button variant="icon" title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={16} className="text-red-400" /></Button>}
      </div>
    )},
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier?.name || '-' },
    { key: 'warehouse', label: 'Warehouse', render: (r) => r.warehouse?.name || '-' },
    { key: 'grandTotal', label: 'Total', render: (r) => fmtCurrency(r.grandTotal) },
    { key: 'status', label: 'Status', render: (r) => <Badge color={STATUS_COLOR[r.status] || 'gray'}>{r.status}</Badge> },
    { key: 'expectedDate', label: 'Expected', render: (r) => fmtDate(r.expectedDate) },
  ];

  /* ───── DETAIL TAB CONTENT ───── */
  const renderDetailContent = () => {
    if (!detailPO) return null;

    switch (detailTab) {
      case 'details': {
        const items = detailPO.items || [];
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <GlassCard className="text-center"><p className="text-xs text-slate-500">PO Number</p><p className="text-slate-800 font-medium mt-1">{detailPO.poNumber}</p></GlassCard>
              <GlassCard className="text-center"><p className="text-xs text-slate-500">Supplier</p><p className="text-slate-800 font-medium mt-1">{detailPO.supplier?.name || '-'}</p></GlassCard>
              <GlassCard className="text-center"><p className="text-xs text-slate-500">Warehouse</p><p className="text-slate-800 font-medium mt-1">{detailPO.warehouse?.name || '-'}</p></GlassCard>
              <GlassCard className="text-center"><p className="text-xs text-slate-500">Expected Date</p><p className="text-slate-800 font-medium mt-1">{fmtDate(detailPO.expectedDate)}</p></GlassCard>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-violet-100 text-slate-500 text-left">
                  <th className="pb-2 pr-4">Product</th><th className="pb-2 pr-4">SKU</th><th className="pb-2 pr-4 text-right">Qty</th>
                  <th className="pb-2 pr-4 text-right">Received</th><th className="pb-2 pr-4 text-right">Unit Cost</th><th className="pb-2 text-right">Line Total</th>
                </tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-violet-50 text-slate-600">
                      <td className="py-2 pr-4 text-slate-800">{it.name || it.product?.name || '-'}</td>
                      <td className="py-2 pr-4">{it.sku || it.product?.sku || '-'}</td>
                      <td className="py-2 pr-4 text-right">{it.quantity}</td>
                      <td className="py-2 pr-4 text-right">{it.receivedQty ?? 0}</td>
                      <td className="py-2 pr-4 text-right">{fmtCurrency(it.unitCost)}</td>
                      <td className="py-2 text-right text-slate-800">{fmtCurrency(it.lineTotal ?? it.quantity * it.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <div className="space-y-1 text-sm w-60">
                <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="text-slate-800">{fmtCurrency(detailPO.subtotal)}</span></div>
                <div className="flex justify-between text-slate-500"><span>Discount</span><span className="text-red-400">-{fmtCurrency(detailPO.discount)}</span></div>
                <div className="flex justify-between text-slate-500"><span>Shipping</span><span className="text-slate-800">{fmtCurrency(detailPO.shippingCost)}</span></div>
                <div className="flex justify-between text-slate-500"><span>Tax</span><span className="text-slate-800">{fmtCurrency(detailPO.taxAmount)}</span></div>
                <div className="flex justify-between border-t border-violet-100 pt-1 font-bold"><span className="text-slate-600">Grand Total</span><span className="text-violet-600">{fmtCurrency(detailPO.grandTotal)}</span></div>
              </div>
            </div>
            {detailPO.notes && <p className="text-sm text-slate-500"><span className="text-gray-500">Notes:</span> {detailPO.notes}</p>}
          </div>
        );
      }

      case 'status': {
        const current = detailPO.status;
        const currentIdx = STATUS_FLOW.indexOf(current);
        const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 text-sm">Current Status:</span>
              <Badge color={STATUS_COLOR[current] || 'gray'} className="text-base px-4 py-1">{current}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {nextStatus && (
                <Button onClick={() => advanceStatus(nextStatus)} loading={statusSaving}>
                  <ClipboardCheck size={16} /> Advance to {nextStatus}
                </Button>
              )}
              {current !== 'cancelled' && current !== 'received' && (
                <Button variant="ghost" className="!text-red-400 !border-red-400/20" onClick={() => advanceStatus('cancelled')} loading={statusSaving}>
                  <XCircle size={16} /> Cancel PO
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-4">
              {STATUS_FLOW.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${STATUS_FLOW.indexOf(current) >= i ? 'bg-cyan-500/20 text-violet-600 ring-2 ring-cyan-500/40' : 'bg-violet-50 text-gray-500'}`}>{i + 1}</div>
                  <span className={`text-sm ${STATUS_FLOW.indexOf(current) >= i ? 'text-slate-800' : 'text-gray-500'}`}>{s}</span>
                  {i < STATUS_FLOW.length - 1 && <div className={`w-8 h-px ${STATUS_FLOW.indexOf(current) > i ? 'bg-cyan-500/40' : 'bg-violet-50'}`} />}
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'grn':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-slate-800 font-medium flex items-center gap-2"><Package size={18} className="text-violet-600" /> Goods Received Notes</h4>
              <Button size="sm" onClick={openGRNModal}><Plus size={14} /> Create GRN</Button>
            </div>
            {detailLoading ? <Loader /> : grnList.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No GRN records found</p>
            ) : (
              <div className="space-y-3">
                {grnList.map((grn) => (
                  <GlassCard key={grn._id}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="text-slate-800 font-medium text-sm">GRN #{grn._id?.slice(-6)}</span>
                        <span className="text-slate-500 text-xs ml-3">Received: {fmtDate(grn.receivedDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color={GRN_STATUS_COLOR[grn.status] || 'gray'}>{grn.status}</Badge>
                        {grn.status === 'pending' && (
                          <>
                            <Button size="sm" variant="ghost" className="!text-emerald-400" onClick={() => handleGRNAction(grn._id, 'approve')}><CheckCircle size={14} /> Approve</Button>
                            <Button size="sm" variant="ghost" className="!text-red-400" onClick={() => handleGRNAction(grn._id, 'reject')}><XCircle size={14} /> Reject</Button>
                          </>
                        )}
                      </div>
                    </div>
                    <table className="w-full text-xs text-slate-600">
                      <thead><tr className="text-gray-500 text-left border-b border-violet-50">
                        <th className="pb-1">Product</th><th className="pb-1 text-right">Received</th><th className="pb-1 text-right">Accepted</th><th className="pb-1 text-right">Rejected</th>
                      </tr></thead>
                      <tbody>
                        {(grn.items || []).map((gi, j) => (
                          <tr key={j} className="border-b border-violet-50">
                            <td className="py-1 text-slate-800">{gi.product?.name || gi.name || '-'}</td>
                            <td className="py-1 text-right">{gi.receivedQty}</td>
                            <td className="py-1 text-right text-emerald-400">{gi.acceptedQty}</td>
                            <td className="py-1 text-right text-red-400">{gi.rejectedQty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {grn.notes && <p className="text-xs text-gray-500 mt-2">Notes: {grn.notes}</p>}
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        );

      case 'returns':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-slate-800 font-medium flex items-center gap-2"><RotateCcw size={18} className="text-amber-400" /> Purchase Returns</h4>
              <Button size="sm" onClick={openReturnModal}><Plus size={14} /> Create Return</Button>
            </div>
            {detailLoading ? <Loader /> : returnList.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No returns found</p>
            ) : (
              <div className="space-y-3">
                {returnList.map((ret) => (
                  <GlassCard key={ret._id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-800 font-medium text-sm">Return #{ret._id?.slice(-6)}</span>
                      <span className="text-slate-500 text-xs">{fmtDate(ret.createdAt)}</span>
                    </div>
                    <table className="w-full text-xs text-slate-600">
                      <thead><tr className="text-gray-500 text-left border-b border-violet-50">
                        <th className="pb-1">Product</th><th className="pb-1 text-right">Qty</th><th className="pb-1 text-right">Unit Cost</th><th className="pb-1">Reason</th>
                      </tr></thead>
                      <tbody>
                        {(ret.items || []).map((ri, j) => (
                          <tr key={j} className="border-b border-violet-50">
                            <td className="py-1 text-slate-800">{ri.product?.name || ri.name || '-'}</td>
                            <td className="py-1 text-right">{ri.quantity}</td>
                            <td className="py-1 text-right">{fmtCurrency(ri.unitCost)}</td>
                            <td className="py-1">{ri.reason || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {ret.notes && <p className="text-xs text-gray-500 mt-2">Notes: {ret.notes}</p>}
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage purchase orders, GRN & returns"
        actions={<Button onClick={openCreate}><Plus size={16} /> New Purchase Order</Button>}
      />

      <GlassCard>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search POs..." className="flex-1 max-w-sm" />
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} options={STATUS_OPTS} placeholder="All Statuses" className="w-40" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} onRowClick={openDetail} emptyMessage="No purchase orders found" />
      </GlassCard>

      {/* ───── Create / Edit PO Modal ───── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Purchase Order' : 'Create Purchase Order'}
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label="Supplier" value={form.supplier} onChange={set('supplier')} options={supplierOpts} placeholder="Select supplier" />
            <Select label="Warehouse" value={form.warehouse} onChange={set('warehouse')} options={warehouseOpts} placeholder="Select warehouse" />
            <Input label="Expected Date" type="date" value={form.expectedDate} onChange={set('expectedDate')} />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Items</h4>
              <Button size="sm" variant="ghost" onClick={addItem}><Plus size={14} /> Add Item</Button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, idx) => (
                <div key={idx} className="flex items-end gap-2 flex-wrap">
                  <Select label={idx === 0 ? 'Product' : ''} value={it.product} onChange={setItemField(idx, 'product')} options={productOpts} placeholder="Select product" className="flex-1 min-w-[180px]" />
                  <Input label={idx === 0 ? 'Qty' : ''} type="number" min="1" value={it.quantity} onChange={setItemField(idx, 'quantity')} className="w-20" />
                  <Input label={idx === 0 ? 'Unit Cost' : ''} type="number" min="0" step="0.01" value={it.unitCost} onChange={setItemField(idx, 'unitCost')} className="w-28" />
                  <span className="text-sm text-slate-500 pb-2 w-24 text-right">{fmtCurrency(calcLineTotal(it))}</span>
                  {form.items.length > 1 && (
                    <Button variant="icon" onClick={() => removeItem(idx)} className="mb-1"><Trash2 size={14} className="text-red-400" /></Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-2 text-sm text-slate-500">
              Subtotal: <span className="text-slate-800 ml-2 font-medium">{fmtCurrency(calcSubtotal(form.items))}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Discount" type="number" min="0" step="0.01" value={form.discount} onChange={set('discount')} placeholder="0.00" />
            <Input label="Shipping Cost" type="number" min="0" step="0.01" value={form.shippingCost} onChange={set('shippingCost')} placeholder="0.00" />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={set('notes')} placeholder="Optional notes" />
        </div>
      </Modal>

      {/* ───── Detail Modal ───── */}
      <Modal open={!!detailPO} onClose={closeDetail} title={detailPO ? `PO ${detailPO.poNumber || ''}` : 'PO Details'} size="xl">
        {detailPO && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-violet-100">
              <div className="flex items-center gap-2">
                <FileText size={24} className="text-violet-600" />
                <div>
                  <p className="text-slate-800 font-medium">{detailPO.poNumber}</p>
                  <p className="text-xs text-slate-500">{detailPO.supplier?.name || '-'}</p>
                </div>
              </div>
              <Badge color={STATUS_COLOR[detailPO.status] || 'gray'}>{detailPO.status}</Badge>
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-500">Grand Total</p>
                <p className="text-lg font-bold text-violet-600">{fmtCurrency(detailPO.grandTotal)}</p>
              </div>
            </div>
            <TabList tabs={DETAIL_TABS} active={detailTab} onChange={onDetailTabChange} />
            {renderDetailContent()}
          </div>
        )}
      </Modal>

      {/* ───── GRN Modal ───── */}
      <Modal
        open={grnModalOpen}
        onClose={closeGRNModal}
        title="Create Goods Received Note"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeGRNModal}>Cancel</Button>
            <Button onClick={handleCreateGRN} loading={grnSaving}><ClipboardCheck size={16} /> Create GRN</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Received Date" type="date" value={grnForm.receivedDate}
            onChange={(e) => setGrnForm((p) => ({ ...p, receivedDate: e.target.value }))} />
          <div>
            <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Items</h4>
            <div className="space-y-2">
              {(grnForm.items || []).map((gi, idx) => (
                <div key={idx} className="flex items-end gap-2 flex-wrap">
                  <div className="flex-1 min-w-[140px]">
                    {idx === 0 && <label className="text-xs text-slate-500 mb-1 block">Product</label>}
                    <p className="text-sm text-slate-800 py-2">{gi.name || 'Product'}</p>
                  </div>
                  <Input label={idx === 0 ? 'Received' : ''} type="number" min="0" value={gi.receivedQty} onChange={setGrnItemField(idx, 'receivedQty')} className="w-24" />
                  <Input label={idx === 0 ? 'Accepted' : ''} type="number" min="0" value={gi.acceptedQty} onChange={setGrnItemField(idx, 'acceptedQty')} className="w-24" />
                  <Input label={idx === 0 ? 'Rejected' : ''} type="number" min="0" value={gi.rejectedQty} onChange={setGrnItemField(idx, 'rejectedQty')} className="w-24" />
                </div>
              ))}
            </div>
          </div>
          <Textarea label="Notes" value={grnForm.notes}
            onChange={(e) => setGrnForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
        </div>
      </Modal>

      {/* ───── Return Modal ───── */}
      <Modal
        open={returnModalOpen}
        onClose={closeReturnModal}
        title="Create Purchase Return"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeReturnModal}>Cancel</Button>
            <Button onClick={handleCreateReturn} loading={returnSaving}><RotateCcw size={16} /> Create Return</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Items</h4>
            <div className="space-y-2">
              {(returnForm.items || []).map((ri, idx) => (
                <div key={idx} className="flex items-end gap-2 flex-wrap">
                  <div className="flex-1 min-w-[140px]">
                    {idx === 0 && <label className="text-xs text-slate-500 mb-1 block">Product</label>}
                    <p className="text-sm text-slate-800 py-2">{ri.name || 'Product'}</p>
                  </div>
                  <Input label={idx === 0 ? 'Qty' : ''} type="number" min="0" value={ri.quantity} onChange={setReturnItemField(idx, 'quantity')} className="w-20" />
                  <Input label={idx === 0 ? 'Unit Cost' : ''} type="number" min="0" step="0.01" value={ri.unitCost} onChange={setReturnItemField(idx, 'unitCost')} className="w-28" />
                  <Input label={idx === 0 ? 'Reason' : ''} value={ri.reason} onChange={setReturnItemField(idx, 'reason')} placeholder="Reason" className="w-40" />
                </div>
              ))}
            </div>
          </div>
          <Textarea label="Notes" value={returnForm.notes}
            onChange={(e) => setReturnForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
        </div>
      </Modal>

      {/* ───── Delete Confirm ───── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Purchase Order"
        message={`Are you sure you want to delete PO "${deleteTarget?.poNumber || ''}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
