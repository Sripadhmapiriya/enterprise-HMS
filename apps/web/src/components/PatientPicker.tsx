'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, UserCheck, Plus, Check, Loader2, X } from 'lucide-react';
import { Button, Dialog, Input, Select } from '@enterprise-hms/ui';
import { patientsApi } from '@/lib/api';

export interface SelectedPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth?: string;
  mobile?: string;
  abhaNumber?: string;
}

interface PatientPickerProps {
  label?: string;
  value?: string; // patientId
  selectedPatient?: SelectedPatient | null;
  onSelect: (patient: SelectedPatient | null) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function PatientPicker({
  label = 'Select Patient',
  value,
  selectedPatient,
  onSelect,
  required = false,
  disabled = false,
  placeholder = 'Search by Name, Mobile, MRN, or ABHA...',
}: PatientPickerProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SelectedPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<SelectedPatient | null>(selectedPatient || null);

  // Quick Register Modal state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [regForm, setRegForm] = useState({
    firstName: '',
    lastName: '',
    gender: 'FEMALE',
    dateOfBirth: '1995-01-01',
    mobile: '',
  });

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync if selectedPatient prop or value changes
  useEffect(() => {
    if (selectedPatient) {
      setCurrent(selectedPatient);
    } else if (value && (!current || current.id !== value)) {
      // Fetch details by ID
      patientsApi.get(value).then((res) => {
        if (res?.data) {
          setCurrent(res.data);
          onSelect(res.data);
        }
      }).catch(() => {});
    } else if (!value && !selectedPatient) {
      setCurrent(null);
    }
  }, [value, selectedPatient]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await patientsApi.list({ q: query.trim(), limit: 10 });
        setResults(res.data || []);
      } catch (err) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (patient: SelectedPatient) => {
    setCurrent(patient);
    onSelect(patient);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    setCurrent(null);
    onSelect(null);
    setQuery('');
  };

  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstName = regForm.firstName.trim();
    const lastName = regForm.lastName.trim() || firstName || 'Patient';
    const mobile = regForm.mobile.trim() || '+15551234567';

    try {
      setRegistering(true);
      const res = await patientsApi.create({
        firstName,
        lastName,
        gender: regForm.gender,
        dateOfBirth: regForm.dateOfBirth || '1995-01-01',
        mobile,
        registrationSource: 'QUICK_PICKER',
      });

      if (res?.data) {
        handleSelect(res.data);
        setIsRegisterOpen(false);
        setRegForm({
          firstName: '',
          lastName: '',
          gender: 'FEMALE',
          dateOfBirth: '1995-01-01',
          mobile: '',
        });
      }
    } catch (err: any) {
      alert(`Registration failed: ${err.message}`);
    } finally {
      setRegistering(false);
    }
  };

  const getAge = (dob?: string) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  };

  return (
    <div className="space-y-1.5" ref={wrapperRef}>
      {label && (
        <label className="block text-xs font-semibold text-text">
          {label} {required && <span className="text-critical">*</span>}
        </label>
      )}

      {current ? (
        <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-subtle">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-text truncate">
                {current.firstName} {current.lastName}
                <span className="ml-1.5 text-[11px] font-mono text-brand font-medium">
                  {current.mrn}
                </span>
              </div>
              <div className="text-[11px] text-text-muted flex items-center gap-2 truncate">
                <span>{current.gender}</span>
                {getAge(current.dateOfBirth) !== null && (
                  <>
                    <span>•</span>
                    <span>{getAge(current.dateOfBirth)} yrs</span>
                  </>
                )}
                {current.mobile && (
                  <>
                    <span>•</span>
                    <span>{current.mobile}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Remove selected patient"
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-raised transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              disabled={disabled}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-surface text-text focus:outline-hidden focus:ring-2 focus:ring-brand focus:border-brand disabled:opacity-50"
            />
            {loading && (
              <Loader2 className="w-4 h-4 text-brand animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>

          {isOpen && query.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-1 z-50 rounded-lg border border-border bg-surface-raised shadow-xl max-h-64 overflow-y-auto divide-y divide-border">
              {results.length > 0 ? (
                results.map((patient) => {
                  const age = getAge(patient.dateOfBirth);
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => handleSelect(patient)}
                      className="w-full px-3 py-2 text-left hover:bg-surface-subtle transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-text group-hover:text-brand flex items-center gap-1.5">
                          <span>{patient.firstName} {patient.lastName}</span>
                          <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-surface border border-border">
                            {patient.mrn}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted flex items-center gap-2 mt-0.5">
                          <span>{patient.gender}</span>
                          {age !== null && (
                            <>
                              <span>•</span>
                              <span>{age} yrs</span>
                            </>
                          )}
                          {patient.mobile && (
                            <>
                              <span>•</span>
                              <span>{patient.mobile}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Check className="w-4 h-4 text-brand opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })
              ) : !loading ? (
                <div className="p-4 text-center space-y-2">
                  <p className="text-xs text-text-muted">No patients found matching "{query}"</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsRegisterOpen(true);
                      setIsOpen(false);
                      // Prepopulate name or phone if obvious
                      if (/^\+?\d+$/.test(query.trim())) {
                        setRegForm((prev) => ({ ...prev, mobile: query.trim() }));
                      } else {
                        const parts = query.trim().split(' ').filter(Boolean);
                        setRegForm((prev) => ({
                          ...prev,
                          firstName: parts[0] || '',
                          lastName: parts.slice(1).join(' ') || parts[0] || '',
                        }));
                      }
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Register New Patient
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Quick Register Dialog */}
      <Dialog
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Quick Patient Registration"
        description="Register a new patient and automatically select them for this action."
        zIndex={60}
      >
        <form onSubmit={handleQuickRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              required
              value={regForm.firstName}
              onChange={(e) => setRegForm({ ...regForm, firstName: e.target.value })}
            />
            <Input
              label="Last Name"
              required
              value={regForm.lastName}
              onChange={(e) => setRegForm({ ...regForm, lastName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Gender"
              value={regForm.gender}
              onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
              options={[
                { value: 'FEMALE', label: 'Female' },
                { value: 'MALE', label: 'Male' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
            <Input
              label="Date of Birth"
              type="date"
              required
              value={regForm.dateOfBirth}
              onChange={(e) => setRegForm({ ...regForm, dateOfBirth: e.target.value })}
            />
          </div>
          <Input
            label="Mobile Phone"
            required
            placeholder="+1 555-0199"
            value={regForm.mobile}
            onChange={(e) => setRegForm({ ...regForm, mobile: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsRegisterOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={registering}>
              {registering ? 'Registering...' : 'Register & Select'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
