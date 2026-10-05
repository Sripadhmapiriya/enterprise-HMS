'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ipdApi, patientsApi } from '@/lib/api';

export default function IpdDashboard() {
  const [loading, setLoading] = useState(true);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [bedBoard, setBedBoard] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Quick Admission Modal
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [admissionType, setAdmissionType] = useState('PLANNED');
  const [admissionSource, setAdmissionSource] = useState('DIRECT');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [admRes, boardRes] = await Promise.all([
        ipdApi.getAdmissions(),
        ipdApi.getBedBoard(),
      ]);
      setAdmissions(admRes.data || []);
      setBedBoard(boardRes.data || null);
    } catch (err: any) {
      console.error('Failed to load IPD data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openQuickAdmit = async () => {
    setShowAdmitModal(true);
    setErrorMsg('');
    try {
      const [ptsRes, bedsRes] = await Promise.all([
        patientsApi.getAll({ limit: 50 }),
        ipdApi.getBeds({ status: 'AVAILABLE' }),
      ]);
      setPatients(ptsRes.data || []);
      setBeds(bedsRes.data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setErrorMsg('Please select a patient');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg('');
      await ipdApi.createAdmission({
        patientId: selectedPatientId,
        bedId: selectedBedId || undefined,
        admissionType,
        admissionSource,
        reason: reason || 'Inpatient admission',
      });
      setShowAdmitModal(false);
      setSelectedPatientId('');
      setSelectedBedId('');
      setReason('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to admit patient');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAdmissions = admissions.filter((adm) => {
    const name = `${adm.patient?.firstName || ''} ${adm.patient?.lastName || ''}`.toLowerCase();
    const mrn = (adm.patient?.mrn || '').toLowerCase();
    const num = (adm.admissionNumber || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q || name.includes(q) || mrn.includes(q) || num.includes(q);
    const matchesStatus = statusFilter === 'ALL' || adm.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IPD Inpatient Command Center</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time inpatient census, ward telemetry, and clinical admission tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/ipd/bed-board"
            className="inline-flex items-center px-3.5 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
          >
            Bed Board Grid
          </Link>
          <button
            onClick={openQuickAdmit}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
          >
            Admit Patient
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Inpatient Census</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {loading ? '...' : bedBoard?.occupiedBeds ?? admissions.filter((a) => a.status === 'ADMITTED').length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Currently assigned to beds</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available Beds</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {loading ? '...' : bedBoard?.availableBeds ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Ready for immediate intake</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Occupancy Rate</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {loading ? '...' : `${bedBoard?.occupancyRate ?? 0}%`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Across all active wards</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Terminal Cleaning Queue</p>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {loading ? '...' : bedBoard?.cleaningBeds ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Housekeeping turnarounds pending</p>
        </div>
      </div>

      {/* Main Table: Inpatient Registry */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">Inpatient Registry</h2>
            <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full font-medium">
              {filteredAdmissions.length} record{filteredAdmissions.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search patient, MRN, admission #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-64"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="ADMITTED">Admitted</option>
              <option value="DISCHARGED">Discharged</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wider">
              <tr>
                <th className="px-4 py-3">Admission #</th>
                <th className="px-4 py-3">Patient Details</th>
                <th className="px-4 py-3">Ward / Bed</th>
                <th className="px-4 py-3">Admission Date</th>
                <th className="px-4 py-3">Type / Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Loading inpatient registry...
                  </td>
                </tr>
              ) : filteredAdmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No matching inpatient records found.
                  </td>
                </tr>
              ) : (
                filteredAdmissions.map((adm) => {
                  const patientName = `${adm.patient?.firstName || ''} ${adm.patient?.lastName || ''}`;
                  const currentBed = adm.bedAllocations?.find((a: any) => a.status === 'OCCUPIED')?.bed;

                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-slate-900 text-xs">
                        {adm.admissionNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{patientName}</div>
                        <div className="text-xs text-slate-400">
                          MRN: {adm.patient?.mrn || 'N/A'} • {adm.patient?.gender} • {adm.patient?.bloodGroup || 'Blood Group Unspecified'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {currentBed ? (
                          <div>
                            <span className="font-medium text-slate-800">{currentBed.bedNumber}</span>
                            <span className="text-xs text-slate-400 block">
                              {currentBed.ward?.name || 'General Ward'} • {currentBed.bedType}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-medium">
                            Bed Unallocated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(adm.admissionDate).toLocaleDateString()} {new Date(adm.admissionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-medium text-slate-700">{adm.admissionType}</span>
                        <span className="text-slate-400 block">via {adm.admissionSource}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            adm.status === 'ADMITTED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : adm.status === 'DISCHARGED'
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {adm.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/ipd/chart/${adm.id}`}
                          className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors"
                        >
                          Clinical Chart & MAR
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Admit Modal */}
      {showAdmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-semibold text-slate-900">Direct Inpatient Admission</h3>
              <button
                onClick={() => setShowAdmitModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                x
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateAdmission} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Patient *</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} (MRN: {p.mrn} • {p.gender})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Allocate Bed (Optional)</label>
                <select
                  value={selectedBedId}
                  onChange={(e) => setSelectedBedId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Bed Allocation Later --</option>
                  {beds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bedNumber} ({b.ward?.name || 'Ward'} • {b.bedType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Admission Type</label>
                  <select
                    value={admissionType}
                    onChange={(e) => setAdmissionType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="EMERGENCY">Emergency</option>
                    <option value="TRANSFER">Transfer</option>
                    <option value="DAY_CARE">Day Care</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Admission Source</label>
                  <select
                    value={admissionSource}
                    onChange={(e) => setAdmissionSource(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="DIRECT">Direct</option>
                    <option value="OPD">OPD Clinic</option>
                    <option value="EMERGENCY">Emergency Dept</option>
                    <option value="TRANSFER">External Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Clinical Indication / Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Primary complaint, provisional diagnosis, or reason for inpatient care..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdmitModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Admitting...' : 'Confirm Admission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
