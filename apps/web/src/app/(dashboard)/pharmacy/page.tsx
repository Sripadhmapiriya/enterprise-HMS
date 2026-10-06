'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Button,
  Badge,
  Dialog,
  Input,
  Select,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@enterprise-hms/ui';
import {
  Pill,
  FileText,
  AlertTriangle,
  AlertOctagon,
  ShoppingCart,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { pharmacyApi, inventoryApi } from '@/lib/api';

export default function PharmacyDashboard() {
  const [dispensings, setDispensings] = useState<any[]>([]);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [inventoryAlerts, setInventoryAlerts] = useState<{ lowStock: any[]; expiringBatches: any[] }>({
    lowStock: [],
    expiringBatches: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Walk-in POS Sale Modal State
  const [isPosOpen, setIsPosOpen] = useState(false);
  const [isSubmittingPos, setIsSubmittingPos] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [posForm, setPosForm] = useState({
    customerName: 'Walk-in Customer',
    locationId: '',
    productId: '',
    quantity: '1',
    paymentMethod: 'CASH' as 'CASH' | 'CARD' | 'UPI',
  });
  const [posSuccess, setPosSuccess] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dispRes, queueRes, alertsRes, prodsRes, locsRes] = await Promise.all([
        pharmacyApi.getDispensings().catch(() => ({ data: [] })),
        pharmacyApi.getQueue().catch(() => ({ data: [] })),
        inventoryApi.getAlerts().catch(() => ({ data: { lowStock: [], expiringBatches: [] } })),
        inventoryApi.listItems().catch(() => ({ data: [] })),
        inventoryApi.listLocations().catch(() => ({ data: [] })),
      ]);

      setDispensings(dispRes.data || []);
      setQueueCount(queueRes.data ? queueRes.data.length : 0);
      setInventoryAlerts(alertsRes.data || { lowStock: [], expiringBatches: [] });
      setProducts(prodsRes.data || []);
      const locList = locsRes.data || [];
      setLocations(locList);
      if (locList.length > 0 && !posForm.locationId) {
        setPosForm((prev) => ({ ...prev, locationId: locList[0].id }));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load pharmacy data');
    } finally {
      setLoading(false);
    }
  }, [posForm.locationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posForm.productId || !posForm.locationId) return;

    try {
      setIsSubmittingPos(true);
      const res = await pharmacyApi.posSale({
        customerName: posForm.customerName,
        locationId: posForm.locationId,
        paymentMethod: posForm.paymentMethod,
        items: [
          {
            productId: posForm.productId,
            quantity: parseInt(posForm.quantity, 10) || 1,
          },
        ],
      });
      setPosSuccess(res.data);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'POS sale failed');
    } finally {
      setIsSubmittingPos(false);
    }
  };

  const revenueTotal = dispensings.reduce((sum, d) => sum + (d.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Pill className="w-6 h-6 text-stable" />
            <h1 className="text-2xl font-bold text-text tracking-tight">Pharmacy & Dispensing</h1>
          </div>
          <p className="text-text-muted mt-1">
            Prescription queue fulfillment, FEFO batch picking, walk-in POS, and stock control.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="secondary" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ?'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="secondary" onClick={() => { setPosSuccess(null); setIsPosOpen(true); }}>
            <ShoppingCart className="w-4 h-4 mr-1.5" />
            Walk-in POS Sale
          </Button>
          <Link href="/pharmacy/prescriptions">
            <Button variant="primary">
              <FileText className="w-4 h-4 mr-1.5" />
              Prescription Queue ({queueCount})
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <span className="text-xs font-semibold text-text-muted uppercase">Prescriptions Waiting</span>
          <div className="text-3xl font-bold text-text mt-1 tabular-nums">{queueCount}</div>
          <span className="text-xs text-info font-medium">Pending fulfillment</span>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <span className="text-xs font-semibold text-text-muted uppercase">Total Dispensed Value</span>
          <div className="text-3xl font-bold text-stable mt-1 tabular-nums">
            ${revenueTotal.toFixed(2)}
          </div>
          <span className="text-xs text-text-muted font-medium">{dispensings.length} completed transactions</span>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-warning-border shadow-sm bg-warning-bg/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-warning-text uppercase">Low Stock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-warning" />
          </div>
          <div className="text-3xl font-bold text-warning-text mt-1 tabular-nums">
            {inventoryAlerts.lowStock.length}
          </div>
          <span className="text-xs text-warning font-medium">At or below reorder level</span>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-critical-border shadow-sm bg-critical-bg/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-critical-text uppercase">Near Expiry (&lt;90d)</span>
            <AlertOctagon className="w-4 h-4 text-critical" />
          </div>
          <div className="text-3xl font-bold text-critical-text mt-1 tabular-nums">
            {inventoryAlerts.expiringBatches.length}
          </div>
          <span className="text-xs text-critical font-medium">Batches requiring FEFO priority</span>
        </div>
      </div>

      {/* Main Dispensings Feed */}
      {loading && dispensings.length === 0 ? (
        <div className="space-y-3 bg-surface p-6 rounded-xl border border-border">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Failed to load pharmacy data" message={error} onRetry={loadData} />
      ) : dispensings.length === 0 ? (
        <EmptyState
          title="No Dispensings Recorded"
          description="Dispense medications from the prescription queue or perform a walk-in OTC POS sale."
          actionLabel="Open Prescription Queue"
          onAction={() => window.location.href = '/pharmacy/prescriptions'}
        />
      ) : (
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-surface-subtle/70 flex justify-between items-center">
            <h3 className="font-semibold text-text">Recent Pharmacy Dispensings</h3>
            <span className="text-xs text-text-muted">{dispensings.length} records</span>
          </div>

          <div className="divide-y divide-border">
            {dispensings.slice(0, 15).map((disp) => (
              <div key={disp.id} className="p-4 hover:bg-surface-subtle/60 transition-colors flex justify-between items-center">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-text">
                      {disp.patient?.firstName} {disp.patient?.lastName}
                    </span>
                    <span className="text-xs font-mono text-text-muted">MRN: {disp.patient?.mrn}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    {disp.items?.length || 0} item(s) dispensed by{' '}
                    {disp.dispensedBy ? `${disp.dispensedBy.firstName} ${disp.dispensedBy.lastName}` : 'Pharmacist'}
                    {' '}&bull; {new Date(disp.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="text-right">
                  <Badge variant={disp.status === 'COMPLETED' ? 'stable' : 'warning'}>
                    {disp.status}
                  </Badge>
                  <div className="text-sm font-bold text-text mt-1 tabular-nums">
                    ${(disp.totalAmount || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Walk-in POS Sale Modal */}
      <Dialog
        isOpen={isPosOpen}
        onClose={() => setIsPosOpen(false)}
        title="Walk-in OTC Pharmacy POS Sale"
      >
        {posSuccess ? (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-stable mx-auto" />
            <h3 className="text-lg font-bold text-text">Sale Completed Successfully</h3>
            <p className="text-sm text-text-muted">
              Receipt <span className="font-mono font-bold">{posSuccess.receiptNumber}</span> generated.
              Total: <span className="font-bold text-stable">${posSuccess.totalAmount.toFixed(2)}</span>
            </p>
            <p className="text-xs text-text-muted">
              Mode: {posSuccess.receiptMode} &bull; Stock ledger updated with FEFO deduction.
            </p>
            <Button variant="primary" onClick={() => setIsPosOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handlePosSubmit} className="space-y-4">
            <Input
              label="Customer Name"
              value={posForm.customerName}
              onChange={(e) => setPosForm({ ...posForm, customerName: e.target.value })}
              required
            />

            <Select
              label="Dispensing Location"
              value={posForm.locationId}
              onChange={(e) => setPosForm({ ...posForm, locationId: e.target.value })}
              options={locations.map((loc) => ({ value: loc.id, label: loc.name }))}
            />

            <Select
              label="Select Medicine / Product"
              value={posForm.productId}
              onChange={(e) => setPosForm({ ...posForm, productId: e.target.value })}
              options={[
                { value: '', label: '-- Select Item --' },
                ...products.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.code}) - Stock: ${p.totalStock}`,
                })),
              ]}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Quantity"
                type="number"
                min="1"
                value={posForm.quantity}
                onChange={(e) => setPosForm({ ...posForm, quantity: e.target.value })}
                required
              />
              <Select
                label="Payment Method"
                value={posForm.paymentMethod}
                onChange={(e) => setPosForm({ ...posForm, paymentMethod: e.target.value as any })}
                options={[
                  { value: 'CASH', label: 'Cash' },
                  { value: 'CARD', label: 'Card' },
                  { value: 'UPI', label: 'UPI' },
                ]}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-border">
              <Button variant="secondary" type="button" onClick={() => setIsPosOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmittingPos || !posForm.productId}>
                {isSubmittingPos ? 'Processing...' : 'Complete POS Sale'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
