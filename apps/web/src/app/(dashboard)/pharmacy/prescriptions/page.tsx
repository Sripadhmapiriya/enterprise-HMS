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
      setIsDispenseOpen(true);
    } catch (err: any) {
      alert(err?.message || 'Failed to load prescription details');
    }
  };

  const handleConfirmDispense = async () => {
    if (!selectedRx || !selectedLocationId) return;

    try {
      setIsSubmitting(true);
      const itemsToDispense = selectedRx.items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        instructions: item.instructions,
      }));

      await pharmacyApi.dispense({
        prescriptionId: selectedRx.id,
        patientId: selectedRx.patientId,
        locationId: selectedLocationId,
        items: itemsToDispense,
      });

      setIsDispenseOpen(false);
      await fetchQueue();
    } catch (err: any) {
      alert(err?.message || 'Dispensing failed');
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
                Medication List (Auto-Allocating via FEFO)
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedRx.items?.map((item: any, idx: number) => (
                  <div key={idx} className="p-3 bg-surface border border-border rounded-lg text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-text">{item.drugName}</span>
                        <div className="text-xs text-text-muted">
                          {item.dosage} &bull; {item.frequency} &bull; {item.duration}
                        </div>
                      </div>
                      <Badge variant="info">Qty: {item.quantity}</Badge>
                    </div>

                    {item.recommendedBatch ? (
                      <div className="mt-2 text-xs bg-stable-bg text-stable-text p-2 rounded border border-stable-border">
                        FEFO Batch Allocated: <span className="font-mono font-bold">{item.recommendedBatch.batchNumber}</span> (Exp: {new Date(item.recommendedBatch.expiryDate).toLocaleDateString()}) &bull; Available: {item.recommendedBatch.availableQty}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs bg-warning-bg text-warning-text p-2 rounded border border-warning-border flex items-center">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                        Stock check: {item.availableStock} in store
                      </div>
                    )}
                  </div>
                ))}
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
