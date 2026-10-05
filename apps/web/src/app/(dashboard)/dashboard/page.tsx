import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';
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
import { Button } from '@enterprise-hms/ui';

export const revalidate = 0;

export default async function DashboardPage() {
  const usersCount = await prisma.user.count();
  const hospitalsCount = await prisma.hospital.count();
  const departmentsCount = await prisma.department.count();
  const rolesCount = await prisma.role.count();

  const recentAudit = await prisma.auditLog.findMany({
    take: 6,
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Enterprise Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Personnel"
          value={usersCount.toString()}
          trend="+2.5%"
          icon={<Users className="w-5 h-5 text-[#0891B2]" aria-hidden="true" />}
        />
        <StatCard
          title="Hospital Branches"
          value={hospitalsCount.toString()}
          trend="Active"
          icon={<Building2 className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
        />
        <StatCard
          title="Clinical Units"
          value={departmentsCount.toString()}
          trend="100% online"
          icon={<Layers className="w-5 h-5 text-[#059669]" aria-hidden="true" />}
        />
        <StatCard
          title="RBAC Roles"
          value={rolesCount.toString()}
          trend="Audited"
          icon={<ShieldCheck className="w-5 h-5 text-amber-600" aria-hidden="true" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* System Activity & Clinical Volume */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0891B2]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-800">Operational Throughput</h2>
            </div>
            <span className="text-xs text-slate-400">Past 24 Hours</span>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500">Outpatient Intake</span>
                <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">142</p>
                <span className="text-[11px] text-emerald-600 font-medium">98.4% on time</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500">Inpatient Bed Occ.</span>
                <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">86%</p>
                <span className="text-[11px] text-cyan-600 font-medium">24 beds free</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500">Diagnostics TAT</span>
                <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">38m</p>
                <span className="text-[11px] text-emerald-600 font-medium">Within SLA</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500">Dispenses Today</span>
                <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">312</p>
                <span className="text-[11px] text-cyan-600 font-medium">100% FEFO</span>
              </div>
            </div>

            {/* Hourly Volume Distribution */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Peak Load Hours (08:00 - 18:00)</span>
                <span className="font-semibold text-slate-700">Average: 42 visits/hr</span>
              </div>
              <div className="h-28 flex items-end gap-2 pt-2 pb-1 px-2 bg-slate-50 rounded-lg border border-slate-100">
                {[30, 45, 75, 95, 88, 92, 70, 85, 60, 40, 25, 20].map((height, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-[#0891B2] hover:bg-[#0E7490] rounded-xs transition-all cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`Hour ${8 + i}:00 - ${height} events`}
                    />
                    <span className="text-[9px] text-slate-400 font-mono">
                      {8 + i < 10 ? `0${8 + i}` : 8 + i}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Security & Audit Events */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-800">Security Audit Feed</h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Live</span>
          </div>

          <div className="flex-1 p-4 overflow-y-auto divide-y divide-slate-100">
            {recentAudit.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-8">No recent security events logged.</p>
            ) : (
              recentAudit.map((log) => (
                <div key={log.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold text-slate-800">{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {log.entity} {log.entityId ? `(#${log.entityId.slice(0, 8)})` : ''}
                  </p>
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
}: {
  title: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
      <div className="flex justify-between items-start">
        <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
          {trend}
        </span>
      </div>
      <div className="mt-3">
        <h3 className="text-xs font-medium text-slate-500">{title}</h3>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 tracking-tight tabular-nums">{value}</p>
      </div>
    </div>
  );
}
