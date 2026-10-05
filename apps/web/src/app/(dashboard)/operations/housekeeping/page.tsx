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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Environmental & Housekeeping Services</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Ward & bed terminal disinfection, biohazard spill response, and hygiene certification.
          </p>
        </div>
        <button
          onClick={() => {
            setShowNewModal(true);
            setNotice(null);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
        >
          + Request Cleaning Task
        </button>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium flex justify-between items-center ${
            notice.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="font-bold">x</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Total Tasks</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats?.total ?? tasks.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Requested</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{stats?.requested ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">In Progress</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{stats?.inProgress ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Completed</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{stats?.completed ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Verified QA</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{stats?.verified ?? 0}</p>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">Cleaning Tasks Queue</h2>
            <span className="text-xs text-slate-500">({filtered.length} tasks)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Types</option>
              <option value="TERMINAL">Terminal Clean</option>
              <option value="ROUTINE">Routine Clean</option>
              <option value="SPILL">Spill / Biohazard</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
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
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading housekeeping tasks...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No cleaning tasks in queue.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <strong className="text-slate-900 block font-mono">{t.locationRef}</strong>
                      <span className="text-slate-400 text-[11px]">{t.locationType}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-semibold ${
                        t.taskType === 'TERMINAL' ? 'text-amber-800' : t.taskType === 'SPILL' ? 'text-rose-800' : 'text-slate-700'
                      }`}>
                        {t.taskType}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.priority === 'URGENT'
                          ? 'bg-rose-100 text-rose-800'
                          : t.priority === 'HIGH'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700 font-medium">
                      {t.assignedTo?.name || 'Unassigned'}
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-mono">
                      {new Date(t.requestedTime).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          t.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : t.status === 'VERIFIED'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right space-x-1.5">
                      {(t.status === 'REQUESTED' || t.status === 'ASSIGNED') && (
                        <button
                          onClick={() => handleStartTask(t.id)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold"
                        >
                          Start Clean
                        </button>
                      )}
                      {t.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleCompleteTask(t.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                        >
                          Complete & Release Bed
                        </button>
                      )}
                      {t.status === 'COMPLETED' && (
                        <button
                          onClick={() => handleVerifyTask(t.id)}
                          className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-[11px] font-bold border border-purple-200"
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Request Cleaning Task</h3>
                <p className="text-xs text-slate-500">Dispatch housekeeping for terminal or routine sanitation</p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 font-bold">x</button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Location Reference / Bed ID *</label>
                <input
                  type="text"
                  value={locationRef}
                  onChange={(e) => setLocationRef(e.target.value)}
                  placeholder="e.g. BED-101, Room 204, OT-1"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Location Type</label>
                  <select
                    value={locationType}
                    onChange={(e) => setLocationType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Task Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white font-semibold"
                  >
                    <option value="TERMINAL">Terminal Clean</option>
                    <option value="ROUTINE">Routine Daily Clean</option>
                    <option value="SPILL">Spill / Biohazard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                >
                  <option value="URGENT">Urgent (Immediate)</option>
                  <option value="HIGH">High (Turnaround pending)</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
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
