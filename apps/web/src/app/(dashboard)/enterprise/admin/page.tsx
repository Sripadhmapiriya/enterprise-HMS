import { prisma } from '@enterprise-hms/database';

export const revalidate = 0;

export default async function EnterpriseAdmin() {
  const enterprises = await prisma.enterprise.findMany({
    include: { hospitals: true, subscriptions: { include: { entitlements: true } } },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Enterprise Administration</h1>
          <p className="text-slate-500 mt-1">Manage tenants, hospitals, subscriptions, and global entitlements.</p>
        </div>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm">
          + Add Enterprise Tenant
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Enterprise Code</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Hospitals</th>
              <th className="px-6 py-4">Active Subscription</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {enterprises.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No enterprise tenants configured. Please run global initialization.
                </td>
              </tr>
            )}
            {enterprises.map(ent => (
              <tr key={ent.id}>
                <td className="px-6 py-4 font-medium text-slate-900">{ent.code}</td>
                <td className="px-6 py-4 font-medium text-slate-700">{ent.name}</td>
                <td className="px-6 py-4 text-slate-500">{ent.hospitals.length} Connected</td>
                <td className="px-6 py-4">
                  {ent.subscriptions.find(s => s.status === 'ACTIVE')?.planName || <span className="text-slate-400 italic">None</span>}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${ent.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {ent.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
