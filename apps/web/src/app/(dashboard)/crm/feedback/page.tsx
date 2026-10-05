'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Star,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Smile,
  Meh,
  Frown,
  ShieldAlert,
} from 'lucide-react';
import { crmApi, patientsApi } from '@/lib/api';

export default function PatientCrmDashboard() {
  const [activeTab, setActiveTab] = useState<'feed' | 'escalations' | 'analytics'>('feed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [patients, setPatients] = useState<any[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modals
  const [isNewFeedbackOpen, setIsNewFeedbackOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);

  // Forms
  const [feedbackForm, setFeedbackForm] = useState({
    patientId: '',
    rating: 5,
    category: 'NURSING_CARE',
    comments: '',
  });

  const [resolveForm, setResolveForm] = useState({
    status: 'RESOLVED',
    resolutionNotes: 'Spoke directly with patient family; rectified billing inquiry and addressed care concerns.',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [fbRes, escRes, anaRes, patRes] = await Promise.all([
        crmApi.getFeedback(),
        crmApi.getEscalations(),
        crmApi.getAnalytics(),
        patientsApi.getAll({ limit: 50 }).catch(() => ({ data: [] })),
      ]);

      setFeedbackList(fbRes.data || []);
      setEscalations(escRes.data || []);
      setAnalytics(anaRes.data || null);
      setPatients(patRes.data || []);
    } catch (err: any) {
      console.error('Failed to load CRM data:', err);
      setError(err?.response?.data?.error?.message || 'Failed to load Patient Feedback & CRM data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle submit feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await crmApi.submitFeedback({
        patientId: feedbackForm.patientId || undefined,
        rating: Number(feedbackForm.rating),
        category: feedbackForm.category,
        comments: feedbackForm.comments,
      });
      setIsNewFeedbackOpen(false);
      setFeedbackForm({
        patientId: '',
        rating: 5,
        category: 'NURSING_CARE',
        comments: '',
      });
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error recording patient feedback');
    }
  };

  // Handle resolve feedback
  const handleResolveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeedback) return;
    try {
      await crmApi.updateFeedbackStatus(selectedFeedback.id, resolveForm);
      setIsResolveModalOpen(false);
      setSelectedFeedback(null);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error updating feedback status');
    }
  };

  // Metrics
  const npsScore = analytics?.npsScore ?? 0;
  const averageRating = analytics?.averageRating ?? 0;
  const openComplaints = feedbackList.filter((f) => f.status !== 'RESOLVED' && f.status !== 'CLOSED').length;
  const slaBreaches = escalations.length;

  const filteredFeed = feedbackList.filter((f) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      f.comments?.toLowerCase().includes(q) ||
      f.category?.toLowerCase().includes(q) ||
      f.patient?.fullName?.toLowerCase().includes(q) ||
      f.patient?.mrn?.toLowerCase().includes(q);

    if (categoryFilter === 'ALL') return matchesQuery;
    return matchesQuery && f.category === categoryFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Patient CRM & Experience Desk
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Patient satisfaction feedback, 48-hour complaint SLA escalation tracker, and Net Promoter Score (NPS) analytics.
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
            onClick={() => setIsNewFeedbackOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Log Feedback
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Net Promoter Score</p>
            <p className={`text-2xl font-bold mt-1 ${npsScore >= 50 ? 'text-emerald-600' : npsScore >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
              {npsScore > 0 ? `+${npsScore}` : npsScore}
            </p>
            <p className="text-xs text-slate-500 mt-1">Based on patient promoter %</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Smile className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Average Patient Rating</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-2xl font-bold text-slate-900">{averageRating.toFixed(1)}</span>
              <div className="flex text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${star <= Math.round(averageRating) ? 'fill-current' : 'text-slate-200'}`}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">Out of 5.0 stars</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Star className="w-6 h-6 fill-current" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Open Inquiries / Grievances</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{openComplaints}</p>
            <p className="text-xs text-slate-500 mt-1">Active resolution queue</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">48h SLA Escalations</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{slaBreaches}</p>
            <p className="text-xs text-rose-600 mt-1">Unresolved &gt; 48 hours</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl px-4 pt-3">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab('feed')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'feed'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Feedback Queue ({feedbackList.length})
          </button>
          <button
            onClick={() => setActiveTab('escalations')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'escalations'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            48h SLA Escalation Watch
            {slaBreaches > 0 && (
              <span className="px-2 py-0.5 text-xs bg-rose-100 text-rose-800 rounded-full font-bold">
                {slaBreaches} Breached
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            NPS & Sentiment Analytics
          </button>
        </div>
      </div>

      {/* Error Banner */}
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

      {/* TAB 1: FEEDBACK FEED */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3 border border-slate-200 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search feedback comments, category or patient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border rounded-lg bg-white"
              >
                <option value="ALL">All Categories</option>
                <option value="NURSING_CARE">Nursing Care</option>
                <option value="DOCTOR_CONSULTATION">Doctor Consultation</option>
                <option value="BILLING_TRANSPARENCY">Billing & Cashier</option>
                <option value="DIETARY_FOOD">Dietary & Food Quality</option>
                <option value="CLEANLINESS_FACILITIES">Cleanliness & Hygiene</option>
                <option value="WAIT_TIMES">Wait Times & Queue</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Rating</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Patient Comments</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFeed.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No patient feedback matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredFeed.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 align-top">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">
                          {item.patient ? `${item.patient.firstName || ''} ${item.patient.lastName || ''}` : 'Anonymous Patient'}
                        </div>
                        {item.patient?.mrn && (
                          <div className="text-xs font-mono text-slate-400">{item.patient.mrn}</div>
                        )}
                        <div className="text-xs text-slate-400 mt-1">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <span>{item.rating}</span>
                          <Star className="w-4 h-4 fill-current" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-sm">
                        <div className="text-slate-800 text-xs italic">&quot;{item.comments}&quot;</div>
                        {item.resolutionNotes && (
                          <div className="text-xs text-emerald-700 mt-1.5 bg-emerald-50 p-1.5 rounded">
                            <span className="font-semibold">Resolution: </span>
                            {item.resolutionNotes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.status === 'RESOLVED' || item.status === 'CLOSED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.status !== 'RESOLVED' && item.status !== 'CLOSED' && (
                          <button
                            onClick={() => {
                              setSelectedFeedback(item);
                              setIsResolveModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            Resolve
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

      {/* TAB 2: SLA ESCALATIONS */}
      {activeTab === 'escalations' && (
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold">Patient Grievance 48-Hour SLA Watchlist</h2>
              <p className="text-xs text-rose-700 mt-0.5">
                The complaints listed below were logged more than 48 hours ago and have not been resolved. Clinical ombudsman intervention is required.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Logged At</th>
                  <th className="px-6 py-4">Age (Hours)</th>
                  <th className="px-6 py-4">Grievance Summary</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {escalations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Zero SLA breaches! All patient feedback is being addressed within 48 hours.
                    </td>
                  </tr>
                ) : (
                  escalations.map((item) => {
                    const hoursAgo = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60));
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="px-6 py-4 font-semibold text-slate-800">
                          {item.patient ? `${item.patient.firstName || ''} ${item.patient.lastName || ''}` : 'Anonymous'}
                          <span className="block text-xs font-normal text-slate-400 font-mono">
                            {item.patient?.mrn || 'WALK-IN'}
                          </span>
                        </td>
                        <td className="px-6 py-4">{new Date(item.createdAt).toLocaleString()}</td>
                        <td className="px-6 py-4 font-mono font-bold text-rose-600">
                          {hoursAgo}h (Overdue)
                        </td>
                        <td className="px-6 py-4 max-w-sm text-xs text-slate-700">
                          &quot;{item.comments}&quot;
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedFeedback(item);
                              setIsResolveModalOpen(true);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                          >
                            Expedite & Resolve
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: NPS & SENTIMENT ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Promoters */}
            <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
              <Smile className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <div className="text-3xl font-bold text-emerald-600 font-mono">
                {analytics?.promoters ?? 0}
              </div>
              <div className="text-sm font-bold text-slate-800 mt-1">Promoters (Rating 5)</div>
              <p className="text-xs text-slate-400 mt-1">Highly satisfied advocates</p>
            </div>

            {/* Passives */}
            <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
              <Meh className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-amber-600 font-mono">
                {analytics?.passives ?? 0}
              </div>
              <div className="text-sm font-bold text-slate-800 mt-1">Passives (Rating 4)</div>
              <p className="text-xs text-slate-400 mt-1">Satisfied but unenthusiastic</p>
            </div>

            {/* Detractors */}
            <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
              <Frown className="w-10 h-10 text-rose-600 mx-auto mb-2" />
              <div className="text-3xl font-bold text-rose-600 font-mono">
                {analytics?.detractors ?? 0}
              </div>
              <div className="text-sm font-bold text-slate-800 mt-1">Detractors (Rating 1-3)</div>
              <p className="text-xs text-slate-400 mt-1">Dissatisfied patients requiring outreach</p>
            </div>
          </div>

          {/* Feedback by Category Breakdown */}
          {analytics?.byCategory && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-900">Feedback Volume by Category</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Object.entries(analytics.byCategory).map(([cat, count]: [string, any]) => (
                  <div key={cat} className="p-3 bg-slate-50 border rounded-lg">
                    <span className="text-xs text-slate-500 uppercase font-semibold">{cat.replace(/_/g, ' ')}</span>
                    <p className="text-lg font-bold text-slate-900 font-mono mt-1">{count} reviews</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: RECORD FEEDBACK */}
      {isNewFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Log Patient Experience / Feedback</h2>
            <form onSubmit={handleSubmitFeedback} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Patient (Optional for anonymous)</label>
                <select
                  value={feedbackForm.patientId}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, patientId: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                >
                  <option value="">Anonymous Patient</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.mrn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Overall Rating (1 - 5 Stars)</label>
                <div className="flex gap-2 items-center mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= feedbackForm.rating ? 'text-amber-400 fill-current' : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Category</label>
                <select
                  value={feedbackForm.category}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, category: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                >
                  <option value="NURSING_CARE">Nursing Care</option>
                  <option value="DOCTOR_CONSULTATION">Doctor Consultation</option>
                  <option value="BILLING_TRANSPARENCY">Billing Transparency</option>
                  <option value="DIETARY_FOOD">Dietary & Food Quality</option>
                  <option value="CLEANLINESS_FACILITIES">Cleanliness & Facilities</option>
                  <option value="WAIT_TIMES">Wait Times & Flow</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Patient Comments</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail comments, compliments, or grievances..."
                  value={feedbackForm.comments}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, comments: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewFeedbackOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow"
                >
                  Submit Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESOLVE FEEDBACK */}
      {isResolveModalOpen && selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Resolve Patient Feedback / Grievance</h2>
            <div className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1">
              <span className="font-semibold text-slate-800">Original Comment:</span>
              <p className="text-slate-600 italic">&quot;{selectedFeedback.comments}&quot;</p>
            </div>
            <form onSubmit={handleResolveFeedback} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Resolution Status</label>
                <select
                  value={resolveForm.status}
                  onChange={(e) => setResolveForm({ ...resolveForm, status: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                >
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Action Taken / Resolution Summary</label>
                <textarea
                  required
                  rows={3}
                  value={resolveForm.resolutionNotes}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolutionNotes: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow"
                >
                  Record Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
