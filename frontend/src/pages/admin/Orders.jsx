import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { useTabs } from '../../context/TabContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader, TabList, Textarea, CsvImport, SearchableSelect } from '../../components/ui';
import { ordersAPI, customersAPI, productsAPI, warehousesAPI } from '../../api';
import { Plus, Edit, Trash2, Eye, ShoppingCart, CreditCard, RotateCcw, Zap, Printer, Truck, CheckCircle } from 'lucide-react';
import POS from './POS';
import ProductSearch from '../../components/ProductSearch';

const STATUS_OPTS = [
  { value: 'placed', label: 'Placed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'return', label: 'Return' },
  { value: 'partial_return', label: 'Partial Return' },
  { value: 'failed_delivery', label: 'Failed Delivery' },
];

const PAYMENT_STATUS_OPTS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
];

const STATUS_COLOR = { placed: 'blue', processing: 'amber', shipped: 'purple', in_transit: 'cyan', out_for_delivery: 'indigo', delivered: 'green', cancelled: 'red', return: 'amber', partial_return: 'amber', failed_delivery: 'red' };
const PAY_STATUS_COLOR = { unpaid: 'red', partial: 'amber', paid: 'green' };

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
  { value: 'wallet', label: 'Wallet' },
];

const DETAIL_TABS = [
  { id: 'details', label: 'Details' },
  { id: 'returns', label: 'Returns' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'history', label: 'History' },
];

const STATUS_FLOW = ['placed', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'];

const emptyItem = { product: '', quantity: 1, unitPrice: '', discount: 0 };
const emptyForm = { customer: '', warehouse: '', items: [{ ...emptyItem }], shippingCharge: 0, notes: '', referenceNumber: '', saleType: '', orderSource: '' };

const SALE_TYPE_OPTS = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'online', label: 'Online' },
];

const ORDER_SOURCE_OPTS = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
  { value: 'online', label: 'Online' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'pos', label: 'POS' },
  { value: 'website', label: 'Website' },
];
const PAGE_SIZE = 20;
const emptyPayment = { amount: '', method: 'cash', reference: '', notes: '' };
const emptyReturn = { items: [{ lineItem: '', returnQty: 1, reason: '' }] };

