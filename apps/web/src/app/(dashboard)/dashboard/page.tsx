'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Users,
  Building2,
  Layers,
  ShieldCheck,
  Activity,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import {
  Button,
  NumberCounter,
  Skeleton,
  staggerContainerVariants,
  staggerItemVariants,
} from '@enterprise-hms/ui';
import { analyticsApi } from '@/lib/api';

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(false);

  const [metrics, setMetrics] = useState({
    activePersonnel: 0,
    hospitalBranches: 0,
    clinicalUnits: 0,
    activeRoles: 0,
    opdIntake: 0,
    bedOccupancy: 0,
    diagnosticsTat: '0m',
    dispensesToday: 0,
  });

  const [onTimePercent, setOnTimePercent] = useState<number>(0);
  const [averageVisitsPerHour, setAverageVisitsPerHour] = useState<number>(0);
  const [hourlyDistribution, setHourlyDistribution] = useState<number[]>([]);
  const [recentAudit, setRecentAudit] = useState<Array<{ id: string; action: string; entity: string; entityId?: string; createdAt: string }>>([]);

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
        const dashRes = await analyticsApi.getDashboard().catch(() => null);

        if (dashRes?.data) {
          const d = dashRes.data;
          setMetrics({
            activePersonnel: d.metrics?.activePersonnel ?? 0,
            hospitalBranches: d.metrics?.hospitalBranches ?? 0,
            clinicalUnits: d.metrics?.clinicalUnits ?? 0,
            activeRoles: d.metrics?.activeRoles ?? 0,
            opdIntake: d.metrics?.opdIntake ?? 0,
            bedOccupancy: d.metrics?.bedOccupancy ?? 0,
            diagnosticsTat: d.metrics?.diagnosticsTat ?? '0m',
            dispensesToday: d.metrics?.dispensesToday ?? 0,
          });
          setOnTimePercent(d.onTimePercent ?? 0);
          setAverageVisitsPerHour(d.averageVisitsPerHour ?? 0);
          setHourlyDistribution(d.hourlyDistribution ?? []);
          setRecentAudit(d.recentAudit ?? []);
        } else {
          // Fallback to getKpis
          const kpiRes = await analyticsApi.getKpis().catch(() => null);
          if (kpiRes?.data) {
            const op = kpiRes.data.operational || {};
            setMetrics({
              activePersonnel: op.activePersonnel ?? 0,
              hospitalBranches: op.hospitalBranches ?? 0,
              clinicalUnits: op.clinicalUnits ?? 0,
              activeRoles: op.activeRoles ?? 0,
              opdIntake: op.opdVisits ?? 0,
              bedOccupancy: op.bedOccupancyRate ?? 0,
              diagnosticsTat: op.diagnosticsTat ?? '0m',
              dispensesToday: op.pharmacyDispenses ?? 0,
            });
          }
        }
      } catch {
        // Leave at initial zeros
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
          <h1 className="text-xl font-bold text-text tracking-tight">Enterprise Overview</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Real-time status across hospital branches, departments, and active clinical sessions.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <Link href="/appointments">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Calendar className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />}
            >
              Appointments
            </Button>
          </Link>
          <Link href="/patients">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Users className="w-3.5 h-3.5 text-brand-foreground" aria-hidden="true" />}
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
            trend="Staff"
            icon={<Users className="w-5 h-5 text-brand" aria-hidden="true" />}
            loading={loading}
          />
        </motion.div>
        <motion.div variants={staggerItemVariants}>
          <StatCard
            title="Hospital Branches"
            value={metrics.hospitalBranches}
            trend="Configured"
            icon={<Building2 className="w-5 h-5 text-brand" aria-hidden="true" />}
            loading={loading}
          />
        </motion.div>
        <motion.div variants={staggerItemVariants}>
          <StatCard
            title="Clinical Units"
            value={metrics.clinicalUnits}
            trend="Departments"
            icon={<Layers className="w-5 h-5 text-stable" aria-hidden="true" />}
            loading={loading}
          />
        </motion.div>
        <motion.div variants={staggerItemVariants}>
          <StatCard
            title="RBAC Roles"
            value={metrics.activeRoles}
            trend="Assigned"
            icon={<ShieldCheck className="w-5 h-5 text-warning" aria-hidden="true" />}
            loading={loading}
          />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* System Activity & Clinical Volume */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-text">Operational Throughput</h2>
            </div>
            <span className="text-xs text-text-muted">Today</span>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-surface-subtle p-3 rounded-lg border border-border">
                <span className="text-xs text-text-muted">Outpatient Intake</span>
                <p className="text-lg font-bold text-text tabular-nums mt-0.5">
                  <NumberCounter value={metrics.opdIntake} />
                </p>
                <span className="text-[11px] text-stable font-medium tabular-nums">{onTimePercent}% on time</span>
              </div>
              <div className="bg-surface-subtle p-3 rounded-lg border border-border">
                <span className="text-xs text-text-muted">Inpatient Bed Occ.</span>
                <p className="text-lg font-bold text-text tabular-nums mt-0.5">
                  <NumberCounter value={metrics.bedOccupancy} suffix="%" />
                </p>
                <span className="text-[11px] text-info font-medium">Occupancy</span>
              </div>
              <div className="bg-surface-subtle p-3 rounded-lg border border-border">
                <span className="text-xs text-text-muted">Diagnostics TAT</span>
                <p className="text-lg font-bold text-text tabular-nums mt-0.5">{metrics.diagnosticsTat}</p>
                <span className="text-[11px] text-stable font-medium">Average</span>
              </div>
              <div className="bg-surface-subtle p-3 rounded-lg border border-border">
                <span className="text-xs text-text-muted">Dispenses Today</span>
                <p className="text-lg font-bold text-text tabular-nums mt-0.5">
                  <NumberCounter value={metrics.dispensesToday} />
                </p>
                <span className="text-[11px] text-info font-medium">Pharmacy</span>
              </div>
            </div>

            {/* Hourly Volume Distribution */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-text-muted">
                <span>Peak Load Hours (08:00 - 19:00)</span>
                <span className="font-semibold text-text tabular-nums">Average: {averageVisitsPerHour} visits/hr</span>
              </div>
              <div className="h-28 flex items-end gap-2 pt-2 pb-1 px-2 bg-surface-subtle rounded-lg border border-border">
                {hourlyDistribution.length > 0 ? (
                  hourlyDistribution.map((height, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-brand hover:bg-brand-hover rounded-xs transition-all cursor-pointer"
                        style={{ height: `${Math.max(4, height)}%` }}
                        title={`${height}% of peak at ${8 + i}:00`}
                      />
                    </div>
                  ))
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-text-muted">
                    No visit activity recorded during clinic hours today
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Audit & Event Feed */}
        <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-sm font-semibold text-text">Live Clinical Activity</h2>
            <Link href="/enterprise/admin" className="text-xs text-brand hover:underline flex items-center gap-1">
              <span>Audit Trail</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>

          <div className="p-4 flex-1 divide-y divide-border overflow-y-auto max-h-[340px]">
            {loading ? (
              <div className="space-y-3 py-2">
                <Skeleton height="36px" />
                <Skeleton height="36px" />
                <Skeleton height="36px" />
              </div>
            ) : recentAudit.length === 0 ? (
              <div className="py-8 text-center text-xs text-text-muted">
                No recent activity recorded in the audit log.
              </div>
            ) : (
              recentAudit.map((event) => (
                <div key={event.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-text block">{event.action.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] text-text-muted">
                      {event.entity} {event.entityId ? `• ${event.entityId}` : ''}
                    </span>
                  </div>
                  <span className="text-[10px] text-text-muted tabular-nums">
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
    <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col justify-between hover:border-border-strong transition-colors">
      <div className="flex justify-between items-start">
        <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border flex items-center justify-center">
          {icon}
        </div>
        <span className="text-[11px] font-medium text-stable-text bg-stable-bg border border-stable-border px-2 py-0.5 rounded-full">
          {trend}
        </span>
      </div>
      <div className="mt-3">
        <h3 className="text-xs font-medium text-text-muted">{title}</h3>
        {loading ? (
          <Skeleton width="60px" height="28px" className="mt-1" />
        ) : (
          <p className="text-2xl font-bold text-text mt-0.5 tracking-tight tabular-nums">
            <NumberCounter value={value} />
          </p>
        )}
      </div>
    </div>
  );
}
