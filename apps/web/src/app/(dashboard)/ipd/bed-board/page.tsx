'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ipdApi, housekeepingApi } from '@/lib/api';

export default function BedBoardPage() {
  const [loading, setLoading] = useState(true);
  const [bedBoard, setBedBoard] = useState<any>(null);
  const [selectedWardId, setSelectedWardId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionSuccess, setActionSuccess] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');

  const loadBoard = async () => {
    try {
      setLoading(true);
      const res = await ipdApi.getBedBoard();
      setBedBoard(res.data || null);
    } catch (err: any) {
      console.error('Failed to load bed board', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, []);

  const handleUpdateStatus = async (bedId: string, newStatus: string) => {
    try {
      setActionSuccess('');
      setActionError('');
      await ipdApi.updateBedStatus(bedId, newStatus);
      setActionSuccess(`Bed status updated to ${newStatus}`);
      await loadBoard();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update bed status');
    }
  };

  const handleRequestCleaning = async (bedId: string, wardId: string) => {
    try {
      setActionSuccess('');
      setActionError('');
      // Update bed to CLEANING
      await ipdApi.updateBedStatus(bedId, 'CLEANING');
      // Create housekeeping terminal clean task
      await housekeepingApi.createTask({
        locationRef: bedId,
        locationType: 'BED',
        taskType: 'TERMINAL',
        priority: 'HIGH',
      });
      setActionSuccess('Housekeeping terminal cleaning requested');
      await loadBoard();
    } catch (err: any) {
      setActionError(err.message || 'Failed to request housekeeping');
    }
  };

  const wards = bedBoard?.wards || [];
  const filteredWards = selectedWardId === 'ALL'
    ? wards
    : wards.filter((w: any) => w.wardId === selectedWardId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inpatient Bed Board</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time visual telemetry of beds, occupancy, and environmental cleaning states.
          </p>
        </div>
        <Link
          href="/ipd/admissions"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
        >
          View Admissions
        </Link>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex justify-between items-center">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess('')} className="text-emerald-600 font-bold">x</button>
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex justify-between items-center">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-rose-600 font-bold">x</button>
        </div>
      )}

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase">Total Beds</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{bedBoard?.totalBeds ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase">Available</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{bedBoard?.availableBeds ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase">Occupied</p>
          <p className="text-xl font-bold text-rose-600 mt-1">{bedBoard?.occupiedBeds ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase">Cleaning</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{bedBoard?.cleaningBeds ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase">Occupancy</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{bedBoard?.occupancyRate ?? 0}%</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ward:</span>
          <select
            value={selectedWardId}
            onChange={(e) => setSelectedWardId(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="ALL">All Wards ({wards.length})</option>
            {wards.map((w: any) => (
              <option key={w.wardId} value={w.wardId}>
                {w.wardName} ({w.totalBeds} beds)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="ALL">All Bed States</option>
            <option value="AVAILABLE">Available</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="CLEANING">Cleaning</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>
      </div>

      {/* Bed Grid by Ward */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          Loading bed board telemetry...
        </div>
      ) : filteredWards.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          No wards or beds configured.
        </div>
      ) : (
        filteredWards.map((w: any) => {
          const displayedBeds = statusFilter === 'ALL'
            ? w.beds
            : w.beds.filter((b: any) => b.status === statusFilter);

          return (
            <div key={w.wardId} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-slate-900">{w.wardName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Type: {w.wardType} • Occupancy: {w.occupiedBeds} / {w.totalBeds} ({w.occupancyRate}%)
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                    {w.availableBeds} Avail
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-medium">
                    {w.occupiedBeds} Occ
                  </span>
                </div>
              </div>

              <div className="p-5">
                {displayedBeds.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No beds matching filter in this ward.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {displayedBeds.map((bed: any) => {
                      const isOccupied = bed.status === 'OCCUPIED';
                      const isAvailable = bed.status === 'AVAILABLE';
                      const isCleaning = bed.status === 'CLEANING';
                      const isMaintenance = bed.status === 'MAINTENANCE';

                      return (
                        <div
                          key={bed.bedId}
                          className={`p-3 rounded-lg border flex flex-col justify-between transition-shadow hover:shadow-md ${
                            isOccupied
                              ? 'bg-rose-50/40 border-rose-200 text-rose-950'
                              : isAvailable
                              ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                              : isCleaning
                              ? 'bg-amber-50/50 border-amber-200 text-amber-950'
                              : 'bg-slate-100 border-slate-300 text-slate-800'
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="font-mono font-bold text-sm">{bed.bedNumber}</span>
                              <span
                                className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                  isOccupied
                                    ? 'bg-rose-200 text-rose-900'
                                    : isAvailable
                                    ? 'bg-emerald-200 text-emerald-900'
                                    : isCleaning
                                    ? 'bg-amber-200 text-amber-900'
                                    : 'bg-slate-200 text-slate-800'
                                }`}
                              >
                                {bed.status}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 mt-1">{bed.bedType}</p>

                            {bed.patient ? (
                              <div className="mt-2 pt-2 border-t border-rose-100">
                                <p className="font-semibold text-xs text-slate-900 truncate">
                                  {bed.patient.name}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  MRN: {bed.patient.mrn}
                                </p>
                                {bed.admissionId && (
                                  <Link
                                    href={`/ipd/chart/${bed.admissionId}`}
                                    className="text-[11px] font-semibold text-blue-600 hover:underline block mt-1"
                                  >
                                    Chart & MAR →
                                  </Link>
                                )}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 mt-2 italic">Unoccupied</p>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                            {isAvailable && (
                              <button
                                onClick={() => handleRequestCleaning(bed.bedId, w.wardId)}
                                className="text-slate-600 hover:text-slate-900 font-medium"
                              >
                                Mark Clean
                              </button>
                            )}
                            {isCleaning && (
                              <button
                                onClick={() => handleUpdateStatus(bed.bedId, 'AVAILABLE')}
                                className="text-emerald-700 hover:text-emerald-900 font-semibold"
                              >
                                Certify Available
                              </button>
                            )}
                            {!isOccupied && !isMaintenance && (
                              <button
                                onClick={() => handleUpdateStatus(bed.bedId, 'MAINTENANCE')}
                                className="text-slate-500 hover:text-slate-700"
                              >
                                Maintenance
                              </button>
                            )}
                            {isMaintenance && (
                              <button
                                onClick={() => handleUpdateStatus(bed.bedId, 'AVAILABLE')}
                                className="text-emerald-700 hover:text-emerald-900 font-semibold"
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
