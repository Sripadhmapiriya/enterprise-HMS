'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ipdApi } from '@/lib/api';

export default function DoctorRoundsPage() {
  const [loading, setLoading] = useState(true);
  const [inpatients, setInpatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);
  const [roundModalOpen, setRoundModalOpen] = useState(false);
  const [clinicalStatus, setClinicalStatus] = useState('IMPROVING');
  const [progressNote, setProgressNote] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await ipdApi.getAdmissions({ status: 'ADMITTED' });
      setInpatients(res.data || []);
    } catch (err: any) {
      console.error('Failed to load doctor rounds data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openDocumentRound = (adm: any) => {
    setSelectedAdmission(adm);
    setClinicalStatus('IMPROVING');
    setProgressNote('');
    setAssessment('');
    setPlan('');
    setRoundModalOpen(true);
    setNotice(null);
  };

  const handleSubmitRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressNote.trim()) {
      setNotice({ type: 'error', text: 'Progress note is required' });
      return;
    }

    try {
      setSubmitting(true);
      await ipdApi.createRound(selectedAdmission.id, {
        clinicalStatus,
        progressNote,
        assessment,
        plan,
      });
      setNotice({ type: 'success', text: `Round note documented for ${selectedAdmission.patient?.firstName} ${selectedAdmission.patient?.lastName}` });
      setRoundModalOpen(false);
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to document round' });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = inpatients.filter((adm) => {
    const name = `${adm.patient?.firstName || ''} ${adm.patient?.lastName || ''}`.toLowerCase();
    const mrn = (adm.patient?.mrn || '').toLowerCase();
    const bed = adm.bedAllocations?.[0]?.bed?.bedNumber?.toLowerCase() || '';
    const q = searchTerm.toLowerCase();
    return !q || name.includes(q) || mrn.includes(q) || bed.includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Physician Daily Rounds</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Active inpatients, daily progress notes, and clinical care planning.
          </p>
        </div>
        <Link
          href="/ipd"
          className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
        >
          IPD Command Center
        </Link>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex justify-between items-center ${
            notice.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="font-bold">x</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Inpatients to Round</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{inpatients.length}</p>
          <p className="text-xs text-slate-400 mt-1">Currently admitted under care</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Documentation Protocol</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">Active</p>
          <p className="text-xs text-slate-400 mt-1">Progress note + assessment + plan format</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <input
            type="text"
            placeholder="Search patient, MRN, bed..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Bed Location</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Admission Reason</th>
                <th className="px-6 py-4">Admission Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Loading physician rounds list...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No active inpatients found for rounding.
                  </td>
                </tr>
              ) : (
                filtered.map((adm) => {
                  const alloc = adm.bedAllocations?.find((a: any) => a.status === 'OCCUPIED');
                  const bed = alloc?.bed;

                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        {bed ? (
                          <div>
                            <span className="font-bold text-slate-900">{bed.bedNumber}</span>
                            <span className="text-xs text-slate-500 block">
                              {bed.ward?.name || 'Ward'} ({bed.bedType})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                            Unallocated
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {adm.patient?.firstName} {adm.patient?.lastName}
                        </div>
                        <div className="text-xs text-slate-400">
                          MRN: {adm.patient?.mrn} • {adm.patient?.gender}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700">
                        {adm.reason || 'General inpatient care'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                        {new Date(adm.admissionDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openDocumentRound(adm)}
                          className="inline-flex items-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm"
                        >
                          Document Round
                        </button>
                        <Link
                          href={`/ipd/chart/${adm.id}`}
                          className="inline-flex items-center text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200"
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

      {/* Document Round Modal */}
      {roundModalOpen && selectedAdmission && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Document Inpatient Round: {selectedAdmission.patient?.firstName} {selectedAdmission.patient?.lastName}
                </h3>
                <p className="text-xs text-slate-500">MRN: {selectedAdmission.patient?.mrn}</p>
              </div>
              <button onClick={() => setRoundModalOpen(false)} className="text-slate-400 font-bold">x</button>
            </div>

            <form onSubmit={handleSubmitRound} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Clinical Status</label>
                <select
                  value={clinicalStatus}
                  onChange={(e) => setClinicalStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="IMPROVING">Improving</option>
                  <option value="STABLE">Stable</option>
                  <option value="DETERIORATING">Deteriorating</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Progress Note *</label>
                <textarea
                  rows={3}
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="Patient symptom review, physical exam findings, overnight events..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Assessment</label>
                <input
                  type="text"
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  placeholder="Clinical synthesis and current trajectory..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Care & Treatment Plan</label>
                <input
                  type="text"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  placeholder="Medication adjustments, labs ordered, discharge planning..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoundModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Round Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
