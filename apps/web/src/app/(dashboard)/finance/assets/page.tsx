'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  FileCheck,
  ShieldAlert,
  Sliders,
  Calendar,
} from 'lucide-react';
import { assetsApi } from '@/lib/api';

export default function BiomedicalAssetsDashboard() {
  const [activeTab, setActiveTab] = useState<'assets' | 'maintenance'>('assets');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [assets, setAssets] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isRegisterAssetOpen, setIsRegisterAssetOpen] = useState(false);
  const [isReportBreakdownOpen, setIsReportBreakdownOpen] = useState(false);
  const [isCompleteTaskOpen, setIsCompleteTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // Forms
  const [assetForm, setAssetForm] = useState({
    assetCode: '',
    name: '',
    category: 'BIOMEDICAL',
    model: '',
    serialNumber: '',
    department: 'Intensive Care Unit (ICU)',
    location: 'Bedside Pod A-1',
    purchaseDate: new Date().toISOString().split('T')[0],
    purchaseCost: '15000',
  });

  const [breakdownForm, setBreakdownForm] = useState({
    assetId: '',
    breakdownReason: '',
    priority: 'HIGH',
  });

  const [completeForm, setCompleteForm] = useState({
    completionNotes: 'Replaced faulty transducer and performed electrical safety check.',
    calibrationPassed: true,
    calibrationCertNumber: `CAL-${Date.now().toString().slice(-6)}`,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [assetsRes, tasksRes] = await Promise.all([
        assetsApi.getAssets(),
        assetsApi.getMaintenanceTasks(),
      ]);

      setAssets(assetsRes.data || []);
      setTasks(tasksRes.data || []);
    } catch (err: any) {
      console.error('Failed to load asset data:', err);
      setError(err?.response?.data?.error?.message || 'Failed to load Biomedical Engineering assets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle register asset
  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await assetsApi.createAsset({
        ...assetForm,
        purchaseCost: parseFloat(assetForm.purchaseCost) || 0,
      });
      setIsRegisterAssetOpen(false);
      setAssetForm({
        assetCode: '',
        name: '',
        category: 'BIOMEDICAL',
        model: '',
        serialNumber: '',
        department: 'Intensive Care Unit (ICU)',
        location: 'Bedside Pod A-1',
        purchaseDate: new Date().toISOString().split('T')[0],
        purchaseCost: '15000',
      });
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error registering biomedical asset');
    }
  };

  // Handle report breakdown
  const handleReportBreakdown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakdownForm.assetId) {
      alert('Please select an asset');
      return;
    }
    try {
      await assetsApi.reportBreakdown(breakdownForm);
      setIsReportBreakdownOpen(false);
      setBreakdownForm({
        assetId: '',
        breakdownReason: '',
        priority: 'HIGH',
      });
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error logging equipment breakdown');
    }
  };

  // Handle complete maintenance task
  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    try {
      await assetsApi.completeMaintenanceTask(selectedTask.id, completeForm);
      setIsCompleteTaskOpen(false);
      setSelectedTask(null);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error completing maintenance work order');
    }
  };

  // KPI Calculations
  const totalAssets = assets.length;
  const activeAssets = assets.filter((a) => a.status === 'ACTIVE').length;
  const inMaintenance = assets.filter((a) => a.status === 'MAINTENANCE').length;
  const pendingTasks = tasks.filter((t) => t.status === 'SCHEDULED').length;

  const filteredAssets = assets.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      a.assetCode?.toLowerCase().includes(q) ||
      a.name?.toLowerCase().includes(q) ||
      a.department?.toLowerCase().includes(q) ||
      a.model?.toLowerCase().includes(q);

    if (statusFilter === 'ALL') return matchesQuery;
    return matchesQuery && a.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Biomedical Engineering & CMMS
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Clinical device asset register, maintenance work orders, breakdown triage, and calibration compliance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-surface-subtle"
          >
            <RefreshCw className={`w-4 h-4 ${loading ?'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsReportBreakdownOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-critical-text bg-critical-bg border border-critical-border rounded-lg hover:bg-critical-bg"
          >
            <ShieldAlert className="w-4 h-4 text-critical" />
            Report Breakdown
          </button>
          <button
            onClick={() => setIsRegisterAssetOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-foreground bg-surface rounded-lg hover:bg-surface-raised shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Register Device
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-surface border border-border rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-muted uppercase">Device Inventory</p>
            <p className="text-2xl font-bold text-text mt-1">{totalAssets}</p>
            <p className="text-xs text-text-muted mt-1">Biomedical equipment units</p>
          </div>
          <div className="p-3 bg-surface-subtle text-brand rounded-lg">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-muted uppercase">Active & In Service</p>
            <p className="text-2xl font-bold text-stable mt-1">{activeAssets}</p>
            <p className="text-xs text-text-muted mt-1">Clinical uptime verified</p>
          </div>
          <div className="p-3 bg-stable-bg text-stable rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-muted uppercase">Out for Maintenance</p>
            <p className="text-2xl font-bold text-critical mt-1">{inMaintenance}</p>
            <p className="text-xs text-critical mt-1">Breakdown / Calibration lock</p>
          </div>
          <div className="p-3 bg-critical-bg text-critical rounded-lg">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-muted uppercase">Open Work Orders</p>
            <p className="text-2xl font-bold text-warning mt-1">{pendingTasks}</p>
            <p className="text-xs text-text-muted mt-1">CMMS maintenance queue</p>
          </div>
          <div className="p-3 bg-warning-bg text-warning rounded-lg">
            <Wrench className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border bg-surface rounded-t-xl px-4 pt-3">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab('assets')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${ activeTab ==='assets'
                ? 'border-border text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <Activity className="w-4 h-4" />
            Equipment Register ({assets.length})
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${ activeTab ==='maintenance'
                ? 'border-border text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <Wrench className="w-4 h-4" />
            CMMS Work Orders ({tasks.length})
            {inMaintenance > 0 && (
              <span className="px-2 py-0.5 text-xs bg-critical-bg text-critical-text rounded-full font-bold">
                {inMaintenance} in service
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-critical-bg border border-critical-border rounded-xl text-critical-text flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-critical" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={loadData} className="px-3 py-1 bg-critical-bg hover:bg-critical-bg text-critical-text rounded text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* TAB 1: ASSET REGISTER */}
      {activeTab === 'assets' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-surface p-3 border border-border rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search device code, name, model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-muted uppercase">Status:</span>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 text-xs rounded-lg font-medium ${statusFilter ==='ALL' ? 'bg-surface text-brand-foreground' : 'bg-surface-subtle text-text'}`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1 text-xs rounded-lg font-medium ${statusFilter ==='ACTIVE' ? 'bg-stable text-brand-foreground' : 'bg-surface-subtle text-text'}`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('MAINTENANCE')}
                className={`px-3 py-1 text-xs rounded-lg font-medium ${statusFilter ==='MAINTENANCE' ? 'bg-critical text-brand-foreground' : 'bg-surface-subtle text-text'}`}
              >
                Maintenance
              </button>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Asset Code</th>
                  <th className="px-6 py-4">Device Name</th>
                  <th className="px-6 py-4">Department & Location</th>
                  <th className="px-6 py-4">Model & Serial</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                      No assets found. Click &quot;Register Device&quot; to add biomedical equipment.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-surface-subtle/80">
                      <td className="px-6 py-4 font-mono font-bold text-text">{asset.assetCode}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-text">{asset.name}</div>
                        <div className="text-xs text-text-muted">{asset.category}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-text">{asset.department || 'General'}</div>
                        <div className="text-xs text-text-muted">{asset.location || 'Central Depot'}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        <div>Model: {asset.model || 'Standard'}</div>
                        <div className="text-text-muted">S/N: {asset.serialNumber || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ asset.status ==='ACTIVE' ? 'bg-stable-bg text-stable-text' :
                          asset.status === 'MAINTENANCE' ? 'bg-critical-bg text-critical-text animate-pulse' :
                          'bg-surface-subtle text-text'
                        }`}>
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {asset.status === 'ACTIVE' && (
                          <button
                            onClick={() => {
                              setBreakdownForm((prev) => ({ ...prev, assetId: asset.id }));
                              setIsReportBreakdownOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-critical-text hover:bg-critical-bg rounded"
                          >
                            Report Fault
                          </button>
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

      {/* TAB 2: CMMS WORK ORDERS */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-text">Work Orders & Calibration Queue</h2>
                <p className="text-xs text-text-muted">Scheduled maintenance, breakdown resolutions, and safety certifications</p>
              </div>
            </div>

            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Asset</th>
                  <th className="px-6 py-4">Task Type & Description</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Scheduled Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                      No maintenance tasks queued. All equipment is fully serviced.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-surface-subtle/80">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-text">{task.asset?.assetCode}</div>
                        <div className="text-xs text-text-muted">{task.asset?.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-text">{task.taskType}</div>
                        <div className="text-xs text-text-muted max-w-xs">{task.description}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${ task.priority ==='CRITICAL' ? 'bg-critical-bg text-critical-text' :
                          task.priority === 'HIGH' ? 'bg-warning-bg text-warning-text' :
                          'bg-info-bg text-info-text'
                        }`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        {new Date(task.scheduledDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ task.status ==='COMPLETED' ? 'bg-stable-bg text-stable-text' :
                          task.status === 'IN_PROGRESS' ? 'bg-info-bg text-info-text' :
                          'bg-warning-bg text-warning-text'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {task.status !== 'COMPLETED' && (
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setIsCompleteTaskOpen(true);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-brand-foreground bg-surface hover:bg-surface-raised rounded-lg shadow-sm"
                          >
                            Resolve & Certify
                          </button>
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

      {/* MODAL 1: REGISTER ASSET */}
      {isRegisterAssetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-text">Register Biomedical Equipment</h2>
            <form onSubmit={handleRegisterAsset} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text">Asset Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BME-VENT-04"
                    value={assetForm.assetCode}
                    onChange={(e) => setAssetForm({ ...assetForm, assetCode: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg font-mono focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text">Category</label>
                  <select
                    value={assetForm.category}
                    onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg"
                  >
                    <option value="BIOMEDICAL">BIOMEDICAL</option>
                    <option value="DIAGNOSTIC">DIAGNOSTIC</option>
                    <option value="SURGICAL">SURGICAL</option>
                    <option value="FACILITY">FACILITY</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text">Device Name / Model</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Puritan Bennett 980 ICU Ventilator"
                  value={assetForm.name}
                  onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text">Model #</label>
                  <input
                    type="text"
                    value={assetForm.model}
                    onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text">Serial Number</label>
                  <input
                    type="text"
                    value={assetForm.serialNumber}
                    onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text">Department</label>
                  <input
                    type="text"
                    value={assetForm.department}
                    onChange={(e) => setAssetForm({ ...assetForm, department: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text">Bed / Room Location</label>
                  <input
                    type="text"
                    value={assetForm.location}
                    onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterAssetOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:bg-surface-subtle rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-brand-foreground bg-surface hover:bg-surface-raised rounded-lg shadow"
                >
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REPORT BREAKDOWN */}
      {isReportBreakdownOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2 text-critical-text">
              <ShieldAlert className="w-5 h-5" />
              <h2 className="text-lg font-bold">Report Equipment Breakdown</h2>
            </div>
            <p className="text-xs text-text-muted">
              Submitting this immediately locks the asset into MAINTENANCE status and dispatches an emergency work order.
            </p>
            <form onSubmit={handleReportBreakdown} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text">Faulty Equipment</label>
                <select
                  required
                  value={breakdownForm.assetId}
                  onChange={(e) => setBreakdownForm({ ...breakdownForm, assetId: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-critical"
                >
                  <option value="">Select Equipment...</option>
                  {assets.filter((a) => a.status === 'ACTIVE').map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetCode} - {a.name} ({a.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-text">Priority Level</label>
                <select
                  value={breakdownForm.priority}
                  onChange={(e) => setBreakdownForm({ ...breakdownForm, priority: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                >
                  <option value="CRITICAL">CRITICAL (Direct Patient Safety Threat)</option>
                  <option value="HIGH">HIGH (Immediate Ward Disruption)</option>
                  <option value="MEDIUM">MEDIUM (Non-Urgent Diagnostic Fault)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-text">Breakdown Symptoms / Reason</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe error codes, power failures, or sensor faults..."
                  value={breakdownForm.breakdownReason}
                  onChange={(e) => setBreakdownForm({ ...breakdownForm, breakdownReason: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReportBreakdownOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:bg-surface-subtle rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-brand-foreground bg-critical hover:bg-critical rounded-lg shadow"
                >
                  Dispatch Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RESOLVE WORK ORDER & CALIBRATE */}
      {isCompleteTaskOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-text">Complete & Calibrate Equipment</h2>
            <p className="text-xs text-text-muted">
              Certifying this work order restores device status back to ACTIVE for clinical usage.
            </p>
            <form onSubmit={handleCompleteTask} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text">Resolution Notes</label>
                <textarea
                  required
                  rows={2}
                  value={completeForm.completionNotes}
                  onChange={(e) => setCompleteForm({ ...completeForm, completionNotes: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2 p-2 bg-surface-subtle rounded-lg">
                <input
                  type="checkbox"
                  id="calibrationPassed"
                  checked={completeForm.calibrationPassed}
                  onChange={(e) => setCompleteForm({ ...completeForm, calibrationPassed: e.target.checked })}
                  className="w-4 h-4 text-stable rounded"
                />
                <label htmlFor="calibrationPassed" className="text-xs font-semibold text-text">
                  Biomedical Safety & Calibration Passed
                </label>
              </div>

              <div>
                <label className="text-xs font-semibold text-text">Calibration Certificate #</label>
                <input
                  type="text"
                  required
                  value={completeForm.calibrationCertNumber}
                  onChange={(e) => setCompleteForm({ ...completeForm, calibrationCertNumber: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCompleteTaskOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:bg-surface-subtle rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-brand-foreground bg-stable hover:bg-stable rounded-lg shadow"
                >
                  Certify & Restore to Active
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
