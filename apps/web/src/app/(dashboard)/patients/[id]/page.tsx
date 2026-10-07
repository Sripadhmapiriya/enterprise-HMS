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
  ToastContainer,
} from '@enterprise-hms/ui';
import type { ToastMessage, ToastVariant } from '@enterprise-hms/ui';
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
  Trash2,
  Download,
  ExternalLink,
  UploadCloud,
  File,
  X,
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
  const [isDoctorSelectOpen, setIsDoctorSelectOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (title: string, description?: string, variant: ToastVariant = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

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

  // Document upload state
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docFilePreview, setDocFilePreview] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docUploadProgress, setDocUploadProgress] = useState<number>(0);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const [docDeleteTarget, setDocDeleteTarget] = useState<any | null>(null);
  const [docDeleting, setDocDeleting] = useState(false);

  const [docForm, setDocForm] = useState({
    title: '',
    documentType: 'ID_PROOF',
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
      showToast('Allergy Recorded', 'Allergy has been documented successfully.', 'success');
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    }
  };

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await patientsApi.addAlert(patientId, alertForm);
      setIsAddAlertOpen(false);
      setAlertForm({ description: '', severity: 'HIGH', alertType: 'CLINICAL' });
      loadPatientData();
      showToast('Alert Added', 'Clinical alert has been logged successfully.', 'success');
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    }
  };

  const handleFileSelect = (file: File | null) => {
    setDocUploadError(null);
    if (!file) {
      setDocFile(null);
      setDocFilePreview(null);
      return;
    }

    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB

    if (!allowedMimes.includes(file.type.toLowerCase()) && !file.name.match(/\.(pdf|jpe?g|png)$/i)) {
      setDocUploadError('Invalid file type. Only PDF, JPG, and PNG files up to 10 MB are permitted.');
      return;
    }

    if (file.size > maxSizeBytes) {
      setDocUploadError(`File exceeds maximum permitted size of 10 MB (selected: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    setDocFile(file);
    if (!docForm.title) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setDocForm((prev) => ({ ...prev, title: nameWithoutExt }));
    }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setDocFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setDocFilePreview(null);
    }
  };

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) {
      setDocUploadError('Please choose or drop a file to upload.');
      return;
    }

    try {
      setDocUploading(true);
      setDocUploadProgress(20);
      setDocUploadError(null);

      // Step 1: Upload multipart file to server
      setDocUploadProgress(50);
      const uploadRes = await patientsApi.uploadDocumentMultipart(docFile);
      setDocUploadProgress(85);

      const uploadedData = uploadRes.data;
      const fileUrl = uploadedData.fileUrl || `/api/v1/platform/files/download/${encodeURIComponent(uploadedData.key)}`;

      // Step 2: Register patient document
      await patientsApi.addDocument(patientId, {
        title: docForm.title.trim(),
        documentType: docForm.documentType,
        fileUrl,
        fileSize: uploadedData.sizeBytes || docFile.size,
        mimeType: uploadedData.mimeType || docFile.type,
      });

      setDocUploadProgress(100);
      setIsAddDocOpen(false);
      setDocFile(null);
      setDocFilePreview(null);
      setDocForm({
        title: '',
        documentType: 'ID_PROOF',
      });
      loadPatientData();
      showToast('Document Uploaded', 'Document was securely uploaded and attached.', 'success');
    } catch (err: any) {
      setDocUploadError(err.message || 'File upload failed');
      showToast('Upload Failed', err.message || 'Could not upload document', 'error');
    } finally {
      setDocUploading(false);
      setDocUploadProgress(0);
    }
  };

  const handleConfirmRemoveDoc = async () => {
    if (!docDeleteTarget) return;
    try {
      setDocDeleting(true);
      await patientsApi.removeDocument(patientId, docDeleteTarget.id);
      showToast('Document Removed', `"${docDeleteTarget.title}" was soft-deleted and logged to the audit log.`, 'success');
      setDocDeleteTarget(null);
      loadPatientData();
    } catch (err: any) {
      showToast('Deletion Failed', err.message || 'Could not remove document', 'error');
    } finally {
      setDocDeleting(false);
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
    if (!selectedDoctorId) {
      showToast('Validation Error', 'Please select a doctor to start the consultation.', 'error');
      return;
    }

    try {
      setIsStartingEncounter(true);
      const res = await opdApi.startEncounter({
        patientId: patient.id,
        doctorId: selectedDoctorId,
        branchId: patient.branchId || 'branch-default',
        departmentId: patient.departmentId || 'dept-opd',
        type: 'OPD',
      });

      if (res.data?.id) {
        setIsDoctorSelectOpen(false);
        showToast('Success', 'Consultation started', 'success');
        router.push(`/opd/consultation/${res.data.id}`);
      }
    } catch (err: any) {
      showToast('Failed to start consultation', err.message, 'error');
    } finally {
      setIsStartingEncounter(false);
    }
  };

  const MOCK_DOCTORS = [
    { value: 'doc-123', label: 'Dr. Sarah Jenkins (Cardiology)' },
    { value: 'doc-456', label: 'Dr. Michael Chen (General Medicine)' },
    { value: 'doc-789', label: 'Dr. Emily Patel (Pediatrics)' },
  ];

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
    allergyStatus: patient.allergyStatus,
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
        onConfirmNKDA={() => {
          if (confirm('Are you sure you want to confirm No Known Drug Allergies (NKDA) for this patient?')) {
            patientsApi.confirmNKDA(patientId).then(() => {
              loadPatientData();
            });
          }
        }}
      />

      {/* Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface border border-border rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => setIsDoctorSelectOpen(true)}
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
            variant="ghost"
            size="sm"
            onClick={() => setIsAddAllergyOpen(true)}
            aria-label="Add Patient Allergy"
            title="Document a new allergy for this patient"
            className="bg-warning/15 text-warning-text hover:bg-warning/25 hover:text-warning-text border border-transparent hover:border-warning/30 font-medium"
          >
            <ShieldAlert className="w-4 h-4 mr-1 text-warning" aria-hidden="true" />
            Allergy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAddAlertOpen(true)}
            aria-label="Add Clinical Alert"
            title="Add a critical clinical alert"
            className="bg-critical/15 text-critical-text hover:bg-critical/25 hover:text-critical-text border border-transparent hover:border-critical/30 font-medium"
          >
            <AlertTriangle className="w-4 h-4 mr-1 text-critical" aria-hidden="true" />
            Alert
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAddDocOpen(true)}
            aria-label="Upload Document"
            title="Upload a new patient document"
            className="bg-info/15 text-info-text hover:bg-info/25 hover:text-info-text border border-transparent hover:border-info/30 font-medium"
          >
            <FilePlus className="w-4 h-4 mr-1 text-info" aria-hidden="true" />
            Document
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
              <div>
                <h4 className="font-semibold text-sm text-text">Patient Documents & Consent Records</h4>
                <p className="text-xs text-text-muted">Attached records, identification proofs, and clinical files with verifiable audit trail.</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setIsAddDocOpen(true)}>
                <FilePlus className="w-4 h-4 mr-1.5" />
                Upload Document
              </Button>
            </div>

            {(!patient.documents || patient.documents.length === 0) ? (
              <EmptyState
                icon={<FileText className="w-6 h-6" />}
                title="No Documents Uploaded"
                description="Securely upload identification proofs, prior diagnostic reports, lab sheets, or consent forms."
                actionLabel="Upload First Document"
                onAction={() => setIsAddDocOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patient.documents.map((doc: any) => {
                  const formatBytes = (bytes?: number) => {
                    if (!bytes) return 'Unknown size';
                    if (bytes < 1024) return `${bytes} B`;
                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                  };

                  const isImage = doc.mimeType?.startsWith('image/') || doc.fileUrl?.match(/\.(jpe?g|png)$/i);
                  const isPdf = doc.mimeType === 'application/pdf' || doc.fileUrl?.match(/\.pdf$/i);

                  return (
                    <div
                      key={doc.id}
                      className="p-4 border border-border rounded-xl bg-surface hover:border-border-strong transition-all flex flex-col justify-between space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-primary-bg/20 text-primary flex items-center justify-center shrink-0">
                            {isPdf ? (
                              <FileText className="w-5 h-5 text-critical" />
                            ) : isImage ? (
                              <File className="w-5 h-5 text-accent" />
                            ) : (
                              <FileText className="w-5 h-5 text-info-text" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-semibold text-sm text-text truncate" title={doc.title}>
                              {doc.title}
                            </h5>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                              <Badge variant="neutral" size="sm">
                                {doc.documentType?.replace(/_/g, ' ') || 'DOCUMENT'}
                              </Badge>
                              <span>•</span>
                              <span>{formatBytes(doc.fileSize)}</span>
                            </div>
                            <p className="text-[11px] text-text-muted mt-1">
                              Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                              {doc.uploadedBy && ` by ${doc.uploadedBy.firstName || ''} ${doc.uploadedBy.lastName || ''}`.trim()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View
                          </a>
                          <span className="text-text-muted">•</span>
                          <a
                            href={doc.fileUrl}
                            download
                            className="inline-flex items-center gap-1 text-text-muted hover:text-text font-medium"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </a>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-critical hover:bg-critical/10 hover:text-critical h-7 px-2"
                          onClick={() => setDocDeleteTarget(doc)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
        onClose={() => {
          if (!docUploading) {
            setIsAddDocOpen(false);
            setDocFile(null);
            setDocFilePreview(null);
            setDocUploadError(null);
          }
        }}
        title="Upload Patient Document"
        description="Attach medical diagnostic records, identification proofs, or signed consent agreements."
      >
        <form onSubmit={handleAddDoc} className="space-y-4">
          <Input
            label="Document Title"
            required
            placeholder="e.g. Brain MRI Report, National ID Copy"
            value={docForm.title}
            onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
            disabled={docUploading}
          />
          <Select
            label="Document Type"
            value={docForm.documentType}
            onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}
            disabled={docUploading}
            options={[
              { value: 'ID_PROOF', label: 'National ID / Passport / Driver License' },
              { value: 'INSURANCE_CARD', label: 'Insurance Card / Policy Document' },
              { value: 'MEDICAL_RECORD', label: 'External Diagnostic / Clinical Record' },
              { value: 'CONSENT_FORM', label: 'Signed Consent Form' },
            ]}
          />

          {/* Drag & Drop File Zone */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text">
              File Attachment <span className="text-critical">*</span>
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelect(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                docFile
                  ? 'border-primary/50 bg-primary-bg/10'
                  : 'border-border hover:border-primary/40 bg-surface-subtle'
              }`}
            >
              {!docFile ? (
                <div className="space-y-2 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted">
                    <UploadCloud className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <label
                      htmlFor="patient-doc-file-input"
                      className="cursor-pointer text-sm font-semibold text-primary hover:underline"
                    >
                      Choose a file
                    </label>
                    <span className="text-sm text-text-muted"> or drag & drop here</span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Supported formats: PDF, JPG, PNG (Max 10 MB). Scanned for integrity.
                  </p>
                  <input
                    id="patient-doc-file-input"
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                    disabled={docUploading}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    {docFilePreview ? (
                      <img
                        src={docFilePreview}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-lg border border-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted shrink-0">
                        <FileText className="w-6 h-6 text-critical" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text truncate">{docFile.name}</p>
                      <p className="text-[11px] text-text-muted">
                        {(docFile.size / 1024).toFixed(1)} KB • {docFile.type || 'Document'}
                      </p>
                    </div>
                  </div>
                  {!docUploading && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFileSelect(null)}
                      className="text-text-muted hover:text-critical h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {docUploading && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-text-muted">
                <span>Uploading & verifying file...</span>
                <span>{docUploadProgress}%</span>
              </div>
              <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${docUploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {docUploadError && (
            <div className="p-3 bg-critical-bg border border-critical-border rounded-lg text-xs text-critical-text flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-critical shrink-0 mt-0.5" />
              <span>{docUploadError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={docUploading}
              onClick={() => {
                setIsAddDocOpen(false);
                setDocFile(null);
                setDocFilePreview(null);
                setDocUploadError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!docFile || docUploading || !docForm.title.trim()}
              isLoading={docUploading}
            >
              Upload & Attach
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Remove Document Confirmation Modal */}
      <Dialog
        isOpen={Boolean(docDeleteTarget)}
        onClose={() => !docDeleting && setDocDeleteTarget(null)}
        title="Remove Patient Document"
        description="Soft-deletes this document record and creates a permanent entry in the compliance audit log."
      >
        <div className="space-y-4">
          <div className="p-3 bg-critical-bg border border-critical-border rounded-lg text-xs text-critical-text">
            <p className="font-semibold">Confirm Document Soft-Deletion:</p>
            <p className="mt-1">
              Are you sure you want to remove &quot;{docDeleteTarget?.title}&quot;? The file will be archived and hidden from clinical views.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={docDeleting}
              onClick={() => setDocDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={docDeleting}
              onClick={handleConfirmRemoveDoc}
            >
              Remove Document
            </Button>
          </div>
        </div>
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

      {/* Select Doctor Modal */}
      <Dialog
        isOpen={isDoctorSelectOpen}
        onClose={() => setIsDoctorSelectOpen(false)}
        title="Start OPD Consultation"
        description="Select the attending physician for this encounter."
      >
        <div className="space-y-4">
          <Select
            label="Attending Doctor"
            options={MOCK_DOCTORS}
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsDoctorSelectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleStartConsultation}
              isLoading={isStartingEncounter}
              disabled={!selectedDoctorId}
            >
              Start Encounter
            </Button>
          </div>
        </div>
      </Dialog>

      {toasts.length > 0 && (
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        />
      )}
    </div>
  );
}
