'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button,
  Badge,
  Skeleton,
  ErrorState, Select } from '@enterprise-hms/ui';
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
          <h1 className="text-2xl font-bold text-text tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-brand" />
            Multi-Hospital Enterprise Administration
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Centralized group hospital registry, cross-site aggregated analytics, and subscription limits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/enterprise/modules"
            className="inline-flex items-center justify-center px-4 py-2 border border-border text-sm font-medium rounded-lg text-brand bg-surface-subtle hover:bg-surface-subtle shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            Module Manager & Licensing
          </Link>
          <Button
            size="sm"
            onClick={() => setRegisterModalOpen(true)}
            className="bg-brand hover:bg-brand-hover text-brand-foreground"
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
            <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Enrolled Hospitals
                </span>
                <Building2 className="w-5 h-5 text-brand" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-text tabular-nums">
                  {metrics?.networkOverview?.totalHospitals || hospitals.length}
                </span>
                <span className="text-xs text-text-muted">
                  ({metrics?.networkOverview?.totalBranches || 1} Branches)
                </span>
              </div>
              <p className="text-xs text-text-muted mt-2">Active in enterprise group</p>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Network Bed Capacity
                </span>
                <Bed className="w-5 h-5 text-info" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-text tabular-nums">
                  {metrics?.networkOverview?.totalLicensedBeds}
                </span>
                <span className="text-xs text-text-muted">Beds</span>
              </div>
              <p className="text-xs text-text-muted mt-2">
                Network Occupancy: {metrics?.networkOverview?.networkOccupancyRate}%
              </p>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Registered Patients
                </span>
                <Users className="w-5 h-5 text-warning" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-text tabular-nums">
                  {metrics?.networkOverview?.totalRegisteredPatients}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-2">Shared master patient index</p>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Consolidated Group Revenue
                </span>
                <DollarSign className="w-5 h-5 text-stable" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-text tabular-nums">
                  ${metrics?.financialConsolidation?.grossGroupRevenue?.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-2">
                Net Collections: ${metrics?.financialConsolidation?.netGroupCollections?.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Subscription Limits & Compliance Tier */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand" />
                <h3 className="font-semibold text-text text-sm">Enterprise License & Entitlement Limits</h3>
              </div>
              <Badge variant="stable">{subscription.status || 'ACTIVE'}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-surface-subtle rounded-lg">
                <span className="text-text-muted">Enterprise Plan</span>
                <p className="font-bold text-text mt-1">{subscription.enterprisePlan}</p>
              </div>
              <div className="p-3 bg-surface-subtle rounded-lg">
                <span className="text-text-muted">Hospital Quota</span>
                <p className="font-bold text-text mt-1">Up to {subscription.limits?.maxHospitals} Facilities</p>
              </div>
              <div className="p-3 bg-surface-subtle rounded-lg">
                <span className="text-text-muted">Bed License</span>
                <p className="font-bold text-text mt-1">Up to {subscription.limits?.maxBeds} Beds</p>
              </div>
              <div className="p-3 bg-surface-subtle rounded-lg">
                <span className="text-text-muted">Compliance Framework</span>
                <p className="font-bold text-text mt-1">{subscription.complianceLevel}</p>
              </div>
            </div>
          </div>

          {/* Hospitals Table */}
          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-surface-subtle">
              <h3 className="font-semibold text-text text-sm">Connected Hospitals</h3>
              <Badge variant="neutral">{hospitals.length} Hospitals</Badge>
            </div>
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-surface-subtle/50 border-b border-border text-xs font-semibold text-text-muted uppercase">
                <tr>
                  <th className="px-6 py-3.5">Hospital Name</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Branches</th>
                  <th className="px-6 py-3.5">Timezone / Currency</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {hospitals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-text-muted">
                      No hospitals registered in enterprise network yet.
                    </td>
                  </tr>
                ) : (
                  hospitals.map((h: any) => (
                    <tr key={h.id} className="hover:bg-surface-subtle/50">
                      <td className="px-6 py-4 font-semibold text-text">
                        {h.name}
                        {h.legalName && <span className="block text-xs text-text-muted font-normal">{h.legalName}</span>}
                      </td>
                      <td className="px-6 py-4 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-text-muted" />
                          {h.city || 'Metro City'}, {h.country || 'USA'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-text">
                        {h.branchesCount || 1} Campus Branches
                      </td>
                      <td className="px-6 py-4 text-xs text-text-muted">
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
        <div className="fixed inset-0 bg-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRegisterHospital}
            className="bg-surface rounded-xl shadow-xl border border-border max-w-md w-full p-6 space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-text flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand" />
                Enrol New Hospital Facility
              </h3>
              <button
                type="button"
                onClick={() => setRegisterModalOpen(false)}
                className="text-text-muted hover:text-text-muted"
              >
                x
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text">Facility / Hospital Name *</label>
                <input
                  type="text"
                  required
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="e.g. St. Jude Children Hospital"
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="New York"
                    className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text">State / Region</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="NY"
                    className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text">Currency</label>
                <Select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setRegisterModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-brand hover:bg-brand-hover text-brand-foreground">
                {saving ? 'Enrolling...' : 'Enrol Facility'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
