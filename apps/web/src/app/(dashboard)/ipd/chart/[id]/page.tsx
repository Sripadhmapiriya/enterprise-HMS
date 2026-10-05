'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ipdApi, housekeepingApi } from '@/lib/api';

export default function IpdChartPage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true);
  const [admission, setAdmission] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'mar' | 'nursing' | 'intakeOutput' | 'rounds' | 'discharge'>('mar');
  
  // Data lists
  const [assessments, setAssessments] = useState<any[]>([]);
  const [intakeOutput, setIntakeOutput] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [medOrders, setMedOrders] = useState<any[]>([]);
  const [marRecords, setMarRecords] = useState<any[]>([]);
  const [dischargeSummary, setDischargeSummary] = useState<any>(null);
  const [billingClearance, setBillingClearance] = useState<any>(null);

  // Forms / Action States
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // MAR Administer Modal
  const [administerOrder, setAdministerOrder] = useState<any>(null);
  const [marChecks, setMarChecks] = useState({
    patientVerificationChecked: false,
    medicationVerificationChecked: false,
    doseVerificationChecked: false,
    routeVerificationChecked: false,
    timeVerificationChecked: false,
  });
  const [marNotes, setMarNotes] = useState('');
  const [marSubmitting, setMarSubmitting] = useState(false);

  // New Assessment Form
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({
    generalCondition: 'STABLE',
    painScore: 0,
    mobility: 'Independent',
    fallRisk: 'Low',
    nutrition: 'Regular Diet',
    skinCondition: 'Intact',
    mentalStatus: 'Alert and Oriented',
    notes: '',
  });

  // New Intake / Output Form
  const [showIoModal, setShowIoModal] = useState(false);
  const [ioForm, setIoForm] = useState({
    type: 'INTAKE',
    category: 'ORAL',
    amount: 250,
    unit: 'ml',
    notes: '',
  });

  // New Doctor Round Form
  const [showRoundModal, setShowRoundModal] = useState(false);
  const [roundForm, setRoundForm] = useState({
    clinicalStatus: 'IMPROVING',
    progressNote: '',
    assessment: '',
    plan: '',
  });

  // New Medication Order Form
  const [showMedModal, setShowMedModal] = useState(false);
  const [medForm, setMedForm] = useState({
    medicationName: '',
    dose: '500 mg',
    route: 'ORAL',
    frequency: 'TID',
    instructions: 'Post meals',
  });

  // Discharge Summary Form
  const [summaryForm, setSummaryForm] = useState({
    finalDiagnosis: '',
    hospitalCourse: '',
    dischargeCondition: 'STABLE',
    medications: '',
    followUpPlan: '',
  });
  const [discharging, setDischarging] = useState(false);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [admRes, assessRes, ioRes, roundsRes, medsRes, marRes, summaryRes, clearRes] = await Promise.all([
        ipdApi.getAdmission(params.id),
        ipdApi.getNursingAssessments(params.id),
        ipdApi.getIntakeOutput(params.id),
        ipdApi.getRounds(params.id),
        ipdApi.getMedicationOrders(params.id),
        ipdApi.getMar(params.id),
        ipdApi.getDischargeSummary(params.id),
        ipdApi.getBillingClearance(params.id),
      ]);

      setAdmission(admRes.data);
      setAssessments(assessRes.data || []);
      setIntakeOutput(ioRes.data || []);
      setRounds(roundsRes.data || []);
      setMedOrders(medsRes.data || []);
      setMarRecords(marRes.data || []);
      setDischargeSummary(summaryRes.data || null);
      if (summaryRes.data) {
        setSummaryForm({
          finalDiagnosis: summaryRes.data.finalDiagnosis || '',
          hospitalCourse: summaryRes.data.hospitalCourse || '',
          dischargeCondition: summaryRes.data.dischargeCondition || 'STABLE',
          medications: summaryRes.data.medications || '',
          followUpPlan: summaryRes.data.followUpPlan || '',
        });
      }
      setBillingClearance(clearRes.data || null);
    } catch (err: any) {
      console.error('Error loading chart data', err);
      setMsg({ type: 'error', text: err.message || 'Failed to load inpatient clinical chart' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [params.id]);

  // Handle MAR 5-Rights Administration
  const handleAdministerMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marChecks.patientVerificationChecked ||
        !marChecks.medicationVerificationChecked ||
        !marChecks.doseVerificationChecked ||
        !marChecks.routeVerificationChecked ||
        !marChecks.timeVerificationChecked) {
      setMsg({ type: 'error', text: 'All 5 Rights of Medication Administration must be checked and verified' });
      return;
    }

    try {
      setMarSubmitting(true);
      await ipdApi.administerMar(administerOrder.id, {
        ...marChecks,
        notes: marNotes,
      });
      setMsg({ type: 'success', text: `Dose administered and signed for ${administerOrder.medicationName}` });
      setAdministerOrder(null);
      setMarChecks({
        patientVerificationChecked: false,
        medicationVerificationChecked: false,
        doseVerificationChecked: false,
        routeVerificationChecked: false,
        timeVerificationChecked: false,
      });
      setMarNotes('');
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Administration check failed' });
    } finally {
      setMarSubmitting(false);
    }
  };

  // Add Nursing Assessment
  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ipdApi.createNursingAssessment(params.id, assessmentForm);
      setMsg({ type: 'success', text: 'Nursing assessment recorded' });
      setShowAssessmentModal(false);
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to save assessment' });
    }
  };

  // Add Intake / Output
  const handleSaveIo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ipdApi.createIntakeOutput(params.id, {
        ...ioForm,
        amount: Number(ioForm.amount),
      });
      setMsg({ type: 'success', text: 'Intake/Output event recorded' });
      setShowIoModal(false);
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to record intake/output' });
    }
  };

  // Add Doctor Round
  const handleSaveRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roundForm.progressNote) {
      setMsg({ type: 'error', text: 'Progress note is required' });
      return;
    }
    try {
      await ipdApi.createRound(params.id, roundForm);
      setMsg({ type: 'success', text: 'Doctor round progress note recorded' });
      setShowRoundModal(false);
      setRoundForm({ clinicalStatus: 'IMPROVING', progressNote: '', assessment: '', plan: '' });
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to save round note' });
    }
  };

  // Add Medication Order
  const handleSaveMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medForm.medicationName) {
      setMsg({ type: 'error', text: 'Medication name is required' });
      return;
    }
    try {
      await ipdApi.createMedicationOrder(params.id, medForm);
      setMsg({ type: 'success', text: 'Medication order placed on MAR' });
      setShowMedModal(false);
      setMedForm({ medicationName: '', dose: '500 mg', route: 'ORAL', frequency: 'TID', instructions: 'Post meals' });
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to place order' });
    }
  };

  // Save Discharge Summary
  const handleSaveSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ipdApi.saveDischargeSummary(params.id, summaryForm);
      setMsg({ type: 'success', text: 'Discharge summary saved successfully' });
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to save discharge summary' });
    }
  };

  // Final Discharge Action
  const handleFinalDischarge = async () => {
    if (!confirm('Are you sure you want to discharge this patient? This will release the bed and schedule housekeeping terminal cleaning.')) {
      return;
    }
    try {
      setDischarging(true);
      const res = await ipdApi.dischargePatient(params.id);
      setMsg({ type: 'success', text: res.message || 'Patient discharged successfully' });
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Discharge failed' });
    } finally {
      setDischarging(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
        Loading Inpatient Chart & MAR...
      </div>
    );
  }

  if (!admission) {
    return (
      <div className="p-12 text-center text-rose-600 bg-white rounded-xl border border-slate-200">
        Inpatient admission record not found.
      </div>
    );
  }

  const patient = admission.patient;
  const currentBedAlloc = admission.bedAllocations?.find((a: any) => a.status === 'OCCUPIED');
  const bed = currentBedAlloc?.bed;

  // Calculate fluid totals
  const totalIntake = intakeOutput
    .filter((io) => io.type === 'INTAKE')
    .reduce((sum, io) => sum + (io.amount || 0), 0);
  const totalOutput = intakeOutput
    .filter((io) => io.type === 'OUTPUT')
    .reduce((sum, io) => sum + (io.amount || 0), 0);
  const netFluid = totalIntake - totalOutput;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/ipd" className="hover:text-blue-600">IPD Command Center</Link>
        <span>/</span>
        <Link href="/ipd/admissions" className="hover:text-blue-600">Admissions</Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold">{admission.admissionNumber}</span>
      </div>

      {/* Alert Notification */}
      {msg && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium flex justify-between items-center ${
            msg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="font-bold text-sm">✕</button>
        </div>
      )}

      {/* Persistent Clinical Patient Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 font-bold text-xl flex items-center justify-center">
              {patient.firstName?.charAt(0)}{patient.lastName?.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900">
                  {patient.firstName} {patient.lastName}
                </h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    admission.status === 'ADMITTED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {admission.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                MRN: <strong className="text-slate-700">{patient.mrn}</strong> • Sex: <strong className="text-slate-700">{patient.gender}</strong> • Blood Group: <strong className="text-slate-700">{patient.bloodGroup || 'Unspecified'}</strong> • Mobile: <strong className="text-slate-700">{patient.mobile || 'N/A'}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
            <div>
              <p className="text-slate-400 font-medium">Assigned Bed</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">
                {bed ? `${bed.bedNumber} (${bed.ward?.name || 'Ward'})` : 'Unallocated'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Admission #</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">{admission.admissionNumber}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Admitted Date</p>
              <p className="font-semibold text-slate-700 mt-0.5">
                {new Date(admission.admissionDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Clearance</p>
              <p className={`font-bold mt-0.5 ${billingClearance?.cleared ? 'text-emerald-600' : 'text-amber-600'}`}>
                {billingClearance?.cleared ? 'Cleared' : 'Pending'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Tab Bar */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto text-sm font-medium">
        <button
          onClick={() => setActiveTab('mar')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'mar'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          MAR (Medication Admin)
        </button>
        <button
          onClick={() => setActiveTab('nursing')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'nursing'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Nursing Assessments ({assessments.length})
        </button>
        <button
          onClick={() => setActiveTab('intakeOutput')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'intakeOutput'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Intake & Output (Net: {netFluid} ml)
        </button>
        <button
          onClick={() => setActiveTab('rounds')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'rounds'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Doctor Rounds ({rounds.length})
        </button>
        <button
          onClick={() => setActiveTab('discharge')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'discharge'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Discharge & Summary
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* 1. MAR (Medication Administration Record) */}
      {activeTab === 'mar' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Medication Administration Record (MAR)</h2>
              <p className="text-xs text-slate-500">
                Five Rights Check: Right Patient, Right Drug, Right Dose, Right Route, Right Time.
              </p>
            </div>
            <button
              onClick={() => setShowMedModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              + Prescribe Medication Order
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3">Medication</th>
                  <th className="px-5 py-3">Dose & Route</th>
                  <th className="px-5 py-3">Frequency</th>
                  <th className="px-5 py-3">Administration History</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-xs">
                      No active medication orders on MAR.
                    </td>
                  </tr>
                ) : (
                  medOrders.map((order) => {
                    const admins = order.administrations || [];
                    const givenCount = admins.filter((a: any) => a.status === 'GIVEN').length;

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">{order.medicationName}</p>
                          <p className="text-xs text-slate-400">{order.instructions || 'Standard administration'}</p>
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-slate-700">
                          {order.dose} • {order.route}
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-slate-700">
                          {order.frequency}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {givenCount} doses given
                          </span>
                          {admins.length > 0 && (
                            <span className="text-slate-400 block mt-1">
                              Last: {new Date(admins[admins.length - 1].actualTime || admins[admins.length - 1].scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => {
                              setAdministerOrder(order);
                              setMarChecks({
                                patientVerificationChecked: false,
                                medicationVerificationChecked: false,
                                doseVerificationChecked: false,
                                routeVerificationChecked: false,
                                timeVerificationChecked: false,
                              });
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                          >
                            Administer Dose
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Nursing Assessments */}
      {activeTab === 'nursing' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Nursing Assessments & Vitals</h2>
              <p className="text-xs text-slate-500">Regular shift assessments, pain scale, and fall risk tracking.</p>
            </div>
            <button
              onClick={() => setShowAssessmentModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              + Record Nursing Assessment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assessments.length === 0 ? (
              <div className="col-span-2 p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-xs">
                No nursing assessments recorded for this admission yet.
              </div>
            ) : (
              assessments.map((a) => (
                <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-900">
                        Shift Assessment
                      </span>
                      <span className="text-xs text-slate-400 block">
                        {new Date(a.recordedAt || a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      Pain: {a.painScore ?? 0} / 10
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div><span className="text-slate-400">Condition:</span> {a.generalCondition || 'Stable'}</div>
                    <div><span className="text-slate-400">Mobility:</span> {a.mobility || 'Independent'}</div>
                    <div><span className="text-slate-400">Fall Risk:</span> {a.fallRisk || 'Low'}</div>
                    <div><span className="text-slate-400">Mental:</span> {a.mentalStatus || 'Alert'}</div>
                  </div>

                  {a.notes && (
                    <p className="text-xs text-slate-600 pt-2 border-t border-slate-100 italic">
                      &quot;{a.notes}&quot;
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. Intake & Output */}
      {activeTab === 'intakeOutput' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Fluid Balance Chart (Intake & Output)</h2>
              <p className="text-xs text-slate-500">Total Intake: {totalIntake} ml • Total Output: {totalOutput} ml • Net: {netFluid} ml</p>
            </div>
            <button
              onClick={() => setShowIoModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              + Log Intake / Output
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {intakeOutput.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      No fluid intake or output entries recorded.
                    </td>
                  </tr>
                ) : (
                  intakeOutput.map((io) => (
                    <tr key={io.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 text-slate-500 font-mono">
                        {new Date(io.recordTime || io.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3 font-semibold">
                        <span className={io.type === 'INTAKE' ? 'text-emerald-700' : 'text-blue-700'}>
                          {io.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{io.category}</td>
                      <td className="px-5 py-3 font-bold text-slate-900">{io.amount} {io.unit || 'ml'}</td>
                      <td className="px-5 py-3 text-slate-400">{io.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Doctor Daily Rounds */}
      {activeTab === 'rounds' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Physician Daily Rounds & Progress Notes</h2>
              <p className="text-xs text-slate-500">Clinical progress notes, assessments, and daily care plans.</p>
            </div>
            <button
              onClick={() => setShowRoundModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              + Document Round Note
            </button>
          </div>

          <div className="space-y-4">
            {rounds.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-xs">
                No doctor round progress notes documented yet.
              </div>
            ) : (
              rounds.map((r) => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-semibold text-sm text-slate-900">
                        Daily Inpatient Round
                      </span>
                      <span className="text-xs text-slate-400 block">
                        Documented: {new Date(r.roundDate || r.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      Status: {r.clinicalStatus || 'STABLE'}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700">Subjective & Objective Progress:</p>
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{r.progressNote}</p>
                  </div>

                  {r.assessment && (
                    <div>
                      <p className="text-xs font-bold text-slate-700">Clinical Assessment:</p>
                      <p className="text-xs text-slate-600 mt-1">{r.assessment}</p>
                    </div>
                  )}

                  {r.plan && (
                    <div>
                      <p className="text-xs font-bold text-slate-700">Treatment Plan:</p>
                      <p className="text-xs text-slate-600 mt-1">{r.plan}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 5. Discharge Workflow & Summary */}
      {activeTab === 'discharge' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Discharge Summary Form */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-semibold text-slate-900">Clinical Discharge Summary</h3>
                <p className="text-xs text-slate-500">Document final diagnosis, hospital course, and discharge instructions.</p>
              </div>

              <form onSubmit={handleSaveSummary} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Final Diagnosis *</label>
                  <input
                    type="text"
                    value={summaryForm.finalDiagnosis}
                    onChange={(e) => setSummaryForm({ ...summaryForm, finalDiagnosis: e.target.value })}
                    placeholder="e.g. Acute appendicitis post laparoscopic appendectomy"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Hospital Course & Summary *</label>
                  <textarea
                    rows={4}
                    value={summaryForm.hospitalCourse}
                    onChange={(e) => setSummaryForm({ ...summaryForm, hospitalCourse: e.target.value })}
                    placeholder="Brief summary of inpatient stay, procedures performed, response to therapy..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Condition on Discharge</label>
                    <select
                      value={summaryForm.dischargeCondition}
                      onChange={(e) => setSummaryForm({ ...summaryForm, dischargeCondition: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="STABLE">Stable / Improved</option>
                      <option value="RECOVERED">Fully Recovered</option>
                      <option value="AGAINST_MEDICAL_ADVICE">Against Medical Advice (LAMA)</option>
                      <option value="TRANSFERRED">Transferred to Higher Center</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Follow-up Plan</label>
                    <input
                      type="text"
                      value={summaryForm.followUpPlan}
                      onChange={(e) => setSummaryForm({ ...summaryForm, followUpPlan: e.target.value })}
                      placeholder="e.g. OPD review in 7 days for suture removal"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Discharge Medications & Advice</label>
                  <textarea
                    rows={2}
                    value={summaryForm.medications}
                    onChange={(e) => setSummaryForm({ ...summaryForm, medications: e.target.value })}
                    placeholder="Prescription on discharge..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  Save Discharge Summary
                </button>
              </form>
            </div>

            {/* Right Col: Clearance & Discharge Authorization */}
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  Discharge Authorization
                </h3>

                {/* Checklist */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                    <span className="text-slate-700 font-medium">Discharge Summary:</span>
                    <span className={dischargeSummary ? 'text-emerald-700 font-bold' : 'text-amber-600 font-semibold'}>
                      {dischargeSummary ? 'Completed' : 'Draft / Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                    <span className="text-slate-700 font-medium">Billing Clearance:</span>
                    <span className={billingClearance?.cleared ? 'text-emerald-700 font-bold' : 'text-amber-600 font-semibold'}>
                      {billingClearance?.cleared ? 'Clearance Granted' : 'Pending Settlement'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                    <span className="text-slate-700 font-medium">Terminal Bed Clean:</span>
                    <span className="text-blue-600 font-medium">Auto-triggers on discharge</span>
                  </div>
                </div>

                {admission.status === 'ADMITTED' ? (
                  <button
                    onClick={handleFinalDischarge}
                    disabled={discharging}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-sm transition-colors disabled:opacity-50"
                  >
                    {discharging ? 'Discharging Inpatient...' : 'Confirm Patient Discharge'}
                  </button>
                ) : (
                  <div className="p-3 bg-slate-100 text-slate-600 text-xs rounded-lg text-center font-medium">
                    Patient has been discharged from inpatient care.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAR 5-Rights Administration Modal */}
      {administerOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">MAR 5-Rights Administration Check</h3>
                <p className="text-xs text-slate-500">
                  Verify and check each right prior to medication administration.
                </p>
              </div>
              <button
                onClick={() => setAdministerOrder(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Dose Details */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
              <p className="font-bold text-blue-900 text-sm">{administerOrder.medicationName}</p>
              <p className="text-blue-800">
                Prescribed Dose: <strong>{administerOrder.dose}</strong> • Route: <strong>{administerOrder.route}</strong> • Frequency: <strong>{administerOrder.frequency}</strong>
              </p>
              <p className="text-blue-700">Patient: <strong>{patient.firstName} {patient.lastName}</strong> (MRN: {patient.mrn})</p>
            </div>

            <form onSubmit={handleAdministerMed} className="space-y-3">
              <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marChecks.patientVerificationChecked}
                    onChange={(e) => setMarChecks({ ...marChecks, patientVerificationChecked: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>1. <strong>Right Patient:</strong> Identity confirmed against wristband MRN</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marChecks.medicationVerificationChecked}
                    onChange={(e) => setMarChecks({ ...marChecks, medicationVerificationChecked: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>2. <strong>Right Drug:</strong> Drug label matches order</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marChecks.doseVerificationChecked}
                    onChange={(e) => setMarChecks({ ...marChecks, doseVerificationChecked: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>3. <strong>Right Dose:</strong> Dose verified ({administerOrder.dose})</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marChecks.routeVerificationChecked}
                    onChange={(e) => setMarChecks({ ...marChecks, routeVerificationChecked: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>4. <strong>Right Route:</strong> Route verified ({administerOrder.route})</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marChecks.timeVerificationChecked}
                    onChange={(e) => setMarChecks({ ...marChecks, timeVerificationChecked: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>5. <strong>Right Time:</strong> Scheduled interval verified ({administerOrder.frequency})</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Administration Notes (Optional)</label>
                <input
                  type="text"
                  value={marNotes}
                  onChange={(e) => setMarNotes(e.target.value)}
                  placeholder="e.g. Tolerated well, taken with water..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdministerOrder(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={marSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 shadow-sm"
                >
                  {marSubmitting ? 'Signing...' : 'Sign & Complete Administration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Medication Modal */}
      {showMedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Add Inpatient Medication Order</h3>
              <button onClick={() => setShowMedModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveMed} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Medication Name *</label>
                <input
                  type="text"
                  value={medForm.medicationName}
                  onChange={(e) => setMedForm({ ...medForm, medicationName: e.target.value })}
                  placeholder="e.g. Amoxicillin-Clavulanate"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Dose</label>
                  <input
                    type="text"
                    value={medForm.dose}
                    onChange={(e) => setMedForm({ ...medForm, dose: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Route</label>
                  <select
                    value={medForm.route}
                    onChange={(e) => setMedForm({ ...medForm, route: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="ORAL">Oral</option>
                    <option value="IV">IV Infusion / Injection</option>
                    <option value="IM">Intramuscular</option>
                    <option value="SUBCUTANEOUS">Subcutaneous</option>
                    <option value="TOPICAL">Topical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Frequency</label>
                <select
                  value={medForm.frequency}
                  onChange={(e) => setMedForm({ ...medForm, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="STAT">STAT (Immediate Once)</option>
                  <option value="QD">Once Daily (QD)</option>
                  <option value="BID">Twice Daily (BID)</option>
                  <option value="TID">Three Times Daily (TID)</option>
                  <option value="QID">Four Times Daily (QID)</option>
                  <option value="PRN">As Needed (PRN)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Instructions</label>
                <input
                  type="text"
                  value={medForm.instructions}
                  onChange={(e) => setMedForm({ ...medForm, instructions: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMedModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  Save Medication Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Nursing Assessment Modal */}
      {showAssessmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Record Nursing Assessment</h3>
              <button onClick={() => setShowAssessmentModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveAssessment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">General Condition</label>
                  <select
                    value={assessmentForm.generalCondition}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, generalCondition: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="STABLE">Stable</option>
                    <option value="GUARDED">Guarded</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Pain Score (0-10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={assessmentForm.painScore}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, painScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mobility</label>
                  <input
                    type="text"
                    value={assessmentForm.mobility}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, mobility: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fall Risk</label>
                  <select
                    value={assessmentForm.fallRisk}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, fallRisk: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Low">Low Risk</option>
                    <option value="Moderate">Moderate Risk</option>
                    <option value="High">High Risk</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Clinical Notes</label>
                <textarea
                  rows={2}
                  value={assessmentForm.notes}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssessmentModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  Save Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New IO Modal */}
      {showIoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Log Intake / Output</h3>
              <button onClick={() => setShowIoModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveIo} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={ioForm.type}
                    onChange={(e) => setIoForm({ ...ioForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="INTAKE">Intake</option>
                    <option value="OUTPUT">Output</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={ioForm.category}
                    onChange={(e) => setIoForm({ ...ioForm, category: e.target.value })}
                    placeholder="ORAL / IV / URINE / DRAIN"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Amount (ml)</label>
                <input
                  type="number"
                  value={ioForm.amount}
                  onChange={(e) => setIoForm({ ...ioForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowIoModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Doctor Round Modal */}
      {showRoundModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Document Daily Round</h3>
              <button onClick={() => setShowRoundModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveRound} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Progress Notes *</label>
                <textarea
                  rows={3}
                  value={roundForm.progressNote}
                  onChange={(e) => setRoundForm({ ...roundForm, progressNote: e.target.value })}
                  placeholder="Patient reports pain subsided, afebrile, wound clean..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Clinical Assessment</label>
                <input
                  type="text"
                  value={roundForm.assessment}
                  onChange={(e) => setRoundForm({ ...roundForm, assessment: e.target.value })}
                  placeholder="Post-op Day 1, recovering smoothly"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Care Plan</label>
                <input
                  type="text"
                  value={roundForm.plan}
                  onChange={(e) => setRoundForm({ ...roundForm, plan: e.target.value })}
                  placeholder="Step down IV fluids, encourage ambulation"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRoundModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  Save Progress Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
