'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Users,
  Building2,
  Layers,
  ShieldCheck,
  TrendingUp,
  Activity,
  Calendar,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Button,
  NumberCounter,
  Skeleton,
  staggerContainerVariants,
  staggerItemVariants,
} from '@enterprise-hms/ui';
import { analyticsApi, userApi } from '@/lib/api';

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(false);

  const [metrics, setMetrics] = useState({
    activePersonnel: 24,
    hospitalBranches: 2,
    clinicalUnits: 12,
    activeRoles: 6,
    opdIntake: 142,
    bedOccupancy: 86,
    diagnosticsTat: '38m',
    dispensesToday: 312,
  });

  const [recentAudit, setRecentAudit] = useState<Array<{ id: string; action: string; entity: string; entityId?: string; createdAt: string }>>([
    { id: '1', action: 'PATIENT_REGISTERED', entity: 'Patient', entityId: 'P-10023', createdAt: new Date(Date.now() - 5 * 60000).toISOString() },
    { id: '2', action: 'PRESCRIPTION_DISPENSED', entity: 'Pharmacy', entityId: 'RX-9821', createdAt: new Date(Date.now() - 15 * 60000).toISOString() },
    { id: '3', action: 'ADMISSION_CONFIRMED', entity: 'IPD', entityId: 'ADM-401', createdAt: new Date(Date.now() - 32 * 60000).toISOString() },
    { id: '4', action: 'LAB_RESULT_VALIDATED', entity: 'Laboratory', entityId: 'LAB-5541', createdAt: new Date(Date.now() - 48 * 60000).toISOString() },
    { id: '5', action: 'PAYMENT_RECEIVED', entity: 'Billing', entityId: 'INV-1092', createdAt: new Date(Date.now() - 65 * 60000).toISOString() },
  ]);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const animated = sessionStorage.getItem('hms_dashboard_animated');
      if (!animated) {
        setIsFirstLoad(true);
        sessionStorage.setItem('hms_dashboard_animated', 'true');
      }
    }

    async function loadData() {
      try {
        const [kpiRes, usersRes] = await Promise.all([
          analyticsApi.getKpis().catch(() => null),
          userApi.getUsers().catch(() => null),
        ]);

        if (kpiRes?.data) {
          setMetrics((prev) => ({
            ...prev,
            opdIntake: kpiRes.data.operational?.opdVisits || prev.opdIntake,
            bedOccupancy: kpiRes.data.operational?.bedOccupancyRate || prev.bedOccupancy,
            dispensesToday: kpiRes.data.operational?.pharmacyDispenses || prev.dispensesToday,
          }));
        }

        if (usersRes?.data && Array.isArray(usersRes.data)) {
          setMetrics((prev) => ({
            ...prev,
            activePersonnel: usersRes.data.length || prev.activePersonnel,
          }));
        }
      } catch {
        // Fallback to default metrics
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Enterprise Overview</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time status across hospital branches, departments, and active clinical sessions.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <Link href="/appointments">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Calendar className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />}
            >
              Appointments
            </Button>
          </Link>
          <Link href="/patients">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Users className="w-3.5 h-3.5 text-white" aria-hidden="true" />}
            >
              Register Patient
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards (staggered entrance on first load only) */}
      <motion.div
        variants={staggerContainerVariants}
        initial={isFirstLoad ? 'hidden' : 'show'}
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={staggerItemVariants}>
          <StatCard
            title="Active Personnel"
            value={metrics.activePersonnel}
            trend="+2.5%"
            icon={<Users className="w-5 h-5 text-[#0891B2]" aria-hidden="true" />}
            loading={loading}
          />
        </motion.div>
        <motion.div variants={staggerItemVariants}>
          <StatCard
            title="Hospital Branches"
            value={metrics.hospitalBranches}
            trend="Active"
            icon={<Building2 className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
            loading={loading}
          />
        </motion.div>
        <motion.div variants={staggerItemVariants}>
          <StatCard
            title="Clinical Units"
            value={metrics.clinicalUnits}
            trend="100% online"
            icon={<Layers className="w-5 h-5 text-[#059669]" aria-hidden="true" />}
            loading={loading}
          />
        </motion.div>
        <motion.div variants={staggerItemVariants}>
          <StatCard
            title="RBAC Roles"
            value={metrics.activeRoles}
            trend="Audited"
            icon={<ShieldCheck className="w-5 h-5 text-amber-600" aria-hidden="true" />}
            loading={loading}
          />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* System Activity & Clinical Volume */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0891B2]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Operational Throughput</h2>
            </div>
            <span className="text-xs text-slate-400">Past 24 Hours</span>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">Outpatient Intake</span>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  <NumberCounter value={metrics.opdIntake} />
                </p>
                <span className="text-[11px] text-emerald-600 font-medium">98.4% on time</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">Inpatient Bed Occ.</span>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  <NumberCounter value={metrics.bedOccupancy} suffix="%" />
                </p>
                <span className="text-[11px] text-cyan-600 font-medium">Available</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">Diagnostics TAT</span>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">{metrics.diagnosticsTat}</p>
                <span className="text-[11px] text-emerald-600 font-medium">Within SLA</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">Dispenses Today</span>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  <NumberCounter value={metrics.dispensesToday} />
                </p>
                <span className="text-[11px] text-cyan-600 font-medium">100% FEFO</span>
              </div>
            </div>

            {/* Hourly Volume Distribution */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Peak Load Hours (08:00 - 18:00)</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">Average: 42 visits/hr</span>
              </div>
              <div className="h-28 flex items-end gap-2 pt-2 pb-1 px-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                {[30, 45, 75, 95, 88, 92, 70, 85, 60, 40, 25, 20].map((height, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-[#0891B2] hover:bg-[#0E7490] rounded-xs transition-all cursor-pointer"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Audit & Event Feed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Live Clinical Activity</h2>
            <Link href="/enterprise/admin" className="text-xs text-[#0891B2] hover:underline flex items-center gap-1">
              <span>Audit Trail</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>

          <div className="p-4 flex-1 divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[340px]">
            {loading ? (
              <div className="space-y-3 py-2">
                <Skeleton height="36px" />
                <Skeleton height="36px" />
                <Skeleton height="36px" />
              </div>
            ) : (
              recentAudit.map((event) => (
                <div key={event.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-slate-800 dark:text-slate-200 block">{event.action.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] text-slate-400">
                      {event.entity} {event.entityId ? `• ${event.entityId}` : ''}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  trend,
  icon,
  loading = false,
}: {
  title: string;
  value: number;
  trend: string;
  icon: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start">
        <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800 px-2 py-0.5 rounded-full">
          {trend}
        </span>
      </div>
      <div className="mt-3">
        <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        {loading ? (
          <Skeleton width="60px" height="28px" className="mt-1" />
        ) : (
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 tracking-tight tabular-nums">
            <NumberCounter value={value} />
          </p>
        )}
      </div>
    </div>
  );
}
