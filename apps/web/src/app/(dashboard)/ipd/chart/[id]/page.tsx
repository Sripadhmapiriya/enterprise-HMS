'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ipdApi, housekeepingApi } from '@/lib/api';
import { Select, Dialog, ToastContainer } from '@enterprise-hms/ui';
import type { ToastMessage, ToastVariant } from '@enterprise-hms/ui';

export default function IpdChartPage() {
  const params = useParams();
  const id = (params?.id as string) || '';
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
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (title: string, description?: string, variant: ToastVariant = 'info') => {
    const toastId = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id: toastId, title, description, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 4500);
  };

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
        ipdApi.getAdmission(id),
        ipdApi.getNursingAssessments(id),
        ipdApi.getIntakeOutput(id),
        ipdApi.getRounds(id),
        ipdApi.getMedicationOrders(id),
        ipdApi.getMar(id),
        ipdApi.getDischargeSummary(id),
        ipdApi.getBillingClearance(id),
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
      const errorMsg = 'All 5 Rights of Medication Administration must be checked and verified';
      setMsg({ type: 'error', text: errorMsg });
      showToast('Verification Incomplete', errorMsg, 'error');
      return;
    }

    try {
      setMarSubmitting(true);
      await ipdApi.administerMar(administerOrder.id, {
        ...marChecks,
        notes: marNotes,
      });
      const successMsg = `Dose administered and signed for ${administerOrder.medicationName}`;
      setMsg({ type: 'success', text: successMsg });
      showToast('Medication Administered', successMsg, 'success');
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
      const errText = err.message || 'Administration check failed';
      setMsg({ type: 'error', text: errText });
      showToast('Administration Failed', errText, 'error');
    } finally {
      setMarSubmitting(false);
    }
  };

  // Add Nursing Assessment
  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ipdApi.createNursingAssessment(id, assessmentForm);
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
      await ipdApi.createIntakeOutput(id, {
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
      await ipdApi.createRound(id, roundForm);
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
      await ipdApi.createMedicationOrder(id, medForm);
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
      await ipdApi.saveDischargeSummary(id, summaryForm);
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
      const res = await ipdApi.dischargePatient(id);
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
      <div className="p-12 text-center text-text-muted bg-surface rounded-xl border border-border">
        Loading Inpatient Chart & MAR...
      </div>
    );
  }

  if (!admission) {
    return (
      <div className="p-12 text-center text-critical bg-surface rounded-xl border border-border">
        Inpatient admission record not found.
      </div>
    );
  }

  const patient = admission.patient;
  const currentBedAlloc = admission.bedAllocations?.find((a: any) => a.status === 'ACTIVE');
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
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Link href="/ipd" className="hover:text-info">IPD Command Center</Link>
        <span>/</span>
        <Link href="/ipd/admissions" className="hover:text-info">Admissions</Link>
        <span>/</span>
        <span className="text-text font-semibold">{admission.admissionNumber}</span>
      </div>

      {/* Alert Notification */}
      {msg && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium flex justify-between items-center ${ msg.type ==='success'
              ? 'bg-stable-bg border border-stable-border text-stable-text'
              : 'bg-critical-bg border border-critical-border text-critical-text'
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="font-bold text-sm">x</button>
        </div>
      )}

      {/* Persistent Clinical Patient Banner */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-info-bg text-info-text font-bold text-xl flex items-center justify-center">
              {patient.firstName?.charAt(0)}{patient.lastName?.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-text">
                  {patient.firstName} {patient.lastName}
                </h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${ admission.status ==='ADMITTED'
                      ? 'bg-stable-bg text-stable-text border border-stable-border'
                      : 'bg-surface-subtle text-text'
                  }`}
                >
                  {admission.status}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1">
                MRN: <strong className="text-text">{patient.mrn}</strong> • Sex: <strong className="text-text">{patient.gender}</strong> • Blood Group: <strong className="text-text">{patient.bloodGroup || 'Unspecified'}</strong> • Mobile: <strong className="text-text">{patient.mobile || 'N/A'}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs border-t lg:border-t-0 pt-3 lg:pt-0 border-border">
            <div>
              <p className="text-text-muted font-medium">Assigned Bed</p>
              <p className="font-bold text-text text-sm mt-0.5">
                {bed ? `${bed.bedNumber} (${bed.ward?.name || 'Ward'})` : 'Unallocated'}
              </p>
            </div>
            <div>
              <p className="text-text-muted font-medium">Admission #</p>
              <p className="font-mono font-bold text-text mt-0.5">{admission.admissionNumber}</p>
            </div>
            <div>
              <p className="text-text-muted font-medium">Admitted Date</p>
              <p className="font-semibold text-text mt-0.5">
                {new Date(admission.admissionDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-text-muted font-medium">Clearance</p>
              <p className={`font-bold mt-0.5 ${billingClearance?.cleared ?'text-stable' : 'text-warning'}`}>
                {billingClearance?.cleared ? 'Cleared' : 'Pending'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Tab Bar */}
      <div className="flex border-b border-border gap-1 overflow-x-auto text-sm font-medium">
        <button
          onClick={() => setActiveTab('mar')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${ activeTab ==='mar'
              ? 'border-brand text-info font-semibold'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          MAR (Medication Admin)
        </button>
        <button
          onClick={() => setActiveTab('nursing')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${ activeTab ==='nursing'
              ? 'border-brand text-info font-semibold'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Nursing Assessments ({assessments.length})
        </button>
        <button
          onClick={() => setActiveTab('intakeOutput')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${ activeTab ==='intakeOutput'
              ? 'border-brand text-info font-semibold'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Intake & Output (Net: {netFluid} ml)
        </button>
        <button
          onClick={() => setActiveTab('rounds')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${ activeTab ==='rounds'
              ? 'border-brand text-info font-semibold'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Doctor Rounds ({rounds.length})
        </button>
        <button
          onClick={() => setActiveTab('discharge')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${ activeTab ==='discharge'
              ? 'border-brand text-info font-semibold'
              : 'border-transparent text-text-muted hover:text-text'
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
              <h2 className="text-base font-semibold text-text">Medication Administration Record (MAR)</h2>
              <p className="text-xs text-text-muted">
                Five Rights Check: Right Patient, Right Drug, Right Dose, Right Route, Right Time.
              </p>
            </div>
            <button
              onClick={() => setShowMedModal(true)}
              className="px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold shadow-sm"
            >
              + Prescribe Medication Order
            </button>
          </div>

          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-surface-subtle border-b border-border text-text-muted text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3">Medication</th>
                  <th className="px-5 py-3">Dose & Route</th>
                  <th className="px-5 py-3">Frequency</th>
                  <th className="px-5 py-3">Administration History</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {medOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-text-muted text-xs">
                      No active medication orders on MAR.
                    </td>
                  </tr>
                ) : (
                  medOrders.map((order) => {
                    const admins = order.administrations || [];
                    const givenCount = admins.filter((a: any) => a.status === 'GIVEN').length;

                    return (
                      <tr key={order.id} className="hover:bg-surface-subtle/50">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-text">{order.medicationName}</p>
                          <p className="text-xs text-text-muted">{order.instructions || 'Standard administration'}</p>
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-text">
                          {order.dose} • {order.route}
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-text">
                          {order.frequency}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span className="font-semibold text-stable-text bg-stable-bg px-2 py-0.5 rounded border border-stable-border">
                            {givenCount} doses given
                          </span>
                          {admins.length > 0 && (
                            <span className="text-text-muted block mt-1">
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
                            className="px-3 py-1.5 bg-stable hover:bg-stable text-brand-foreground rounded-lg text-xs font-semibold shadow-sm"
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
              <h2 className="text-base font-semibold text-text">Nursing Assessments & Vitals</h2>
              <p className="text-xs text-text-muted">Regular shift assessments, pain scale, and fall risk tracking.</p>
            </div>
            <button
              onClick={() => setShowAssessmentModal(true)}
              className="px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold shadow-sm"
            >
              + Record Nursing Assessment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assessments.length === 0 ? (
              <div className="col-span-2 p-8 text-center text-text-muted bg-surface rounded-xl border border-border text-xs">
                No nursing assessments recorded for this admission yet.
              </div>
            ) : (
              assessments.map((a) => (
                <div key={a.id} className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex justify-between items-start border-b border-border pb-2">
                    <div>
                      <span className="text-xs font-semibold text-text">
                        Shift Assessment
                      </span>
                      <span className="text-xs text-text-muted block">
                        {new Date(a.recordedAt || a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-info-text bg-info-bg px-2 py-0.5 rounded">
                      Pain: {a.painScore ?? 0} / 10
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
                    <div><span className="text-text-muted">Condition:</span> {a.generalCondition || 'Stable'}</div>
                    <div><span className="text-text-muted">Mobility:</span> {a.mobility || 'Independent'}</div>
                    <div><span className="text-text-muted">Fall Risk:</span> {a.fallRisk || 'Low'}</div>
                    <div><span className="text-text-muted">Mental:</span> {a.mentalStatus || 'Alert'}</div>
                  </div>

                  {a.notes && (
                    <p className="text-xs text-text-muted pt-2 border-t border-border italic">
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
              <h2 className="text-base font-semibold text-text">Fluid Balance Chart (Intake & Output)</h2>
              <p className="text-xs text-text-muted">Total Intake: {totalIntake} ml • Total Output: {totalOutput} ml • Net: {netFluid} ml</p>
            </div>
            <button
              onClick={() => setShowIoModal(true)}
              className="px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold shadow-sm"
            >
              + Log Intake / Output
            </button>
          </div>

          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-surface-subtle border-b border-border text-text-muted text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {intakeOutput.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-text-muted">
                      No fluid intake or output entries recorded.
                    </td>
                  </tr>
                ) : (
                  intakeOutput.map((io) => (
                    <tr key={io.id} className="hover:bg-surface-subtle/50">
                      <td className="px-5 py-3 text-text-muted font-mono">
                        {new Date(io.recordTime || io.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3 font-semibold">
                        <span className={io.type === 'INTAKE' ? 'text-stable-text' : 'text-info-text'}>
                          {io.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-text">{io.category}</td>
                      <td className="px-5 py-3 font-bold text-text">{io.amount} {io.unit || 'ml'}</td>
                      <td className="px-5 py-3 text-text-muted">{io.notes || '—'}</td>
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
              <h2 className="text-base font-semibold text-text">Physician Daily Rounds & Progress Notes</h2>
              <p className="text-xs text-text-muted">Clinical progress notes, assessments, and daily care plans.</p>
            </div>
            <button
              onClick={() => setShowRoundModal(true)}
              className="px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold shadow-sm"
            >
              + Document Round Note
            </button>
          </div>

          <div className="space-y-4">
            {rounds.length === 0 ? (
              <div className="p-8 text-center text-text-muted bg-surface rounded-xl border border-border text-xs">
                No doctor round progress notes documented yet.
              </div>
            ) : (
              rounds.map((r) => (
                <div key={r.id} className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex justify-between items-center border-b border-border pb-2">
                    <div>
                      <span className="font-semibold text-sm text-text">
                        Daily Inpatient Round
                      </span>
                      <span className="text-xs text-text-muted block">
                        Documented: {new Date(r.roundDate || r.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-info-text bg-info-bg px-2 py-0.5 rounded">
                      Status: {r.clinicalStatus || 'STABLE'}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-text">Subjective & Objective Progress:</p>
                    <p className="text-xs text-text-muted mt-1 whitespace-pre-wrap">{r.progressNote}</p>
                  </div>

                  {r.assessment && (
                    <div>
                      <p className="text-xs font-bold text-text">Clinical Assessment:</p>
                      <p className="text-xs text-text-muted mt-1">{r.assessment}</p>
                    </div>
                  )}

                  {r.plan && (
                    <div>
                      <p className="text-xs font-bold text-text">Treatment Plan:</p>
                      <p className="text-xs text-text-muted mt-1">{r.plan}</p>
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
            <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="border-b border-border pb-3">
                <h3 className="text-base font-semibold text-text">Clinical Discharge Summary</h3>
                <p className="text-xs text-text-muted">Document final diagnosis, hospital course, and discharge instructions.</p>
              </div>

              <form onSubmit={handleSaveSummary} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Final Diagnosis *</label>
                  <input
                    type="text"
                    value={summaryForm.finalDiagnosis}
                    onChange={(e) => setSummaryForm({ ...summaryForm, finalDiagnosis: e.target.value })}
                    placeholder="e.g. Acute appendicitis post laparoscopic appendectomy"
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs focus:ring-1 focus:ring-brand"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text mb-1">Hospital Course & Summary *</label>
                  <textarea
                    rows={4}
                    value={summaryForm.hospitalCourse}
                    onChange={(e) => setSummaryForm({ ...summaryForm, hospitalCourse: e.target.value })}
                    placeholder="Brief summary of inpatient stay, procedures performed, response to therapy..."
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs focus:ring-1 focus:ring-brand"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text mb-1">Condition on Discharge</label>
                    <Select
                      value={summaryForm.dischargeCondition}
                      onChange={(e) => setSummaryForm({ ...summaryForm, dischargeCondition: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface"
                    >
                      <option value="STABLE">Stable / Improved</option>
                      <option value="RECOVERED">Fully Recovered</option>
                      <option value="AGAINST_MEDICAL_ADVICE">Against Medical Advice (LAMA)</option>
                      <option value="TRANSFERRED">Transferred to Higher Center</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text mb-1">Follow-up Plan</label>
                    <input
                      type="text"
                      value={summaryForm.followUpPlan}
                      onChange={(e) => setSummaryForm({ ...summaryForm, followUpPlan: e.target.value })}
                      placeholder="e.g. OPD review in 7 days for suture removal"
                      className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text mb-1">Discharge Medications & Advice</label>
                  <textarea
                    rows={2}
                    value={summaryForm.medications}
                    onChange={(e) => setSummaryForm({ ...summaryForm, medications: e.target.value })}
                    placeholder="Prescription on discharge..."
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold shadow-sm"
                >
                  Save Discharge Summary
                </button>
              </form>
            </div>

            {/* Right Col: Clearance & Discharge Authorization */}
            <div className="space-y-4">
              <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-base font-semibold text-text border-b border-border pb-2">
                  Discharge Authorization
                </h3>

                {/* Checklist */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-surface-subtle border border-border">
                    <span className="text-text font-medium">Discharge Summary:</span>
                    <span className={dischargeSummary ? 'text-stable-text font-bold' : 'text-warning font-semibold'}>
                      {dischargeSummary ? 'Completed' : 'Draft / Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-surface-subtle border border-border">
                    <span className="text-text font-medium">Billing Clearance:</span>
                    <span className={billingClearance?.cleared ? 'text-stable-text font-bold' : 'text-warning font-semibold'}>
                      {billingClearance?.cleared ? 'Clearance Granted' : 'Pending Settlement'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-surface-subtle border border-border">
                    <span className="text-text font-medium">Terminal Bed Clean:</span>
                    <span className="text-info font-medium">Auto-triggers on discharge</span>
                  </div>
                </div>

                {admission.status === 'ADMITTED' ? (
                  <button
                    onClick={handleFinalDischarge}
                    disabled={discharging}
                    className="w-full py-2.5 bg-critical hover:bg-critical text-brand-foreground font-bold rounded-lg text-xs shadow-sm transition-colors disabled:opacity-50"
                  >
                    {discharging ? 'Discharging Inpatient...' : 'Confirm Patient Discharge'}
                  </button>
                ) : (
                  <div className="p-3 bg-surface-subtle text-text-muted text-xs rounded-lg text-center font-medium">
                    Patient has been discharged from inpatient care.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAR 5-Rights Administration Modal */}
      <Dialog
        isOpen={Boolean(administerOrder)}
        onClose={() => setAdministerOrder(null)}
        title="MAR 5-Rights Administration Check"
        description="Verify and check each right prior to medication administration."
        maxWidth="lg"
        zIndex={60}
      >
        {administerOrder && (
          <div className="space-y-4">
            {/* Dose Details */}
            <div className="p-3 bg-info-bg border border-info-border rounded-lg text-xs space-y-1">
              <p className="font-bold text-info-text text-sm">{administerOrder.medicationName}</p>
              <p className="text-info-text">
                Prescribed Dose: <strong>{administerOrder.dose}</strong> • Route: <strong>{administerOrder.route}</strong> • Frequency: <strong>{administerOrder.frequency}</strong>
              </p>
              <p className="text-info-text">Patient: <strong>{patient.firstName} {patient.lastName}</strong> (MRN: {patient.mrn})</p>
            </div>

            <form onSubmit={handleAdministerMed} className="space-y-3">
              <div className="space-y-2 border border-border rounded-lg p-3 bg-surface-subtle">
                <label className="flex items-center gap-2.5 text-xs font-medium text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marChecks.patientVerificationChecked}
                    onChange={(e) => setMarChecks({ ...marChecks, patientVerificationChecked: e.target.checked })}
                    className="rounded text-info"
                  />
                  <span>1. <strong>Right Patient:</strong> Identity confirmed against wristband MRN</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marChecks.medicationVerificationChecked}
                    onChange={(e) => setMarChecks({ ...marChecks, medicationVerificationChecked: e.target.checked })}
                    className="rounded text-info"
                  />
                  <span>2. <strong>Right Drug:</strong> Drug label matches order</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marChecks.doseVerificationChecked}
                    onChange={(e) => setMarChecks({ ...marChecks, doseVerificationChecked: e.target.checked })}
                    className="rounded text-info"
                  />
                  <span>3. <strong>Right Dose:</strong> Dose verified ({administerOrder.dose})</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marChecks.routeVerificationChecked}
                    onChange={(e) => setMarChecks({ ...marChecks, routeVerificationChecked: e.target.checked })}
                    className="rounded text-info"
                  />
                  <span>4. <strong>Right Route:</strong> Route verified ({administerOrder.route})</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marChecks.timeVerificationChecked}
                    onChange={(e) => setMarChecks({ ...marChecks, timeVerificationChecked: e.target.checked })}
                    className="rounded text-info"
                  />
                  <span>5. <strong>Right Time:</strong> Scheduled interval verified ({administerOrder.frequency})</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Administration Notes (Optional)</label>
                <input
                  type="text"
                  value={marNotes}
                  onChange={(e) => setMarNotes(e.target.value)}
                  placeholder="e.g. Tolerated well, taken with water..."
                  className="w-full px-3 py-1.5 border border-border rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setAdministerOrder(null)}
                  className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={marSubmitting}
                  className="px-4 py-2 bg-stable hover:bg-stable text-brand-foreground rounded-lg text-xs font-semibold disabled:opacity-50 shadow-sm"
                >
                  {marSubmitting ? 'Signing...' : 'Sign & Complete Administration'}
                </button>
              </div>
            </form>
          </div>
        )}
      </Dialog>

      {/* New Medication Modal */}
      {showMedModal && (
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-text">Add Inpatient Medication Order</h3>
              <button onClick={() => setShowMedModal(false)} className="text-text-muted font-bold">x</button>
            </div>
            <form onSubmit={handleSaveMed} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text mb-1">Medication Name *</label>
                <input
                  type="text"
                  value={medForm.medicationName}
                  onChange={(e) => setMedForm({ ...medForm, medicationName: e.target.value })}
                  placeholder="e.g. Amoxicillin-Clavulanate"
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Dose</label>
                  <input
                    type="text"
                    value={medForm.dose}
                    onChange={(e) => setMedForm({ ...medForm, dose: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Route</label>
                  <Select
                    value={medForm.route}
                    onChange={(e) => setMedForm({ ...medForm, route: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface"
                  >
                    <option value="ORAL">Oral</option>
                    <option value="IV">IV Infusion / Injection</option>
                    <option value="IM">Intramuscular</option>
                    <option value="SUBCUTANEOUS">Subcutaneous</option>
                    <option value="TOPICAL">Topical</option>
                  </Select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text mb-1">Frequency</label>
                <Select
                  value={medForm.frequency}
                  onChange={(e) => setMedForm({ ...medForm, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface"
                >
                  <option value="STAT">STAT (Immediate Once)</option>
                  <option value="QD">Once Daily (QD)</option>
                  <option value="BID">Twice Daily (BID)</option>
                  <option value="TID">Three Times Daily (TID)</option>
                  <option value="QID">Four Times Daily (QID)</option>
                  <option value="PRN">As Needed (PRN)</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text mb-1">Instructions</label>
                <input
                  type="text"
                  value={medForm.instructions}
                  onChange={(e) => setMedForm({ ...medForm, instructions: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowMedModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold"
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
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-text">Record Nursing Assessment</h3>
              <button onClick={() => setShowAssessmentModal(false)} className="text-text-muted font-bold">x</button>
            </div>
            <form onSubmit={handleSaveAssessment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">General Condition</label>
                  <Select
                    value={assessmentForm.generalCondition}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, generalCondition: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface"
                  >
                    <option value="STABLE">Stable</option>
                    <option value="GUARDED">Guarded</option>
                    <option value="CRITICAL">Critical</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Pain Score (0-10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={assessmentForm.painScore}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, painScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Mobility</label>
                  <input
                    type="text"
                    value={assessmentForm.mobility}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, mobility: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Fall Risk</label>
                  <Select
                    value={assessmentForm.fallRisk}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, fallRisk: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface"
                  >
                    <option value="Low">Low Risk</option>
                    <option value="Moderate">Moderate Risk</option>
                    <option value="High">High Risk</option>
                  </Select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text mb-1">Clinical Notes</label>
                <textarea
                  rows={2}
                  value={assessmentForm.notes}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAssessmentModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold"
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
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-text">Log Intake / Output</h3>
              <button onClick={() => setShowIoModal(false)} className="text-text-muted font-bold">x</button>
            </div>
            <form onSubmit={handleSaveIo} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Type</label>
                  <Select
                    value={ioForm.type}
                    onChange={(e) => setIoForm({ ...ioForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface"
                  >
                    <option value="INTAKE">Intake</option>
                    <option value="OUTPUT">Output</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Category</label>
                  <input
                    type="text"
                    value={ioForm.category}
                    onChange={(e) => setIoForm({ ...ioForm, category: e.target.value })}
                    placeholder="ORAL / IV / URINE / DRAIN"
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text mb-1">Amount (ml)</label>
                <input
                  type="number"
                  value={ioForm.amount}
                  onChange={(e) => setIoForm({ ...ioForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowIoModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold"
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
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-text">Document Daily Round</h3>
              <button onClick={() => setShowRoundModal(false)} className="text-text-muted font-bold">x</button>
            </div>
            <form onSubmit={handleSaveRound} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text mb-1">Progress Notes *</label>
                <textarea
                  rows={3}
                  value={roundForm.progressNote}
                  onChange={(e) => setRoundForm({ ...roundForm, progressNote: e.target.value })}
                  placeholder="Patient reports pain subsided, afebrile, wound clean..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text mb-1">Clinical Assessment</label>
                <input
                  type="text"
                  value={roundForm.assessment}
                  onChange={(e) => setRoundForm({ ...roundForm, assessment: e.target.value })}
                  placeholder="Post-op Day 1, recovering smoothly"
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text mb-1">Care Plan</label>
                <input
                  type="text"
                  value={roundForm.plan}
                  onChange={(e) => setRoundForm({ ...roundForm, plan: e.target.value })}
                  placeholder="Step down IV fluids, encourage ambulation"
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowRoundModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold"
                >
                  Save Progress Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Container (Top-Right) */}
      <ToastContainer
        toasts={toasts}
        onDismiss={(toastId) => setToasts((prev) => prev.filter((t) => t.id !== toastId))}
      />
    </div>
  );
}
