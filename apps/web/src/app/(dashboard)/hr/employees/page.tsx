'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Award,
  CalendarCheck,
  CalendarDays,
  Banknote,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
import { hrApi } from '@/lib/api';

export default function HumanResourcesDashboard() {
  const [activeTab, setActiveTab] = useState<'employees' | 'credentials' | 'attendance' | 'leave' | 'payroll'>('employees');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [employees, setEmployees] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('ALL');

  // Modals
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isAddCredentialOpen, setIsAddCredentialOpen] = useState(false);
  const [isLogAttendanceOpen, setIsLogAttendanceOpen] = useState(false);
  const [isRequestLeaveOpen, setIsRequestLeaveOpen] = useState(false);
  const [isRunPayrollOpen, setIsRunPayrollOpen] = useState(false);

  // Form states
  const [employeeForm, setEmployeeForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    employeeCode: '',
    department: 'Cardiology',
    designation: 'Staff Physician',
    dateOfJoining: new Date().toISOString().split('T')[0],
  });

  const [credentialForm, setCredentialForm] = useState({
    employeeId: '',
    credentialType: 'STATE_MEDICAL_LICENSE',
    credentialNumber: '',
    issuingAuthority: 'National Medical Commission',
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const [attendanceForm, setAttendanceForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    checkInTime: '08:00',
    checkOutTime: '17:00',
    status: 'PRESENT',
  });

  const [leaveForm, setLeaveForm] = useState({
    employeeId: '',
    leaveType: 'CASUAL',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reason: 'Personal medical leave',
  });

  const [payrollForm, setPayrollForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [empRes, credRes, attRes, leaveRes, payPerRes] = await Promise.all([
        hrApi.getEmployees(),
        hrApi.getCredentials(),
        hrApi.getAttendance(),
        hrApi.getLeaveRequests(),
        hrApi.getPayrollPeriods(),
      ]);

      setEmployees(empRes.data || []);
      setCredentials(credRes.data || []);
      setAttendance(attRes.data || []);
      setLeaveRequests(leaveRes.data || []);
      setPayrollPeriods(payPerRes.data || []);

      if (payPerRes.data && payPerRes.data.length > 0) {
        const slipRes = await hrApi.getPayslips({ periodId: payPerRes.data[0].id });
        setPayslips(slipRes.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load HR data:', err);
      setError(err?.response?.data?.error?.message || 'Failed to load Human Resources data. Please verify network connectivity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Add Employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrApi.createEmployee(employeeForm);
      setIsAddEmployeeOpen(false);
      setEmployeeForm({
        firstName: '',
        lastName: '',
        email: '',
        employeeCode: '',
        department: 'Cardiology',
        designation: 'Staff Physician',
        dateOfJoining: new Date().toISOString().split('T')[0],
      });
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error creating employee profile');
    }
  };

  // Handle Add Credential
  const handleAddCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialForm.employeeId) {
      alert('Please select an employee');
      return;
    }
    try {
      await hrApi.addCredential(credentialForm.employeeId, {
        credentialType: credentialForm.credentialType,
        credentialNumber: credentialForm.credentialNumber,
        issuingAuthority: credentialForm.issuingAuthority,
        validFrom: credentialForm.validFrom,
        validTo: credentialForm.validTo,
      });
      setIsAddCredentialOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error recording credential');
    }
  };

  // Handle Log Attendance
  const handleLogAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendanceForm.employeeId) {
      alert('Please select an employee');
      return;
    }
    try {
      const checkInDateTime = `${attendanceForm.date}T${attendanceForm.checkInTime}:00Z`;
      const checkOutDateTime = attendanceForm.checkOutTime ? `${attendanceForm.date}T${attendanceForm.checkOutTime}:00Z` : undefined;
      await hrApi.logAttendance({
        employeeId: attendanceForm.employeeId,
        date: attendanceForm.date,
        checkInTime: checkInDateTime,
        checkOutTime: checkOutDateTime,
        status: attendanceForm.status,
      });
      setIsLogAttendanceOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error logging biometric attendance');
    }
  };

  // Handle Submit Leave
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.employeeId) {
      alert('Please select an employee');
      return;
    }
    try {
      await hrApi.submitLeave(leaveForm);
      setIsRequestLeaveOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error submitting leave request');
    }
  };

  // Handle Review Leave
  const handleReviewLeave = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await hrApi.reviewLeave(id, { status, reviewNotes: `Reviewed and ${status.toLowerCase()} by HR Desk` });
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error updating leave status');
    }
  };

  // Handle Run Payroll
  const handleRunPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrApi.runPayroll(payrollForm);
      setIsRunPayrollOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error processing payroll cycle');
    }
  };

  // Metrics calculation
  const totalEmployees = employees.length;
  const criticalCredentials = credentials.filter(c => c.isExpiringSoon || c.isExpired).length;
  const presentToday = attendance.filter(a => a.status === 'PRESENT').length;
  const pendingLeaves = leaveRequests.filter(l => l.status === 'PENDING').length;

  const filteredEmployees = employees.filter(e => {
    const fullName = `${e.user?.firstName || ''} ${e.user?.lastName || ''}`.toLowerCase();
    const code = (e.employeeCode || '').toLowerCase();
    const dept = (e.department?.name || e.designation || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return fullName.includes(q) || code.includes(q) || dept.includes(q);
  });

  const filteredCredentials = credentials.filter(c => {
    if (complianceFilter === 'EXPIRING') return c.isExpiringSoon;
    if (complianceFilter === 'EXPIRED') return c.isExpired;
    if (complianceFilter === 'VALID') return !c.isExpiringSoon && !c.isExpired;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Human Resources & Workforce Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Clinical staff credential compliance, biometric duty logs, leaves, and payroll processing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsAddEmployeeOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Staff Member
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Active Workforce</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalEmployees}</p>
            <p className="text-xs text-slate-500 mt-1">Registered hospital personnel</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">License Expiry Alerts</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{criticalCredentials}</p>
            <p className="text-xs text-amber-600 mt-1">Expiring within 90 days / Expired</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Present Today</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{presentToday}</p>
            <p className="text-xs text-slate-500 mt-1">Biometric clock-ins verified</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CalendarCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Pending Leave Requests</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{pendingLeaves}</p>
            <p className="text-xs text-slate-500 mt-1">Awaiting department approval</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <CalendarDays className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl px-4 pt-3">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab('employees')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'employees'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Staff Directory ({employees.length})
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'credentials'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className="w-4 h-4" />
            Credentials Compliance
            {criticalCredentials > 0 && (
              <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full font-bold">
                {criticalCredentials}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'attendance'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            Biometric Attendance
          </button>
          <button
            onClick={() => setActiveTab('leave')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'leave'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Leave Approvals
            {pendingLeaves > 0 && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full font-bold">
                {pendingLeaves}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'payroll'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Banknote className="w-4 h-4" />
            Payroll & Payslips
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={loadData} className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* TAB 1: EMPLOYEES */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-3 border border-slate-200 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search staff by name, code or designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing {filteredEmployees.length} of {employees.length} employees
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Employee Code</th>
                  <th className="px-6 py-4">Full Name</th>
                  <th className="px-6 py-4">Department / Specialty</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4">Work Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading staff master...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No employees match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-mono font-medium text-slate-900">{emp.employeeCode}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {emp.user?.firstName} {emp.user?.lastName}
                        </div>
                        <div className="text-xs text-slate-400">{emp.user?.email}</div>
                      </td>
                      <td className="px-6 py-4">{emp.department?.name || 'General Clinical'}</td>
                      <td className="px-6 py-4">{emp.designation || 'Specialist'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          emp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setCredentialForm((prev) => ({ ...prev, employeeId: emp.id }));
                            setIsAddCredentialOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          + Add Credential
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CREDENTIALS COMPLIANCE */}
      {activeTab === 'credentials' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">Compliance Filter:</span>
              <button
                onClick={() => setComplianceFilter('ALL')}
                className={`px-3 py-1 text-xs rounded-lg font-medium ${complianceFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                All ({credentials.length})
              </button>
              <button
                onClick={() => setComplianceFilter('EXPIRING')}
                className={`px-3 py-1 text-xs rounded-lg font-medium ${complianceFilter === 'EXPIRING' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Expiring &lt;90d
              </button>
              <button
                onClick={() => setComplianceFilter('EXPIRED')}
                className={`px-3 py-1 text-xs rounded-lg font-medium ${complianceFilter === 'EXPIRED' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Expired
              </button>
              <button
                onClick={() => setComplianceFilter('VALID')}
                className={`px-3 py-1 text-xs rounded-lg font-medium ${complianceFilter === 'VALID' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Fully Compliant
              </button>
            </div>
            <button
              onClick={() => setIsAddCredentialOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Credential
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4">Credential Type</th>
                  <th className="px-6 py-4">License / Reg Number</th>
                  <th className="px-6 py-4">Issuing Authority</th>
                  <th className="px-6 py-4">Valid Until</th>
                  <th className="px-6 py-4">Compliance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCredentials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No clinical credentials recorded matching this filter.
                    </td>
                  </tr>
                ) : (
                  filteredCredentials.map((cred) => (
                    <tr key={cred.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {cred.employee?.user?.firstName} {cred.employee?.user?.lastName}
                        <span className="block text-xs font-normal text-slate-400 font-mono">
                          {cred.employee?.employeeCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{cred.credentialType}</td>
                      <td className="px-6 py-4 font-mono text-slate-700">{cred.credentialNumber}</td>
                      <td className="px-6 py-4">{cred.issuingAuthority}</td>
                      <td className="px-6 py-4 font-medium">
                        {new Date(cred.validTo).toLocaleDateString()}
                        {cred.daysUntilExpiry !== undefined && (
                          <span className="block text-xs text-slate-400 font-normal">
                            {cred.daysUntilExpiry > 0 ? `${cred.daysUntilExpiry} days left` : 'Expired'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {cred.isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                            <XCircle className="w-3.5 h-3.5" /> EXPIRED
                          </span>
                        ) : cred.isExpiringSoon ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5" /> EXPIRING SOON
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" /> VALID
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3 border border-slate-200 rounded-xl">
            <div className="text-sm font-medium text-slate-700">
              Biometric Clock-in Records & Shift Presence
            </div>
            <button
              onClick={() => setIsLogAttendanceOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Biometric Punch
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Check-In</th>
                  <th className="px-6 py-4">Check-Out</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No attendance records logged for this cycle.
                    </td>
                  </tr>
                ) : (
                  attendance.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {att.employee?.user?.firstName} {att.employee?.user?.lastName}
                        <span className="block text-xs font-normal text-slate-400 font-mono">
                          {att.employee?.employeeCode}
                        </span>
                      </td>
                      <td className="px-6 py-4">{new Date(att.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-mono text-emerald-700">
                        {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-700">
                        {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          att.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' :
                          att.status === 'LATE' ? 'bg-amber-100 text-amber-800' :
                          att.status === 'HALF_DAY' ? 'bg-blue-100 text-blue-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {att.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LEAVE REQUESTS */}
      {activeTab === 'leave' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3 border border-slate-200 rounded-xl">
            <div className="text-sm font-medium text-slate-700">
              Staff Leave Approvals & Absence Tracking
            </div>
            <button
              onClick={() => setIsRequestLeaveOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Request Leave
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4">Leave Type</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No leave applications submitted.
                    </td>
                  </tr>
                ) : (
                  leaveRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {req.employee?.user?.firstName} {req.employee?.user?.lastName}
                        <span className="block text-xs font-normal text-slate-400 font-mono">
                          {req.employee?.employeeCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{req.leaveType}</td>
                      <td className="px-6 py-4 text-xs font-medium">
                        {new Date(req.startDate).toLocaleDateString()} &rarr; {new Date(req.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{req.reason || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                          req.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {req.status === 'PENDING' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleReviewLeave(req.id, 'APPROVED')}
                              className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReviewLeave(req.id, 'REJECTED')}
                              className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PAYROLL */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-xl">
            <div>
              <h2 className="text-base font-bold text-slate-900">Hospital Payroll Processing</h2>
              <p className="text-xs text-slate-500">Calculate monthly salaries, deductions, and generate payslips</p>
            </div>
            <button
              onClick={() => setIsRunPayrollOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm"
            >
              <Banknote className="w-4 h-4" />
              Run Payroll Cycle
            </button>
          </div>

          {/* Payroll Periods List */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-semibold text-sm text-slate-800">
              Processed Payroll Cycles
            </div>
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Period</th>
                  <th className="px-6 py-4">Total Gross</th>
                  <th className="px-6 py-4">Total Deductions</th>
                  <th className="px-6 py-4">Net Payout</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrollPeriods.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No payroll cycles processed yet. Click &quot;Run Payroll Cycle&quot; to calculate this month.
                    </td>
                  </tr>
                ) : (
                  payrollPeriods.map((period) => (
                    <tr key={period.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        Month {period.month} / {period.year}
                      </td>
                      <td className="px-6 py-4 font-mono font-medium">${Number(period.totalGross).toLocaleString()}</td>
                      <td className="px-6 py-4 font-mono text-rose-600">${Number(period.totalDeductions).toLocaleString()}</td>
                      <td className="px-6 py-4 font-mono font-bold text-emerald-600">${Number(period.totalNet).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          {period.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Payslips table */}
          {payslips.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 font-semibold text-sm text-slate-800">
                Generated Employee Payslips
              </div>
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Basic Pay</th>
                    <th className="px-6 py-4">Allowances</th>
                    <th className="px-6 py-4">Deductions</th>
                    <th className="px-6 py-4">Net Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payslips.map((slip) => (
                    <tr key={slip.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {slip.employee?.user?.firstName} {slip.employee?.user?.lastName}
                        <span className="block text-xs font-normal text-slate-400 font-mono">
                          {slip.employee?.employeeCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono">${Number(slip.basicSalary).toLocaleString()}</td>
                      <td className="px-6 py-4 font-mono text-emerald-600">+${Number(slip.allowances).toLocaleString()}</td>
                      <td className="px-6 py-4 font-mono text-rose-600">-${Number(slip.deductions).toLocaleString()}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">${Number(slip.netSalary).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD EMPLOYEE */}
      {isAddEmployeeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Register Staff Member</h2>
            <form onSubmit={handleCreateEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">First Name</label>
                  <input
                    type="text"
                    required
                    value={employeeForm.firstName}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, firstName: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Last Name</label>
                  <input
                    type="text"
                    required
                    value={employeeForm.lastName}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, lastName: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Work Email</label>
                <input
                  type="email"
                  required
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Employee ID / Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EMP-901"
                  value={employeeForm.employeeCode}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, employeeCode: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Department</label>
                  <input
                    type="text"
                    value={employeeForm.department}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Designation</label>
                  <input
                    type="text"
                    value={employeeForm.designation}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddEmployeeOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD CREDENTIAL */}
      {isAddCredentialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Record Professional Credential</h2>
            <form onSubmit={handleAddCredential} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Staff Member</label>
                <select
                  required
                  value={credentialForm.employeeId}
                  onChange={(e) => setCredentialForm({ ...credentialForm, employeeId: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.firstName} {emp.user?.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Credential Type</label>
                <select
                  value={credentialForm.credentialType}
                  onChange={(e) => setCredentialForm({ ...credentialForm, credentialType: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="STATE_MEDICAL_LICENSE">State Medical License (MD/MBBS)</option>
                  <option value="NURSING_BOARD_REG">Nursing Board Registration (RN)</option>
                  <option value="DEA_REGISTRATION">DEA Controlled Substances Reg</option>
                  <option value="BOARD_CERTIFICATION">Specialty Board Certification</option>
                  <option value="ACLS_CERTIFICATE">ACLS / BLS Certificate</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">License / Registration Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MED-2024-99881"
                  value={credentialForm.credentialNumber}
                  onChange={(e) => setCredentialForm({ ...credentialForm, credentialNumber: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Issuing Authority</label>
                <input
                  type="text"
                  required
                  value={credentialForm.issuingAuthority}
                  onChange={(e) => setCredentialForm({ ...credentialForm, issuingAuthority: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Valid From</label>
                  <input
                    type="date"
                    required
                    value={credentialForm.validFrom}
                    onChange={(e) => setCredentialForm({ ...credentialForm, validFrom: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Valid Until (Expiry)</label>
                  <input
                    type="date"
                    required
                    value={credentialForm.validTo}
                    onChange={(e) => setCredentialForm({ ...credentialForm, validTo: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCredentialOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow"
                >
                  Save Credential
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: LOG ATTENDANCE */}
      {isLogAttendanceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Biometric Clock-in Manual Entry</h2>
            <form onSubmit={handleLogAttendance} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Staff Member</label>
                <select
                  required
                  value={attendanceForm.employeeId}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, employeeId: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.firstName} {emp.user?.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Date</label>
                <input
                  type="date"
                  required
                  value={attendanceForm.date}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Check-In Time</label>
                  <input
                    type="time"
                    required
                    value={attendanceForm.checkInTime}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, checkInTime: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Check-Out Time</label>
                  <input
                    type="time"
                    value={attendanceForm.checkOutTime}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, checkOutTime: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Status</label>
                <select
                  value={attendanceForm.status}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="HALF_DAY">HALF_DAY</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLogAttendanceOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow"
                >
                  Log Punch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REQUEST LEAVE */}
      {isRequestLeaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Submit Leave Application</h2>
            <form onSubmit={handleSubmitLeave} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Staff Member</label>
                <select
                  required
                  value={leaveForm.employeeId}
                  onChange={(e) => setLeaveForm({ ...leaveForm, employeeId: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.firstName} {emp.user?.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Leave Type</label>
                <select
                  value={leaveForm.leaveType}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                >
                  <option value="CASUAL">Casual Leave</option>
                  <option value="SICK">Medical / Sick Leave</option>
                  <option value="EARNED">Earned / Privilege Leave</option>
                  <option value="UNPAID">Loss of Pay (Unpaid)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">End Date</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Reason</label>
                <textarea
                  rows={2}
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRequestLeaveOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: RUN PAYROLL */}
      {isRunPayrollOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Run Payroll Processing</h2>
            <p className="text-xs text-slate-500">
              This will calculate salaries for all active employees based on duty attendance, generate payslips, and record payroll period liabilities.
            </p>
            <form onSubmit={handleRunPayroll} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Month</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    required
                    value={payrollForm.month}
                    onChange={(e) => setPayrollForm({ ...payrollForm, month: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Year</label>
                  <input
                    type="number"
                    min="2020"
                    max="2030"
                    required
                    value={payrollForm.year}
                    onChange={(e) => setPayrollForm({ ...payrollForm, year: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRunPayrollOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow"
                >
                  Execute Payroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
