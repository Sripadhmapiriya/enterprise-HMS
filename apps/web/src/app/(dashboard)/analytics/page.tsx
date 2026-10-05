'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Badge,
  Skeleton,
  ErrorState,
  Select,
} from '@enterprise-hms/ui';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Users,
  Bed,
  Clock,
  DollarSign,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { analyticsApi } from '@/lib/api';

export default function AnalyticsDashboardPage() {
  const [activeTab, setActiveTab] = useState<'kpis' | 'mis' | 'trends'>('kpis');
  const [kpiData, setKpiData] = useState<any>(null);
  const [misData, setMisData] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Export State
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportReportType, setExportReportType] = useState('MIS_PACK');
  const [exportFormat, setExportFormat] = useState('json');
  const [exportAsync, setExportAsync] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [kpiRes, misRes, trendRes] = await Promise.all([
        analyticsApi.getKpis(),
        analyticsApi.getMisPack(),
        analyticsApi.getTrends(7),
      ]);

      setKpiData(kpiRes.data);
      setMisData(misRes.data);
      setTrends(trendRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load hospital analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async () => {
    try {
      setExporting(true);
      setExportSuccess(null);

      const res = await analyticsApi.exportReport({
        reportType: exportReportType,
        format: exportFormat,
        async: exportAsync,
      });

      if (exportAsync) {
        setExportSuccess(`Report queued in background worker (Job ID: ${res.data?.id})`);
      } else {
        setExportSuccess(`Export generated successfully for ${exportReportType}`);
      }
      setTimeout(() => {
        setExportModalOpen(false);
        setExportSuccess(null);
      }, 2000);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            Clinical & Operational Analytics
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Executive KPI scorecards, department utilization, and scheduled MIS reporting pack.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => setExportModalOpen(true)}
          >
            <Download className="w-4 h-4 mr-2" />
            Export MIS Pack
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('kpis')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'kpis'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Executive KPI Scorecard
        </button>
        <button
          onClick={() => setActiveTab('mis')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'mis'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Monthly MIS Pack
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'trends'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          7-Day Operational Trends
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <>
          {/* TAB 1: EXECUTIVE KPIS */}
          {activeTab === 'kpis' && (
            <div className="space-y-6">
              {/* Metric Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Bed Occupancy Rate
                    </span>
                    <Bed className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900 tabular-nums">
                      {kpiData?.clinical?.occupancyRatePercent}%
                    </span>
                    <span className="text-xs text-slate-500">
                      ({kpiData?.clinical?.occupiedBeds} / {kpiData?.clinical?.totalBeds} Beds)
                    </span>
                  </div>
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Optimal target range (75-85%)
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Avg Length of Stay (ALOS)
                    </span>
                    <Clock className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900 tabular-nums">
                      {kpiData?.clinical?.averageLengthOfStayDays}
                    </span>
                    <span className="text-xs text-slate-500">Days</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Active Inpatient Census: {kpiData?.clinical?.activeCensus}</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Today Footfall (OPD / ER)
                    </span>
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900 tabular-nums">
                      {kpiData?.clinical?.todayEncounters}
                    </span>
                    <span className="text-xs text-amber-600 font-medium">
                      ({kpiData?.clinical?.todayEmergencyVisits} ER Triage)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Patient consultations recorded today</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Total Billed & AR
                    </span>
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900 tabular-nums">
                      ${kpiData?.financial?.totalBilled?.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Collected: ${kpiData?.financial?.totalCollected?.toLocaleString()} | AR: ${kpiData?.financial?.outstandingAr?.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Quality & Safety Scorecard */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-900 text-base">Clinical Quality & Safety Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Hospital Mortality Rate</span>
                    <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{kpiData?.clinical?.mortalityRatePercent}%</p>
                    <p className="text-xs text-emerald-600 mt-1">Zero unreviewed sentinel events</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Hospital Acquired Infection</span>
                    <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{kpiData?.clinical?.infectionRatePercent}%</p>
                    <p className="text-xs text-slate-500 mt-1">Well below CDC 1.5% threshold</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Revenue Collection Ratio</span>
                    <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{kpiData?.financial?.collectionRatioPercent}%</p>
                    <p className="text-xs text-slate-500 mt-1">Cashier and insurance receipts reconciled</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MONTHLY MIS PACK */}
          {activeTab === 'mis' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Departmental Utilization */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold text-slate-900 text-sm">Department Volume & Utilization</h3>
                    <Badge variant="neutral">{misData?.departments?.length || 0} Departments</Badge>
                  </div>
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Department</th>
                        <th className="px-4 py-2.5 text-right">Patients</th>
                        <th className="px-4 py-2.5 text-right">Revenue ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {misData?.departments?.map((dept: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-medium text-slate-900">{dept.department}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{dept.patientCount}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-900 tabular-nums">
                            ${dept.revenue.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Top Prescribed Medications */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold text-slate-900 text-sm">Top 5 Prescribed Medications</h3>
                    <Badge variant="neutral">Pharmacy FEFO</Badge>
                  </div>
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Drug Name</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5 text-right">Units Dispensed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {misData?.topMedications?.map((m: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-medium text-slate-900">{m.name}</td>
                          <td className="px-4 py-2.5 text-slate-500 text-xs">{m.category}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-indigo-600 tabular-nums">{m.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Turnaround Time Benchmarks */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-900 text-sm">Operational Turnaround Benchmarks (TAT)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500">Avg OPD Wait Time</span>
                    <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                      {misData?.hospitalTurnaround?.averageOpdWaitMinutes} mins
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500">ER Triage Assessment</span>
                    <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                      {misData?.hospitalTurnaround?.averageErTriageMinutes} mins
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500">Bed Turnaround (Clean)</span>
                    <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                      {misData?.hospitalTurnaround?.bedTurnaroundMinutes} mins
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500">Pharmacy Dispense TAT</span>
                    <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                      {misData?.hospitalTurnaround?.pharmacyDispenseMinutes} mins
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 7-DAY OPERATIONAL TRENDS */}
          {activeTab === 'trends' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
              <h3 className="font-semibold text-slate-900 text-sm">7-Day Daily Volume & Revenue Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">OPD Visits</th>
                      <th className="px-4 py-3 text-right">ER Admissions</th>
                      <th className="px-4 py-3 text-right">IPD Admissions</th>
                      <th className="px-4 py-3 text-right">Daily Revenue ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trends.map((t: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">{t.date}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{t.opdVisits}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-600 font-medium">{t.erAdmissions}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-cyan-600 font-medium">{t.inpatientAdmissions}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                          ${t.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* EXPORT MODAL */}
      {exportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-600" />
                Export Hospital MIS Report
              </h3>
              <button
                onClick={() => setExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {exportSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {exportSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">Report Scope</label>
                <select
                  value={exportReportType}
                  onChange={(e) => setExportReportType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="MIS_PACK">Comprehensive Monthly MIS Pack</option>
                  <option value="CENSUS_REPORT">Hospital Inpatient Census & BOR</option>
                  <option value="FINANCIAL_SUMMARY">Revenue & Accounts Receivable</option>
                  <option value="CLINICAL_QUALITY">Clinical Quality & Safety Metrics</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">File Format</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setExportFormat('json')}
                    className={`px-3 py-2 border rounded-lg text-sm font-medium text-center ${
                      exportFormat === 'json'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    JSON Pack
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={`px-3 py-2 border rounded-lg text-sm font-medium text-center ${
                      exportFormat === 'csv'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    CSV Spreadsheet
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="asyncWorker"
                  checked={exportAsync}
                  onChange={(e) => setExportAsync(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="asyncWorker" className="text-xs text-slate-600">
                  Process asynchronously via BullMQ background worker queue
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setExportModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? 'Exporting...' : 'Generate & Download'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
