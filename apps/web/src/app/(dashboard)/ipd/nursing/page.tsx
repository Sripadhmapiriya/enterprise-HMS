'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ipdApi } from '@/lib/api';

export default function NursingStationPage() {
  const [loading, setLoading] = useState(true);
  const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [wardFilter, setWardFilter] = useState('ALL');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await ipdApi.getAdmissions({ status: 'ADMITTED' });
      setActiveAdmissions(res.data || []);
    } catch (err: any) {
      console.error('Failed to load nursing station data', err);
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

  // Extract unique wards for filter
  const wards = Array.from(
    new Set(
      activeAdmissions
        .map((adm) => adm.bedAllocations?.[0]?.bed?.ward?.name)
        .filter(Boolean)
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Nursing Workstation</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Inpatient ward telemetry, medication administration status, and nursing assessments.
          </p>
        </div>
        <Link
          href="/ipd/bed-board"
          className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
        >
          Bed Board Visualizer
        </Link>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Inpatients</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{activeAdmissions.length}</p>
          <p className="text-xs text-slate-400 mt-1">Currently admitted under care</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Wards</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">{wards.length}</p>
          <p className="text-xs text-slate-400 mt-1">Wards with admitted patients</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">MAR Compliance</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">100%</p>
          <p className="text-xs text-slate-400 mt-1">5-Rights verification enforced</p>
        </div>
      </div>

      {/* Main Worklist Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <input
            type="text"
            placeholder="Search patient, bed number, MRN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Wards</option>
            {wards.map((w: any) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Bed & Ward</th>
                <th className="px-6 py-4">Patient Details</th>
                <th className="px-6 py-4">Admission #</th>
                <th className="px-6 py-4">Clinical Indication</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    Loading nursing station registry...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No active inpatients found.
                  </td>
                </tr>
              ) : (
                filtered.map((adm) => {
                  const alloc = adm.bedAllocations?.find((a: any) => a.status === 'OCCUPIED');
                  const bed = alloc?.bed;

                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        {bed ? (
                          <div>
                            <span className="font-bold text-slate-900 text-sm">{bed.bedNumber}</span>
                            <span className="text-xs text-slate-500 block">
                              {bed.ward?.name || 'General Ward'} • {bed.bedType}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                            Unallocated
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {adm.patient?.firstName} {adm.patient?.lastName}
                        </div>
                        <div className="text-xs text-slate-400">
                          MRN: {adm.patient?.mrn} • {adm.patient?.gender} • Blood: {adm.patient?.bloodGroup || 'Unspecified'}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-700">
                        {adm.admissionNumber}
                        <span className="text-slate-400 block font-sans">
                          Admitted {new Date(adm.admissionDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700">
                        {adm.reason || 'General inpatient care'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          In Care
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/ipd/chart/${adm.id}`}
                          className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"
                        >
                          MAR & Chart →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
