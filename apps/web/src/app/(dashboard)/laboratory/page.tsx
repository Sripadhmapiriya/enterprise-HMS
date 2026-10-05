'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FlaskConical, AlertTriangle, CheckCircle2, Clock, RefreshCw, Download, ArrowUpRight } from 'lucide-react';
import { laboratoryApi } from '@/lib/api';
import { Button, Badge, Dialog, Input } from '@enterprise-hms/ui';

export default function LaboratoryDashboard() {
  const [samples, setSamples] = useState<any[]>([]);
  const [criticalResults, setCriticalResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Critical Acknowledgment Modal
  const [isAckOpen, setIsAckOpen] = useState(false);
  const [activeCritical, setActiveCritical] = useState<any | null>(null);
  const [ackMethod, setAckMethod] = useState<'PHONE' | 'VERBAL' | 'IN_PERSON' | 'EMR_ALERT'>('PHONE');
  const [ackNotes, setAckNotes] = useState('');
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        laboratoryApi.getSamples(),
        laboratoryApi.getCriticalResults(),
      ]);
      if (sRes.data) setSamples(sRes.data);
      if (cRes.data) setCriticalResults(cRes.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAck = (crit: any) => {
    setActiveCritical(crit);
    setAckNotes('');
    setIsAckOpen(true);
  };

  const handleAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCritical) return;

    setIsSubmittingAck(true);
    try {
      await laboratoryApi.acknowledgeCritical(activeCritical.id, {
        method: ackMethod,
        notes: ackNotes || undefined,
      });
      setIsAckOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Acknowledgment failed');
    } finally {
      setIsSubmittingAck(false);
    }
  };

  const pendingCollection = samples.filter((s) => s.status === 'PENDING').length;
  const processing = samples.filter((s) => s.status === 'PROCESSING' || s.status === 'COLLECTED').length;
  const completed = samples.filter((s) => s.status === 'COMPLETED').length;
  const pendingCritical = criticalResults.filter((c) => c.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FlaskConical className="w-6 h-6 text-sky-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clinical Laboratory Hub</h1>
          </div>
          <p className="text-slate-500 mt-1">Diagnostic sample accessioning, result authorization, critical alerts, and reports</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="secondary" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/laboratory/worklist">
            <Button>
              Worklist & Result Entry
              <ArrowUpRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Pending Accession</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{pendingCollection}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-sky-200 shadow-sm bg-sky-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-800 uppercase">Processing / Testing</span>
            <FlaskConical className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-3xl font-bold text-sky-700 mt-2 tabular-nums">{processing}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Authorized & Reported</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-emerald-600 mt-2 tabular-nums">{completed}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-sm bg-rose-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 uppercase">Critical Value Alerts</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-3xl font-bold text-rose-700 mt-2 tabular-nums">{pendingCritical}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Alerts Banner Board */}
        <div className="bg-white border border-rose-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-rose-100 bg-rose-50/60 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="font-semibold text-rose-900 text-sm">Urgent Panic / Critical Values</h3>
            </div>
            <span className="text-xs font-bold text-rose-700">{pendingCritical} Pending</span>
          </div>

          <div className="divide-y divide-rose-100">
            {criticalResults.map((c) => (
              <div key={c.id} className="p-4 bg-rose-50/20 hover:bg-rose-50/50 transition-colors flex justify-between items-center">
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {c.patient?.firstName} {c.patient?.lastName} ({c.patient?.mrn})
                  </div>
                  <div className="text-xs text-rose-700 font-medium mt-0.5">{c.resultValue}</div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    {new Date(c.createdAt).toLocaleTimeString()}
                  </div>
                </div>

                <div>
                  {c.status === 'PENDING' ? (
                    <Button size="sm" variant="destructive" onClick={() => handleOpenAck(c)}>
                      Acknowledge
                    </Button>
                  ) : (
                    <Badge variant="stable" size="sm">
                      Acknowledged
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {criticalResults.length === 0 && !loading && (
              <div className="p-6 text-center text-sm text-slate-500">
                No active critical test alerts. Laboratory panic limits normal.
              </div>
            )}
          </div>
        </div>

        {/* Recent Diagnostic Samples */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 text-sm">Recent Samples & Reports</h3>
            <Link href="/laboratory/worklist" className="text-xs font-semibold text-sky-600 hover:text-sky-700">
              Worklist &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {samples.slice(0, 6).map((s) => (
              <div key={s.id} className="p-4 hover:bg-slate-50/60 transition-colors flex justify-between items-center">
                <div>
                  <div className="font-mono font-bold text-slate-900 text-sm">{s.sampleId}</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {s.patient?.firstName} {s.patient?.lastName} &bull; {s.specimenType?.name || 'Specimen'}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Badge variant={s.status === 'COMPLETED' ? 'stable' : s.status === 'PROCESSING' ? 'info' : 'warning'} size="sm">
                    {s.status}
                  </Badge>

                  {s.status === 'COMPLETED' && (
                    <a
                      href={laboratoryApi.getReportPdfUrl(s.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-semibold px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
            {samples.length === 0 && !loading && (
              <div className="p-6 text-center text-sm text-slate-500">No diagnostic samples found.</div>
            )}
          </div>
        </div>
      </div>

      {/* Critical Alert Acknowledgment Modal */}
      <Dialog isOpen={isAckOpen} onClose={() => setIsAckOpen(false)} title="Clinical Acknowledgment of Critical Alert">
        <form onSubmit={handleAcknowledge} className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1 text-rose-900">
            <div className="font-bold">CRITICAL PANIC VALUE:</div>
            <div>{activeCritical?.resultValue}</div>
            <div className="text-slate-600">
              Patient: {activeCritical?.patient?.firstName} {activeCritical?.patient?.lastName} ({activeCritical?.patient?.mrn})
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notification Method *</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={ackMethod}
              onChange={(e: any) => setAckMethod(e.target.value)}
            >
              <option value="PHONE">Direct Telephone Call to Clinician</option>
              <option value="VERBAL">Verbal Readback at Bedside</option>
              <option value="IN_PERSON">In-Person Handover to Charge Nurse</option>
              <option value="EMR_ALERT">Electronic Clinical Alert System</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Communication Notes</label>
            <Input
              value={ackNotes}
              onChange={(e) => setAckNotes(e.target.value)}
              placeholder="e.g. Read-back verified by Dr. Smith at 14:15"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setIsAckOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" type="submit" disabled={isSubmittingAck}>
              {isSubmittingAck ? 'Acknowledging...' : 'Confirm Acknowledgment'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
