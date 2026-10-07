'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ipdApi } from '@/lib/api';
import { Select } from '@enterprise-hms/ui';

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
          <h1 className="text-2xl font-bold text-text tracking-tight">Physician Daily Rounds</h1>
          <p className="text-text-muted text-sm mt-0.5">
            Active inpatients, daily progress notes, and clinical care planning.
          </p>
        </div>
        <Link
          href="/ipd"
          className="inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-lg text-text bg-surface hover:bg-surface-subtle shadow-sm"
        >
          IPD Command Center
        </Link>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex justify-between items-center ${ notice.type ==='success'
              ? 'bg-stable-bg border border-stable-border text-stable-text'
              : 'bg-critical-bg border border-critical-border text-critical-text'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="font-bold">x</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Total Inpatients to Round</p>
          <p className="text-2xl font-bold text-text mt-2">{inpatients.length}</p>
          <p className="text-xs text-text-muted mt-1">Currently admitted under care</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Documentation Protocol</p>
          <p className="text-2xl font-bold text-info mt-2">Active</p>
          <p className="text-xs text-text-muted mt-1">Progress note + assessment + plan format</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <input
            type="text"
            placeholder="Search patient, MRN, bed..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Bed Location</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Admission Reason</th>
                <th className="px-6 py-4">Admission Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-muted">
                    Loading physician rounds list...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-muted">
                    No active inpatients found for rounding.
                  </td>
                </tr>
              ) : (
                filtered.map((adm) => {
                  const alloc = adm.bedAllocations?.find((a: any) => a.status === 'OCCUPIED');
                  const bed = alloc?.bed;

                  return (
                    <tr key={adm.id} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="px-6 py-4">
                        {bed ? (
                          <div>
                            <span className="font-bold text-text">{bed.bedNumber}</span>
                            <span className="text-xs text-text-muted block">
                              {bed.ward?.name || 'Ward'} ({bed.bedType})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-warning font-semibold bg-warning-bg px-2 py-0.5 rounded">
                            Unallocated
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-text">
                          {adm.patient?.firstName} {adm.patient?.lastName}
                        </div>
                        <div className="text-xs text-text-muted">
                          MRN: {adm.patient?.mrn} • {adm.patient?.gender}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-text">
                        {adm.reason || 'General inpatient care'}
                      </td>
                      <td className="px-6 py-4 text-xs text-text-muted font-mono">
                        {new Date(adm.admissionDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openDocumentRound(adm)}
                          className="inline-flex items-center text-xs font-semibold text-brand-foreground bg-brand hover:bg-brand-hover px-3 py-1.5 rounded-lg shadow-sm"
                        >
                          Document Round
                        </button>
                        <Link
                          href={`/ipd/chart/${adm.id}`}
                          className="inline-flex items-center text-xs font-semibold text-text bg-surface-subtle hover:bg-surface-subtle px-3 py-1.5 rounded-lg border border-border"
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
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-text">
                  Document Inpatient Round: {selectedAdmission.patient?.firstName} {selectedAdmission.patient?.lastName}
                </h3>
                <p className="text-xs text-text-muted">MRN: {selectedAdmission.patient?.mrn}</p>
              </div>
              <button onClick={() => setRoundModalOpen(false)} className="text-text-muted font-bold">x</button>
            </div>

            <form onSubmit={handleSubmitRound} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text mb-1">Clinical Status</label>
                <Select
                  value={clinicalStatus}
                  onChange={(e) => setClinicalStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface"
                >
                  <option value="IMPROVING">Improving</option>
                  <option value="STABLE">Stable</option>
                  <option value="DETERIORATING">Deteriorating</option>
                  <option value="CRITICAL">Critical</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Progress Note *</label>
                <textarea
                  rows={3}
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="Patient symptom review, physical exam findings, overnight events..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs focus:ring-1 focus:ring-brand"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Assessment</label>
                <input
                  type="text"
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  placeholder="Clinical synthesis and current trajectory..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Care & Treatment Plan</label>
                <input
                  type="text"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  placeholder="Medication adjustments, labs ordered, discharge planning..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setRoundModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold disabled:opacity-50"
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