function fmtCurrency(v) {
  return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Orders() {
  const toast = useToast();
  const { openTab } = useTabs();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayStatus, setFilterPayStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });

  // Dropdown options
  const [customerOpts, setCustomerOpts] = useState([]);
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
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailTab, setDetailTab] = useState('details');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  // Standalone status action modal
  const [statusModal, setStatusModal] = useState(null);
  // Standalone payments modal
  const [paymentModal, setPaymentModal] = useState(null); // { order, payments }
  const [paymentModalLoading, setPaymentModalLoading] = useState(false);

  // Payment form
  const [payForm, setPayForm] = useState(emptyPayment);
  const [payingSaving, setPayingSaving] = useState(false);

  // Return form
  const [returnForm, setReturnForm] = useState(emptyReturn);
  const [returnSaving, setReturnSaving] = useState(false);
  // Refund method selection per pending return row { [returnId]: method }
  const [refundMethodMap, setRefundMethodMap] = useState({});

  // Stock validation cache: { productId: { warehouseId: { total, reserved, available } } }
  const [stockCache, setStockCache] = useState({});

  // (Product search and variant modal are handled by <ProductSearch> component)

  const checkStock = async (productId) => {
    if (!productId || stockCache[productId]) return;
    try {
      const res = await productsAPI.getStock(productId);
      const stocks = res.data?.stocks || [];
      const byWarehouse = {};
      stocks.forEach((s) => {
        const wId = String(s.warehouse?._id || s.warehouse || '');
        const total = Number(s.quantity ?? 0);
        const reserved = Number(s.reservedQuantity ?? s.reserved ?? 0);
        byWarehouse[wId] = {
          total,
          reserved,
          available: total - reserved,
        };
      });
      setStockCache((prev) => ({ ...prev, [productId]: byWarehouse }));
    } catch { /* silent */ }
  };

  // Load dropdown options
  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, pRes, wRes] = await Promise.all([
          customersAPI.list({ limit: 500 }),
          productsAPI.list({ limit: 500 }),
          warehousesAPI.list({ limit: 500 }),
        ]);
        setCustomerOpts((cRes.data?.customers || []).map((c) => ({ value: c._id, label: c.name })));
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

  // onSelect callback for <ProductSearch> in the items editor
  const handleProductSearchSelect = useCallback((items) => {
    items.forEach(({ product }) => addOrderItem(product));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add item to order form
  const addOrderItem = (product) => {
    setForm((prev) => {
      const existing = prev.items.findIndex(i => i.product === product._id);
      if (existing >= 0) {
        const items = [...prev.items];
        items[existing] = { ...items[existing], quantity: Number(items[existing].quantity) + 1 };
        return { ...prev, items };
      }
      // Remove empty placeholder rows
      const cleanItems = prev.items.filter(i => i.product);
      return {
        ...prev,
        items: [...cleanItems, {
          product: product._id,
          _name: product.name,
          _sku: product.sku || '',
          _barcodeValue: product.barcodeValue || '',
          quantity: 1,
          unitPrice: product.basePrice || '',
          discount: 0,
        }],
      };
    });
    if (product._id) checkStock(product._id);
  };



  /* ───── FETCH LIST ───── */
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterPayStatus) params.paymentStatus = filterPayStatus;
      const res = await ordersAPI.list(params);
      setOrders(res.data?.orders || []);
      setPagination(res.data?.pagination || { total: 0, page, pages: 1, limit: PAGE_SIZE });
    } catch (err) {
      toast.error(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterPayStatus, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setPage(1); }, [search, filterStatus, filterPayStatus]);

  /* ───── CREATE / EDIT ───── */
  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      items: [{ ...emptyItem }],
      warehouse: warehouseOpts[0]?.value || '',
      saleType: SALE_TYPE_OPTS[0]?.value || '',
      orderSource: ORDER_SOURCE_OPTS[0]?.value || '',
    });
    setModalOpen(true);
  };
  const openEdit = (o) => {
    setEditing(o);
    setForm({
      customer: o.customer?._id || o.customer || '',
      warehouse: o.warehouse?._id || o.warehouse || warehouseOpts[0]?.value || '',
      items: (o.items || []).map((i) => ({
        product: i.product?._id || i.product || '',
        _name: i.productSnapshot?.name || i.product?.name || i.name || 'Product',
        _sku: i.productSnapshot?.sku || i.product?.sku || i.sku || '',
        _barcodeValue: i.productSnapshot?.barcodeValue || '',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount || 0,
      })),
      shippingCharge: o.shippingCharge || 0,
      notes: o.notes || '',
      referenceNumber: o.referenceNumber || '',
      saleType: o.saleType || SALE_TYPE_OPTS[0]?.value || '',
      orderSource: o.orderSource || ORDER_SOURCE_OPTS[0]?.value || '',
    });
    // Pre-fetch stock for existing items
    (o.items || []).forEach((i) => {
      const pid = i.product?._id || i.product;
      if (pid) checkStock(pid);
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };

  const setFormField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setItemField = (idx, k) => (e) => {
    const val = e.target.value;
    setForm((p) => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [k]: val };
      if (k === 'product' && productMap[val]) {
        items[idx].unitPrice = productMap[val].basePrice || '';
      }
      return { ...p, items };
    });
    if (k === 'product' && val) checkStock(val);
  };
  const addItem = () => setForm((p) => ({ ...p, items: [...p.items, { ...emptyItem }] }));
  const removeItem = (idx) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const calcLineTotal = (item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discount) || 0;
    return qty * price - disc;
  };
  const calcSubtotal = (items) => items.reduce((s, i) => s + calcLineTotal(i), 0);

  const handleSave = async () => {
    if (!form.customer) return toast.error('Customer is required');
    if (!form.warehouse) return toast.error('Warehouse is required');
    if (!form.items.length || !form.items.some(i => i.product)) return toast.error('At least one item is required');
    try {
      setSaving(true);
      const payload = {
        customerId: form.customer,
        warehouseId: form.warehouse,
        items: form.items.filter(i => i.product).map((i) => ({ productId: i.product, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), discount: Number(i.discount) || 0 })),
        shippingCharge: Number(form.shippingCharge) || 0,
        notes: form.notes,
        referenceNumber: form.referenceNumber,
        saleType: form.saleType,
        orderSource: form.orderSource,
      };
      if (editing) {
        await ordersAPI.update(editing._id, payload);
        toast.success('Order updated');
      } else {
        await ordersAPI.create(payload);
        toast.success('Order created');
      }
      closeModal();
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  /* ───── DELETE ───── */
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await ordersAPI.delete(deleteTarget._id);
      toast.success('Order deleted');
      setDeleteTarget(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to delete order');
    } finally {
      setDeleting(false);
    }
  };

  /* ───── DETAIL MODAL ───── */
  const openDetail = async (o) => {
    try {
      const res = await ordersAPI.get(o._id);
      setDetailOrder(res.data?.order || o);
    } catch { setDetailOrder(o); }
    setDetailTab('details');
    setPayForm(emptyPayment);
    setReturnForm({ items: [{ lineItem: '', returnQty: 1, reason: '' }] });
    setDetailData(null);
  };
  const closeDetail = () => { setDetailOrder(null); setDetailData(null); };

  const fetchDetailTab = useCallback(async (tab, order) => {
    const o = order || detailOrder;
    if (!o) return;
    setDetailLoading(true);
    setDetailData(null);
    try {
      let res;
      switch (tab) {
        case 'returns':  res = await ordersAPI.listReturns(o._id);  setDetailData(res.data || []); break;
        case 'invoice':  res = await ordersAPI.getInvoice(o._id);   setDetailData(res.data || res); break;
        case 'history':  res = await ordersAPI.getHistory(o._id);   setDetailData(res.data || []); break;
        default: break;
      }
    } catch (err) { toast.error(err.message || 'Failed to load data'); }
    finally { setDetailLoading(false); }
  }, [detailOrder, toast]);

  const switchDetailTab = (tab) => {
    setDetailTab(tab);
    if (['returns', 'invoice', 'history'].includes(tab)) fetchDetailTab(tab);
  };

  /* ───── STATUS MODAL (standalone from list) ───── */
  const openStatusModal = async (o) => {
    try {
      const res = await ordersAPI.get(o._id);
      setStatusModal(res.data?.order || o);
    } catch {
      setStatusModal(o);
    }
  };
  const handleStatusModalAction = async (newStatus) => {
    try {
      await ordersAPI.updateStatus(statusModal._id, { status: newStatus });
      toast.success(`Order ${newStatus}`);
      setStatusModal(null);
      fetchOrders();
      // Invalidate stockCache for all products in this order so Available Qty reflects new reserved counts
      const orderForCache = statusModal;
      if (orderForCache?.items?.length) {
        setStockCache((prev) => {
          const next = { ...prev };
          orderForCache.items.forEach((item) => {
            const pid = item.product?._id || item.product;
            if (pid) delete next[String(pid)];
          });
          return next;
        });
      }
      // If the same order is open in the detail modal, refresh it too
      if (detailOrder?._id === statusModal._id) {
        const res = await ordersAPI.get(statusModal._id);
        setDetailOrder(res.data?.order);
      }
    } catch (err) { toast.error(err.message || 'Failed to update status'); }
  };

  /* ───── PAYMENTS MODAL (standalone from list) ───── */
  const openPaymentModal = async (o) => {
    setPaymentModalLoading(true);
    setPayForm(emptyPayment);
    try {
      const [orderRes, payRes] = await Promise.all([ordersAPI.get(o._id), ordersAPI.listPayments(o._id)]);
      setPaymentModal({ order: orderRes.data?.order || o, payments: payRes.data || [] });
    } catch {
      setPaymentModal({ order: o, payments: [] });
    } finally {
      setPaymentModalLoading(false);
    }
  };
  const handlePaymentModalRecord = async () => {
    if (!payForm.amount || Number(payForm.amount) <= 0) return toast.error('Valid amount is required');
    const due = paymentModal?.order?.balanceDue || 0;
    if (Number(payForm.amount) > due + 0.001) return toast.error(`Amount cannot exceed balance due \u20b9${fmtCurrency(due)}`);
    try {
      setPayingSaving(true);
      await ordersAPI.recordPayment(paymentModal.order._id, { amount: Number(payForm.amount), method: payForm.method, reference: payForm.reference, notes: payForm.notes });
      toast.success('Payment recorded');
      setPayForm(emptyPayment);
      const [orderRes, payRes] = await Promise.all([ordersAPI.get(paymentModal.order._id), ordersAPI.listPayments(paymentModal.order._id)]);
      setPaymentModal({ order: orderRes.data?.order || paymentModal.order, payments: payRes.data || [] });
      // Sync detailOrder if open for same order, and refresh invoice tab if active
      if (detailOrder && detailOrder._id === paymentModal.order._id) {
        const freshOrder = orderRes.data?.order || detailOrder;
        setDetailOrder(freshOrder);
        if (detailTab === 'invoice') fetchDetailTab('invoice', freshOrder);
      }
      fetchOrders();
    } catch (err) { toast.error(err.message || 'Failed to record payment'); }
    finally { setPayingSaving(false); }
  };

  /* ───── RETURN ───── */
  const addReturnItem = () => setReturnForm((p) => ({ items: [...p.items, { lineItem: '', returnQty: 1, reason: '' }] }));
  const removeReturnItem = (idx) => setReturnForm((p) => ({ items: p.items.filter((_, i) => i !== idx) }));
  const setReturnField = (idx, k) => (e) => {
    setReturnForm((p) => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [k]: e.target.value };
      return { items };
    });
  };

  const handleInitiateReturn = async () => {
    const validItems = returnForm.items.filter(i => i.lineItem);
    if (!validItems.length) return toast.error('At least one item required');
    try {
      setReturnSaving(true);
      const returnItems = validItems.map((i) => {
        const orderItem = (detailOrder?.items || []).find((oi) => oi._id === i.lineItem);
        // product may be a plain ObjectId string (not populated) or populated object
        const productId = orderItem?.product?._id || orderItem?.product;
        return { lineItemId: i.lineItem, product: productId, returnQty: Number(i.returnQty), reason: i.reason };
      });
      await ordersAPI.initiateReturn(detailOrder._id, {
        returnType: returnItems.length >= (detailOrder?.items?.length || 0) ? 'full' : 'partial',
        items: returnItems,
        returnWarehouse: detailOrder?.warehouse?._id || detailOrder?.warehouse,
      });
      toast.success('Return initiated (pending approval)');
      setReturnForm({ items: [{ lineItem: '', returnQty: 1, reason: '' }] });
      const res = await ordersAPI.get(detailOrder._id);
      setDetailOrder(res.data?.order);
      fetchDetailTab('returns');
      fetchOrders();
    } catch (err) { toast.error(err.message || 'Failed to initiate return'); }
    finally { setReturnSaving(false); }
  };

  const handleApproveReturn = async (returnId) => {
    const method = refundMethodMap[returnId];
    if (!method) return toast.error('Select a refund method before approving');
    try {
      await ordersAPI.approveReturn(detailOrder._id, returnId, method);
      toast.success('Return approved');
      setRefundMethodMap((m) => { const n = { ...m }; delete n[returnId]; return n; });
      const res = await ordersAPI.get(detailOrder._id);
      setDetailOrder(res.data?.order);
      fetchDetailTab('returns');
      fetchOrders();
    } catch (err) { toast.error(err.message || 'Failed to approve return'); }
  };

  const columns = [
    { key: 'orderNumber', label: 'Order #', render: (r) => <span className="font-mono text-slate-700 font-semibold">{r.orderNumber}</span> },
    {
      key: 'actions', label: 'Actions', render: (r) => (
        <div className="flex gap-1">
          <Button size="xs" variant="ghost" onClick={() => openDetail(r)}><Eye size={15} /></Button>
          {['placed', 'processing'].includes(r.status) && <Button size="xs" variant="ghost" onClick={() => openEdit(r)}><Edit size={15} /></Button>}
          {!['delivered', 'cancelled', 'return', 'partial_return'].includes(r.status) && <Button size="xs" variant="ghost" title="Update status" onClick={() => openStatusModal(r)}><Truck size={15} /></Button>}
          {['processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(r.status) && r.paymentStatus !== 'paid' && <Button size="xs" variant="ghost" title="Payments" onClick={() => openPaymentModal(r)}><CreditCard size={15} /></Button>}
          {r.status === 'placed' && <Button size="xs" variant="ghost" className="text-red-400" onClick={() => setDeleteTarget(r)}><Trash2 size={15} /></Button>}
        </div>
      ),
    },
    { key: 'customer', label: 'Customer', render: (r) => <span className="text-slate-700">{r.customer?.name || '-'}</span> },
    { key: 'grandTotal', label: 'Total', render: (r) => <span className="text-slate-800 font-medium">{fmtCurrency(r.grandTotal)}</span> },
    { key: 'amountPaid', label: 'Paid', render: (r) => <span className="text-green-600 font-medium">{fmtCurrency(r.amountPaid)}</span> },
    { key: 'balanceDue', label: 'Due', render: (r) => <span className={`font-medium ${(r.balanceDue || 0) > 0 ? 'text-red-500' : 'text-slate-400'}`}>{fmtCurrency(r.balanceDue)}</span> },
    { key: 'sellReturn', label: 'Sell Return', render: (r) => <span className={`font-medium ${(r.sellReturn || 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{fmtCurrency(r.sellReturn)}</span> },
    { key: 'returnDue', label: 'Return Due', render: (r) => <span className={`font-medium ${(r.returnDue || 0) > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{fmtCurrency(r.returnDue)}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge> },
    { key: 'paymentStatus', label: 'Payment', render: (r) => <Badge color={PAY_STATUS_COLOR[r.paymentStatus]}>{r.paymentStatus}</Badge> },
    { key: 'createdAt', label: 'Date', render: (r) => fmtDate(r.createdAt) },
  ];

  /* ───── DETAIL SUB-TAB RENDERERS ───── */
  const renderDetails = () => {
    const o = detailOrder;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><span className="text-slate-400 text-sm">Order #</span><p className="font-mono text-violet-600 font-semibold">{o.orderNumber}</p></div>
          <div><span className="text-slate-400 text-sm">Date</span><p className="text-slate-700">{fmtDateTime(o.createdAt)}</p></div>
          <div><span className="text-slate-400 text-sm">Customer</span><p className="text-slate-700">{o.customer?.name || '-'}</p></div>
          <div><span className="text-slate-400 text-sm">Warehouse</span><p className="text-slate-700">{o.warehouse?.name || '-'}</p></div>
          <div><span className="text-slate-400 text-sm">Status</span><p><Badge color={STATUS_COLOR[o.status]}>{o.status}</Badge></p></div>
          <div><span className="text-slate-400 text-sm">Payment</span><p><Badge color={PAY_STATUS_COLOR[o.paymentStatus]}>{o.paymentStatus}</Badge></p></div>
          {o.referenceNumber && <div><span className="text-slate-400 text-sm">Reference #</span><p className="text-slate-700 font-mono">{o.referenceNumber}</p></div>}
          {o.saleType && <div><span className="text-slate-400 text-sm">Sale Type</span><p className="text-slate-700 capitalize">{o.saleType}</p></div>}
          {o.orderSource && <div><span className="text-slate-400 text-sm">Order Source</span><p className="text-slate-700 capitalize">{o.orderSource.replace('_', ' ')}</p></div>}
        </div>
        {o.shippingAddress && (
          <div><span className="text-slate-400 text-sm">Shipping Address</span><p className="text-sm text-slate-700">{[o.shippingAddress.line1, o.shippingAddress.city, o.shippingAddress.state, o.shippingAddress.zip, o.shippingAddress.country].filter(Boolean).join(', ')}</p></div>
        )}
        {o.notes && <div><span className="text-slate-400 text-sm">Notes</span><p className="text-sm text-slate-700">{o.notes}</p></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-slate-500 border-b border-violet-100"><th className="py-2 text-left">Product</th><th className="py-2 text-left">SKU</th><th className="py-2 text-right">Price</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Disc</th><th className="py-2 text-right">Tax</th><th className="py-2 text-right">Total</th></tr></thead>
            <tbody>
              {(o.items || []).map((it, i) => (
                <tr key={i} className="border-b border-violet-50">
                  <td className="py-2 text-slate-700">{it.productSnapshot?.name || it.name || it.product?.name || '-'}</td>
                  <td className="py-2 font-mono text-xs text-slate-500">{it.productSnapshot?.sku || it.sku || '-'}</td>
                  <td className="py-2 text-right text-slate-700">{fmtCurrency(it.unitPrice)}</td>
                  <td className="py-2 text-right text-slate-700">{it.quantity}</td>
                  <td className="py-2 text-right text-slate-500">{fmtCurrency(it.discountAmount)}</td>
                  <td className="py-2 text-right text-slate-500">{fmtCurrency(it.taxAmount)}</td>
                  <td className="py-2 text-right font-medium text-slate-800">{fmtCurrency(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <div className="space-y-1 text-sm w-56">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="text-slate-700">{fmtCurrency(o.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="text-slate-700">-{fmtCurrency(o.discountAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tax</span><span className="text-slate-700">{fmtCurrency(o.taxTotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span className="text-slate-700">{fmtCurrency(o.shippingCharge)}</span></div>
            <div className="flex justify-between font-semibold text-violet-700 border-t border-violet-100 pt-1"><span>Grand Total</span><span>{fmtCurrency(o.grandTotal)}</span></div>
            <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{fmtCurrency(o.amountPaid)}</span></div>
            <div className="flex justify-between text-red-500"><span>Due</span><span>{fmtCurrency(o.balanceDue)}</span></div>
            {(o.sellReturn || 0) > 0 && <div className="flex justify-between text-amber-600"><span>Sell Return</span><span>{fmtCurrency(o.sellReturn)}</span></div>}
            {(o.returnDue || 0) > 0 && <div className="flex justify-between text-orange-600"><span>Return Due</span><span>{fmtCurrency(o.returnDue)}</span></div>}
          </div>
        </div>
      </div>
    );
  };

  const renderReturns = () => {
    const orderProducts = [
      { value: '', label: 'Select product…' },
      ...(detailOrder?.items || [])
        .filter(it => it.status === 'active' || it.status === 'partial_returned')
        .map((it) => ({
          value: it._id,
          label: `${it.productSnapshot?.name || it.name || it.product?.name || 'Product'} (Qty: ${it.quantity - (it.returnedQty || 0)} available)`,
        })),
    ];
    return (
      <div className="space-y-4">
        {detailLoading ? <Loader /> : (
          <>
            {Array.isArray(detailData) && detailData.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-400 border-b border-violet-100"><th className="py-2 text-left">Date</th><th className="py-2 text-left">Items</th><th className="py-2 text-left">Status</th><th className="py-2 text-right">Return Value</th><th className="py-2 text-left min-w-[280px]">Action</th></tr></thead>
                  <tbody>
                    {detailData.map((r, i) => (
                <tr key={i} className="border-b border-violet-50">
                        <td className="py-2 text-slate-600">{fmtDate(r.createdAt)}</td>
                        <td className="py-2 text-xs text-slate-600">{(r.items || []).map((it) => {
                          const line = (detailOrder?.items || []).find((oi) => String(oi._id) === String(it.lineItemId));
                          const name = it.product?.name || line?.productSnapshot?.name || line?.name || line?.product?.name || 'Item';
                          return `${name} x${it.returnQty || it.quantity || 0}`;
                        }).join(', ')}</td>
                        <td className="py-2"><Badge color={r.status === 'approved' ? 'green' : 'amber'}>{r.status}</Badge></td>
                        <td className="py-2 text-right text-slate-700 font-medium">{fmtCurrency(r.returnValue)}</td>
                        <td className="py-2">
                          {r.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <select
                                className="text-xs border border-violet-200 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-400"
                                value={refundMethodMap[r._id] || ''}
                                onChange={(e) => setRefundMethodMap((m) => ({ ...m, [r._id]: e.target.value }))}
                              >
                                <option value="">Refund via…</option>
                                <option value="cash">Cash</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="card">Card</option>
                                <option value="online">Online</option>
                                <option value="wallet">Wallet</option>
                                <option value="ledger_credit">Ledger Credit</option>
                              </select>
                              <Button
                                size="xs"
                                className={refundMethodMap[r._id] ? 'text-green-600' : 'opacity-40 cursor-not-allowed'}
                                onClick={() => refundMethodMap[r._id] && handleApproveReturn(r._id)}
                                title={refundMethodMap[r._id] ? 'Approve return' : 'Select refund method first'}
                              >
                                <CheckCircle size={15} />
                              </Button>
                            </div>
                          )}
                          {r.status === 'approved' && (
                            <span className="text-xs text-slate-500">
                              Approved · <span className="capitalize">{r.refundMethod?.replace('_', ' ') || '-'}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {['delivered', 'partial_return'].includes(detailOrder?.status) && (
              <GlassCard className="p-4 space-y-3">
                <h4 className="text-sm font-semibold text-violet-700 flex items-center gap-2"><RotateCcw size={16} />Initiate Return</h4>
                {returnForm.items.map((ri, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 items-end">
                    <Select label="Product" options={orderProducts} value={ri.lineItem} onChange={setReturnField(idx, 'lineItem')} />
                    <Input label="Qty" type="number" min="1" value={ri.returnQty} onChange={setReturnField(idx, 'returnQty')} />
                    <Input label="Reason" value={ri.reason} onChange={setReturnField(idx, 'reason')} />
                    <Button size="sm" variant="ghost" className="text-red-400 mb-1" onClick={() => removeReturnItem(idx)} disabled={returnForm.items.length <= 1}><Trash2 size={14} /></Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={addReturnItem}><Plus size={14} /> Add Item</Button>
                  <Button onClick={handleInitiateReturn} disabled={returnSaving}>{returnSaving ? 'Submitting…' : 'Submit Return'}</Button>
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>
    );
  };

  const renderInvoice = () => {
    if (detailLoading) return <Loader />;
    const inv = detailData;
    if (!inv) return <p className="text-slate-400 text-sm">No invoice data</p>;
    return (
      <GlassCard className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-violet-700">INVOICE</h3>
            <p className="text-sm text-slate-500">#{inv.invoiceNumber || inv.orderNumber || detailOrder?.orderNumber}</p>
            <p className="text-xs text-slate-400">{fmtDate(inv.date || inv.createdAt || detailOrder?.createdAt)}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => window.print()}><Printer size={14} className="mr-1" />Print</Button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-slate-400">Customer</span><p className="text-slate-700">{inv.customer?.name || detailOrder?.customer?.name}</p></div>
          <div><span className="text-slate-400">Warehouse</span><p className="text-slate-700">{inv.warehouse?.name || detailOrder?.warehouse?.name}</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-slate-500 border-b border-violet-100"><th className="py-2 text-left">Item</th><th className="py-2 text-right">Price</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Total</th></tr></thead>
            <tbody>
              {(inv.items || detailOrder?.items || []).map((it, i) => (
                <tr key={i} className="border-b border-violet-50">
                  <td className="py-2">{it.productSnapshot?.name || it.name || it.product?.name || '-'}</td>
                  <td className="py-2 text-right">{fmtCurrency(it.unitPrice)}</td>
                  <td className="py-2 text-right">{it.quantity}</td>
                  <td className="py-2 text-right">{fmtCurrency(it.lineTotal || (it.quantity * it.unitPrice))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <div className="space-y-1 text-sm w-52">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="text-slate-700">{fmtCurrency(inv.subtotal ?? detailOrder?.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tax</span><span className="text-slate-700">{fmtCurrency(inv.taxTotal ?? detailOrder?.taxTotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span className="text-slate-700">{fmtCurrency(inv.shippingCharge ?? detailOrder?.shippingCharge)}</span></div>
            <div className="flex justify-between font-semibold text-violet-700 border-t border-violet-100 pt-1"><span>Total</span><span>{fmtCurrency(inv.grandTotal ?? detailOrder?.grandTotal)}</span></div>
          </div>
        </div>
      </GlassCard>
    );
  };

  const renderHistory = () => {
    if (detailLoading) return <Loader />;
    const entries = Array.isArray(detailData) ? detailData : [];
    if (!entries.length) return <p className="text-slate-400 text-sm">No history entries</p>;
    return (
      <div className="space-y-3">
        {entries.map((h, i) => (
          <div key={i} className="flex gap-3 items-start">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500 mt-1.5" />
              {i < entries.length - 1 && <div className="w-px flex-1 bg-violet-200 mt-1" />}
            </div>
            <div className="pb-4">
              <p className="text-sm text-slate-700">{h.message || h.status || '-'}</p>
              {h.type === 'edit' && h.fromTotal !== undefined && (
                <p className="text-xs font-medium text-amber-600 mt-0.5">
                  Grand Total: ₹{fmtCurrency(h.fromTotal)} → ₹{fmtCurrency(h.toTotal)}
                </p>
              )}
              {h.note && <p className="text-xs text-slate-500 italic">{h.note}</p>}
              <p className="text-xs text-slate-400">{fmtDateTime(h.date || h.changedAt || h.createdAt)} {h.user?.name ? `• ${h.user.name}` : ''}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* ───── LINE ITEMS EDITOR (search-based) ───── */
  const renderItemsEditor = () => {
    const warehouseId = form.warehouse;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><ShoppingCart size={16} className="text-violet-600" /> Line Items</span>
        </div>
        {/* Product Search */}
        <ProductSearch
          warehouseId={form.warehouse}
          onSelect={handleProductSearchSelect}
          placeholder="Search products by name, SKU, or barcode…"
        />
        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-gray-200 text-xs uppercase">
                <th className="py-2 text-left w-8">#</th>
                <th className="py-2 text-left">Product</th>
                <th className="py-2 text-center w-28">Available Qty</th>
                <th className="py-2 text-center w-20">QTY</th>
                <th className="py-2 text-center w-24">Unit Price</th>
                <th className="py-2 text-center w-20">Discount</th>
                <th className="py-2 text-right w-28">Subtotal</th>
                <th className="py-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody>
              {form.items.filter(i => i.product).length === 0 ? (
                <tr><td colSpan="8" className="py-6 text-center text-gray-400">Search and add products above</td></tr>
              ) : form.items.filter(i => i.product).map((item, idx) => {
                const stockInfo = stockCache[item.product];
                const warehouseStock = stockInfo && warehouseId ? (stockInfo[String(warehouseId)] ?? null) : null;
                const warehouseQty = warehouseStock?.total ?? null;
                const warehouseReserved = warehouseStock?.reserved ?? 0;
                const warehouseAvailable = warehouseStock?.available ?? null;
                const displayName = item._name || productMap[item.product]?.name || 'Product';
                const displaySku = item._sku || productMap[item.product]?.sku || '';
                return (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-2 text-slate-500">{idx + 1}</td>
                    <td className="py-2">
                      <div>
                        <span className="text-slate-800 font-medium">{displayName}</span>
                        {displaySku && <div className="text-xs text-gray-500">{displaySku}</div>}
                        {warehouseQty !== null && warehouseQty !== undefined && (
                          <span className={`text-xs ${warehouseAvailable <= 0 ? 'text-red-500' : warehouseAvailable < 10 ? 'text-amber-500' : 'text-green-600'}`}>Total: {warehouseQty} • Reserved: {warehouseReserved} • Available: {warehouseAvailable}</span>
                        )}
                        {!warehouseId && item.product && <span className="text-[11px] text-slate-300 italic">Select warehouse for stock</span>}
                      </div>
                    </td>
                    <td className="py-2 text-center font-medium">
                      {warehouseAvailable !== null && warehouseAvailable !== undefined ? (
                        <span className={`${warehouseAvailable <= 0 ? 'text-red-500' : warehouseAvailable < 10 ? 'text-amber-500' : 'text-emerald-600'}`}>{warehouseAvailable}</span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-2 text-center">
                      <input type="number" min="1" className="w-16 text-center border border-gray-200 rounded px-1 py-1 text-sm" value={item.quantity} onChange={setItemField(idx, 'quantity')} />
                    </td>
                    <td className="py-2 text-center">
                      <input type="number" min="0" step="0.01" className="w-20 text-center border border-gray-200 rounded px-1 py-1 text-sm" value={item.unitPrice} onChange={setItemField(idx, 'unitPrice')} />
                    </td>
                    <td className="py-2 text-center">
                      <input type="number" min="0" className="w-16 text-center border border-gray-200 rounded px-1 py-1 text-sm" value={item.discount} onChange={setItemField(idx, 'discount')} />
                    </td>
                    <td className="py-2 text-right font-medium text-slate-800">{fmtCurrency(calcLineTotal(item))}</td>
                    <td className="py-2 text-center">
                      <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {form.items.filter(i => i.product).length > 0 && (
            <div className="text-right space-y-1 text-sm mt-3 pt-3 border-t border-gray-200">
              <div className="text-slate-500">Subtotal: {fmtCurrency(calcSubtotal(form.items))}</div>
              {Number(form.shippingCharge) > 0 && <div className="text-slate-500">Shipping: + {fmtCurrency(form.shippingCharge)}</div>}
              <div className="text-violet-600 font-semibold">Total: {fmtCurrency(calcSubtotal(form.items) + Number(form.shippingCharge || 0))}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ───── RENDER ───── */
  if (loading && !orders.length) return <Loader />;

  return (
    <div className="space-y-4">
      <PageHeader title="Orders" subtitle={`${pagination.total || 0} orders`} actions={
        <div className="flex items-center gap-2">
          <CsvImport
            columns={[
              { key: 'customer_name', label: 'Customer Name' },
              { key: 'warehouse_name', label: 'Warehouse Name' },
              { key: 'product_sku', label: 'Product SKU' },
              { key: 'quantity', label: 'Quantity' },
              { key: 'unit_price', label: 'Unit Price' },
              { key: 'notes', label: 'Notes' },
            ]}
            sampleRows={[{ customer_name: 'John Doe', warehouse_name: 'Main Warehouse', product_sku: 'PRD-001', quantity: '2', unit_price: '499', notes: 'Rush order' }]}
            onImport={async (rows) => {
              const custMap = {}; customerOpts.forEach((c) => { custMap[c.label.toLowerCase()] = c.value; });
              const prodSkuMap = {}; Object.values(productMap).forEach((p) => { prodSkuMap[p.sku?.toLowerCase()] = p._id; });
              const whMap = {}; warehouseOpts.forEach((w) => { whMap[w.label.toLowerCase()] = w.value; });
              let ok = 0, fail = 0;
              for (const row of rows) {
                const custId = custMap[row.customer_name?.trim().toLowerCase()];
                const prodId = prodSkuMap[row.product_sku?.trim().toLowerCase()];
                const whId = whMap[row.warehouse_name?.trim().toLowerCase()] || warehouseOpts[0]?.value;
                if (!custId || !prodId) { fail++; continue; }
                try {
                  await ordersAPI.create({
                    customer: custId,
                    warehouse: whId,
                    items: [{ product: prodId, quantity: Number(row.quantity) || 1, unitPrice: Number(row.unit_price) || 0 }],
                    notes: row.notes || '',
                    paymentStatus: 'pending',
                    status: 'placed',
                  });
                  ok++;
                } catch { fail++; }
              }
              toast.success(`Imported ${ok} order${ok !== 1 ? 's' : ''}${fail ? `, ${fail} skipped` : ''}`);
              fetchOrders();
            }}
            label="Import CSV"
          />
          <Button onClick={() => openTab({ id: 'pos', label: 'POS', icon: Zap, component: POS })}><Zap size={16} className="mr-1" />POS</Button>
          <Button onClick={openCreate}><Plus size={16} className="mr-1" />New Order</Button>
        </div>
      } />

      <GlassCard className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <SearchInput value={search} onChange={setSearch} placeholder="Search orders…" className="flex-1 min-w-[200px]" />
          <Select label="Status" options={[{ value: '', label: 'All Statuses' }, ...STATUS_OPTS]} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-40" />
          <Select label="Payment" options={[{ value: '', label: 'All Payments' }, ...PAYMENT_STATUS_OPTS]} value={filterPayStatus} onChange={(e) => setFilterPayStatus(e.target.value)} className="w-40" />
        </div>
      </GlassCard>

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        emptyMessage="No orders found"
        serverPagination
        currentPage={page}
        totalItems={pagination.total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Order' : 'Create Order'} size="full">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SearchableSelect label="Customer *" options={[{ value: '', label: 'Select customer' }, ...customerOpts]} value={form.customer} onChange={setFormField('customer')} placeholder="Select customer" />
            <Select label="Warehouse *" options={[{ value: '', label: 'Select warehouse' }, ...warehouseOpts]} value={form.warehouse} onChange={setFormField('warehouse')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Reference #" value={form.referenceNumber} onChange={setFormField('referenceNumber')} placeholder="Ref / PO number" />
            <Select label="Sale Type" options={[{ value: '', label: 'Select' }, ...SALE_TYPE_OPTS]} value={form.saleType} onChange={setFormField('saleType')} />
            <Select label="Order Source" options={[{ value: '', label: 'Select' }, ...ORDER_SOURCE_OPTS]} value={form.orderSource} onChange={setFormField('orderSource')} />
          </div>
          {renderItemsEditor()}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Shipping Charge" type="number" value={form.shippingCharge} onChange={setFormField('shippingCharge')} />
            <div />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={setFormField('notes')} rows={2} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Delete Order" message={`Delete order ${deleteTarget?.orderNumber}? This cannot be undone.`} />

      {/* Standalone Status Modal */}
      <Modal open={!!statusModal} onClose={() => setStatusModal(null)} title={`Status — ${statusModal?.orderNumber || ''}`} size="md">
        {statusModal && (() => {
          const o = statusModal;
          const idx = STATUS_FLOW.indexOf(o.status);
          const nextStatus = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
          return (
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-slate-400 text-sm">Current Status</span>
                <div className="mt-2"><Badge color={STATUS_COLOR[o.status]} className="text-lg px-4 py-1">{o.status}</Badge></div>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {STATUS_FLOW.map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded-full ${STATUS_FLOW.indexOf(o.status) >= i ? 'bg-violet-500' : 'bg-slate-200'}`} />
                    <span className={`text-xs ${STATUS_FLOW.indexOf(o.status) >= i ? 'text-violet-600' : 'text-slate-400'}`}>{s}</span>
                    {i < STATUS_FLOW.length - 1 && <span className="text-slate-300 mx-1">→</span>}
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-3 mt-6">
                {nextStatus && o.status !== 'cancelled' && (
                  <Button onClick={() => handleStatusModalAction(nextStatus)}>Advance to {nextStatus}</Button>
                )}
                {!['cancelled', 'delivered', 'returned', 'return', 'partial_return'].includes(o.status) && (
                  <Button variant="ghost" className="text-red-500 border-red-300" onClick={() => handleStatusModalAction('cancelled')}>Cancel Order</Button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Standalone Payments Modal */}
      <Modal open={!!paymentModal} onClose={() => setPaymentModal(null)} title={`Payments — ${paymentModal?.order?.orderNumber || ''}`} size="lg">
        {paymentModal && (
          <div className="space-y-4">
            {paymentModalLoading ? <Loader /> : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex gap-4 text-sm">
                    <span className="text-slate-600">Total: <strong className="text-slate-800">₹{fmtCurrency(paymentModal.order.grandTotal)}</strong></span>
                    <span className="text-green-600">Paid: <strong>₹{fmtCurrency(paymentModal.order.amountPaid)}</strong></span>
                    <span className="text-red-500">Due: <strong>₹{fmtCurrency(paymentModal.order.balanceDue)}</strong></span>
                  </div>
                  <Badge color={PAY_STATUS_COLOR[paymentModal.order.paymentStatus]}>{paymentModal.order.paymentStatus}</Badge>
                </div>
                {paymentModal.payments.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 border-b border-violet-100">
                          <th className="py-2 text-left">Date</th>
                          <th className="py-2 text-left">Method</th>
                          <th className="py-2 text-right">Amount</th>
                          <th className="py-2 text-left">Reference</th>
                          <th className="py-2 text-left">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentModal.payments.map((p, i) => (
                          <tr key={i} className="border-b border-violet-50">
                            <td className="py-2 text-slate-600">{fmtDate(p.createdAt || p.date)}</td>
                            <td className="py-2"><Badge color="cyan">{p.method}</Badge></td>
                            <td className="py-2 text-right text-emerald-600 font-medium">₹{fmtCurrency(p.amount)}</td>
                            <td className="py-2 font-mono text-xs text-slate-500">{p.reference || '-'}</td>
                            <td className="py-2 text-xs text-slate-500">{p.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {paymentModal.order.paymentStatus !== 'paid' && (
                  <GlassCard className="p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-violet-700 flex items-center gap-2"><CreditCard size={16} />Record Payment</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label={`Amount (Max \u20b9${fmtCurrency(paymentModal.order.balanceDue)})`} type="number" min="0.01" max={paymentModal.order.balanceDue} value={payForm.amount} onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))} />
                      <Select label="Method" options={PAY_METHODS} value={payForm.method} onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))} />
                      <Input label="Reference" value={payForm.reference} onChange={(e) => setPayForm((p) => ({ ...p, reference: e.target.value }))} />
                      <Input label="Notes" value={payForm.notes} onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))} />
                    </div>
                    <Button onClick={handlePaymentModalRecord} disabled={payingSaving}>{payingSaving ? 'Recording…' : 'Record Payment'}</Button>
                  </GlassCard>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailOrder} onClose={closeDetail} title={`Order ${detailOrder?.orderNumber || ''}`} size="full">
        {detailOrder && (
          <div className="space-y-4">
            <TabList tabs={DETAIL_TABS} active={detailTab} onChange={switchDetailTab} />
            <div className="min-h-[300px]">
              {detailTab === 'details' && renderDetails()}
              {detailTab === 'returns' && renderReturns()}
              {detailTab === 'invoice' && renderInvoice()}
              {detailTab === 'history' && renderHistory()}
            </div>
          </div>
        )}
      </Modal>


    </div>
  );
}
