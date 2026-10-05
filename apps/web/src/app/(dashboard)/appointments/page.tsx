'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  DataTable,
  Button,
  Input,
  Select,
  Badge,
  Dialog,
  EmptyState,
  ErrorState,
  Skeleton,
  TableSkeletonRows,
} from '@enterprise-hms/ui';
import {
  Calendar,
  Clock,
  UserPlus,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { schedulingApi, patientsApi } from '@/lib/api';

interface AppointmentRecord {
  id: string;
  patientId: string;
  doctorId: string;
  departmentId: string;
  branchId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  type: string;
  status: string;
  reason?: string;
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    mobile: string;
  };
  doctor: {
    id: string;
    specialization?: string;
    user: {
      firstName: string;
      lastName: string;
    };
  };
  department?: {
    name: string;
  };
}

function AppointmentsContent() {
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId');

  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRecord | null>(null);

  // Forms
  const [bookForm, setBookForm] = useState({
    patientMrn: '',
    doctorId: 'doc-default',
    departmentId: 'dept-opd',
    branchId: 'branch-default',
    appointmentDate: new Date().toISOString().slice(0, 10),
    startTime: `${new Date().toISOString().slice(0, 10)}T09:00:00Z`,
    endTime: `${new Date().toISOString().slice(0, 10)}T09:15:00Z`,
    type: 'NEW',
    reason: 'Routine outpatient consultation',
  });

  const [rescheduleDate, setRescheduleDate] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await schedulingApi.getAppointments({
        date: dateFilter || undefined,
        status: statusFilter || undefined,
      });
      setAppointments(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, statusFilter]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      // Resolve patient by MRN
      let patientId = preselectedPatientId;
      if (!patientId && bookForm.patientMrn) {
        const pRes = await patientsApi.list({ q: bookForm.patientMrn });
        const match = (pRes.data || []).find(
          (p: any) => p.mrn.toLowerCase() === bookForm.patientMrn.trim().toLowerCase()
        );
        if (!match) {
          alert(`Patient with MRN "${bookForm.patientMrn}" not found.`);
          return;
        }
        patientId = match.id;
      }

      if (!patientId) {
        alert('Please provide a valid Patient MRN');
        return;
      }

      await schedulingApi.bookAppointment({
        patientId,
        doctorId: bookForm.doctorId,
        departmentId: bookForm.departmentId,
        branchId: bookForm.branchId,
        appointmentDate: bookForm.appointmentDate,
        startTime: bookForm.startTime,
        endTime: bookForm.endTime,
        type: bookForm.type,
        reason: bookForm.reason,
      });

      setIsBookOpen(false);
      loadAppointments();
    } catch (err: any) {
      alert(`Booking failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async (apt: AppointmentRecord) => {
    try {
      const res = await schedulingApi.checkIn(apt.id);
      alert(`Checked in successfully! Queue Token: ${res.data?.queueNumber}`);
      loadAppointments();
    } catch (err: any) {
      alert(`Check-in failed: ${err.message}`);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;
    try {
      setIsSubmitting(true);
      const newStart = `${rescheduleDate}T10:00:00Z`;
      const newEnd = `${rescheduleDate}T10:15:00Z`;
      await schedulingApi.rescheduleAppointment(selectedAppointment.id, {
        newDate: rescheduleDate,
        newStartTime: newStart,
        newEndTime: newEnd,
      });
      setIsRescheduleOpen(false);
      loadAppointments();
    } catch (err: any) {
      alert(`Reschedule failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;
    try {
      setIsSubmitting(true);
      await schedulingApi.cancelAppointment(selectedAppointment.id, cancelReason);
      setIsCancelOpen(false);
      loadAppointments();
    } catch (err: any) {
      alert(`Cancellation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = useMemo<ColumnDef<AppointmentRecord>[]>(
    () => [
      {
        accessorKey: 'appointmentDate',
        header: 'Date & Time',
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-slate-900 tabular-nums">
              {new Date(row.original.appointmentDate).toLocaleDateString()}
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              {new Date(row.original.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ),
      },
      {
        header: 'Patient Details',
        cell: ({ row }) => (
          <div>
            <Link
              href={`/patients/${row.original.patient?.id}`}
              className="font-medium text-slate-900 hover:text-cyan-700 hover:underline"
            >
              {row.original.patient?.firstName} {row.original.patient?.lastName}
            </Link>
            <p className="text-xs text-slate-500 font-mono tabular-nums">
              MRN: {row.original.patient?.mrn}
            </p>
          </div>
        ),
      },
      {
        header: 'Doctor & Department',
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-slate-900">
              Dr. {row.original.doctor?.user?.firstName} {row.original.doctor?.user?.lastName}
            </div>
            <div className="text-xs text-slate-500">
              {row.original.department?.name || 'General OPD'}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => <Badge variant="neutral">{row.original.type}</Badge>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status;
          let v: 'stable' | 'warning' | 'critical' | 'neutral' = 'neutral';
          if (s === 'ARRIVED' || s === 'COMPLETED') v = 'stable';
          if (s === 'SCHEDULED' || s === 'CONFIRMED') v = 'neutral';
          if (s === 'IN_CONSULTATION') v = 'warning';
          if (s === 'CANCELLED' || s === 'NO_SHOW') v = 'critical';
          return <Badge variant={v}>{s}</Badge>;
        },
      },
      {
        id: 'actions',
        header: () => <span className="text-right block">Actions</span>,
        cell: ({ row }) => {
          const apt = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              {apt.status === 'SCHEDULED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleCheckIn(apt)}
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1" />
                  Check In
                </Button>
              )}
              {apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedAppointment(apt);
                      setIsRescheduleOpen(true);
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedAppointment(apt);
                      setIsCancelOpen(true);
                    }}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Appointments & Doctor Schedules
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Book visits, manage slots with overbooking control, and check in patients to the live OPD queue.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/queue">
            <Button variant="outline">
              <Clock className="w-4 h-4 mr-2" />
              Live Queue Board
            </Button>
          </Link>
          <Button variant="primary" onClick={() => setIsBookOpen(true)}>
            <Calendar className="w-4 h-4 mr-2" />
            Book Appointment
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-wrap items-center gap-4">
        <div className="w-48">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            placeholder="Filter Date"
          />
        </div>
        <div className="w-48">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'SCHEDULED', label: 'Scheduled' },
              { value: 'ARRIVED', label: 'Arrived (Checked In)' },
              { value: 'IN_CONSULTATION', label: 'In Consultation' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
          />
        </div>
        {(dateFilter || statusFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFilter('');
              setStatusFilter('');
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Appointments Table */}
      {loading && appointments.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <TableSkeletonRows rows={5} cols={5} />
        </div>
      ) : error ? (
        <ErrorState
          title="Appointments Error"
          message={error}
          onRetry={loadAppointments}
        />
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-slate-400" />}
          title="No Appointments Found"
          description="There are no scheduled patient appointments matching the current filters."
          actionLabel="Book New Appointment"
          onAction={() => setIsBookOpen(true)}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <DataTable
            data={appointments}
            columns={columns}
            searchPlaceholder="Search by patient, doctor, or department..."
            exportFileName="appointments_schedule"
          />
        </div>
      )}

      {/* Book Appointment Modal */}
      <Dialog
        isOpen={isBookOpen}
        onClose={() => setIsBookOpen(false)}
        title="Book Patient Appointment"
        description="Select patient MRN, doctor, and schedule slot with overbooking capacity checks."
      >
        <form onSubmit={handleBook} className="space-y-4">
          <Input
            label="Patient MRN"
            required
            placeholder="e.g. MRN-20261005-0001"
            value={bookForm.patientMrn}
            onChange={(e) => setBookForm({ ...bookForm, patientMrn: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Appointment Date"
              type="date"
              required
              value={bookForm.appointmentDate}
              onChange={(e) => setBookForm({ ...bookForm, appointmentDate: e.target.value })}
            />
            <Select
              label="Visit Type"
              value={bookForm.type}
              onChange={(e) => setBookForm({ ...bookForm, type: e.target.value })}
              options={[
                { value: 'NEW', label: 'New Consultation' },
                { value: 'FOLLOW_UP', label: 'Follow-Up Visit' },
                { value: 'PROCEDURE', label: 'Clinical Procedure' },
                { value: 'WALK_IN', label: 'Walk-In Priority' },
              ]}
            />
          </div>
          <Input
            label="Reason for Visit"
            placeholder="e.g. Hypertension review, persistent cough"
            value={bookForm.reason}
            onChange={(e) => setBookForm({ ...bookForm, reason: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsBookOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Confirm Booking
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Reschedule Modal */}
      <Dialog
        isOpen={isRescheduleOpen}
        onClose={() => setIsRescheduleOpen(false)}
        title="Reschedule Appointment"
        description="Select a new date for this consultation."
      >
        <form onSubmit={handleReschedule} className="space-y-4">
          <Input
            label="New Date"
            type="date"
            required
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsRescheduleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Save Reschedule
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Cancel Modal */}
      <Dialog
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title="Cancel Appointment"
        description="Document reason for cancellation for clinical audit."
      >
        <form onSubmit={handleCancel} className="space-y-4">
          <Input
            label="Cancellation Reason"
            required
            placeholder="e.g. Patient requested cancellation, doctor emergency"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsCancelOpen(false)}>
              Back
            </Button>
            <Button type="submit" variant="destructive" isLoading={isSubmitting}>
              Confirm Cancellation
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <TableSkeletonRows rows={5} cols={5} />
        </div>
      }
    >
      <AppointmentsContent />
    </Suspense>
  );
}
