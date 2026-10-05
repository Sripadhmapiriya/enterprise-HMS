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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Procurement & Purchasing</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Requisition approval workflows, purchase orders (PO), goods receipts (GRN), and inventory restocking.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowPrModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" /> New Requisition (PR)
          </button>
          <button
            onClick={() => setShowPoModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
          >
            <Plus className="w-4 h-4" /> Issue PO
          </button>
          <button
            onClick={() => setShowGrnModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm"
          >
            <Truck className="w-4 h-4" /> Receive Goods (GRN)
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active PRs</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{requests.length}</h3>
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {requests.filter((r) => r.status === 'PENDING_APPROVAL').length} pending approval
              </p>
            </div>
            <span className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Issued POs</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{orders.length}</h3>
              <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5" /> {orders.filter((o) => o.status === 'SENT').length} in transit
              </p>
            </div>
            <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Received GRNs</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{receipts.length}</h3>
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Restocked into pharmacy batches
              </p>
            </div>
            <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Package className="w-5 h-5" />
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Suppliers</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{suppliers.length}</h3>
              <button
                onClick={() => setShowSupplierModal(true)}
                className="text-xs text-indigo-600 font-medium hover:underline mt-1 block"
              >
                + Register New Vendor
              </button>
            </div>
            <span className="p-2.5 bg-sky-50 text-sky-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 relative ${
            activeTab === 'requests'
              ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Purchase Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 relative ${
            activeTab === 'orders'
              ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Purchase Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('receipts')}
          className={`pb-3 relative ${
            activeTab === 'receipts'
              ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Goods Receipts / GRN ({receipts.length})
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 relative ${
            activeTab === 'suppliers'
              ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Suppliers Directory ({suppliers.length})
        </button>
      </div>

      {/* Main Table Content */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading procurement records...</div>
        ) : (
          <>
            {activeTab === 'requests' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">PR Number</th>
                      <th className="px-6 py-4">Items / Details</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Requested By</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                          No purchase requisitions found. Click &quot;New Requisition&quot; to submit a material request.
                        </td>
                      </tr>
                    ) : (
                      requests.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/60">
                          <td className="px-6 py-4 font-semibold text-slate-900">{r.prNumber}</td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-800">
                              {r.items?.map((i: any) => `${i.product?.name || 'Product'} (${i.quantity} units)`).join(', ') || 'Material Request'}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{r.reason || 'Restocking'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                r.priority === 'URGENT'
                                  ? 'bg-rose-100 text-rose-700'
                                  : r.priority === 'HIGH'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {r.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {r.requestedBy?.firstName} {r.requestedBy?.lastName}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                r.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : r.status === 'PO_CREATED'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : r.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-700'
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
                                  className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleApprovePr(r.id, false)}
                                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200"
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
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">PO Number</th>
                      <th className="px-6 py-4">Supplier</th>
                      <th className="px-6 py-4">Items Ordered</th>
                      <th className="px-6 py-4">Total Amount</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          No purchase orders issued yet.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50/60">
                          <td className="px-6 py-4 font-semibold text-slate-900">{o.poNumber}</td>
                          <td className="px-6 py-4 font-medium text-slate-800">{o.supplier?.name}</td>
                          <td className="px-6 py-4">
                            {o.items?.map((i: any) => `${i.product?.name || 'Item'} (${i.quantity} @ $${i.unitPrice})`).join(', ')}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-900">${o.totalAmount?.toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                o.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-indigo-100 text-indigo-700'
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
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">GRN / Invoice</th>
                      <th className="px-6 py-4">Supplier</th>
                      <th className="px-6 py-4">Received Batches</th>
                      <th className="px-6 py-4">Total Amount</th>
                      <th className="px-6 py-4">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receipts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          No goods receipt notes recorded. Receive supplier shipments to stock pharmacy batches.
                        </td>
                      </tr>
                    ) : (
                      receipts.map((grn) => (
                        <tr key={grn.id} className="hover:bg-slate-50/60">
                          <td className="px-6 py-4 font-semibold text-slate-900">{grn.invoiceNumber}</td>
                          <td className="px-6 py-4 font-medium text-slate-800">{grn.supplier?.name}</td>
                          <td className="px-6 py-4">
                            {grn.items?.map((i: any) => (
                              <div key={i.id} className="text-xs text-slate-700">
                                <span className="font-medium text-slate-900">{i.product?.name}</span> (Qty: {i.quantity}) &bull; Batch: {i.batchNumber}
                              </div>
                            ))}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-900">${grn.totalAmount?.toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 flex items-center gap-1 w-max">
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
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Supplier Name</th>
                      <th className="px-6 py-4">Code</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">Phone / Email</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          No suppliers found. Click &quot;Register New Vendor&quot; to onboard suppliers.
                        </td>
                      </tr>
                    ) : (
                      suppliers.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/60">
                          <td className="px-6 py-4 font-semibold text-slate-900">{s.name}</td>
                          <td className="px-6 py-4 text-slate-600 font-mono text-xs">{s.code}</td>
                          <td className="px-6 py-4">{s.contactName || '—'}</td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            <div>{s.phone || '—'}</div>
                            <div className="text-slate-400">{s.email || '—'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create Purchase Requisition (PR)</h3>
            <form onSubmit={handleCreatePr} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Product / Medication
                </label>
                <select
                  value={prForm.productId}
                  onChange={(e) => setPrForm({ ...prForm, productId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                  required
                >
                  <option value="">Select item to restock...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={prForm.quantity}
                    onChange={(e) => setPrForm({ ...prForm, quantity: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Priority
                  </label>
                  <select
                    value={prForm.priority}
                    onChange={(e) => setPrForm({ ...prForm, priority: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Justification / Clinical Purpose
                </label>
                <textarea
                  value={prForm.reason}
                  onChange={(e) => setPrForm({ ...prForm, reason: e.target.value })}
                  placeholder="Low stock alert or seasonal surge requirement..."
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm h-20"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPrModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Issue Purchase Order (PO)</h3>
            <form onSubmit={handleCreatePo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Select Supplier
                </label>
                <select
                  value={poForm.supplierId}
                  onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                  required
                >
                  <option value="">Choose vendor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Product
                </label>
                <select
                  value={poForm.productId}
                  onChange={(e) => setPoForm({ ...poForm, productId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                  required
                >
                  <option value="">Choose product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={poForm.quantity}
                    onChange={(e) => setPoForm({ ...poForm, quantity: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Agreed Unit Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={poForm.unitPrice}
                    onChange={(e) => setPoForm({ ...poForm, unitPrice: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPoModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Receive Shipment & Restock (GRN)</h3>
            <form onSubmit={handleCreateGrn} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Supplier
                </label>
                <select
                  value={grnForm.supplierId}
                  onChange={(e) => setGrnForm({ ...grnForm, supplierId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                  required
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Product
                </label>
                <select
                  value={grnForm.productId}
                  onChange={(e) => setGrnForm({ ...grnForm, productId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                  required
                >
                  <option value="">Select product received...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    placeholder="BATCH-2026-X"
                    value={grnForm.batchNumber}
                    onChange={(e) => setGrnForm({ ...grnForm, batchNumber: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={grnForm.expiryDate}
                    onChange={(e) => setGrnForm({ ...grnForm, expiryDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={grnForm.quantity}
                    onChange={(e) => setGrnForm({ ...grnForm, quantity: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Purchase Rate ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={grnForm.purchaseRate}
                    onChange={(e) => setGrnForm({ ...grnForm, purchaseRate: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGrnModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Register New Supplier / Vendor</h3>
            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  placeholder="Apex Pharmaceuticals Ltd."
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Vendor Code
                </label>
                <input
                  type="text"
                  placeholder="SUP-APEX-01"
                  value={supplierForm.code}
                  onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="Jane Doe"
                    value={supplierForm.contactName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+1 555-0199"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
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
