'use client';

import { useState, useEffect } from 'react';
import { housekeepingApi } from '@/lib/api';

export default function HousekeepingDashboard() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Task Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [locationRef, setLocationRef] = useState('');
  const [locationType, setLocationType] = useState('BED');
  const [taskType, setTaskType] = useState('TERMINAL');
  const [priority, setPriority] = useState('NORMAL');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tasksRes, statsRes] = await Promise.all([
        housekeepingApi.getTasks(),
        housekeepingApi.getStats(),
      ]);
      setTasks(tasksRes.data || []);
      setStats(statsRes.data || null);
    } catch (err: any) {
      console.error('Failed to load housekeeping tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationRef.trim()) {
      setNotice({ type: 'error', text: 'Location reference is required (e.g. Bed Number, Room ID)' });
      return;
    }

    try {
      setSubmitting(true);
      await housekeepingApi.createTask({
        locationRef,
        locationType,
        taskType,
        priority,
      });
      setNotice({ type: 'success', text: 'Housekeeping cleaning task requested' });
      setShowNewModal(false);
      setLocationRef('');
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to create task' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartTask = async (id: string) => {
    try {
      await housekeepingApi.startTask(id);
      setNotice({ type: 'success', text: 'Cleaning initiated (Status: IN_PROGRESS)' });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Action failed' });
    }
  };

  const handleCompleteTask = async (id: string) => {
    try {
      const res = await housekeepingApi.completeTask(id);
      setNotice({ type: 'success', text: res.message || 'Cleaning completed; bed status restored to AVAILABLE' });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Action failed' });
    }
  };

  const handleVerifyTask = async (id: string) => {
    try {
      await housekeepingApi.verifyTask(id);
      setNotice({ type: 'success', text: 'Hygiene inspection verified' });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Action failed' });
    }
  };

  const filtered = tasks.filter((t) => {
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || t.taskType === typeFilter;
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    return matchesStatus && matchesType && matchesPriority;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Environmental & Housekeeping Services</h1>
          <p className="text-text-muted text-sm mt-0.5">
            Ward & bed terminal disinfection, biohazard spill response, and hygiene certification.
          </p>
        </div>
        <button
          onClick={() => {
            setShowNewModal(true);
            setNotice(null);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-brand-foreground bg-brand hover:bg-brand-hover shadow-sm"
        >
          + Request Cleaning Task
        </button>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium flex justify-between items-center ${ notice.type ==='success'
              ? 'bg-stable-bg border border-stable-border text-stable-text'
              : 'bg-critical-bg border border-critical-border text-critical-text'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="font-bold">x</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-surface p-4 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase">Total Tasks</p>
          <p className="text-xl font-bold text-text mt-1">{stats?.total ?? tasks.length}</p>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase">Requested</p>
          <p className="text-xl font-bold text-warning mt-1">{stats?.requested ?? 0}</p>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase">In Progress</p>
          <p className="text-xl font-bold text-info mt-1">{stats?.inProgress ?? 0}</p>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase">Completed</p>
          <p className="text-xl font-bold text-stable mt-1">{stats?.completed ?? 0}</p>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase">Verified QA</p>
          <p className="text-xl font-bold text-text mt-1">{stats?.verified ?? 0}</p>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-text">Cleaning Tasks Queue</h2>
            <span className="text-xs text-text-muted">({filtered.length} tasks)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-lg text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="ALL">All Statuses</option>
              <option value="REQUESTED">Requested</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="VERIFIED">Verified</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-lg text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="ALL">All Types</option>
              <option value="TERMINAL">Terminal Clean</option>
              <option value="ROUTINE">Routine Clean</option>
              <option value="SPILL">Spill / Biohazard</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-lg text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Priority</th>
                <th className="px-5 py-3">Assigned Staff</th>
                <th className="px-5 py-3">Requested At</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-text-muted">
                    Loading housekeeping tasks...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-text-muted">
                    No cleaning tasks in queue.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-subtle/50">
                    <td className="px-5 py-4">
                      <strong className="text-text block font-mono">{t.locationRef}</strong>
                      <span className="text-text-muted text-[11px]">{t.locationType}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-semibold ${ t.taskType ==='TERMINAL' ? 'text-warning-text' : t.taskType === 'SPILL' ? 'text-critical-text' : 'text-text'
                      }`}>
                        {t.taskType}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ t.priority ==='URGENT'
                          ? 'bg-critical-bg text-critical-text'
                          : t.priority === 'HIGH'
                          ? 'bg-warning-bg text-warning-text'
                          : 'bg-surface-subtle text-text'
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-text font-medium">
                      {t.assignedTo?.name || 'Unassigned'}
                    </td>
                    <td className="px-5 py-4 text-text-muted font-mono">
                      {new Date(t.requestedTime).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${ t.status ==='COMPLETED'
                            ? 'bg-stable-bg text-stable-text'
                            : t.status === 'IN_PROGRESS'
                            ? 'bg-info-bg text-info-text'
                            : t.status === 'VERIFIED'
                            ? 'bg-surface-subtle text-brand'
                            : 'bg-warning-bg text-warning-text'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right space-x-1.5">
                      {(t.status === 'REQUESTED' || t.status === 'ASSIGNED') && (
                        <button
                          onClick={() => handleStartTask(t.id)}
                          className="px-2.5 py-1 bg-brand hover:bg-brand-hover text-brand-foreground rounded text-[11px] font-bold"
                        >
                          Start Clean
                        </button>
                      )}
                      {t.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleCompleteTask(t.id)}
                          className="px-2.5 py-1 bg-stable hover:bg-stable text-brand-foreground rounded text-[11px] font-bold"
                        >
                          Complete & Release Bed
                        </button>
                      )}
                      {t.status === 'COMPLETED' && (
                        <button
                          onClick={() => handleVerifyTask(t.id)}
                          className="px-2.5 py-1 bg-surface-subtle text-brand hover:bg-surface-subtle rounded text-[11px] font-bold border border-border"
                        >
                          Verify QA
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

      {/* New Task Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-text">Request Cleaning Task</h3>
                <p className="text-xs text-text-muted">Dispatch housekeeping for terminal or routine sanitation</p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="text-text-muted font-bold">x</button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text mb-1">Location Reference / Bed ID *</label>
                <input
                  type="text"
                  value={locationRef}
                  onChange={(e) => setLocationRef(e.target.value)}
                  placeholder="e.g. BED-101, Room 204, OT-1"
                  className="w-full px-3 py-1.5 border border-border rounded text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Location Type</label>
                  <select
                    value={locationType}
                    onChange={(e) => setLocationType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-border rounded text-xs bg-surface"
                  >
                    <option value="BED">Bed</option>
                    <option value="ROOM">Room</option>
                    <option value="WARD">Ward</option>
                    <option value="OT">Operating Theatre</option>
                    <option value="ICU">ICU Bay</option>
                    <option value="AREA">General Area</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Task Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-border rounded text-xs bg-surface font-semibold"
                  >
                    <option value="TERMINAL">Terminal Clean</option>
                    <option value="ROUTINE">Routine Daily Clean</option>
                    <option value="SPILL">Spill / Biohazard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-1.5 border border-border rounded text-xs bg-surface"
                >
                  <option value="URGENT">Urgent (Immediate)</option>
                  <option value="HIGH">High (Turnaround pending)</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Requesting...' : 'Request Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
