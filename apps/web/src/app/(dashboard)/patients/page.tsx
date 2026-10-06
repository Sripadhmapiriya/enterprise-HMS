'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  UserPlus,
  Search,
  Download,
  AlertTriangle,
  Eye,
  Calendar,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { patientsApi } from '@/lib/api';

interface PatientRecord {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  mobile: string;
  email?: string;
  bloodGroup?: string;
  status: string;
  allergies?: Array<{ allergen: string }>;
  alerts?: Array<{ description: string; severity: string }>;
  createdAt: string;
}

export default function PatientsDirectoryPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Registration Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regMode, setRegMode] = useState<'quick' | 'full'>('quick');

  const [formData, setFormData] = useState({
    hospitalId: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '1990-01-01',
    gender: 'FEMALE',
    mobile: '',
    email: '',
    bloodGroup: 'O_POSITIVE',
    address: '',
    city: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyRelationship: 'SPOUSE',
  });

  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Fetch patients
  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await patientsApi.list({ q: searchQuery });
      setPatients(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load patients directory');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // Duplicate detection debounced check
  useEffect(() => {
    if (!formData.firstName && !formData.lastName && !formData.mobile) {
      setDuplicates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingDuplicates(true);
        const res = await patientsApi.checkDuplicates({
          firstName: formData.firstName,
          lastName: formData.lastName,
          mobile: formData.mobile,
          dateOfBirth: formData.dateOfBirth,
        });
        setDuplicates(res.data || []);
      } catch (err) {
        // Non-blocking
      } finally {
        setCheckingDuplicates(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.firstName, formData.lastName, formData.mobile, formData.dateOfBirth]);

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload: any = {
        hospitalId: formData.hospitalId || 'default-hospital',
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        mobile: formData.mobile,
        email: formData.email || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
      };

      if (formData.emergencyContactName && formData.emergencyContactPhone) {
        payload.emergencyContact = {
          name: formData.emergencyContactName,
          phone: formData.emergencyContactPhone,
          relationship: formData.emergencyRelationship,
        };
      }

      const res = await patientsApi.create(payload);
      setIsRegisterOpen(false);
      setFormData({
        hospitalId: '',
        firstName: '',
        lastName: '',
        dateOfBirth: '1990-01-01',
        gender: 'FEMALE',
        mobile: '',
        email: '',
        bloodGroup: 'O_POSITIVE',
        address: '',
        city: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyRelationship: 'SPOUSE',
      });
      setDuplicates([]);
      loadPatients();
      if (res.data?.id) {
        router.push('/patients/' + res.data.id);
      }
    } catch (err: any) {
      alert('Registration failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = useMemo<ColumnDef<PatientRecord>[]>(
    () => [
      {
        accessorKey: 'mrn',
        header: 'MRN',
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold text-info-text tabular-nums">
            {row.original.mrn}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Patient Name',
        cell: ({ row }) => (
          <div>
            <Link
              href={'/patients/' + row.original.id}
              className="font-medium text-text hover:text-info-text hover:underline"
            >
              {row.original.firstName} {row.original.lastName}
            </Link>
            {row.original.email && (
              <p className="text-xs text-text-muted">{row.original.email}</p>
            )}
          </div>
        ),
      },
      {
        header: 'Age / Gender',
        cell: ({ row }) => {
          const now = new Date();
          const dob = new Date(row.original.dateOfBirth);
          const age = now.getFullYear() - dob.getFullYear();
          return (
            <span className="text-sm text-text tabular-nums">
              {age}y / {row.original.gender.charAt(0).toUpperCase()}
            </span>
          );
        },
      },
      {
        accessorKey: 'mobile',
        header: 'Mobile Phone',
        cell: ({ row }) => (
          <span className="text-sm font-mono tabular-nums text-text">
            {row.original.mobile}
          </span>
        ),
      },
      {
        accessorKey: 'bloodGroup',
        header: 'Blood Group',
        cell: ({ row }) =>
          row.original.bloodGroup ? (
            <Badge variant="neutral">{row.original.bloodGroup.replace('_', ' ')}</Badge>
          ) : (
            <span className="text-xs text-text-muted">Not Recorded</span>
          ),
      },
      {
        header: 'Alerts & Allergies',
        cell: ({ row }) => {
          const alertCount = row.original.alerts?.length || 0;
          const allergyCount = row.original.allergies?.length || 0;

          if (alertCount === 0 && allergyCount === 0) {
            return <span className="text-xs text-text-muted">None</span>;
          }

          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              {alertCount > 0 && (
                <Badge variant="critical">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {alertCount} Alert{alertCount > 1 ? 's' : ''}
                </Badge>
              )}
              {allergyCount > 0 && (
                <Badge variant="warning">
                  {allergyCount} Allergy{allergyCount > 1 ? 'ies' : ''}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'ACTIVE' ? 'stable' : 'neutral'}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="text-right block">Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Link href={'/patients/' + row.original.id}>
              <Button variant="outline" size="sm">
                <Eye className="w-3.5 h-3.5 mr-1" />
                Patient 360
              </Button>
            </Link>
            <Link href={'/appointments?patientId=' + row.original.id}>
              <Button variant="ghost" size="sm">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                Book
              </Button>
            </Link>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Master Patient Index
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Search, register, and manage patient health records across hospital branches.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => setIsRegisterOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Register Patient
          </Button>
        </div>
      </div>

      {/* Directory Table */}
      {loading && patients.length === 0 ? (
        <div className="bg-surface p-6 rounded-xl border border-border">
          <TableSkeletonRows rows={5} cols={5} />
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to Load Directory"
          message={error}
          onRetry={loadPatients}
        />
      ) : patients.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8 text-text-muted" />}
          title="No Patients Registered"
          description="Register a new patient to initialize their medical record number and start clinical encounters."
          actionLabel="Register First Patient"
          onAction={() => setIsRegisterOpen(true)}
        />
      ) : (
        <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
          <DataTable
            data={patients}
            columns={columns}
            searchPlaceholder="Search patients by name, MRN, mobile, email..."
            exportFileName="patients_directory"
          />
        </div>
      )}

      {/* Registration Modal */}
      <Dialog
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register New Patient"
        description="Quick or comprehensive patient intake with automated MRN generation and duplicate checks."
        maxWidth="2xl"
      >
        <form onSubmit={handleCreatePatient} className="space-y-5">
          {/* Registration Mode Selector */}
          <div className="flex items-center gap-4 p-1.5 bg-surface-subtle rounded-lg">
            <button
              type="button"
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${ regMode ==='quick'
                  ? 'bg-surface text-info-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
              onClick={() => setRegMode('quick')}
            >
              Quick Intake (Walk-in / Emergency)
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${ regMode ==='full'
                  ? 'bg-surface text-info-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
              onClick={() => setRegMode('full')}
            >
              Full Registration (Demographics & Emergency)
            </button>
          </div>

          {/* Duplicate Detection Alert */}
          {duplicates.length > 0 && (
            <div className="p-3 bg-warning-bg border border-warning-border rounded-lg flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="text-xs text-warning-text">
                <span className="font-semibold">Possible Duplicate Record Detected:</span>
                <p className="mt-0.5">
                  Found {duplicates.length} existing record(s) matching this name or mobile:
                </p>
                <div className="mt-1 space-y-1">
                  {duplicates.map((d: any) => (
                    <div key={d.id} className="font-mono">
                      • {d.firstName} {d.lastName} ({d.mrn}) — Tel: {d.mobile}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name"
              required
              placeholder="e.g. Eleanor"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
            <Input
              label="Last Name"
              required
              placeholder="e.g. Vance"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Date of Birth"
              type="date"
              required
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
            />
            <Select
              label="Gender"
              required
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              options={[
                { value: 'FEMALE', label: 'Female' },
                { value: 'MALE', label: 'Male' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
            <Select
              label="Blood Group"
              value={formData.bloodGroup}
              onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
              options={[
                { value: 'A_POSITIVE', label: 'A+' },
                { value: 'A_NEGATIVE', label: 'A-' },
                { value: 'B_POSITIVE', label: 'B+' },
                { value: 'B_NEGATIVE', label: 'B-' },
                { value: 'O_POSITIVE', label: 'O+' },
                { value: 'O_NEGATIVE', label: 'O-' },
                { value: 'AB_POSITIVE', label: 'AB+' },
                { value: 'AB_NEGATIVE', label: 'AB-' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Mobile Phone"
              required
              placeholder="+1-555-0199"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="patient@example.org"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          {regMode === 'full' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                Address & Emergency Contact
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Street Address"
                  placeholder="123 Health Ave"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
                <Input
                  label="City"
                  placeholder="Metro City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Emergency Contact Name"
                  placeholder="Contact Name"
                  value={formData.emergencyContactName}
                  onChange={(e) =>
                    setFormData({ ...formData, emergencyContactName: e.target.value })
                  }
                />
                <Input
                  label="Emergency Phone"
                  placeholder="+1-555-0188"
                  value={formData.emergencyContactPhone}
                  onChange={(e) =>
                    setFormData({ ...formData, emergencyContactPhone: e.target.value })
                  }
                />
                <Select
                  label="Relationship"
                  value={formData.emergencyRelationship}
                  onChange={(e) =>
                    setFormData({ ...formData, emergencyRelationship: e.target.value })
                  }
                  options={[
                    { value: 'SPOUSE', label: 'Spouse' },
                    { value: 'PARENT', label: 'Parent' },
                    { value: 'CHILD', label: 'Child' },
                    { value: 'SIBLING', label: 'Sibling' },
                    { value: 'GUARDIAN', label: 'Guardian' },
                    { value: 'FRIEND', label: 'Friend' },
                  ]}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRegisterOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Complete Registration
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
