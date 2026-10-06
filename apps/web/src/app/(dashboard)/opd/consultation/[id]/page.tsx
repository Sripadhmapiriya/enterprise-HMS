'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PatientBanner,
  Button,
  Badge,
  Input,
  Select,
  Textarea,
  Dialog,
  ErrorState,
  Skeleton,
} from '@enterprise-hms/ui';
import {
  Stethoscope,
  Activity,
  FileText,
  Pill,
  Microscope,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ArrowLeft,
  Plus,
} from 'lucide-react';
import { opdApi } from '@/lib/api';

export default function ConsultationWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const encounterId = resolvedParams.id;
  const router = useRouter();

  const [encounter, setEncounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vitals form
  const [vitals, setVitals] = useState({
    temperature: 98.6,
    pulse: 76,
    bpSystolic: 120,
    bpDiastolic: 80,
    respiratoryRate: 16,
    spo2: 99,
    height: 172,
    weight: 70,
  });

  // SOAP form
  const [soap, setSoap] = useState({
    chiefComplaint: '',
    historyOfPresent: '',
    examinationFindings: '',
    assessmentPlan: '',
  });

  // Diagnosis form
  const [diagnosis, setDiagnosis] = useState({
    diagnosisCode: 'J06.9',
    description: 'Acute upper respiratory infection, unspecified',
    type: 'PRIMARY',
  });

  // Prescription form
  const [prescriptionItems, setPrescriptionItems] = useState([
    {
      medicationName: 'Amoxicillin 500mg',
      dosage: '1 capsule',
      frequency: 'TDS (3 times daily)',
      duration: '5 days',
      timing: 'AFTER_FOOD',
    },
  ]);
  const [overrideAllergyAlerts, setOverrideAllergyAlerts] = useState(false);
  const [allergyConflictWarning, setAllergyConflictWarning] = useState<string | null>(null);

  // Saving states
  const [savingVitals, setSavingVitals] = useState(false);
  const [savingSoap, setSavingSoap] = useState(false);
  const [savingDiagnosis, setSavingDiagnosis] = useState(false);
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [closingEncounter, setClosingEncounter] = useState(false);

  const loadEncounter = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await opdApi.getEncounter(encounterId);
      setEncounter(res.data);

      if (res.data?.vitals?.[0]) {
        const v = res.data.vitals[0];
        setVitals({
          temperature: v.temperature || 98.6,
          pulse: v.pulse || 76,
          bpSystolic: v.bpSystolic || 120,
          bpDiastolic: v.bpDiastolic || 80,
          respiratoryRate: v.respiratoryRate || 16,
          spo2: v.spo2 || 99,
          height: v.height || 172,
          weight: v.weight || 70,
        });
      }

      if (res.data?.clinicalHistory) {
        const ch = res.data.clinicalHistory;
        setSoap((prev) => ({
          ...prev,
          chiefComplaint: ch.chiefComplaint || '',
          historyOfPresent: ch.historyOfPresent || '',
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load consultation encounter');
    } finally {
      setLoading(false);
    }
  }, [encounterId]);

  useEffect(() => {
    loadEncounter();
  }, [loadEncounter]);

  // Live drug-allergy interaction check
  useEffect(() => {
    if (!encounter?.patient?.allergies) return;
    const activeAllergens = (encounter.patient.allergies as any[])
      .filter((a) => a.status === 'ACTIVE')
      .map((a) => a.allergen.toLowerCase());

    let warning: string | null = null;
    for (const item of prescriptionItems) {
      const medName = item.medicationName.toLowerCase();
      for (const allergen of activeAllergens) {
        if (
          medName.includes(allergen) ||
          (allergen.includes('penicillin') && medName.includes('amox'))
        ) {
          warning = `CRITICAL ALLERGY CONFLICT: Patient is allergic to "${allergen}". Prescribed "${item.medicationName}" carries cross-reactivity risk!`;
          break;
        }
      }
      if (warning) break;
    }
    setAllergyConflictWarning(warning);
  }, [prescriptionItems, encounter]);

  const handleSaveVitals = async () => {
    try {
      setSavingVitals(true);
      await opdApi.recordVitals(encounterId, vitals);
      alert('Vitals saved successfully');
      loadEncounter();
    } catch (err: any) {
      alert(`Failed to save vitals: ${err.message}`);
    } finally {
      setSavingVitals(false);
    }
  };

  const handleSaveSoap = async () => {
    try {
      setSavingSoap(true);
      await opdApi.recordSoap(encounterId, soap);
      alert('Clinical notes saved successfully');
      loadEncounter();
    } catch (err: any) {
      alert(`Failed to save SOAP notes: ${err.message}`);
    } finally {
      setSavingSoap(false);
    }
  };

  const handleAddDiagnosis = async () => {
    try {
      setSavingDiagnosis(true);
      await opdApi.addDiagnosis(encounterId, diagnosis);
      alert('Diagnosis documented');
      loadEncounter();
    } catch (err: any) {
      alert(`Failed to add diagnosis: ${err.message}`);
    } finally {
      setSavingDiagnosis(false);
    }
  };

  const handleSavePrescription = async () => {
    try {
      setSavingPrescription(true);
      await opdApi.createPrescription(encounterId, {
        items: prescriptionItems,
        overrideAllergyAlerts,
      });
      alert('Prescription created and sent to pharmacy queue');
      loadEncounter();
    } catch (err: any) {
      alert(`Prescription failed: ${err.message}`);
    } finally {
      setSavingPrescription(false);
    }
  };

  const handleCloseEncounter = async () => {
    if (!confirm('Close this consultation and capture outpatient charges?')) return;
    try {
      setClosingEncounter(true);
      await opdApi.closeEncounter(encounterId);
      alert('Encounter completed! Consultation fee recorded.');
      router.push(`/patients/${encounter.patientId}`);
    } catch (err: any) {
      alert(`Failed to close encounter: ${err.message}`);
    } finally {
      setClosingEncounter(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton height={120} className="w-full" />
        <Skeleton height={200} className="w-full" />
      </div>
    );
  }

  if (error || !encounter) {
    return (
      <ErrorState
        title="Consultation Record Unavailable"
        message={error || 'Could not load encounter'}
        onRetry={loadEncounter}
      />
    );
  }

  const pb = encounter.patientBanner;
  const bannerData = pb
    ? {
        id: pb.id || encounter.patientId,
        mrn: pb.mrn,
        name: pb.name,
        gender: pb.gender,
        ageYears: pb.age,
        bloodGroup: pb.bloodGroup,
        allergies: (pb.allergies || []).map((sub: string) => ({
          substance: sub,
          severity: 'moderate' as const,
        })),
        alerts: (pb.alerts || []).map((msg: string) => ({
          message: msg,
          level: 'critical' as const,
        })),
      }
    : null;

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/patients/${encounter.patientId}`}
          className="inline-flex items-center text-sm font-medium text-text-muted hover:text-text"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Patient 360
        </Link>
        <div className="flex items-center gap-2">
          <Badge
            variant={encounter.status === 'COMPLETED' ? 'stable' : 'warning'}
          >
            Consultation {encounter.status}
          </Badge>
          <Button
            variant="primary"
            onClick={handleCloseEncounter}
            isLoading={closingEncounter}
            disabled={encounter.status === 'COMPLETED'}
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Complete & Close Encounter
          </Button>
        </div>
      </div>

      {/* Persistent Patient Banner */}
      {bannerData && (
        <PatientBanner
          patient={bannerData}
          className="shadow-sm"
        />
      )}

      {/* Grid: Left Column Clinical Data, Right Column Orders & Prescriptions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vitals Form Card */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-text text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-info" />
                Vital Signs & Anthropometry
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveVitals}
                isLoading={savingVitals}
              >
                Save Vitals
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Input
                label="BP Systolic (mmHg)"
                type="number"
                value={vitals.bpSystolic}
                onChange={(e) =>
                  setVitals({ ...vitals, bpSystolic: Number(e.target.value) })
                }
              />
              <Input
                label="BP Diastolic (mmHg)"
                type="number"
                value={vitals.bpDiastolic}
                onChange={(e) =>
                  setVitals({ ...vitals, bpDiastolic: Number(e.target.value) })
                }
              />
              <Input
                label="Pulse Rate (bpm)"
                type="number"
                value={vitals.pulse}
                onChange={(e) =>
                  setVitals({ ...vitals, pulse: Number(e.target.value) })
                }
              />
              <Input
                label="Temperature (°F)"
                type="number"
                step="0.1"
                value={vitals.temperature}
                onChange={(e) =>
                  setVitals({ ...vitals, temperature: Number(e.target.value) })
                }
              />
              <Input
                label="SpO2 (%)"
                type="number"
                value={vitals.spo2}
                onChange={(e) =>
                  setVitals({ ...vitals, spo2: Number(e.target.value) })
                }
              />
              <Input
                label="Resp. Rate (/min)"
                type="number"
                value={vitals.respiratoryRate}
                onChange={(e) =>
                  setVitals({
                    ...vitals,
                    respiratoryRate: Number(e.target.value),
                  })
                }
              />
              <Input
                label="Height (cm)"
                type="number"
                value={vitals.height}
                onChange={(e) =>
                  setVitals({ ...vitals, height: Number(e.target.value) })
                }
              />
              <Input
                label="Weight (kg)"
                type="number"
                value={vitals.weight}
                onChange={(e) =>
                  setVitals({ ...vitals, weight: Number(e.target.value) })
                }
              />
            </div>
          </div>

          {/* SOAP Clinical Notes Card */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-text text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-info" />
                SOAP Consultation Workspace
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveSoap}
                isLoading={savingSoap}
              >
                Save Notes
              </Button>
            </div>

            <div className="space-y-4">
              <Textarea
                label="Subjective: Chief Complaint & Symptoms"
                placeholder="Patient presents with persistent cough and fever for 3 days..."
                value={soap.chiefComplaint}
                onChange={(e) =>
                  setSoap({ ...soap, chiefComplaint: e.target.value })
                }
              />
              <Textarea
                label="Objective: Physical Examination Findings"
                placeholder="Chest clear on auscultation. Pharyngeal congestion noted..."
                value={soap.examinationFindings}
                onChange={(e) =>
                  setSoap({ ...soap, examinationFindings: e.target.value })
                }
              />
              <Textarea
                label="Assessment & Clinical Management Plan"
                placeholder="Acute upper respiratory tract infection. Advised rest, hydration, and symptomatic pharmacotherapy..."
                value={soap.assessmentPlan}
                onChange={(e) =>
                  setSoap({ ...soap, assessmentPlan: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Right Column: Diagnoses & Prescriptions (1 Col) */}
        <div className="space-y-6">
          {/* ICD-10 Diagnoses Card */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-text text-sm flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-info" />
                ICD-10 Diagnoses
              </h3>
            </div>

            {encounter.diagnoses?.length > 0 && (
              <div className="space-y-1.5">
                {encounter.diagnoses.map((d: any) => (
                  <div
                    key={d.id}
                    className="p-2.5 bg-surface-subtle border border-border rounded-lg text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-info-text">
                        {d.diagnosisCode}
                      </span>
                      <Badge variant="neutral">{d.type}</Badge>
                    </div>
                    <p className="text-text mt-1 font-medium">{d.description}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <Input
                label="ICD Code"
                placeholder="e.g. J06.9"
                value={diagnosis.diagnosisCode}
                onChange={(e) =>
                  setDiagnosis({ ...diagnosis, diagnosisCode: e.target.value })
                }
              />
              <Input
                label="Diagnosis Description"
                placeholder="e.g. Acute upper respiratory infection"
                value={diagnosis.description}
                onChange={(e) =>
                  setDiagnosis({ ...diagnosis, description: e.target.value })
                }
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleAddDiagnosis}
                isLoading={savingDiagnosis}
              >
                + Add Diagnosis
              </Button>
            </div>
          </div>

          {/* E-Prescribing & Allergy Check Card */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-text text-sm flex items-center gap-2">
                <Pill className="w-4 h-4 text-info" />
                E-Prescription & Pharmacy Hook
              </h3>
            </div>

            {/* Allergy Conflict Alert Box */}
            {allergyConflictWarning && (
              <div className="p-3 bg-critical-bg border border-critical-border rounded-xl space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-critical shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-critical-text">
                    {allergyConflictWarning}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-critical-text cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={overrideAllergyAlerts}
                    onChange={(e) => setOverrideAllergyAlerts(e.target.checked)}
                    className="rounded border-critical-border text-critical focus:ring-critical"
                  />
                  <span>Clinician override with informed benefit/risk rationale</span>
                </label>
              </div>
            )}

            {/* Items List */}
            <div className="space-y-3">
              {prescriptionItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-surface-subtle border border-border rounded-lg space-y-2 text-xs"
                >
                  <Input
                    label="Medication Name & Strength"
                    value={item.medicationName}
                    onChange={(e) => {
                      const updated = [...prescriptionItems];
                      updated[idx].medicationName = e.target.value;
                      setPrescriptionItems(updated);
                    }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Dosage"
                      value={item.dosage}
                      onChange={(e) => {
                        const updated = [...prescriptionItems];
                        updated[idx].dosage = e.target.value;
                        setPrescriptionItems(updated);
                      }}
                    />
                    <Input
                      label="Frequency"
                      value={item.frequency}
                      onChange={(e) => {
                        const updated = [...prescriptionItems];
                        updated[idx].frequency = e.target.value;
                        setPrescriptionItems(updated);
                      }}
                    />
                  </div>
                </div>
              ))}

              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={handleSavePrescription}
                isLoading={savingPrescription}
              >
                Sign & Transmit E-Prescription
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
