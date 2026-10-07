'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ipdApi, patientsApi } from '@/lib/api';
import { Select } from '@enterprise-hms/ui';

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
      setErrorMsg('');
      const [admRes, boardRes] = await Promise.all([
        ipdApi.getAdmissions().catch((e) => {
          console.warn('Admissions fetch warning:', e.message);
          return { success: false, data: [] };
        }),
        ipdApi.getBedBoard().catch((e) => {
          console.warn('Bed board fetch warning:', e.message);
          return { success: false, data: null };
        }),
      ]);
      setAdmissions(admRes.data || []);
      setBedBoard(boardRes.data || null);
    } catch (err: any) {
      console.error('Failed to load IPD data', err);
      setErrorMsg(err.message || 'Unable to load inpatient records.');
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
          <h1 className="text-2xl font-bold text-text tracking-tight">IPD Inpatient Command Center</h1>
          <p className="text-text-muted text-sm mt-0.5">
            Real-time inpatient census, ward telemetry, and clinical admission tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/ipd/bed-board"
            className="inline-flex items-center px-3.5 py-2 border border-border text-sm font-medium rounded-lg text-text bg-surface hover:bg-surface-subtle shadow-sm"
          >
            Bed Board Grid
          </Link>
          <button
            onClick={openQuickAdmit}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-brand-foreground bg-brand hover:bg-brand-hover shadow-sm"
          >
            Admit Patient
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Active Inpatient Census</p>
          <p className="text-2xl font-bold text-text mt-2">
            {loading ? '...' : bedBoard?.occupiedBeds ?? admissions.filter((a) => a.status === 'ADMITTED').length}
          </p>
          <p className="text-xs text-text-muted mt-1">Currently assigned to beds</p>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Available Beds</p>
          <p className="text-2xl font-bold text-stable mt-2">
            {loading ? '...' : bedBoard?.availableBeds ?? 0}
          </p>
          <p className="text-xs text-text-muted mt-1">Ready for immediate intake</p>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Occupancy Rate</p>
          <p className="text-2xl font-bold text-info mt-2">
            {loading ? '...' : `${bedBoard?.occupancyRate ?? 0}%`}
          </p>
          <p className="text-xs text-text-muted mt-1">Across all active wards</p>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Terminal Cleaning Queue</p>
          <p className="text-2xl font-bold text-warning mt-2">
            {loading ? '...' : bedBoard?.cleaningBeds ?? 0}
          </p>
          <p className="text-xs text-text-muted mt-1">Housekeeping turnarounds pending</p>
        </div>
      </div>

      {/* Main Table: Inpatient Registry */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-text">Inpatient Registry</h2>
            <span className="bg-surface-subtle text-text-muted text-xs px-2.5 py-0.5 rounded-full font-medium">
              {filteredAdmissions.length} record{filteredAdmissions.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search patient, MRN, admission #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand w-full sm:w-64"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand bg-surface"
            >
              <option value="ALL">All Statuses</option>
              <option value="ADMITTED">Admitted</option>
              <option value="DISCHARGED">Discharged</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-xs uppercase text-text-muted font-semibold tracking-wider">
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
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    Loading inpatient registry...
                  </td>
                </tr>
              ) : filteredAdmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    No matching inpatient records found.
                  </td>
                </tr>
              ) : (
                filteredAdmissions.map((adm) => {
                  const patientName = `${adm.patient?.firstName || ''} ${adm.patient?.lastName || ''}`;
                  const currentBed = adm.bedAllocations?.find((a: any) => a.status === 'ACTIVE')?.bed;

                  return (
                    <tr key={adm.id} className="hover:bg-surface-subtle/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-text text-xs">
                        {adm.admissionNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-text">{patientName}</div>
                        <div className="text-xs text-text-muted">
                          MRN: {adm.patient?.mrn || 'N/A'} • {adm.patient?.gender} • {adm.patient?.bloodGroup || 'Blood Group Unspecified'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {currentBed ? (
                          <div>
                            <span className="font-medium text-text">{currentBed.bedNumber}</span>
                            <span className="text-xs text-text-muted block">
                              {currentBed.ward?.name || 'General Ward'} • {currentBed.bedType}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-warning bg-warning-bg px-2 py-0.5 rounded font-medium">
                            Bed Unallocated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                        {new Date(adm.admissionDate).toLocaleDateString()} {new Date(adm.admissionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-medium text-text">{adm.admissionType}</span>
                        <span className="text-text-muted block">via {adm.admissionSource}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${ adm.status ==='ADMITTED'
                              ? 'bg-stable-bg text-stable-text border border-stable-border'
                              : adm.status === 'DISCHARGED'
                              ? 'bg-surface-subtle text-text-muted border border-border'
                              : 'bg-critical-bg text-critical-text border border-critical-border'
                          }`}
                        >
                          {adm.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/ipd/chart/${adm.id}`}
                          className="inline-flex items-center text-xs font-semibold text-info hover:text-info-text bg-info-bg px-3 py-1.5 rounded-lg border border-info-border transition-colors"
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
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-lg font-semibold text-text">Direct Inpatient Admission</h3>
              <button
                onClick={() => setShowAdmitModal(false)}
                className="text-text-muted hover:text-text-muted text-lg font-bold"
              >
                x
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-critical-bg border border-critical-border text-critical-text text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateAdmission} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text mb-1">Select Patient *</label>
                <Select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand bg-surface"
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} (MRN: {p.mrn} • {p.gender})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Allocate Bed (Optional)</label>
                <Select
                  value={selectedBedId}
                  onChange={(e) => setSelectedBedId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand bg-surface"
                >
                  <option value="">-- Bed Allocation Later --</option>
                  {beds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bedNumber} ({b.ward?.name || 'Ward'} • {b.bedType})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Admission Type</label>
                  <Select
                    value={admissionType}
                    onChange={(e) => setAdmissionType(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand bg-surface"
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="EMERGENCY">Emergency</option>
                    <option value="TRANSFER">Transfer</option>
                    <option value="DAY_CARE">Day Care</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Admission Source</label>
                  <Select
                    value={admissionSource}
                    onChange={(e) => setAdmissionSource(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand bg-surface"
                  >
                    <option value="DIRECT">Direct</option>
                    <option value="OPD">OPD Clinic</option>
                    <option value="EMERGENCY">Emergency Dept</option>
                    <option value="TRANSFER">External Transfer</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Clinical Indication / Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Primary complaint, provisional diagnosis, or reason for inpatient care..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAdmitModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-text hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-sm font-medium disabled:opacity-50"
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
