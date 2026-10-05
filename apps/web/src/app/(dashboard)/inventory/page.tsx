'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Badge,
  Dialog,
  Input,
  Select,
  Textarea,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@enterprise-hms/ui';
import {
  Boxes,
  Plus,
  AlertTriangle,
  AlertOctagon,
  Search,
  Package,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { inventoryApi } from '@/lib/api';

export default function InventoryDashboard() {
  const [items, setItems] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<{ lowStock: any[]; expiringBatches: any[] }>({
    lowStock: [],
    expiringBatches: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'products' | 'batches'>('products');

  // Receive Batch Modal State
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [batchForm, setBatchForm] = useState({
    productId: '',
    locationId: '',
    batchNumber: '',
    expiryDate: '',
    quantity: '100',
    purchaseRate: '10.00',
    mrp: '15.00',
    sellingRate: '15.00',
    supplierName: 'MediCorp Supplies',
  });

  // Stock Adjustment Modal State
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    productId: '',
    batchId: '',
    locationId: '',
    quantity: '-1',
    reason: 'Damaged packaging write-off',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [itemsRes, batchesRes, locsRes, alertsRes] = await Promise.all([
        inventoryApi.listItems(),
        inventoryApi.listBatches(),
        inventoryApi.listLocations(),
        inventoryApi.getAlerts().catch(() => ({ data: { lowStock: [], expiringBatches: [] } })),
      ]);

      const itemList = itemsRes.data || [];
      const batchList = batchesRes.data || [];
      const locList = locsRes.data || [];

      setItems(itemList);
      setBatches(batchList);
      setLocations(locList);
      setAlerts(alertsRes.data || { lowStock: [], expiringBatches: [] });

      if (itemList.length > 0 && !batchForm.productId) {
        setBatchForm((prev) => ({ ...prev, productId: itemList[0].id }));
        setAdjustForm((prev) => ({ ...prev, productId: itemList[0].id }));
      }
      if (locList.length > 0 && !batchForm.locationId) {
        setBatchForm((prev) => ({ ...prev, locationId: locList[0].id }));
        setAdjustForm((prev) => ({ ...prev, locationId: locList[0].id }));
      }
      if (batchList.length > 0 && !adjustForm.batchId) {
        setAdjustForm((prev) => ({ ...prev, batchId: batchList[0].id }));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }, [batchForm.productId, batchForm.locationId, adjustForm.batchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReceiveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchForm.productId || !batchForm.locationId || !batchForm.batchNumber || !batchForm.expiryDate) {
      alert('Please fill all required fields');
      return;
    }

    try {
      setIsSubmittingBatch(true);
      await inventoryApi.receiveBatch({
        productId: batchForm.productId,
        locationId: batchForm.locationId,
        batchNumber: batchForm.batchNumber,
        expiryDate: batchForm.expiryDate,
        quantity: parseInt(batchForm.quantity, 10),
        purchaseRate: parseFloat(batchForm.purchaseRate),
        mrp: parseFloat(batchForm.mrp),
        sellingRate: parseFloat(batchForm.sellingRate),
        supplierName: batchForm.supplierName,
      });
      setIsReceiveOpen(false);
      setBatchForm((prev) => ({ ...prev, batchNumber: '' }));
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to receive batch');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm.batchId) return;

    try {
      setIsSubmittingAdjust(true);
      await inventoryApi.adjustStock({
        productId: adjustForm.productId,
        batchId: adjustForm.batchId,
        locationId: adjustForm.locationId,
        quantity: parseInt(adjustForm.quantity, 10),
        reason: adjustForm.reason,
      });
      setIsAdjustOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to adjust stock');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return item.name?.toLowerCase().includes(q) || item.code?.toLowerCase().includes(q);
  });

  const totalStockCount = items.reduce((sum, item) => sum + (item.totalStock || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Boxes className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory & Materials Management</h1>
          </div>
          <p className="text-slate-500 mt-1">Multi-store stock tracking, FEFO batch control, and stock ledger adjustments.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="secondary" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="secondary" onClick={() => setIsAdjustOpen(true)}>
            <ArrowUpDown className="w-4 h-4 mr-1.5" />
            Stock Adjustment
          </Button>
          <Button variant="primary" onClick={() => setIsReceiveOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Receive Stock Batch
          </Button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Item Master Catalog</span>
          <div className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{items.length}</div>
          <span className="text-xs text-slate-500">Active SKUs registered</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Available Units</span>
          <div className="text-3xl font-bold text-blue-600 mt-1 tabular-nums">{totalStockCount}</div>
          <span className="text-xs text-slate-500">Across {locations.length} store locations</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm bg-amber-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase">Low Stock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-amber-700 mt-1 tabular-nums">
            {alerts.lowStock.length}
          </div>
          <span className="text-xs text-amber-600">Items below reorder point</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-sm bg-rose-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 uppercase">Near Expiry Batches</span>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-3xl font-bold text-rose-700 mt-1 tabular-nums">
            {alerts.expiringBatches.length}
          </div>
          <span className="text-xs text-rose-600">Expiring within 90 days</span>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex space-x-2 border-b border-slate-200 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('products')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center border-b-2 transition-colors ${
              activeTab === 'products'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Package className="w-4 h-4 mr-1.5" />
            Product Catalog ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('batches')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center border-b-2 transition-colors ${
              activeTab === 'batches'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers className="w-4 h-4 mr-1.5" />
            FEFO Batch Tracking ({batches.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search items or SKU..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main View */}
      {loading ? (
        <div className="space-y-3 bg-white p-6 rounded-xl border border-slate-200">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Failed to load inventory" message={error} onRetry={loadData} />
      ) : activeTab === 'products' ? (
        filteredItems.length === 0 ? (
          <EmptyState
            title="No Inventory Products Found"
            description="Create your first medicine or medical supply in the item master."
            actionLabel="Receive Stock Batch"
            onAction={() => setIsReceiveOpen(true)}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-5 py-3">Item / SKU</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Unit</th>
                  <th className="px-5 py-3">Reorder Point</th>
                  <th className="px-5 py-3">Stock Units</th>
                  <th className="px-5 py-3">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{item.code}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{item.category}</td>
                    <td className="px-5 py-3 text-slate-700">{item.unit}</td>
                    <td className="px-5 py-3 tabular-nums font-mono">{item.reorderLevel}</td>
                    <td className="px-5 py-3 font-bold text-slate-900 tabular-nums">
                      {item.totalStock}
                    </td>
                    <td className="px-5 py-3">
                      {item.totalStock === 0 ? (
                        <Badge variant="critical">Out of Stock</Badge>
                      ) : item.isLowStock ? (
                        <Badge variant="warning">Low Stock</Badge>
                      ) : (
                        <Badge variant="stable">Adequate</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Batch #</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Available Qty</th>
                <th className="px-5 py-3">Selling Rate</th>
                <th className="px-5 py-3">Expiry Date (FEFO)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b) => {
                const isExpired = new Date(b.expiryDate) <= new Date();
                return (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {b.product?.name} ({b.product?.code})
                    </td>
                    <td className="px-5 py-3 font-mono font-bold text-slate-800">{b.batchNumber}</td>
                    <td className="px-5 py-3 text-slate-700">{b.location?.name}</td>
                    <td className="px-5 py-3 font-bold text-slate-900 tabular-nums">{b.availableQty}</td>
                    <td className="px-5 py-3 font-mono">${(b.sellingRate || 0).toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span className={`font-mono text-xs font-semibold ${isExpired ? 'text-rose-600' : 'text-slate-700'}`}>
                        {new Date(b.expiryDate).toLocaleDateString()}
                      </span>
                      {isExpired && <Badge variant="critical" size="sm" className="ml-2">Expired</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Receive Stock Batch Modal */}
      <Dialog
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        title="Receive New Inventory Stock Batch"
      >
        <form onSubmit={handleReceiveBatch} className="space-y-4">
          <Select
            label="Product / SKU"
            value={batchForm.productId}
            onChange={(e) => setBatchForm({ ...batchForm, productId: e.target.value })}
            options={items.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))}
          />

          <Select
            label="Storage Location"
            value={batchForm.locationId}
            onChange={(e) => setBatchForm({ ...batchForm, locationId: e.target.value })}
            options={locations.map((loc) => ({ value: loc.id, label: loc.name }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Batch Number"
              placeholder="e.g. BATCH-2026-A1"
              value={batchForm.batchNumber}
              onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
              required
            />
            <Input
              label="Expiry Date"
              type="date"
              value={batchForm.expiryDate}
              onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Received Qty"
              type="number"
              min="1"
              value={batchForm.quantity}
              onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })}
              required
            />
            <Input
              label="Purchase Rate ($)"
              value={batchForm.purchaseRate}
              onChange={(e) => setBatchForm({ ...batchForm, purchaseRate: e.target.value })}
              required
            />
            <Input
              label="Selling Rate ($)"
              value={batchForm.sellingRate}
              onChange={(e) => setBatchForm({ ...batchForm, sellingRate: e.target.value })}
              required
            />
          </div>

          <Input
            label="Supplier"
            value={batchForm.supplierName}
            onChange={(e) => setBatchForm({ ...batchForm, supplierName: e.target.value })}
          />

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setIsReceiveOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmittingBatch}>
              {isSubmittingBatch ? 'Saving...' : 'Add to Stock'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Stock Adjustment Modal */}
      <Dialog
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        title="Stock Adjustment / Write-Off"
      >
        <form onSubmit={handleStockAdjustment} className="space-y-4">
          <Select
            label="Select Batch to Adjust"
            value={adjustForm.batchId}
            onChange={(e) => {
              const b = batches.find((x) => x.id === e.target.value);
              setAdjustForm({
                ...adjustForm,
                batchId: e.target.value,
                productId: b?.productId || adjustForm.productId,
                locationId: b?.locationId || adjustForm.locationId,
              });
            }}
            options={batches.map((b) => ({
              value: b.id,
              label: `${b.product?.name} (Batch: ${b.batchNumber}, Available: ${b.availableQty})`,
            }))}
          />

          <Input
            label="Adjustment Quantity (negative to deduct, positive to add)"
            type="number"
            value={adjustForm.quantity}
            onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
            required
          />

          <Textarea
            label="Audit Justification / Reason"
            value={adjustForm.reason}
            onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
            required
            rows={2}
          />

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setIsAdjustOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" type="submit" disabled={isSubmittingAdjust || !adjustForm.batchId}>
              {isSubmittingAdjust ? 'Adjusting...' : 'Confirm Adjustment'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
