'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ipdApi, patientsApi } from '@/lib/api';

export default function AdmissionsPage() {
  const [loading, setLoading] = useState(true);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Allocation Modal
  const [allocatingAdm, setAllocatingAdm] = useState<any>(null);
  const [availableBeds, setAvailableBeds] = useState<any[]>([]);
  const [selectedBedId, setSelectedBedId] = useState('');
  const [submittingAlloc, setSubmittingAlloc] = useState(false);
  const [allocError, setAllocError] = useState('');

  // New Admission Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [admissionType, setAdmissionType] = useState('PLANNED');
  const [admissionSource, setAdmissionSource] = useState('DIRECT');
  const [reason, setReason] = useState('');
  const [submittingNew, setSubmittingNew] = useState(false);
  const [newError, setNewError] = useState('');

  const loadAdmissions = async () => {
    try {
      setLoading(true);
      const res = await ipdApi.getAdmissions();
      setAdmissions(res.data || []);
    } catch (err: any) {
      console.error('Failed to load admissions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmissions();
  }, []);

  const openAllocateModal = async (adm: any) => {
    setAllocatingAdm(adm);
    setSelectedBedId('');
    setAllocError('');
    try {
      const res = await ipdApi.getBeds({ status: 'AVAILABLE' });
      setAvailableBeds(res.data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleAllocateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBedId) {
      setAllocError('Please select a bed to allocate');
      return;
    }
    try {
      setSubmittingAlloc(true);
      setAllocError('');
      await ipdApi.allocateBed(allocatingAdm.id, { bedId: selectedBedId });
      setAllocatingAdm(null);
      await loadAdmissions();
    } catch (err: any) {
      setAllocError(err.message || 'Failed to allocate bed');
    } finally {
      setSubmittingAlloc(false);
    }
  };

  const openNewAdmission = async () => {
    setShowNewModal(true);
    setNewError('');
    try {
      const res = await patientsApi.getAll({ limit: 50 });
      setPatients(res.data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setNewError('Please select a patient');
      return;
    }
    try {
      setSubmittingNew(true);
      setNewError('');
      await ipdApi.createAdmission({
        patientId: selectedPatientId,
        admissionType,
        admissionSource,
        reason: reason || 'Inpatient admission',
      });
      setShowNewModal(false);
      setSelectedPatientId('');
      setReason('');
      await loadAdmissions();
    } catch (err: any) {
      setNewError(err.message || 'Failed to create admission');
    } finally {
      setSubmittingNew(false);
    }
  };

  const filtered = admissions.filter((adm) => {
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IPD Admissions</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Admission lifecycle, bed allocations, and clinical inpatient transfers.
          </p>
        </div>
        <button
          onClick={openNewAdmission}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
        >
          + New Admission
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <input
            type="text"
            placeholder="Search by admission #, patient name, MRN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">IPD No. & Date</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Admission Reason</th>
                <th className="px-6 py-4">Bed Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    Loading admissions list...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No admission records found.
                  </td>
                </tr>
              ) : (
                filtered.map((adm) => {
                  const currentAlloc = adm.bedAllocations?.find((a: any) => a.status === 'OCCUPIED');
                  const bed = currentAlloc?.bed;

                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-slate-900 text-xs">
                        {adm.admissionNumber}
                        <span className="text-slate-400 block font-sans">
                          {new Date(adm.admissionDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {adm.patient?.firstName} {adm.patient?.lastName}
                        </div>
                        <div className="text-xs text-slate-400">
                          MRN: {adm.patient?.mrn || 'N/A'} • {adm.patient?.gender}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className="font-medium text-slate-800">{adm.reason || 'General inpatient care'}</span>
                        <span className="text-slate-400 block">
                          Type: {adm.admissionType} • Src: {adm.admissionSource}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {bed ? (
                          <div>
                            <span className="font-semibold text-slate-900">{bed.bedNumber}</span>
                            <span className="text-xs text-slate-500 block">
                              {bed.ward?.name || 'General'} ({bed.bedType})
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => openAllocateModal(adm)}
                            className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg"
                          >
                            Allocate Bed Now
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 text-right space-x-2">
                        <Link
                          href={`/ipd/chart/${adm.id}`}
                          className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"
                        >
                          Chart & MAR
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

      {/* Allocate Bed Modal */}
      {allocatingAdm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                Allocate Bed for {allocatingAdm.patient?.firstName} {allocatingAdm.patient?.lastName}
              </h3>
              <button
                onClick={() => setAllocatingAdm(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                x
              </button>
            </div>

            {allocError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {allocError}
              </div>
            )}

            <form onSubmit={handleAllocateBed} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Available Bed *</label>
                <select
                  value={selectedBedId}
                  onChange={(e) => setSelectedBedId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  required
                >
                  <option value="">-- Choose Bed --</option>
                  {availableBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bedNumber} ({b.ward?.name || 'Ward'} • {b.bedType})
                    </option>
                  ))}
                </select>
                {availableBeds.length === 0 && (
                  <p className="text-xs text-rose-600 mt-1">No beds currently available with status AVAILABLE.</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAllocatingAdm(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAlloc || availableBeds.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submittingAlloc ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Admission Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">New Inpatient Admission</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                x
              </button>
            </div>

            {newError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {newError}
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
                      {p.firstName} {p.lastName} (MRN: {p.mrn})
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
                    <option value="TRANSFER">Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Indication / Notes</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Primary diagnosis or reason for admission..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNew}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submittingNew ? 'Creating...' : 'Create Admission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
