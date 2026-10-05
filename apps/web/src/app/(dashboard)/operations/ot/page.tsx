'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { otApi, patientsApi, encountersApi } from '@/lib/api';

export default function OTDashboard() {
  const [loading, setLoading] = useState(true);
  const [theatres, setTheatres] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Scheduling Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [selectedOtId, setSelectedOtId] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [schedulingSubmitting, setSchedulingSubmitting] = useState(false);

  // New Request Modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [priority, setPriority] = useState('ROUTINE');
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  // WHO Checklist Modal
  const [checklistSchedule, setChecklistSchedule] = useState<any>(null);
  const [whoChecklist, setWhoChecklist] = useState({
    patientIdentityConfirmed: true,
    surgicalSiteMarked: true,
    anaesthesiaMachineCheckComplete: true,
    pulseOximeterFunctioning: true,
    knownAllergiesReviewed: true,
    difficultAirwayAssessed: true,
    bloodLossRiskAssessed: true,
    teamIntroduced: true,
    verbalConfirmationPatientSiteProcedure: true,
    anticipatedCriticalEventsReviewed: true,
    antibioticProphylaxisGiven: true,
    essentialImagingDisplayed: true,
    procedureNameRecorded: true,
    instrumentNeedleSpongeCountComplete: true,
    specimenLabeledCorrectly: true,
    equipmentIssuesIdentified: false,
    keyConcernsForRecoveryReviewed: true,
  });

  // Procedure Note Modal
  const [noteSchedule, setNoteSchedule] = useState<any>(null);
  const [noteForm, setNoteForm] = useState({
    preOpDiagnosis: '',
    postOpDiagnosis: '',
    findings: '',
    procedureDetails: '',
    complications: 'None',
    bloodLoss: 50,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [thRes, schRes, reqRes] = await Promise.all([
        otApi.getTheatres(),
        otApi.getSchedules(),
        otApi.getRequests(),
      ]);
      setTheatres(thRes.data || []);
      setSchedules(schRes.data || []);
      setRequests(reqRes.data || []);
    } catch (err: any) {
      console.error('Failed to load OT data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewRequestModal = async () => {
    setShowRequestModal(true);
    setNotice(null);
    try {
      const res = await patientsApi.getAll({ limit: 50 });
      setPatients(res.data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !procedureName) {
      setNotice({ type: 'error', text: 'Patient and procedure name are required' });
      return;
    }

    try {
      setRequestSubmitting(true);
      // Find or create encounter
      const encRes = await encountersApi.create({
        patientId: selectedPatientId,
        type: 'INPATIENT',
        priority,
      });

      await otApi.createRequest({
        patientId: selectedPatientId,
        encounterId: encRes.data.id,
        procedureName,
        diagnosis,
        priority,
      });

      setNotice({ type: 'success', text: 'Surgery request created successfully' });
      setShowRequestModal(false);
      setProcedureName('');
      setDiagnosis('');
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to create surgery request' });
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleScheduleSurgery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestId || !selectedOtId || !scheduledStart || !scheduledEnd) {
      setNotice({ type: 'error', text: 'All scheduling fields are required' });
      return;
    }

    try {
      setSchedulingSubmitting(true);
      const res = await otApi.createSchedule({
        requestId: selectedRequestId,
        otId: selectedOtId,
        scheduledStart,
        scheduledEnd,
      });

      setNotice({ type: 'success', text: res.message || 'Surgery scheduled successfully' });
      setShowScheduleModal(false);
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to schedule surgery' });
    } finally {
      setSchedulingSubmitting(false);
    }
  };

  const handleStatusChange = async (scheduleId: string, status: string) => {
    try {
      await otApi.updateScheduleStatus(scheduleId, status);
      setNotice({ type: 'success', text: `Surgery status updated to ${status}` });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Status update failed' });
    }
  };

  const handleSaveWhoChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await otApi.submitWhoChecklist(checklistSchedule.id, whoChecklist);
      setNotice({ type: 'success', text: res.message || 'WHO checklist certified' });
      setChecklistSchedule(null);
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to save checklist' });
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await otApi.addProcedureNote(noteSchedule.id, {
        ...noteForm,
        bloodLoss: Number(noteForm.bloodLoss),
      });
      setNotice({ type: 'success', text: 'Surgical procedure note recorded' });
      setNoteSchedule(null);
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to save procedure note' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operating Theatre Suite (OT)</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Surgical booking, conflict-aware theatre scheduling, WHO safety checklists, and operative records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openNewRequestModal}
            className="inline-flex items-center px-3.5 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
          >
            + Surgery Request
          </button>
          <button
            onClick={() => {
              setShowScheduleModal(true);
              setNotice(null);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
          >
            Schedule OT Slot
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium flex justify-between items-center ${
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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Theatres</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{theatres.length}</p>
          <p className="text-xs text-slate-400 mt-1">Major, Minor, Cardiac, Endoscopy</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Surgeries Scheduled</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {schedules.filter((s) => s.status === 'SCHEDULED' || s.status === 'PREPARING').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Pending operative execution</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Surgeries In-Progress</p>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {schedules.filter((s) => s.status === 'IN_PROGRESS').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Currently on table</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Surgeries Completed</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {schedules.filter((s) => s.status === 'COMPLETED').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Post-op recovery and cleaning</p>
        </div>
      </div>

      {/* Operating Theatres Live Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Operating Theatre Live Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {theatres.map((th) => (
            <div
              key={th.id}
              className={`p-4 rounded-lg border ${
                th.status === 'IN_USE'
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : th.status === 'AVAILABLE'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">{th.name}</span>
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  th.status === 'IN_USE' ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {th.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Type: {th.type} ({th.code})</p>
              {th.schedules && th.schedules.length > 0 && (
                <p className="text-xs font-medium text-slate-700 mt-2 truncate">
                  Next: {th.schedules[0].request?.procedureName}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Surgery Schedule Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-base font-semibold text-slate-900">Surgical Schedule & Operative Worklist</h2>
          <span className="text-xs text-slate-500">{schedules.length} surgical cases</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3">Scheduled Time</th>
                <th className="px-5 py-3">Theatre</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Procedure & Diagnosis</th>
                <th className="px-5 py-3">Surgical Team</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading surgical schedules...
                  </td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No surgeries scheduled. Click &quot;Schedule OT Slot&quot; to book an operative session.
                  </td>
                </tr>
              ) : (
                schedules.map((s) => {
                  const patient = s.request?.patient;
                  const startStr = new Date(s.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const endStr = new Date(s.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-4 font-mono">
                        <strong className="text-slate-900">{startStr} - {endStr}</strong>
                        <span className="text-[11px] text-slate-400 block font-sans">
                          {new Date(s.scheduledStart).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {s.ot?.name}
                      </td>
                      <td className="px-5 py-4">
                        <strong className="text-slate-900">{patient?.firstName} {patient?.lastName}</strong>
                        <span className="text-slate-400 block text-[11px]">
                          MRN: {patient?.mrn} • Blood: {patient?.bloodGroup || 'Unspecified'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <strong className="text-blue-900 block">{s.request?.procedureName}</strong>
                        <span className="text-slate-500 text-[11px]">{s.request?.diagnosis || 'Elective procedure'}</span>
                      </td>
                      <td className="px-5 py-4">
                        {s.team && s.team.length > 0 ? (
                          <div className="space-y-0.5">
                            {s.team.map((t: any) => (
                              <span key={t.id} className="block text-[11px] text-slate-600">
                                <strong>{t.role}:</strong> {t.user?.name || 'Staff'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Team unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            s.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'IN_PROGRESS'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right space-y-1">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.status === 'SCHEDULED' && (
                            <button
                              onClick={() => handleStatusChange(s.id, 'IN_PROGRESS')}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold"
                            >
                              Start Surgery
                            </button>
                          )}
                          {s.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() => handleStatusChange(s.id, 'COMPLETED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                            >
                              Complete Surgery
                            </button>
                          )}
                          <button
                            onClick={() => setChecklistSchedule(s)}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-semibold border border-blue-200"
                          >
                            WHO Checklist
                          </button>
                          <button
                            onClick={() => {
                              setNoteSchedule(s);
                              setNoteForm({
                                preOpDiagnosis: s.request?.diagnosis || '',
                                postOpDiagnosis: s.request?.diagnosis || '',
                                findings: '',
                                procedureDetails: '',
                                complications: 'None',
                                bloodLoss: 50,
                              });
                            }}
                            className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-[11px] font-semibold"
                          >
                            Op Note
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Slot Modal (with conflict detection) */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Schedule Operating Theatre Slot</h3>
                <p className="text-xs text-slate-500">Automated conflict detection prevents overlapping bookings.</p>
              </div>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 font-bold">x</button>
            </div>

            <form onSubmit={handleScheduleSurgery} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Surgery Request *</label>
                <select
                  value={selectedRequestId}
                  onChange={(e) => setSelectedRequestId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  required
                >
                  <option value="">-- Choose Request --</option>
                  {requests
                    .filter((r) => r.status === 'REQUESTED')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.procedureName} - {r.patient?.firstName} {r.patient?.lastName} ({r.priority})
                      </option>
                    ))}
                </select>
                {requests.filter((r) => r.status === 'REQUESTED').length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">No unbooked requests. Create a Surgery Request first.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Operating Theatre *</label>
                <select
                  value={selectedOtId}
                  onChange={(e) => setSelectedOtId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  required
                >
                  <option value="">-- Choose Theatre --</option>
                  {theatres.map((th) => (
                    <option key={th.id} value={th.id}>
                      {th.name} ({th.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Scheduled Start *</label>
                  <input
                    type="datetime-local"
                    value={scheduledStart}
                    onChange={(e) => setScheduledStart(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Scheduled End *</label>
                  <input
                    type="datetime-local"
                    value={scheduledEnd}
                    onChange={(e) => setScheduledEnd(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schedulingSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {schedulingSubmitting ? 'Checking Conflict & Booking...' : 'Confirm OT Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHO Checklist Modal */}
      {checklistSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">WHO Surgical Safety Checklist</h3>
                <p className="text-xs text-slate-500">Sign In • Time Out • Sign Out verification</p>
              </div>
              <button onClick={() => setChecklistSchedule(null)} className="text-slate-400 font-bold">x</button>
            </div>

            <form onSubmit={handleSaveWhoChecklist} className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <p className="font-bold text-blue-900 uppercase">Part 1: Sign In (Before Induction of Anaesthesia)</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={whoChecklist.patientIdentityConfirmed}
                    onChange={(e) => setWhoChecklist({ ...whoChecklist, patientIdentityConfirmed: e.target.checked })}
                  />
                  <span>Patient identity, site, and consent confirmed</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={whoChecklist.surgicalSiteMarked}
                    onChange={(e) => setWhoChecklist({ ...whoChecklist, surgicalSiteMarked: e.target.checked })}
                  />
                  <span>Surgical site marked by operating surgeon</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={whoChecklist.anaesthesiaMachineCheckComplete}
                    onChange={(e) => setWhoChecklist({ ...whoChecklist, anaesthesiaMachineCheckComplete: e.target.checked })}
                  />
                  <span>Anaesthesia safety check complete</span>
                </label>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                <p className="font-bold text-amber-900 uppercase">Part 2: Time Out (Before Skin Incision)</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={whoChecklist.teamIntroduced}
                    onChange={(e) => setWhoChecklist({ ...whoChecklist, teamIntroduced: e.target.checked })}
                  />
                  <span>All team members introduced by name and role</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={whoChecklist.verbalConfirmationPatientSiteProcedure}
                    onChange={(e) => setWhoChecklist({ ...whoChecklist, verbalConfirmationPatientSiteProcedure: e.target.checked })}
                  />
                  <span>Verbal confirmation: patient, site, and procedure</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={whoChecklist.antibioticProphylaxisGiven}
                    onChange={(e) => setWhoChecklist({ ...whoChecklist, antibioticProphylaxisGiven: e.target.checked })}
                  />
                  <span>Antibiotic prophylaxis given within last 60 minutes</span>
                </label>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                <p className="font-bold text-emerald-900 uppercase">Part 3: Sign Out (Before Patient Leaves OT)</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={whoChecklist.instrumentNeedleSpongeCountComplete}
                    onChange={(e) => setWhoChecklist({ ...whoChecklist, instrumentNeedleSpongeCountComplete: e.target.checked })}
                  />
                  <span>Instrument, sponge, and needle counts correct</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={whoChecklist.specimenLabeledCorrectly}
                    onChange={(e) => setWhoChecklist({ ...whoChecklist, specimenLabeledCorrectly: e.target.checked })}
                  />
                  <span>Specimen labeled with patient MRN and name</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setChecklistSchedule(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                >
                  Certify WHO Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Operative Note Modal */}
      {noteSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Operative Procedure Note</h3>
                <p className="text-xs text-slate-500">Document surgical findings, technique, and estimated blood loss.</p>
              </div>
              <button onClick={() => setNoteSchedule(null)} className="text-slate-400 font-bold">x</button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Pre-op Diagnosis *</label>
                  <input
                    type="text"
                    value={noteForm.preOpDiagnosis}
                    onChange={(e) => setNoteForm({ ...noteForm, preOpDiagnosis: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Post-op Diagnosis *</label>
                  <input
                    type="text"
                    value={noteForm.postOpDiagnosis}
                    onChange={(e) => setNoteForm({ ...noteForm, postOpDiagnosis: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Intraoperative Findings *</label>
                <textarea
                  rows={2}
                  value={noteForm.findings}
                  onChange={(e) => setNoteForm({ ...noteForm, findings: e.target.value })}
                  placeholder="Pathology visual findings, tissue state..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Procedure Details / Technique *</label>
                <textarea
                  rows={3}
                  value={noteForm.procedureDetails}
                  onChange={(e) => setNoteForm({ ...noteForm, procedureDetails: e.target.value })}
                  placeholder="Incision, dissection, resection, closure details..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Estimated Blood Loss (ml)</label>
                  <input
                    type="number"
                    value={noteForm.bloodLoss}
                    onChange={(e) => setNoteForm({ ...noteForm, bloodLoss: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Complications</label>
                  <input
                    type="text"
                    value={noteForm.complications}
                    onChange={(e) => setNoteForm({ ...noteForm, complications: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNoteSchedule(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  Save Procedure Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">New Surgery Request</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 font-bold">x</button>
            </div>
            <form onSubmit={handleCreateRequest} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Patient *</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
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

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Procedure Name *</label>
                <input
                  type="text"
                  value={procedureName}
                  onChange={(e) => setProcedureName(e.target.value)}
                  placeholder="e.g. Laparoscopic Cholecystectomy"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Diagnosis</label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Symptomatic cholelithiasis"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="ROUTINE">Routine</option>
                  <option value="URGENT">Urgent</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {requestSubmitting ? 'Creating...' : 'Create Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
