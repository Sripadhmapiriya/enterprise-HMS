'use client';

import { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Package,
  Building2,
  Truck,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { procurementApi, inventoryApi } from '@/lib/api';
import { Select } from '@enterprise-hms/ui';

export default function ProcurementDashboard() {
  const [activeTab, setActiveTab] = useState<'requests' | 'orders' | 'receipts' | 'suppliers'>('requests');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showPrModal, setShowPrModal] = useState(false);
  const [showPoModal, setShowPoModal] = useState(false);
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  // Form states
  const [prForm, setPrForm] = useState({
    priority: 'MEDIUM',
    reason: '',
    productId: '',
    quantity: 100,
  });

  const [poForm, setPoForm] = useState({
    supplierId: '',
    requestId: '',
    productId: '',
    quantity: 100,
    unitPrice: 15.5,
  });

  const [grnForm, setGrnForm] = useState({
    supplierId: '',
    purchaseOrderId: '',
    productId: '',
    batchNumber: '',
    expiryDate: '',
    quantity: 100,
    purchaseRate: 15.5,
    mrp: 25.0,
    sellingRate: 22.0,
  });

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    code: '',
    contactName: '',
    phone: '',
    email: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqRes, poRes, grnRes, supRes, prodRes] = await Promise.all([
        procurementApi.getRequests(),
        procurementApi.getOrders(),
        procurementApi.getGoodsReceipts(),
        procurementApi.getSuppliers(),
        inventoryApi.getProducts().catch(() => ({ data: [] })),
      ]);

      if (reqRes?.data) setRequests(reqRes.data);
      if (poRes?.data) setOrders(poRes.data);
      if (grnRes?.data) setReceipts(grnRes.data);
      if (supRes?.data) setSuppliers(supRes.data);
      if (prodRes?.data) setProducts(prodRes.data);
    } catch (err) {
      console.error('Failed to load procurement data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prForm.productId) return alert('Select a product for requisition');
    try {
      await procurementApi.createRequest({
        priority: prForm.priority,
        reason: prForm.reason,
        items: [{ productId: prForm.productId, quantity: Number(prForm.quantity) }],
      });
      setShowPrModal(false);
      setPrForm({ priority: 'MEDIUM', reason: '', productId: '', quantity: 100 });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit requisition');
    }
  };

  const handleApprovePr = async (id: string, approved: boolean) => {
    try {
      await procurementApi.approveRequest(id, { approved });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.supplierId || !poForm.productId) return alert('Supplier and product required');
    try {
      await procurementApi.createOrder({
        supplierId: poForm.supplierId,
        requestId: poForm.requestId || undefined,
        items: [
          {
            productId: poForm.productId,
            quantity: Number(poForm.quantity),
            unitPrice: Number(poForm.unitPrice),
          },
        ],
      });
      setShowPoModal(false);
      setPoForm({ supplierId: '', requestId: '', productId: '', quantity: 100, unitPrice: 15.5 });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create PO');
    }
  };

  const handleCreateGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnForm.supplierId || !grnForm.productId || !grnForm.batchNumber || !grnForm.expiryDate) {
      return alert('Supplier, product, batch number, and expiry date are required');
    }
    try {
      await procurementApi.createGoodsReceipt({
        supplierId: grnForm.supplierId,
        purchaseOrderId: grnForm.purchaseOrderId || undefined,
        items: [
          {
            productId: grnForm.productId,
            batchNumber: grnForm.batchNumber,
            expiryDate: grnForm.expiryDate,
            quantity: Number(grnForm.quantity),
            purchaseRate: Number(grnForm.purchaseRate),
            mrp: Number(grnForm.mrp),
            sellingRate: Number(grnForm.sellingRate),
          },
        ],
      });
      setShowGrnModal(false);
      setGrnForm({
        supplierId: '',
        purchaseOrderId: '',
        productId: '',
        batchNumber: '',
        expiryDate: '',
        quantity: 100,
        purchaseRate: 15.5,
        mrp: 25.0,
        sellingRate: 22.0,
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to complete GRN');
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name || !supplierForm.code) return alert('Name and Code are required');
    try {
      await procurementApi.createSupplier(supplierForm);
      setShowSupplierModal(false);
      setSupplierForm({ name: '', code: '', contactName: '', phone: '', email: '' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add supplier');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-surface-subtle text-brand rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-text tracking-tight">Procurement & Purchasing</h1>
          </div>
          <p className="text-text-muted text-sm mt-1">
            Requisition approval workflows, purchase orders (PO), goods receipts (GRN), and inventory restocking.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowPrModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-surface-subtle"
          >
            <Plus className="w-4 h-4" /> New Requisition (PR)
          </button>
          <button
            onClick={() => setShowPoModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-brand bg-surface-subtle border border-border rounded-lg hover:bg-surface-subtle"
          >
            <Plus className="w-4 h-4" /> Issue PO
          </button>
          <button
            onClick={() => setShowGrnModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-brand-foreground bg-brand rounded-lg hover:bg-brand-hover shadow-sm"
          >
            <Truck className="w-4 h-4" /> Receive Goods (GRN)
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Active PRs</p>
              <h3 className="text-2xl font-bold text-text mt-1">{requests.length}</h3>
              <p className="text-xs text-warning mt-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {requests.filter((r) => r.status === 'PENDING_APPROVAL').length} pending approval
              </p>
            </div>
            <span className="p-2.5 bg-warning-bg text-warning rounded-lg">
              <FileText className="w-5 h-5" />
            </span>
          </div>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Issued POs</p>
              <h3 className="text-2xl font-bold text-text mt-1">{orders.length}</h3>
              <p className="text-xs text-brand mt-1 flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5" /> {orders.filter((o) => o.status === 'SENT').length} in transit
              </p>
            </div>
            <span className="p-2.5 bg-surface-subtle text-brand rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </span>
          </div>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Received GRNs</p>
              <h3 className="text-2xl font-bold text-text mt-1">{receipts.length}</h3>
              <p className="text-xs text-stable mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Restocked into pharmacy batches
              </p>
            </div>
            <span className="p-2.5 bg-stable-bg text-stable rounded-lg">
              <Package className="w-5 h-5" />
            </span>
          </div>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Active Suppliers</p>
              <h3 className="text-2xl font-bold text-text mt-1">{suppliers.length}</h3>
              <button
                onClick={() => setShowSupplierModal(true)}
                className="text-xs text-brand font-medium hover:underline mt-1 block"
              >
                + Register New Vendor
              </button>
            </div>
            <span className="p-2.5 bg-info-bg text-info rounded-lg">
              <Building2 className="w-5 h-5" />
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 relative ${ activeTab ==='requests'
              ? 'text-brand border-b-2 border-brand font-semibold'
              : 'text-text-muted hover:text-text'
          }`}
        >
          Purchase Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 relative ${ activeTab ==='orders'
              ? 'text-brand border-b-2 border-brand font-semibold'
              : 'text-text-muted hover:text-text'
          }`}
        >
          Purchase Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('receipts')}
          className={`pb-3 relative ${ activeTab ==='receipts'
              ? 'text-brand border-b-2 border-brand font-semibold'
              : 'text-text-muted hover:text-text'
          }`}
        >
          Goods Receipts / GRN ({receipts.length})
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 relative ${ activeTab ==='suppliers'
              ? 'text-brand border-b-2 border-brand font-semibold'
              : 'text-text-muted hover:text-text'
          }`}
        >
          Suppliers Directory ({suppliers.length})
        </button>
      </div>

      {/* Main Table Content */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-muted">Loading procurement records...</div>
        ) : (
          <>
            {activeTab === 'requests' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-text-muted">
                  <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">PR Number</th>
                      <th className="px-6 py-4">Items / Details</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Requested By</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                          No purchase requisitions found. Click &quot;New Requisition&quot; to submit a material request.
                        </td>
                      </tr>
                    ) : (
                      requests.map((r) => (
                        <tr key={r.id} className="hover:bg-surface-subtle/60">
                          <td className="px-6 py-4 font-semibold text-text">{r.prNumber}</td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-text">
                              {r.items?.map((i: any) => `${i.product?.name || 'Product'} (${i.quantity} units)`).join(', ') || 'Material Request'}
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">{r.reason || 'Restocking'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${ r.priority ==='URGENT'
                                  ? 'bg-critical-bg text-critical-text'
                                  : r.priority === 'HIGH'
                                  ? 'bg-warning-bg text-warning-text'
                                  : 'bg-surface-subtle text-text'
                              }`}
                            >
                              {r.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-text-muted">
                            {r.requestedBy?.firstName} {r.requestedBy?.lastName}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${ r.status ==='APPROVED'
                                  ? 'bg-stable-bg text-stable-text'
                                  : r.status === 'PO_CREATED'
                                  ? 'bg-surface-subtle text-brand'
                                  : r.status === 'REJECTED'
                                  ? 'bg-critical-bg text-critical-text'
                                  : 'bg-warning-bg text-warning-text'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            {r.status === 'PENDING_APPROVAL' && (
                              <>
                                <button
                                  onClick={() => handleApprovePr(r.id, true)}
                                  className="px-2.5 py-1 text-xs font-medium text-brand-foreground bg-stable rounded hover:bg-stable"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleApprovePr(r.id, false)}
                                  className="px-2.5 py-1 text-xs font-medium text-text bg-surface-subtle rounded hover:bg-surface-subtle"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-text-muted">
                  <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">PO Number</th>
                      <th className="px-6 py-4">Supplier</th>
                      <th className="px-6 py-4">Items Ordered</th>
                      <th className="px-6 py-4">Total Amount</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                          No purchase orders issued yet.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id} className="hover:bg-surface-subtle/60">
                          <td className="px-6 py-4 font-semibold text-text">{o.poNumber}</td>
                          <td className="px-6 py-4 font-medium text-text">{o.supplier?.name}</td>
                          <td className="px-6 py-4">
                            {o.items?.map((i: any) => `${i.product?.name || 'Item'} (${i.quantity} @ $${i.unitPrice})`).join(', ')}
                          </td>
                          <td className="px-6 py-4 font-semibold text-text">${o.totalAmount?.toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${ o.status ==='COMPLETED'
                                  ? 'bg-stable-bg text-stable-text'
                                  : 'bg-surface-subtle text-brand'
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'receipts' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-text-muted">
                  <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">GRN / Invoice</th>
                      <th className="px-6 py-4">Supplier</th>
                      <th className="px-6 py-4">Received Batches</th>
                      <th className="px-6 py-4">Total Amount</th>
                      <th className="px-6 py-4">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {receipts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                          No goods receipt notes recorded. Receive supplier shipments to stock pharmacy batches.
                        </td>
                      </tr>
                    ) : (
                      receipts.map((grn) => (
                        <tr key={grn.id} className="hover:bg-surface-subtle/60">
                          <td className="px-6 py-4 font-semibold text-text">{grn.invoiceNumber}</td>
                          <td className="px-6 py-4 font-medium text-text">{grn.supplier?.name}</td>
                          <td className="px-6 py-4">
                            {grn.items?.map((i: any) => (
                              <div key={i.id} className="text-xs text-text">
                                <span className="font-medium text-text">{i.product?.name}</span> (Qty: {i.quantity}) &bull; Batch: {i.batchNumber}
                              </div>
                            ))}
                          </td>
                          <td className="px-6 py-4 font-semibold text-text">${grn.totalAmount?.toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-stable-bg text-stable-text flex items-center gap-1 w-max">
                              <CheckCircle2 className="w-3 h-3" /> Restocked in Batch Ledger
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'suppliers' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-text-muted">
                  <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Supplier Name</th>
                      <th className="px-6 py-4">Code</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">Phone / Email</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                          No suppliers found. Click &quot;Register New Vendor&quot; to onboard suppliers.
                        </td>
                      </tr>
                    ) : (
                      suppliers.map((s) => (
                        <tr key={s.id} className="hover:bg-surface-subtle/60">
                          <td className="px-6 py-4 font-semibold text-text">{s.name}</td>
                          <td className="px-6 py-4 text-text-muted font-mono text-xs">{s.code}</td>
                          <td className="px-6 py-4">{s.contactName || '—'}</td>
                          <td className="px-6 py-4 text-xs text-text-muted">
                            <div>{s.phone || '—'}</div>
                            <div className="text-text-muted">{s.email || '—'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-stable-bg text-stable-text">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: New Purchase Request */}
      {showPrModal && (
        <div className="fixed inset-0 bg-surface/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl max-w-md w-full p-6 shadow-xl border border-border">
            <h3 className="text-lg font-bold text-text mb-4">Create Purchase Requisition (PR)</h3>
            <form onSubmit={handleCreatePr} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Product / Medication
                </label>
                <Select
                  value={prForm.productId}
                  onChange={(e) => setPrForm({ ...prForm, productId: e.target.value })}
                  className="w-full border border-border rounded-lg p-2 text-sm bg-surface"
                  required
                >
                  <option value="">Select item to restock...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={prForm.quantity}
                    onChange={(e) => setPrForm({ ...prForm, quantity: Number(e.target.value) })}
                    className="w-full border border-border rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Priority
                  </label>
                  <Select
                    value={prForm.priority}
                    onChange={(e) => setPrForm({ ...prForm, priority: e.target.value })}
                    className="w-full border border-border rounded-lg p-2 text-sm bg-surface"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </Select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Justification / Clinical Purpose
                </label>
                <textarea
                  value={prForm.reason}
                  onChange={(e) => setPrForm({ ...prForm, reason: e.target.value })}
                  placeholder="Low stock alert or seasonal surge requirement..."
                  className="w-full border border-border rounded-lg p-2 text-sm h-20"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPrModal(false)}
                  className="px-4 py-2 text-sm font-medium text-text bg-surface-subtle rounded-lg hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-brand-foreground bg-brand rounded-lg hover:bg-brand-hover"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Purchase Order */}
      {showPoModal && (
        <div className="fixed inset-0 bg-surface/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl max-w-md w-full p-6 shadow-xl border border-border">
            <h3 className="text-lg font-bold text-text mb-4">Issue Purchase Order (PO)</h3>
            <form onSubmit={handleCreatePo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Select Supplier
                </label>
                <Select
                  value={poForm.supplierId}
                  onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                  className="w-full border border-border rounded-lg p-2 text-sm bg-surface"
                  required
                >
                  <option value="">Choose vendor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Product
                </label>
                <Select
                  value={poForm.productId}
                  onChange={(e) => setPoForm({ ...poForm, productId: e.target.value })}
                  className="w-full border border-border rounded-lg p-2 text-sm bg-surface"
                  required
                >
                  <option value="">Choose product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={poForm.quantity}
                    onChange={(e) => setPoForm({ ...poForm, quantity: Number(e.target.value) })}
                    className="w-full border border-border rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Agreed Unit Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={poForm.unitPrice}
                    onChange={(e) => setPoForm({ ...poForm, unitPrice: Number(e.target.value) })}
                    className="w-full border border-border rounded-lg p-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPoModal(false)}
                  className="px-4 py-2 text-sm font-medium text-text bg-surface-subtle rounded-lg hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-brand-foreground bg-brand rounded-lg hover:bg-brand-hover"
                >
                  Issue Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Receive Goods (GRN) */}
      {showGrnModal && (
        <div className="fixed inset-0 bg-surface/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl max-w-md w-full p-6 shadow-xl border border-border">
            <h3 className="text-lg font-bold text-text mb-4">Receive Shipment & Restock (GRN)</h3>
            <form onSubmit={handleCreateGrn} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Supplier
                </label>
                <Select
                  value={grnForm.supplierId}
                  onChange={(e) => setGrnForm({ ...grnForm, supplierId: e.target.value })}
                  className="w-full border border-border rounded-lg p-2 text-sm bg-surface"
                  required
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Product
                </label>
                <Select
                  value={grnForm.productId}
                  onChange={(e) => setGrnForm({ ...grnForm, productId: e.target.value })}
                  className="w-full border border-border rounded-lg p-2 text-sm bg-surface"
                  required
                >
                  <option value="">Select product received...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    placeholder="BATCH-2026-X"
                    value={grnForm.batchNumber}
                    onChange={(e) => setGrnForm({ ...grnForm, batchNumber: e.target.value })}
                    className="w-full border border-border rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={grnForm.expiryDate}
                    onChange={(e) => setGrnForm({ ...grnForm, expiryDate: e.target.value })}
                    className="w-full border border-border rounded-lg p-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={grnForm.quantity}
                    onChange={(e) => setGrnForm({ ...grnForm, quantity: Number(e.target.value) })}
                    className="w-full border border-border rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Purchase Rate ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={grnForm.purchaseRate}
                    onChange={(e) => setGrnForm({ ...grnForm, purchaseRate: Number(e.target.value) })}
                    className="w-full border border-border rounded-lg p-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGrnModal(false)}
                  className="px-4 py-2 text-sm font-medium text-text bg-surface-subtle rounded-lg hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-brand-foreground bg-brand rounded-lg hover:bg-brand-hover"
                >
                  Confirm & Restock Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Supplier */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-surface/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl max-w-md w-full p-6 shadow-xl border border-border">
            <h3 className="text-lg font-bold text-text mb-4">Register New Supplier / Vendor</h3>
            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  placeholder="Apex Pharmaceuticals Ltd."
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full border border-border rounded-lg p-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Vendor Code
                </label>
                <input
                  type="text"
                  placeholder="SUP-APEX-01"
                  value={supplierForm.code}
                  onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                  className="w-full border border-border rounded-lg p-2 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="Jane Doe"
                    value={supplierForm.contactName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                    className="w-full border border-border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+1 555-0199"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full border border-border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 text-sm font-medium text-text bg-surface-subtle rounded-lg hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-brand-foreground bg-brand rounded-lg hover:bg-brand-hover"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
