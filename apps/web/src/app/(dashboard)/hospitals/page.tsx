'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Search, Plus, MapPin } from 'lucide-react';
import { Button } from '@enterprise-hms/ui';
import { hospitalsApi } from '@/lib/api';

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadHospitals() {
      try {
        const res = await hospitalsApi.getHospitals();
        if (res?.data) {
          setHospitals(res.data);
        }
      } catch {
        // Fallback default
        setHospitals([
          {
            id: 'hosp-1',
            name: 'Central General Hospital',
            legalName: 'Apex Health Systems Ltd.',
            city: 'Metro City',
            state: 'NY',
            branchCount: 3,
            isActive: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadHospitals();
  }, []);

  const filteredHospitals = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.city && h.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hospitals & Branches</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage the hospital network and associated physical facilities.</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
          onClick={() => alert('New hospital enrollment is available under Enterprise Administration.')}
        >
          Add Hospital
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search hospitals by name, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {filteredHospitals.length} facilities registered
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3">Facility Name</th>
                <th className="px-6 py-3">Location</th>
                <th className="px-6 py-3">Active Branches</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Loading facility registry...
                  </td>
                </tr>
              ) : filteredHospitals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No matching hospital facilities found.
                  </td>
                </tr>
              ) : (
                filteredHospitals.map((hospital) => (
                  <tr key={hospital.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-slate-900">{hospital.name}</div>
                      {hospital.legalName && (
                        <div className="text-[11px] text-slate-400">{hospital.legalName}</div>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {hospital.city ? `${hospital.city}, ${hospital.state || ''}` : 'Primary Campus'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-700">
                      {hospital.branchCount ?? 1} Branches
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {hospital.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => alert(`Viewing details for ${hospital.name}`)}
                        className="text-cyan-700 hover:text-cyan-900 font-medium text-xs"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
