import { prisma } from '@enterprise-hms/database';

export const revalidate = 0;

export default async function DashboardPage() {
  const usersCount = await prisma.user.count();
  const hospitalsCount = await prisma.hospital.count();
  const departmentsCount = await prisma.department.count();
  const rolesCount = await prisma.role.count();
  
  const recentAudit = await prisma.auditLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 mt-1">Welcome back. Here is what's happening across your hospital network today.</p>
        </div>
        <div className="flex space-x-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
            Download Report
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
            New Appointment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Users" value={usersCount.toString()} trend="+2.5%" icon="👥" color="blue" />
        <StatCard title="Hospitals" value={hospitalsCount.toString()} trend="+0.0%" icon="🏥" color="indigo" />
        <StatCard title="Departments" value={departmentsCount.toString()} trend="+12%" icon="📂" color="emerald" />
        <StatCard title="Roles configured" value={rolesCount.toString()} trend="Stable" icon="🛡️" color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800">System Activity</h2>
            <button className="text-blue-600 text-sm font-medium hover:text-blue-700">View All</button>
          </div>
          <div className="p-6">
            <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400">
              [Activity Chart Placeholder - Phase 2]
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Recent Audit Events</h2>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            {recentAudit.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No recent events recorded.</p>
            ) : (
              <div className="space-y-4">
                {recentAudit.map(log => (
                  <div key={log.id} className="flex items-start space-x-3">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{log.action}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {log.entity} • {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, icon, color }: any) {
  const colorMap: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };
  
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl border ${colorMap[color]}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
          {trend}
        </span>
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">{value}</p>
      </div>
    </div>
  );
}
