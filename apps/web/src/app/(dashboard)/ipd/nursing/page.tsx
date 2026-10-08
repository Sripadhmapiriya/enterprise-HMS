'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ipdApi } from '@/lib/api';
import { Select, Button, Dialog, Textarea } from '@enterprise-hms/ui';
import { AlertCircle, FileText, Activity, FlaskConical, Pill } from 'lucide-react';

export default function NursingStationPage() {
  const [loading, setLoading] = useState(true);
  const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [wardFilter, setWardFilter] = useState('ALL');
  
  // Handover state
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [selectedAdmForHandover, setSelectedAdmForHandover] = useState<any>(null);
  const [handoverNote, setHandoverNote] = useState('');
  const [submittingHandover, setSubmittingHandover] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await ipdApi.getNursingWorklist();
      setActiveAdmissions(res.data || []);
    } catch (err: any) {
      console.error('Failed to load nursing worklist data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = activeAdmissions.filter((adm) => {
    const name = `${adm.patient?.firstName || ''} ${adm.patient?.lastName || ''}`.toLowerCase();
    const mrn = (adm.patient?.mrn || '').toLowerCase();
    const bed = adm.bedAllocations?.[0]?.bed?.bedNumber?.toLowerCase() || '';
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q || name.includes(q) || mrn.includes(q) || bed.includes(q);

    const wardName = adm.bedAllocations?.[0]?.bed?.ward?.name;
    const matchesWard = wardFilter === 'ALL' || wardName === wardFilter;

    return matchesSearch && matchesWard;
  });

  const wards = Array.from(
    new Set(
      activeAdmissions
        .map((adm) => adm.bedAllocations?.[0]?.bed?.ward?.name)
        .filter(Boolean)
    )
  );

  const handleSaveHandover = async () => {
    if (!selectedAdmForHandover || !handoverNote.trim()) return;
    try {
      setSubmittingHandover(true);
      await ipdApi.createNursingNote(selectedAdmForHandover.id, {
        observation: handoverNote.trim(),
        intervention: 'Shift Handover'
      });
      setHandoverModalOpen(false);
      setHandoverNote('');
      setSelectedAdmForHandover(null);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingHandover(false);
    }
  };
  
  const openHandover = (adm: any) => {
    setSelectedAdmForHandover(adm);
    setHandoverNote('');
    setHandoverModalOpen(true);
  };

  // KPIs
  const totalMedsDue = filtered.reduce((acc, adm) => {
    let due = 0;
    adm.medicationOrders?.forEach((o: any) => {
      due += o.administrations?.length || 0;
    });
    return acc + due;
  }, 0);

  const totalPendingOrders = filtered.reduce((acc, adm) => {
    return acc + (adm.inpatientOrders?.length || 0);
  }, 0);

  const totalAlerts = filtered.reduce((acc, adm) => {
    return acc + (adm.patient?.alerts?.length || 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Nursing Workstation</h1>
          <p className="text-text-muted text-sm mt-0.5">
            Manage your ward worklist: monitor tasks due, track medications, and record shift handovers.
          </p>
        </div>
        <Link
          href="/ipd/bed-board"
          className="inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-lg text-text bg-surface hover:bg-surface-subtle shadow-sm transition-colors"
        >
          Bed Board Visualizer
        </Link>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Active Inpatients</p>
          <p className="text-2xl font-bold text-text mt-2">{filtered.length}</p>
          <p className="text-xs text-text-muted mt-1">Currently in selected ward(s)</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Meds Due / Overdue</p>
          <p className="text-2xl font-bold text-critical mt-2">{totalMedsDue}</p>
          <p className="text-xs text-text-muted mt-1">From MAR schedule</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Pending Orders</p>
          <p className="text-2xl font-bold text-warning mt-2">{totalPendingOrders}</p>
          <p className="text-xs text-text-muted mt-1">Lab, Rad, Dietary</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Critical Alerts</p>
          <p className="text-2xl font-bold text-critical mt-2">{totalAlerts}</p>
          <p className="text-xs text-text-muted mt-1">Active patient flags</p>
        </div>
      </div>

      {/* Main Worklist Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-subtle/30">
          <input
            type="text"
            placeholder="Search patient, bed number, MRN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand bg-surface"
          />
          <Select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="px-3 py-1.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-1 focus:ring-brand w-full sm:w-auto"
          >
            <option value="ALL">All Wards</option>
            {wards.map((w: any) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Bed & Ward</th>
                <th className="px-6 py-4">Patient & Flags</th>
                <th className="px-6 py-4">Admission Reason</th>
                <th className="px-6 py-4">Tasks Due</th>
                <th className="px-6 py-4">Latest Handover</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-muted">
                    Loading nursing station registry...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-muted">
                    No active inpatients found for this criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((adm) => {
                  const alloc = adm.bedAllocations?.[0];
                  const bed = alloc?.bed;
                  
                  const age = adm.patient?.dateOfBirth ? Math.floor((new Date().getTime() - new Date(adm.patient.dateOfBirth).getTime()) / 31557600000) : '?';
                  
                  const medsCount = adm.medicationOrders?.reduce((acc: number, curr: any) => acc + (curr.administrations?.length || 0), 0) || 0;
                  const ordersCount = adm.inpatientOrders?.length || 0;
                  
                  const activeAllergies = adm.patient?.allergies || [];
                  const activeAlerts = adm.patient?.alerts || [];
                  const latestNote = adm.nursingNotes?.[0];

                  return (
                    <tr key={adm.id} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap align-top">
                        {bed ? (
                          <div>
                            <span className="font-bold text-text text-base">{bed.bedNumber}</span>
                            <span className="text-xs text-text-muted block mt-0.5">
                              {bed.ward?.name || 'General'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-warning font-semibold bg-warning-bg px-2 py-0.5 rounded-full border border-warning-border">
                            Unallocated
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="font-semibold text-text">
                          {adm.patient?.firstName} {adm.patient?.lastName}
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">
                          {adm.patient?.mrn} • {age}Y / {adm.patient?.gender?.charAt(0)}
                        </div>
                        
                        {(activeAllergies.length > 0 || activeAlerts.length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {activeAllergies.map((al: any) => (
                              <span key={al.id} className="inline-flex items-center gap-1 text-[10px] font-semibold text-critical bg-critical-bg border border-critical-border px-1.5 py-0.5 rounded">
                                <AlertCircle className="w-3 h-3" />
                                {al.allergen}
                              </span>
                            ))}
                            {activeAlerts.map((al: any) => (
                              <span key={al.id} className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning bg-warning-bg border border-warning-border px-1.5 py-0.5 rounded">
                                <Activity className="w-3 h-3" />
                                {al.title}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="text-sm">
                          {adm.reason || 'General inpatient care'}
                        </div>
                        <div className="text-xs text-text-muted mt-1 font-mono">
                          {adm.admissionNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <Pill className={`w-3.5 h-3.5 ${medsCount > 0 ? 'text-critical' : 'text-stable'}`} />
                            <span className={medsCount > 0 ? 'text-critical font-bold' : 'text-text-muted'}>
                              {medsCount} Meds Due
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <FlaskConical className={`w-3.5 h-3.5 ${ordersCount > 0 ? 'text-warning' : 'text-stable'}`} />
                            <span className={ordersCount > 0 ? 'text-warning font-bold' : 'text-text-muted'}>
                              {ordersCount} Orders Pending
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top max-w-xs">
                        {latestNote ? (
                          <div>
                            <div className="text-xs font-medium text-text truncate" title={latestNote.observation}>
                              "{latestNote.observation}"
                            </div>
                            <div className="text-[10px] text-text-muted mt-1 flex justify-between items-center">
                              <span>By {latestNote.nurse?.firstName} {latestNote.nurse?.lastName}</span>
                              <span>{new Date(latestNote.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted italic">No handover notes</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-right space-y-2">
                        <Link
                          href={`/ipd/chart/${adm.id}`}
                          className="w-full inline-flex justify-center items-center gap-1 text-xs font-semibold text-brand hover:text-brand-hover bg-brand-bg px-3 py-1.5 rounded-lg border border-brand/20 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" /> Open Chart
                        </Link>
                        <button
                          onClick={() => openHandover(adm)}
                          className="w-full inline-flex justify-center items-center gap-1 text-xs font-semibold text-text hover:bg-surface-subtle px-3 py-1.5 rounded-lg border border-border transition-colors mt-2"
                        >
                          Log Handover
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
      
      <Dialog 
        isOpen={handoverModalOpen} 
        onClose={() => setHandoverModalOpen(false)}
        title="Shift Handover Note"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Record clinical status and handover instructions (SBAR format recommended) for {selectedAdmForHandover?.patient?.firstName} {selectedAdmForHandover?.patient?.lastName}.
          </p>
          <Textarea
            value={handoverNote}
            onChange={(e) => setHandoverNote(e.target.value)}
            placeholder="Situation, Background, Assessment, Recommendation..."
            rows={5}
            className="w-full text-sm"
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button variant="outline" onClick={() => setHandoverModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveHandover} 
              disabled={submittingHandover || !handoverNote.trim()}
            >
              {submittingHandover ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
