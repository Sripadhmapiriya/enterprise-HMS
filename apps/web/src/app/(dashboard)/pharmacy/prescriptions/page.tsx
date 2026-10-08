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
  ToastContainer,
  ToastMessage,
} from '@enterprise-hms/ui';
import {
  FileText,
  Pill,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { pharmacyApi, inventoryApi } from '@/lib/api';

export default function PrescriptionQueuePage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Dispensing Modal State
  const [isDispenseOpen, setIsDispenseOpen] = useState(false);
  const [selectedRx, setSelectedRx] = useState<any | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dispenseFormItems, setDispenseFormItems] = useState<Record<string, { quantity: number | string; batchId: string }>>({});

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${toasts.length + 1}`;
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, [toasts.length]);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [queueRes, locsRes] = await Promise.all([
        pharmacyApi.getQueue(),
        inventoryApi.listLocations().catch(() => ({ data: [] })),
      ]);
      setQueue(queueRes.data || []);
      const locList = locsRes.data || [];
      setLocations(locList);
      if (locList.length > 0 && !selectedLocationId) {
        setSelectedLocationId(locList[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load prescription queue');
    } finally {
      setLoading(false);
    }
  }, [selectedLocationId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleOpenDispense = async (rx: any) => {
    try {
      const detail = await pharmacyApi.getPrescription(rx.id);
      setSelectedRx(detail.data);
      const initial: any = {};
      detail.data.items.forEach((item: any) => {
        initial[item.id] = {
          quantity: item.quantity || 1,
          batchId: item.recommendedBatch?.id || (item.fefoBatches?.[0]?.id || ''),
        };
      });
      setDispenseFormItems(initial);
      setIsDispenseOpen(true);
    } catch (err: any) {
      addToast({ title: 'Error', description: err?.message || 'Failed to load prescription details', variant: 'error' });
    }
  };

  const handleConfirmDispense = async () => {
    if (!selectedRx || !selectedLocationId) return;

    try {
      setIsSubmitting(true);
      const itemsToDispense = [];
      
      for (const item of selectedRx.items) {
        const formItem = dispenseFormItems[item.id];
        const qty = parseInt(String(formItem.quantity), 10);
        
        if (qty > 0) {
           if (!item.productId) {
              throw new Error(`Product mapping missing for "${item.drugName}". Please configure this medication in inventory.`);
           }
           const batch = item.fefoBatches?.find((b: any) => b.id === formItem.batchId);
           if (batch && qty > batch.availableQty) {
              throw new Error(`Not enough stock for ${item.drugName} in the selected batch. Available: ${batch.availableQty}, Requested: ${qty}`);
           }
           
           itemsToDispense.push({
             productId: item.productId,
             batchId: formItem.batchId || undefined,
             quantity: qty,
             instructions: item.instructions,
           });
        }
      }

      if (itemsToDispense.length === 0) {
         throw new Error("No valid items to dispense. Check quantities and stock.");
      }

      await pharmacyApi.dispense({
        prescriptionId: selectedRx.id,
        patientId: selectedRx.patientId,
        locationId: selectedLocationId,
        items: itemsToDispense,
      });

      setIsDispenseOpen(false);
      addToast({ title: 'Success', description: 'Prescription dispensed successfully', variant: 'success' });
      await fetchQueue();
    } catch (err: any) {
      addToast({ title: 'Dispense Failed', description: err?.message || 'Dispensing failed', variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQueue = queue.filter((rx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const patientName = `${rx.patient?.firstName} ${rx.patient?.lastName}`.toLowerCase();
    const mrn = (rx.patient?.mrn || '').toLowerCase();
    const rxNum = (rx.prescriptionNumber || '').toLowerCase();
    return patientName.includes(q) || mrn.includes(q) || rxNum.includes(q);
  });

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Link href="/pharmacy" className="text-text-muted hover:text-text-muted transition-colors">
              <ArrowLeft className="w-5 h-5 mr-1" />
            </Link>
            <h1 className="text-2xl font-bold text-text tracking-tight">Prescription Queue</h1>
          </div>
          <p className="text-text-muted mt-1">
            Review outpatient and emergency prescriptions for FEFO batch fulfillment.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="secondary" onClick={() => fetchQueue()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ?'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-text-muted" />
          <input
            type="text"
            placeholder="Search by Patient, MRN, or Rx #..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <span className="text-xs text-text-muted font-medium">
          {filteredQueue.length} prescription(s) pending
        </span>
      </div>

      {/* Queue Table */}
      {loading ? (
        <div className="space-y-3 bg-surface p-6 rounded-xl border border-border">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Failed to load prescription queue" message={error} onRetry={fetchQueue} />
      ) : filteredQueue.length === 0 ? (
        <EmptyState
          title="No Prescriptions Waiting"
          description="There are currently no active prescriptions awaiting fulfillment in the queue."
        />
      ) : (
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3">Prescription #</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Prescriber</th>
                <th className="px-5 py-3">Medications</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredQueue.map((rx) => (
                <tr key={rx.id} className="hover:bg-surface-subtle/60 transition-colors">
                  <td className="px-5 py-3 font-mono text-sm font-semibold text-text">
                    {rx.prescriptionNumber}
                    <div className="text-xs font-normal text-text-muted">
                      {new Date(rx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>

                  <td className="px-5 py-3">
                    <div className="font-semibold text-text">
                      {rx.patient?.firstName} {rx.patient?.lastName}
                    </div>
                    <div className="text-xs text-text-muted font-mono">
                      MRN: {rx.patient?.mrn}
                    </div>
                  </td>

                  <td className="px-5 py-3 text-text">
                    {rx.prescriber}
                  </td>

                  <td className="px-5 py-3">
                    <Badge variant="neutral" size="sm">
                      {rx.itemCount} item(s)
                    </Badge>
                  </td>

                  <td className="px-5 py-3">
                    <Badge variant="warning">{rx.status}</Badge>
                  </td>

                  <td className="px-5 py-3 text-right">
                    <Button variant="primary" size="sm" onClick={() => handleOpenDispense(rx)}>
                      <Pill className="w-3.5 h-3.5 mr-1" />
                      Dispense
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* FEFO Dispense Confirmation Modal */}
      <Dialog
        isOpen={isDispenseOpen}
        onClose={() => setIsDispenseOpen(false)}
        title="Fulfill Prescription (FEFO Batch Picking)"
      >
        {selectedRx && (
          <div className="space-y-4">
            <div className="bg-surface-subtle p-3 rounded-lg border border-border">
              <div className="font-semibold text-text">
                Patient: {selectedRx.patient?.firstName} {selectedRx.patient?.lastName} (MRN: {selectedRx.patient?.mrn})
              </div>
              <div className="text-xs text-text-muted mt-1">
                Prescription #{selectedRx.prescriptionNumber || selectedRx.id.slice(0, 8)}
              </div>
            </div>

            <Select
              label="Dispensing Pharmacy Location"
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              options={locations.map((loc) => ({ value: loc.id, label: loc.name }))}
            />

            <div>
              <label className="block text-xs font-semibold text-text uppercase mb-2">
                Medication List
              </label>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {selectedRx.items?.map((item: any) => {
                  const formItem = dispenseFormItems[item.id] || { quantity: '', batchId: '' };
                  const hasStock = item.fefoBatches && item.fefoBatches.length > 0;
                  
                  return (
                    <div key={item.id} className="p-3 bg-surface border border-border rounded-lg text-sm">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                        <div>
                          <span className="font-bold text-text">{item.drugName}</span>
                          {!item.productId && (
                            <Badge variant="critical" className="ml-2">Product Not Linked</Badge>
                          )}
                          <div className="text-xs text-text-muted mt-1">
                            {item.dosage} &bull; {item.frequency} &bull; {item.duration}
                          </div>
                          <div className="text-xs text-text-muted italic mt-1">
                            Rx Qty: {item.quantity === null || item.quantity === 0 ? 'As needed / unspecified' : item.quantity}
                          </div>
                        </div>
                        <div className="w-24 shrink-0">
                          <Input
                            label="Dispense Qty"
                            type="number"
                            min="0"
                            value={formItem.quantity}
                            onChange={(e) => setDispenseFormItems(prev => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], quantity: e.target.value }
                            }))}
                            disabled={!item.productId}
                          />
                        </div>
                      </div>

                      {hasStock && item.productId ? (
                        <div className="bg-surface-subtle p-2 rounded border border-border">
                          <Select
                            label="Select Batch (Default is FEFO)"
                            value={formItem.batchId}
                            onChange={(e) => setDispenseFormItems(prev => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], batchId: e.target.value }
                            }))}
                            options={[
                              { value: '', label: 'Auto-select via FEFO' },
                              ...item.fefoBatches.map((b: any) => ({
                                value: b.id,
                                label: `${b.batchNumber} (Exp: ${new Date(b.expiryDate).toLocaleDateString()}) - Qty: ${b.availableQty}`,
                              })),
                            ]}
                          />
                        </div>
                      ) : (
                        <div className="mt-2 text-xs bg-warning-bg text-warning-text p-2 rounded border border-warning-border flex items-center">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />
                          {!item.productId ? 'Map product in inventory first.' : `Out of stock. Current store check: ${item.availableStock}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setIsDispenseOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmDispense} disabled={isSubmitting}>
                {isSubmitting ? 'Dispensing...' : 'Confirm & Dispense'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
