'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { icuApi, encountersApi } from '@/lib/api';

export default function ICUDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeIcuPatients, setActiveIcuPatients] = useState<any[]>([]);
  const [flowsheets, setFlowsheets] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEncounterId, setSelectedEncounterId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Flowsheet Form
  const [vitals, setVitals] = useState({
    heartRate: 85,
    bpSystolic: 120,
    bpDiastolic: 80,
    spo2: 98,
    respRate: 18,
    temperature: 37.0,
    gcs: 15,
    platelets: 200,
    bilirubin: 0.8,
    creatinine: 0.9,
  });

  const [ventilator, setVentilator] = useState({
    mode: 'AC',
    fio2: 0.4,
    peep: 5,
    tidalVolume: 450,
    peakPressure: 22,
  });

  const [fluid, setFluid] = useState({
    enteralIntake: 100,
    ivIntake: 500,
    urineOutput: 400,
    drainOutput: 0,
  });

  const [notes, setNotes] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [ptsRes, flowRes] = await Promise.all([
        icuApi.getActivePatients(),
        icuApi.getFlowsheets(),
      ]);
      setActiveIcuPatients(ptsRes.data || []);
      setFlowsheets(flowRes.data || []);
    } catch (err: any) {
      console.error('Failed to load ICU data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openLogModal = (encounterId?: string) => {
    if (encounterId) setSelectedEncounterId(encounterId);
    else if (activeIcuPatients.length > 0) setSelectedEncounterId(activeIcuPatients[0].encounterId);
    setShowModal(true);
    setNotice(null);
  };

  const handleSaveFlowsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEncounterId) {
      setNotice({ type: 'error', text: 'Select an active ICU encounter' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await icuApi.createFlowsheet({
        encounterId: selectedEncounterId,
        vitalSigns: vitals,
        ventilatorParams: ventilator,
        fluidBalance: fluid,
        notes,
      });

      setNotice({ type: 'success', text: res.message || 'ICU flowsheet recorded successfully' });
      setShowModal(false);
      setNotes('');
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to record flowsheet' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ICU Critical Care Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Continuous organ dysfunction telemetry, ventilator charting, and critical range alerts.
          </p>
        </div>
        <button
          onClick={() => openLogModal()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
        >
          + Record Flowsheet Entry
        </button>
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
          <button onClick={() => setNotice(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">ICU Active Census</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{activeIcuPatients.length}</p>
          <p className="text-xs text-slate-400 mt-1">Patients in critical care units</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Flowsheets Charted</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">{flowsheets.length}</p>
          <p className="text-xs text-slate-400 mt-1">Total rounds documented</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Mechanical Ventilation</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {flowsheets.filter((f) => f.ventilatorParams?.mode).length > 0 ? 'Active' : 'Standby'}
          </p>
          <p className="text-xs text-slate-400 mt-1">Invasive and non-invasive</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Alarms</p>
          <p className="text-2xl font-bold text-rose-600 mt-2">
            {flowsheets.reduce((acc, f) => acc + (f.criticalAlarms?.length || 0), 0)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Parameters outside safe range</p>
        </div>
      </div>

      {/* Active ICU Patients Card Grid */}
      {activeIcuPatients.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Current Inpatients in Critical Care</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeIcuPatients.map((adm) => (
              <div key={adm.admissionId} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      {adm.patient?.firstName} {adm.patient?.lastName}
                    </h3>
                    <p className="text-xs text-slate-400">
                      MRN: {adm.patient?.mrn} • Bed: <strong>{adm.bed?.bedNumber || 'ICU Bed'}</strong>
                    </p>
                  </div>
                  {adm.sofaScore && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                      SOFA: {adm.sofaScore.score}
                    </span>
                  )}
                </div>

                {adm.criticalAlarms && adm.criticalAlarms.length > 0 && (
                  <div className="space-y-1">
                    {adm.criticalAlarms.map((a: string, idx: number) => (
                      <span key={idx} className="block text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {a}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100 text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">HR</span>
                    <strong className="text-slate-800">{adm.latestVitals?.heartRate || '—'} bpm</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">BP / MAP</span>
                    <strong className="text-slate-800">
                      {adm.latestVitals?.bpSystolic ? `${adm.latestVitals.bpSystolic}/${adm.latestVitals.bpDiastolic}` : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">SpO2</span>
                    <strong className="text-slate-800">{adm.latestVitals?.spo2 ? `${adm.latestVitals.spo2}%` : '—'}</strong>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => openLogModal(adm.encounterId)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Add Flowsheet
                  </button>
                  <Link
                    href={`/ipd/chart/${adm.admissionId}`}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Full Chart →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Flowsheet Log */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-base font-semibold text-slate-900">Recent ICU Flowsheets & Scoring</h2>
          <span className="text-xs text-slate-500">{flowsheets.length} charted records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Vital Signs</th>
                <th className="px-5 py-3">Ventilator</th>
                <th className="px-5 py-3">Fluid Balance</th>
                <th className="px-5 py-3">SOFA Score</th>
                <th className="px-5 py-3">Critical Alarms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading flowsheet records...
                  </td>
                </tr>
              ) : flowsheets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No flowsheet entries recorded yet.
                  </td>
                </tr>
              ) : (
                flowsheets.map((f) => {
                  const vs = f.vitalSigns || {};
                  const vp = f.ventilatorParams || {};
                  const fb = f.fluidBalance || {};
                  const alarms = f.criticalAlarms || [];
                  const sofa = f.sofaScore;

                  return (
                    <tr key={f.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-4 text-slate-500 font-mono whitespace-nowrap">
                        {new Date(f.recordTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        <span className="text-[10px] text-slate-400 block">by {f.recordedBy?.name || 'Staff'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <strong className="text-slate-900">
                          {f.encounter?.patient?.firstName} {f.encounter?.patient?.lastName}
                        </strong>
                        <span className="text-slate-400 block text-[11px]">
                          MRN: {f.encounter?.patient?.mrn}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div>HR: <strong>{vs.heartRate || '—'}</strong> | BP: <strong>{vs.bpSystolic}/{vs.bpDiastolic}</strong></div>
                        <div className="text-slate-400">SpO2: <strong>{vs.spo2}%</strong> | RR: {vs.respRate} | T: {vs.temperature}°C</div>
                      </td>
                      <td className="px-5 py-4">
                        {vp.mode ? (
                          <div>
                            <span className="font-semibold text-slate-800">{vp.mode}</span>
                            <span className="text-slate-400 block text-[11px]">
                              FiO2: {(vp.fio2 * 100).toFixed(0)}% • PEEP: {vp.peep} • Ppeak: {vp.peakPressure}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Room Air / Standby</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div>In: {fb.intakeTotal || 0} ml • Out: {fb.outputTotal || 0} ml</div>
                        <div className={`font-semibold ${(fb.netBalance || 0) >= 0 ? 'text-emerald-700' : 'text-blue-700'}`}>
                          Net: {fb.netBalance || 0} ml
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {sofa ? (
                          <div>
                            <span className="font-bold text-slate-900 text-sm">{sofa.score}</span>
                            <span className="text-[10px] text-slate-400 block">{sofa.riskCategory}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {alarms.length > 0 ? (
                          <div className="space-y-1">
                            {alarms.map((al: string, i: number) => (
                              <span key={i} className="inline-block bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                {al}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-emerald-700 font-medium">Safe Ranges</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Flowsheet Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record ICU Flowsheet Entry</h3>
                <p className="text-xs text-slate-500">Comprehensive vital signs, ventilator telemetry, and fluid balance</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveFlowsheet} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Patient Encounter *</label>
                <select
                  value={selectedEncounterId}
                  onChange={(e) => setSelectedEncounterId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  required
                >
                  <option value="">-- Choose Encounter --</option>
                  {activeIcuPatients.map((adm) => (
                    <option key={adm.encounterId} value={adm.encounterId}>
                      {adm.patient?.firstName} {adm.patient?.lastName} (MRN: {adm.patient?.mrn} • Bed: {adm.bed?.bedNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Vitals Section */}
              <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                <p className="text-xs font-bold text-slate-800 uppercase">Vital Signs & Neurological</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={vitals.heartRate}
                      onChange={(e) => setVitals({ ...vitals, heartRate: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">BP Systolic</label>
                    <input
                      type="number"
                      value={vitals.bpSystolic}
                      onChange={(e) => setVitals({ ...vitals, bpSystolic: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">BP Diastolic</label>
                    <input
                      type="number"
                      value={vitals.bpDiastolic}
                      onChange={(e) => setVitals({ ...vitals, bpDiastolic: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600">SpO2 (%)</label>
                    <input
                      type="number"
                      value={vitals.spo2}
                      onChange={(e) => setVitals({ ...vitals, spo2: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">Respiratory Rate (/min)</label>
                    <input
                      type="number"
                      value={vitals.respRate}
                      onChange={(e) => setVitals({ ...vitals, respRate: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">Glasgow Coma (3-15)</label>
                    <input
                      type="number"
                      min="3"
                      max="15"
                      value={vitals.gcs}
                      onChange={(e) => setVitals({ ...vitals, gcs: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Ventilator Section */}
              <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                <p className="text-xs font-bold text-slate-800 uppercase">Ventilator Settings</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600">Mode</label>
                    <select
                      value={ventilator.mode}
                      onChange={(e) => setVentilator({ ...ventilator, mode: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value="AC">Assist Control (AC)</option>
                      <option value="SIMV">SIMV</option>
                      <option value="PSV">Pressure Support (PSV)</option>
                      <option value="CPAP">CPAP / BIPAP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">FiO2 (0.21 - 1.0)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.21"
                      max="1.0"
                      value={ventilator.fio2}
                      onChange={(e) => setVentilator({ ...ventilator, fio2: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">PEEP (cmH2O)</label>
                    <input
                      type="number"
                      value={ventilator.peep}
                      onChange={(e) => setVentilator({ ...ventilator, peep: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Fluid Balance Section */}
              <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                <p className="text-xs font-bold text-slate-800 uppercase">Fluid Balance (ml)</p>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600">IV Intake</label>
                    <input
                      type="number"
                      value={fluid.ivIntake}
                      onChange={(e) => setFluid({ ...fluid, ivIntake: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">Enteral Intake</label>
                    <input
                      type="number"
                      value={fluid.enteralIntake}
                      onChange={(e) => setFluid({ ...fluid, enteralIntake: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">Urine Output</label>
                    <input
                      type="number"
                      value={fluid.urineOutput}
                      onChange={(e) => setFluid({ ...fluid, urineOutput: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">Drain Output</label>
                    <input
                      type="number"
                      value={fluid.drainOutput}
                      onChange={(e) => setFluid({ ...fluid, drainOutput: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Clinical Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Inotropes/vasopressors, sedation state, arterial line wave..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Commit Flowsheet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
