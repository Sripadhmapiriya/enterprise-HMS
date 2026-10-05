'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Button,
  Badge,
  Skeleton,
  ErrorState,
} from '@enterprise-hms/ui';
import {
  Building2,
  ShieldCheck,
  Plus,
  RefreshCw,
  Bed,
  Users,
  DollarSign,
  Layers,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { enterpriseApi } from '@/lib/api';

export default function EnterpriseAdminPage() {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Hospital Modal
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [hospitalName, setHospitalName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [hospRes, metricsRes, subRes] = await Promise.all([
        enterpriseApi.getHospitals(),
        enterpriseApi.getCrossSiteMetrics(),
        enterpriseApi.getSubscriptions(),
      ]);

      setHospitals(hospRes.data || []);
      setMetrics(metricsRes.data || {});
      setSubscription(subRes.data || {});
    } catch (err: any) {
      setError(err.message || 'Failed to load enterprise network data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRegisterHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalName) return;

    try {
      setSaving(true);
      await enterpriseApi.registerHospital({
        name: hospitalName,
        city: city || 'Metro City',
        state: state || 'Central',
        currency,
      });
      setRegisterModalOpen(false);
      setHospitalName('');
      setCity('');
      setState('');
      loadData();
    } catch (err: any) {
      alert(`Registration failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-600" />
            Multi-Hospital Enterprise Administration
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Centralized group hospital registry, cross-site aggregated analytics, and subscription limits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/enterprise/modules"
            className="inline-flex items-center justify-center px-4 py-2 border border-indigo-200 text-sm font-medium rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            Module Manager & Licensing
          </Link>
          <Button
            size="sm"
            onClick={() => setRegisterModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Enrol Hospital
          </Button>
        </div>
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
          {/* Group KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Enrolled Hospitals
                </span>
                <Building2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  {metrics?.networkOverview?.totalHospitals || hospitals.length}
                </span>
                <span className="text-xs text-slate-500">
                  ({metrics?.networkOverview?.totalBranches || 1} Branches)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Active in enterprise group</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Network Bed Capacity
                </span>
                <Bed className="w-5 h-5 text-cyan-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  {metrics?.networkOverview?.totalLicensedBeds}
                </span>
                <span className="text-xs text-slate-500">Beds</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Network Occupancy: {metrics?.networkOverview?.networkOccupancyRate}%
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Registered Patients
                </span>
                <Users className="w-5 h-5 text-amber-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  {metrics?.networkOverview?.totalRegisteredPatients}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Shared master patient index</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Consolidated Group Revenue
                </span>
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  ${metrics?.financialConsolidation?.grossGroupRevenue?.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Net Collections: ${metrics?.financialConsolidation?.netGroupCollections?.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Subscription Limits & Compliance Tier */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900 text-sm">Enterprise License & Entitlement Limits</h3>
              </div>
              <Badge variant="stable">{subscription.status || 'ACTIVE'}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Enterprise Plan</span>
                <p className="font-bold text-slate-900 mt-1">{subscription.enterprisePlan}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Hospital Quota</span>
                <p className="font-bold text-slate-900 mt-1">Up to {subscription.limits?.maxHospitals} Facilities</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Bed License</span>
                <p className="font-bold text-slate-900 mt-1">Up to {subscription.limits?.maxBeds} Beds</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Compliance Framework</span>
                <p className="font-bold text-slate-900 mt-1">{subscription.complianceLevel}</p>
              </div>
            </div>
          </div>

          {/* Hospitals Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-900 text-sm">Connected Hospitals</h3>
              <Badge variant="neutral">{hospitals.length} Hospitals</Badge>
            </div>
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Hospital Name</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Branches</th>
                  <th className="px-6 py-3.5">Timezone / Currency</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hospitals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No hospitals registered in enterprise network yet.
                    </td>
                  </tr>
                ) : (
                  hospitals.map((h: any) => (
                    <tr key={h.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {h.name}
                        {h.legalName && <span className="block text-xs text-slate-400 font-normal">{h.legalName}</span>}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {h.city || 'Metro City'}, {h.country || 'USA'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700">
                        {h.branchesCount || 1} Campus Branches
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {h.timezone || 'UTC'} | {h.currency || 'USD'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={h.isActive ? 'stable' : 'critical'}>
                          {h.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* REGISTER HOSPITAL MODAL */}
      {registerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRegisterHospital}
            className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                Enrol New Hospital Facility
              </h3>
              <button
                type="button"
                onClick={() => setRegisterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Facility / Hospital Name *</label>
                <input
                  type="text"
                  required
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="e.g. St. Jude Children Hospital"
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="New York"
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">State / Region</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="NY"
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setRegisterModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {saving ? 'Enrolling...' : 'Enrol Facility'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
