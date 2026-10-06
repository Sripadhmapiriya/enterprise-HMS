'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PatientBanner,
  Button,
  Badge,
  Tabs,
  Dialog,
  Input,
  Select,
  Textarea,
  ErrorState,
  Skeleton,
  EmptyState,
} from '@enterprise-hms/ui';
import {
  Calendar,
  Stethoscope,
  AlertTriangle,
  FileText,
  ShieldAlert,
  GitMerge,
  Plus,
  Clock,
  CheckCircle2,
  FilePlus,
  ArrowRight,
  User,
} from 'lucide-react';
import { patientsApi, opdApi } from '@/lib/api';

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const patientId = resolvedParams.id;
  const router = useRouter();

  const [patient, setPatient] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState('encounters');

  // Modals state
  const [isAddAllergyOpen, setIsAddAllergyOpen] = useState(false);
  const [isAddAlertOpen, setIsAddAlertOpen] = useState(false);
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isStartingEncounter, setIsStartingEncounter] = useState(false);

  // Form states
  const [allergyForm, setAllergyForm] = useState({
    allergen: '',
    severity: 'MODERATE',
    reaction: '',
    notes: '',
  });

  const [alertForm, setAlertForm] = useState({
    description: '',
    severity: 'HIGH',
    alertType: 'CLINICAL',
  });

  const [docForm, setDocForm] = useState({
    title: '',
    documentType: 'ID_PROOF',
    fileUrl: 'https://storage.hospital.org/docs/sample.pdf',
  });

  const [mergeForm, setMergeForm] = useState({
    targetPatientMrn: '',
    reason: 'Duplicate patient record identified during intake',
  });

  const loadPatientData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [pRes, tRes] = await Promise.all([
        patientsApi.get(patientId),
        patientsApi.getTimeline(patientId),
      ]);
      setPatient(pRes.data);
      setTimeline(tRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load patient record');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  const handleAddAllergy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await patientsApi.addAllergy(patientId, allergyForm);
      setIsAddAllergyOpen(false);
      setAllergyForm({ allergen: '', severity: 'MODERATE', reaction: '', notes: '' });
      loadPatientData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await patientsApi.addAlert(patientId, alertForm);
      setIsAddAlertOpen(false);
      setAlertForm({ description: '', severity: 'HIGH', alertType: 'CLINICAL' });
      loadPatientData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await patientsApi.addDocument(patientId, docForm);
      setIsAddDocOpen(false);
      setDocForm({
        title: '',
        documentType: 'ID_PROOF',
        fileUrl: 'https://storage.hospital.org/docs/sample.pdf',
      });
      loadPatientData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Find target patient by MRN
      const searchRes = await patientsApi.list({ q: mergeForm.targetPatientMrn });
      const target = (searchRes.data || []).find(
        (p: any) => p.mrn.toLowerCase() === mergeForm.targetPatientMrn.trim().toLowerCase()
      );
      if (!target) {
        alert(`Target patient with MRN "${mergeForm.targetPatientMrn}" not found.`);
        return;
      }

      await patientsApi.merge({
        sourcePatientId: patient.id,
        targetPatientId: target.id,
        reason: mergeForm.reason,
      });

      alert(`Patient successfully merged into ${target.mrn}. Redirecting to primary record...`);
      setIsMergeOpen(false);
      router.push(`/patients/${target.id}`);
    } catch (err: any) {
      alert(`Merge failed: ${err.message}`);
    }
  };

  const handleStartConsultation = async () => {
    try {
      setIsStartingEncounter(true);
      const res = await opdApi.startEncounter({
        patientId: patient.id,
        doctorId: patient.encounters?.[0]?.doctorId || 'doc-default',
        branchId: patient.branchId || 'branch-default',
        departmentId: patient.departmentId || 'dept-opd',
        type: 'OPD',
      });

      if (res.data?.id) {
        router.push(`/opd/consultation/${res.data.id}`);
      }
    } catch (err: any) {
      alert(`Failed to start consultation: ${err.message}`);
    } finally {
      setIsStartingEncounter(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton height={120} className="w-full" />
        <Skeleton height={24} className="w-1/3" />
        <Skeleton height={200} className="w-full" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <ErrorState
        title="Patient Record Unavailable"
        message={error || 'Could not find requested patient'}
        onRetry={loadPatientData}
      />
    );
  }

  const age =
    new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear();
  const activeAllergies = (patient.allergies || [])
    .filter((a: any) => a.status === 'ACTIVE')
    .map((a: any) => a.allergen);
  const activeAlerts = (patient.alerts || [])
    .filter((al: any) => al.isActive)
    .map((al: any) => al.description);

  const bannerData = {
    id: patient.id,
    mrn: patient.mrn,
    name: `${patient.firstName} ${patient.lastName}`,
    gender: patient.gender,
    ageYears: age,
    bloodGroup: patient.bloodGroup || undefined,
    mobile: patient.mobile,
    allergies: (patient.allergies || [])
      .filter((a: any) => a.status === 'ACTIVE')
      .map((a: any) => ({
        id: a.id,
        substance: a.allergen,
        severity: (a.severity ? a.severity.toLowerCase() : 'moderate') as 'mild' | 'moderate' | 'severe',
      })),
    alerts: (patient.alerts || [])
      .filter((al: any) => al.isActive)
      .map((al: any) => ({
        id: al.id,
        message: al.description,
        level: (al.severity === 'HIGH' ? 'critical' : al.severity === 'MEDIUM' ? 'warning' : 'info') as 'critical' | 'warning' | 'info',
      })),
  };

  return (
    <div className="space-y-6">
      {/* Merged Patient Notice */}
      {patient.mergedIntoPatientId && (
        <div className="p-4 bg-warning-bg border border-warning-border rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitMerge className="w-5 h-5 text-warning" />
            <div>
              <p className="font-semibold text-warning-text text-sm">
                This record has been merged into a primary patient record.
              </p>
              <p className="text-xs text-warning-text">
                All clinical records and appointments have been moved.
              </p>
            </div>
          </div>
          <Link href={`/patients/${patient.mergedIntoPatientId}`}>
            <Button variant="outline" size="sm">
              View Active Record <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* Persistent Patient Banner */}
      <PatientBanner
        patient={bannerData}
        className="shadow-sm"
      />

      {/* Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface border border-border rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handleStartConsultation}
            isLoading={isStartingEncounter}
          >
            <Stethoscope className="w-4 h-4 mr-2" />
            Start OPD Consultation
          </Button>
          <Link href={`/appointments?patientId=${patient.id}`}>
            <Button variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Appointment
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddAllergyOpen(true)}
          >
            <ShieldAlert className="w-3.5 h-3.5 mr-1 text-warning" />
            + Allergy
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddAlertOpen(true)}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-critical" />
            + Alert
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddDocOpen(true)}
          >
            <FilePlus className="w-3.5 h-3.5 mr-1 text-info" />
            + Document
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMergeOpen(true)}
            className="text-text-muted"
          >
            <GitMerge className="w-3.5 h-3.5 mr-1" />
            Merge Record
          </Button>
        </div>
      </div>

      {/* 360 Tabs */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-6">
        <Tabs
          tabs={[
            { id: 'encounters', label: 'Consultations & Encounters', count: patient.encounters?.length },
            { id: 'timeline', label: 'Clinical Timeline', count: timeline.length },
            { id: 'appointments', label: 'Appointments', count: patient.appointments?.length },
            { id: 'safety', label: 'Allergies & Clinical Alerts', count: activeAllergies.length + activeAlerts.length },
            { id: 'documents', label: 'Documents & Consent', count: (patient.documents?.length || 0) + (patient.consents?.length || 0) },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {/* Tab 1: Encounters */}
        {activeTab === 'encounters' && (
          <div className="space-y-4">
            {patient.encounters?.length === 0 ? (
              <EmptyState
                icon={<Stethoscope className="w-6 h-6" />}
                title="No Clinical Encounters Recorded"
                description="Start an outpatient consultation to capture SOAP notes, vitals, ICD diagnoses, and prescriptions."
                actionLabel="Start Consultation"
                onAction={handleStartConsultation}
              />
            ) : (
              <div className="divide-y divide-border">
                {patient.encounters.map((enc: any) => (
                  <div
                    key={enc.id}
                    className="py-4 flex items-center justify-between hover:bg-surface-subtle/50 px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text text-sm">
                          {enc.type} Consultation
                        </span>
                        <Badge
                          variant={
                            enc.status === 'COMPLETED'
                              ? 'stable'
                              : enc.status === 'IN_PROGRESS'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {enc.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        Doctor: Dr. {enc.doctor?.user?.firstName} {enc.doctor?.user?.lastName} • Date: {new Date(enc.startTime).toLocaleDateString()}
                      </p>
                      {enc.diagnoses?.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-xs font-medium text-text-muted">Diagnosis:</span>
                          {enc.diagnoses.map((d: any) => (
                            <Badge key={d.id} variant="neutral">
                              {d.diagnosisCode ? `${d.diagnosisCode} - ` : ''}{d.description}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Link href={`/opd/consultation/${enc.id}`}>
                      <Button variant="outline" size="sm">
                        Open Workspace <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Timeline */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            {timeline.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">No timeline events recorded yet.</p>
            ) : (
              <div className="relative pl-6 border-l-2 border-border space-y-6">
                {timeline.map((event: any, idx: number) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-brand border-2 border-border shadow-sm" />
                    <div className="bg-surface-subtle p-3.5 rounded-lg border border-border">
                      <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                        <span className="font-semibold text-text">{event.title}</span>
                        <span className="tabular-nums">{new Date(event.date).toLocaleDateString()}</span>
                      </div>
                      {event.details?.diagnoses?.length > 0 && (
                        <p className="text-xs text-text-muted">
                          Diagnoses: {event.details.diagnoses.join(', ')}
                        </p>
                      )}
                      {event.details?.vitals && (
                        <p className="text-xs text-text-muted mt-1">
                          Vitals: BP {event.details.vitals.bpSystolic}/{event.details.vitals.bpDiastolic} mmHg • Pulse {event.details.vitals.pulse} bpm
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Appointments */}
        {activeTab === 'appointments' && (
          <div className="space-y-3">
            {patient.appointments?.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-6 h-6" />}
                title="No Appointments Scheduled"
                description="Book a new OPD or follow-up appointment with a hospital physician."
                actionLabel="Book Appointment"
                onAction={() => router.push(`/appointments?patientId=${patient.id}`)}
              />
            ) : (
              <div className="divide-y divide-border">
                {patient.appointments.map((apt: any) => (
                  <div key={apt.id} className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-text text-sm">
                        Dr. {apt.doctor?.user?.firstName} {apt.doctor?.user?.lastName}
                      </span>
                      <p className="text-xs text-text-muted">
                        {new Date(apt.appointmentDate).toLocaleDateString()} • {apt.type} • Status: {apt.status}
                      </p>
                    </div>
                    <Badge variant={apt.status === 'ARRIVED' ? 'stable' : 'neutral'}>
                      {apt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Allergies & Alerts */}
        {activeTab === 'safety' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Allergies Card */}
            <div className="p-4 border border-warning-border bg-warning-bg/40 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-warning-text flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-warning" />
                  Known Allergies
                </h4>
                <Button variant="outline" size="sm" onClick={() => setIsAddAllergyOpen(true)}>
                  + Add
                </Button>
              </div>
              {patient.allergies?.length === 0 ? (
                <p className="text-xs text-text-muted">No known allergies documented (NKA).</p>
              ) : (
                <div className="space-y-2">
                  {patient.allergies.map((alg: any) => (
                    <div key={alg.id} className="bg-surface p-2.5 rounded-lg border border-warning-border text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-text">{alg.allergen}</span>
                        <Badge variant="warning">{alg.severity}</Badge>
                      </div>
                      {alg.reaction && <p className="text-text-muted mt-1">Reaction: {alg.reaction}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alerts Card */}
            <div className="p-4 border border-critical-border bg-critical-bg/40 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-critical-text flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-critical" />
                  Clinical & Safety Alerts
                </h4>
                <Button variant="outline" size="sm" onClick={() => setIsAddAlertOpen(true)}>
                  + Add
                </Button>
              </div>
              {patient.alerts?.length === 0 ? (
                <p className="text-xs text-text-muted">No active clinical alerts.</p>
              ) : (
                <div className="space-y-2">
                  {patient.alerts.map((alt: any) => (
                    <div key={alt.id} className="bg-surface p-2.5 rounded-lg border border-critical-border text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-text">{alt.description}</span>
                        <Badge variant="critical">{alt.severity}</Badge>
                      </div>
                      <p className="text-text-muted mt-0.5">{alt.alertType} Alert</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Documents & Consent */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-sm text-text">Patient Documents & Consent Records</h4>
              <Button variant="outline" size="sm" onClick={() => setIsAddDocOpen(true)}>
                + Upload Document
              </Button>
            </div>
            {patient.documents?.length === 0 ? (
              <p className="text-xs text-text-muted py-4">No documents uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {patient.documents.map((doc: any) => (
                  <div key={doc.id} className="p-3 border border-border rounded-lg bg-surface-subtle flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-info-text" />
                      <div>
                        <p className="text-xs font-semibold text-text">{doc.title}</p>
                        <p className="text-[11px] text-text-muted">{doc.documentType}</p>
                      </div>
                    </div>
                    <Badge variant="neutral">Verified</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Allergy Modal */}
      <Dialog
        isOpen={isAddAllergyOpen}
        onClose={() => setIsAddAllergyOpen(false)}
        title="Document Patient Allergy"
        description="Records an adverse drug or substance allergy visible on all clinical workspaces."
      >
        <form onSubmit={handleAddAllergy} className="space-y-4">
          <Input
            label="Allergen Name"
            required
            placeholder="e.g. Penicillin, Sulfa, Aspirin"
            value={allergyForm.allergen}
            onChange={(e) => setAllergyForm({ ...allergyForm, allergen: e.target.value })}
          />
          <Select
            label="Severity"
            value={allergyForm.severity}
            onChange={(e) => setAllergyForm({ ...allergyForm, severity: e.target.value })}
            options={[
              { value: 'MILD', label: 'Mild (Rash, localized pruritus)' },
              { value: 'MODERATE', label: 'Moderate (Urticaria, facial swelling)' },
              { value: 'SEVERE', label: 'Severe / Anaphylaxis (Life-threatening)' },
            ]}
          />
          <Input
            label="Observed Reaction"
            placeholder="e.g. Urticaria, Bronchospasm"
            value={allergyForm.reaction}
            onChange={(e) => setAllergyForm({ ...allergyForm, reaction: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddAllergyOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Allergy
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Alert Modal */}
      <Dialog
        isOpen={isAddAlertOpen}
        onClose={() => setIsAddAlertOpen(false)}
        title="Add Clinical Alert"
        description="Creates a high-visibility alert banner for clinicians (e.g. Fall Risk, Blood Thinners)."
      >
        <form onSubmit={handleAddAlert} className="space-y-4">
          <Input
            label="Alert Description"
            required
            placeholder="e.g. High Fall Risk, On Warfarin"
            value={alertForm.description}
            onChange={(e) => setAlertForm({ ...alertForm, description: e.target.value })}
          />
          <Select
            label="Severity"
            value={alertForm.severity}
            onChange={(e) => setAlertForm({ ...alertForm, severity: e.target.value })}
            options={[
              { value: 'HIGH', label: 'High Priority (Critical Clinical Alert)' },
              { value: 'MEDIUM', label: 'Medium Priority' },
              { value: 'LOW', label: 'Low Priority (Administrative Alert)' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddAlertOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Alert
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Document Modal */}
      <Dialog
        isOpen={isAddDocOpen}
        onClose={() => setIsAddDocOpen(false)}
        title="Upload Patient Document"
        description="Attach medical reports, ID proofs, or signed consent documents."
      >
        <form onSubmit={handleAddDoc} className="space-y-4">
          <Input
            label="Document Title"
            required
            placeholder="e.g. National ID Card Copy"
            value={docForm.title}
            onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
          />
          <Select
            label="Document Type"
            value={docForm.documentType}
            onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}
            options={[
              { value: 'ID_PROOF', label: 'National ID / Passport' },
              { value: 'INSURANCE_CARD', label: 'Insurance Card' },
              { value: 'MEDICAL_RECORD', label: 'Previous Medical Record' },
              { value: 'CONSENT_FORM', label: 'Signed Consent Form' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddDocOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Document
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Patient Merge Modal */}
      <Dialog
        isOpen={isMergeOpen}
        onClose={() => setIsMergeOpen(false)}
        title="Merge Duplicate Patient Record"
        description="Permanently moves all clinical encounters, appointments, allergies, and alerts into a primary patient record."
      >
        <form onSubmit={handleMerge} className="space-y-4">
          <div className="p-3 bg-warning-bg border border-warning-border rounded-lg text-xs text-warning-text">
            <p className="font-semibold">Irreversible Clinical Merge Action:</p>
            <p className="mt-1">
              This record ({patient.mrn}) will be marked as merged and become read-only. All historical consultations will appear under the target record.
            </p>
          </div>
          <Input
            label="Target Primary Patient MRN"
            required
            placeholder="e.g. MRN-20261005-1234"
            value={mergeForm.targetPatientMrn}
            onChange={(e) => setMergeForm({ ...mergeForm, targetPatientMrn: e.target.value })}
          />
          <Textarea
            label="Merge Justification / Audit Reason"
            required
            value={mergeForm.reason}
            onChange={(e) => setMergeForm({ ...mergeForm, reason: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsMergeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              Confirm Record Merge
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
