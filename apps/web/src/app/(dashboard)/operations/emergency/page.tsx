'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Badge,
  Dialog,
  Input,
  Select,
  Textarea,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@enterprise-hms/ui';
import {
  Activity,
  AlertOctagon,
  Clock,
  UserPlus,
  ShieldAlert,
  Flame,
  User,
  HeartPulse,
  RefreshCw,
} from 'lucide-react';
import { emergencyApi } from '@/lib/api';

interface ErBoardPatient {
  encounterId: string;
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    gender: string;
    allergies?: Array<{ allergen: string }>;
    alerts?: Array<{ description: string; severity: string }>;
  };
  priority: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE';
  priorityRank: number;
  chiefComplaint: string;
  consciousness: string;
  painScore: number | null;
  arrivalMode: string;
  arrivalTime: string;
  elapsedMinutes: number;
  attendingDoctor: string | null;
  latestVitals?: {
    bloodPressure?: string;
    pulseRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
  } | null;
  status: string;
}

export default function EmergencyDashboard() {
  const [boardData, setBoardData] = useState<{
    patients: ErBoardPatient[];
    counts: { total: number; red: number; orange: number; yellow: number; green: number; blue: number };
  }>({
    patients: [],
    counts: { total: 0, red: 0, orange: 0, yellow: 0, green: 0, blue: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fast-register Modal
  const [isFastRegOpen, setIsFastRegOpen] = useState(false);
  const [isSubmittingFastReg, setIsSubmittingFastReg] = useState(false);
  const [fastRegForm, setFastRegForm] = useState({
    firstName: 'Unknown',
    lastName: '(Trauma)',
    gender: 'UNKNOWN',
    estimatedAge: '',
    arrivalMode: 'AMBULANCE',
    chiefComplaint: '',
    isMlc: false,
    policeStation: '',
  });

  // Triage Modal
  const [isTriageOpen, setIsTriageOpen] = useState(false);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [isSubmittingTriage, setIsSubmittingTriage] = useState(false);
  const [triageForm, setTriageForm] = useState({
    priority: 'YELLOW' as 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE',
    chiefComplaint: '',
    consciousness: 'ALERT' as 'ALERT' | 'VERBAL' | 'PAIN' | 'UNRESPONSIVE',
    painScore: '0',
    systolic: '',
    diastolic: '',
    heartRate: '',
    oxygenSaturation: '',
    temperature: '',
    isMlc: false,
    policeStation: '',
  });

  const fetchBoard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await emergencyApi.getBoard();
      setBoardData(res.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load emergency tracking board');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
    const interval = setInterval(fetchBoard, 15000); // Polling every 15s for live board
    return () => clearInterval(interval);
  }, [fetchBoard]);

  const handleFastRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fastRegForm.chiefComplaint) return;
    try {
      setIsSubmittingFastReg(true);
      await emergencyApi.fastRegister({
        ...fastRegForm,
        estimatedAge: fastRegForm.estimatedAge ? parseInt(fastRegForm.estimatedAge, 10) : undefined,
      });
      setIsFastRegOpen(false);
      setFastRegForm({
        firstName: 'Unknown',
        lastName: '(Trauma)',
        gender: 'UNKNOWN',
        estimatedAge: '',
        arrivalMode: 'AMBULANCE',
        chiefComplaint: '',
        isMlc: false,
        policeStation: '',
      });
      await fetchBoard();
    } catch (err: any) {
      alert(err?.message || 'Fast registration failed');
    } finally {
      setIsSubmittingFastReg(false);
    }
  };

  const handleTriageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEncounterId) return;
    try {
      setIsSubmittingTriage(true);
      await emergencyApi.triage({
        encounterId: selectedEncounterId,
        priority: triageForm.priority,
        chiefComplaint: triageForm.chiefComplaint,
        consciousness: triageForm.consciousness,
        painScore: parseInt(triageForm.painScore, 10) || 0,
        vitals: {
          systolic: triageForm.systolic ? parseFloat(triageForm.systolic) : undefined,
          diastolic: triageForm.diastolic ? parseFloat(triageForm.diastolic) : undefined,
          heartRate: triageForm.heartRate ? parseFloat(triageForm.heartRate) : undefined,
          oxygenSaturation: triageForm.oxygenSaturation ? parseFloat(triageForm.oxygenSaturation) : undefined,
          temperature: triageForm.temperature ? parseFloat(triageForm.temperature) : undefined,
        },
        isMlc: triageForm.isMlc,
        policeStation: triageForm.policeStation || undefined,
      });
      setIsTriageOpen(false);
      await fetchBoard();
    } catch (err: any) {
      alert(err?.message || 'Triage submission failed');
    } finally {
      setIsSubmittingTriage(false);
    }
  };

  const getPriorityBadgeVariant = (priority: string): 'critical' | 'warning' | 'stable' | 'info' | 'neutral' => {
    switch (priority) {
      case 'RED':
        return 'critical';
      case 'ORANGE':
        return 'warning';
      case 'YELLOW':
        return 'warning';
      case 'GREEN':
        return 'stable';
      case 'BLUE':
        return 'info';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Activity className="w-6 h-6 text-critical" />
            <h1 className="text-2xl font-bold text-text tracking-tight">Emergency Department (ER)</h1>
          </div>
          <p className="text-text-muted mt-1">Live ESI Triage tracking board, trauma intake, and resuscitation management.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="secondary" onClick={() => fetchBoard()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ?'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="destructive" onClick={() => setIsFastRegOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            Fast-Track Trauma Intake
          </Button>
        </div>
      </div>

      {/* Triage Acuity Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-critical-bg border border-critical-border p-4 rounded-xl">
          <div className="flex items-center space-x-1.5 text-critical-text text-xs font-semibold uppercase">
            <Flame className="w-4 h-4" />
            <span>Level 1: Red</span>
          </div>
          <div className="text-2xl font-bold text-critical-text mt-1 tabular-nums">
            {boardData.counts.red}
          </div>
          <span className="text-xs text-critical">Immediate / Resus</span>
        </div>

        <div className="bg-warning-bg border border-warning-border p-4 rounded-xl">
          <div className="flex items-center space-x-1.5 text-warning-text text-xs font-semibold uppercase">
            <AlertOctagon className="w-4 h-4" />
            <span>Level 2: Orange</span>
          </div>
          <div className="text-2xl font-bold text-warning-text mt-1 tabular-nums">
            {boardData.counts.orange}
          </div>
          <span className="text-xs text-warning">Emergent (&lt;15m)</span>
        </div>

        <div className="bg-warning-bg border border-warning-border p-4 rounded-xl">
          <div className="flex items-center space-x-1.5 text-warning-text text-xs font-semibold uppercase">
            <Clock className="w-4 h-4" />
            <span>Level 3: Yellow</span>
          </div>
          <div className="text-2xl font-bold text-warning-text mt-1 tabular-nums">
            {boardData.counts.yellow}
          </div>
          <span className="text-xs text-warning">Urgent (&lt;60m)</span>
        </div>

        <div className="bg-stable-bg border border-stable-border p-4 rounded-xl">
          <div className="flex items-center space-x-1.5 text-stable-text text-xs font-semibold uppercase">
            <HeartPulse className="w-4 h-4" />
            <span>Level 4: Green</span>
          </div>
          <div className="text-2xl font-bold text-stable-text mt-1 tabular-nums">
            {boardData.counts.green}
          </div>
          <span className="text-xs text-stable">Less Urgent</span>
        </div>

        <div className="bg-info-bg border border-info-border p-4 rounded-xl">
          <div className="flex items-center space-x-1.5 text-info-text text-xs font-semibold uppercase">
            <User className="w-4 h-4" />
            <span>Level 5: Blue</span>
          </div>
          <div className="text-2xl font-bold text-info-text mt-1 tabular-nums">
            {boardData.counts.blue}
          </div>
          <span className="text-xs text-info">Non-Urgent</span>
        </div>

        <div className="bg-surface-subtle border border-border p-4 rounded-xl">
          <div className="text-text-muted text-xs font-semibold uppercase">Total Active</div>
          <div className="text-2xl font-bold text-text mt-1 tabular-nums">
            {boardData.counts.total}
          </div>
          <span className="text-xs text-text-muted">In ER</span>
        </div>
      </div>

      {/* Main Board Content */}
      {loading && boardData.patients.length === 0 ? (
        <div className="space-y-3 bg-surface p-6 rounded-xl border border-border shadow-sm">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Failed to load emergency board" message={error} onRetry={fetchBoard} />
      ) : boardData.patients.length === 0 ? (
        <EmptyState
          title="No Active Emergency Patients"
          description="The Emergency Department tracking board currently has no waiting or admitted patients."
          actionLabel="Intake Trauma Walk-in"
          onAction={() => setIsFastRegOpen(true)}
        />
      ) : (
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-surface-subtle/70 flex justify-between items-center">
            <h3 className="font-semibold text-text flex items-center">
              <Activity className="w-4 h-4 mr-2 text-critical" />
              Active Emergency Triage Tracking Board
            </h3>
            <span className="text-xs text-text-muted">Sorted by Acuity (ESI) and Wait Time</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                <tr>
                  <th className="px-5 py-3">Acuity</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Chief Complaint</th>
                  <th className="px-5 py-3">Vitals / AVPU</th>
                  <th className="px-5 py-3">Elapsed Time</th>
                  <th className="px-5 py-3">Attending</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {boardData.patients.map((p) => (
                  <tr key={p.encounterId} className="hover:bg-surface-subtle/60 transition-colors">
                    {/* Acuity Badge */}
                    <td className="px-5 py-3">
                      <Badge variant={getPriorityBadgeVariant(p.priority)} size="md">
                        {p.priority} (ESI {p.priorityRank})
                      </Badge>
                    </td>

                    {/* Patient MRN and Name */}
                    <td className="px-5 py-3">
                      <div className="font-semibold text-text">
                        {p.patient.firstName} {p.patient.lastName}
                      </div>
                      <div className="text-xs text-text-muted font-mono">
                        {p.patient.mrn} &bull; {p.patient.gender}
                      </div>
                      {p.patient.alerts && p.patient.alerts.length > 0 && (
                        <div className="mt-1 flex items-center space-x-1 text-xs text-critical font-medium">
                          <ShieldAlert className="w-3.5 h-3.5 inline" />
                          <span>MLC / Alert</span>
                        </div>
                      )}
                    </td>

                    {/* Chief Complaint */}
                    <td className="px-5 py-3 max-w-[220px]">
                      <div className="font-medium text-text line-clamp-2">
                        {p.chiefComplaint}
                      </div>
                      <span className="text-xs text-text-muted capitalize">
                        Via {p.arrivalMode.replace('_', ' ').toLowerCase()}
                      </span>
                    </td>

                    {/* Vitals */}
                    <td className="px-5 py-3">
                      <div className="text-xs font-mono">
                        {p.latestVitals?.bloodPressure && <span>BP: {p.latestVitals.bloodPressure} </span>}
                        {p.latestVitals?.pulseRate && <span>HR: {p.latestVitals.pulseRate} </span>}
                        {p.latestVitals?.oxygenSaturation && <span>SpO2: {p.latestVitals.oxygenSaturation}%</span>}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        AVPU: <span className="font-medium text-text">{p.consciousness}</span>
                        {p.painScore !== null && <span> &bull; Pain: {p.painScore}/10</span>}
                      </div>
                    </td>

                    {/* Elapsed Time */}
                    <td className="px-5 py-3">
                      <div className="flex items-center text-text font-mono text-sm">
                        <Clock className="w-3.5 h-3.5 mr-1 text-text-muted" />
                        <span className="font-bold">{p.elapsedMinutes}</span>m
                      </div>
                      <span className="text-xs text-text-muted">
                        {new Date(p.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Attending Doctor */}
                    <td className="px-5 py-3 text-text">
                      {p.attendingDoctor || <span className="text-text-muted italic">Unassigned</span>}
                    </td>

                    {/* Action buttons */}
                    <td className="px-5 py-3 text-right space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedEncounterId(p.encounterId);
                          setTriageForm((prev) => ({
                            ...prev,
                            priority: p.priority,
                            chiefComplaint: p.chiefComplaint,
                            consciousness: p.consciousness as any,
                            painScore: p.painScore ? String(p.painScore) : '0',
                          }));
                          setIsTriageOpen(true);
                        }}
                      >
                        Update Triage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fast-Track Trauma Intake Modal */}
      <Dialog
        isOpen={isFastRegOpen}
        onClose={() => setIsFastRegOpen(false)}
        title="Fast-Track Emergency Intake"
      >
        <form onSubmit={handleFastRegister} className="space-y-4">
          <p className="text-xs text-text-muted">
            Rapid intake for trauma, ambulance, and unidentified walk-in patients. An emergency MRN will be auto-generated.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              value={fastRegForm.firstName}
              onChange={(e) => setFastRegForm({ ...fastRegForm, firstName: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={fastRegForm.lastName}
              onChange={(e) => setFastRegForm({ ...fastRegForm, lastName: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Gender"
              value={fastRegForm.gender}
              onChange={(e) => setFastRegForm({ ...fastRegForm, gender: e.target.value })}
              options={[
                { value: 'UNKNOWN', label: 'Unknown' },
                { value: 'MALE', label: 'Male' },
                { value: 'FEMALE', label: 'Female' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
            <Input
              label="Estimated Age"
              type="number"
              placeholder="e.g. 35"
              value={fastRegForm.estimatedAge}
              onChange={(e) => setFastRegForm({ ...fastRegForm, estimatedAge: e.target.value })}
            />
            <Select
              label="Arrival Mode"
              value={fastRegForm.arrivalMode}
              onChange={(e) => setFastRegForm({ ...fastRegForm, arrivalMode: e.target.value })}
              options={[
                { value: 'AMBULANCE', label: 'Ambulance' },
                { value: 'WALK_IN', label: 'Walk-in' },
                { value: 'WHEELCHAIR', label: 'Wheelchair' },
              ]}
            />
          </div>

          <Textarea
            label="Chief Complaint / Trauma Assessment"
            placeholder="e.g., Road traffic accident with severe head injury and active bleeding..."
            value={fastRegForm.chiefComplaint}
            onChange={(e) => setFastRegForm({ ...fastRegForm, chiefComplaint: e.target.value })}
            required
            rows={3}
          />

          <div className="border border-border p-3 rounded-lg bg-surface-subtle space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isMlc"
                checked={fastRegForm.isMlc}
                onChange={(e) => setFastRegForm({ ...fastRegForm, isMlc: e.target.checked })}
                className="rounded border-border text-critical focus:ring-critical"
              />
              <label htmlFor="isMlc" className="text-sm font-medium text-text">
                Medico-Legal Case (MLC)
              </label>
            </div>

            {fastRegForm.isMlc && (
              <Input
                label="Police Station Jurisdiction"
                placeholder="e.g., Central Police Station"
                value={fastRegForm.policeStation}
                onChange={(e) => setFastRegForm({ ...fastRegForm, policeStation: e.target.value })}
              />
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-border">
            <Button variant="secondary" type="button" onClick={() => setIsFastRegOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" type="submit" disabled={isSubmittingFastReg}>
              {isSubmittingFastReg ? 'Registering...' : 'Complete Intake'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Triage Modal */}
      <Dialog
        isOpen={isTriageOpen}
        onClose={() => setIsTriageOpen(false)}
        title="Emergency Triage Assessment"
      >
        <form onSubmit={handleTriageSubmit} className="space-y-4">
          <Select
            label="ESI Acuity Priority"
            value={triageForm.priority}
            onChange={(e) => setTriageForm({ ...triageForm, priority: e.target.value as any })}
            options={[
              { value: 'RED', label: 'Level 1: RED (Immediate Resuscitation)' },
              { value: 'ORANGE', label: 'Level 2: ORANGE (Emergent - <15 mins)' },
              { value: 'YELLOW', label: 'Level 3: YELLOW (Urgent - <60 mins)' },
              { value: 'GREEN', label: 'Level 4: GREEN (Less Urgent)' },
              { value: 'BLUE', label: 'Level 5: BLUE (Non-Urgent)' },
            ]}
          />

          <Textarea
            label="Clinical Complaint"
            value={triageForm.chiefComplaint}
            onChange={(e) => setTriageForm({ ...triageForm, chiefComplaint: e.target.value })}
            required
            rows={2}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Consciousness (AVPU)"
              value={triageForm.consciousness}
              onChange={(e) => setTriageForm({ ...triageForm, consciousness: e.target.value as any })}
              options={[
                { value: 'ALERT', label: 'Alert' },
                { value: 'VERBAL', label: 'Responds to Voice' },
                { value: 'PAIN', label: 'Responds to Pain' },
                { value: 'UNRESPONSIVE', label: 'Unresponsive' },
              ]}
            />
            <Input
              label="Pain Score (0-10)"
              type="number"
              min="0"
              max="10"
              value={triageForm.painScore}
              onChange={(e) => setTriageForm({ ...triageForm, painScore: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Systolic BP"
              placeholder="120"
              value={triageForm.systolic}
              onChange={(e) => setTriageForm({ ...triageForm, systolic: e.target.value })}
            />
            <Input
              label="Diastolic BP"
              placeholder="80"
              value={triageForm.diastolic}
              onChange={(e) => setTriageForm({ ...triageForm, diastolic: e.target.value })}
            />
            <Input
              label="Heart Rate"
              placeholder="72 bpm"
              value={triageForm.heartRate}
              onChange={(e) => setTriageForm({ ...triageForm, heartRate: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="SpO2 (%)"
              placeholder="98%"
              value={triageForm.oxygenSaturation}
              onChange={(e) => setTriageForm({ ...triageForm, oxygenSaturation: e.target.value })}
            />
            <Input
              label="Temp (°C)"
              placeholder="37.0"
              value={triageForm.temperature}
              onChange={(e) => setTriageForm({ ...triageForm, temperature: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-border">
            <Button variant="secondary" type="button" onClick={() => setIsTriageOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmittingTriage}>
              {isSubmittingTriage ? 'Saving Triage...' : 'Save Triage & Emit Charges'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
