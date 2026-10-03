import { prisma } from '@enterprise-hms/database';

export const revalidate = 0;

export default async function HospitalsPage() {
  const hospitals = await prisma.hospital.findMany({
    include: {
      tenant: true,
      _count: {
        select: { branches: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hospitals</h1>
          <p className="text-slate-500 mt-1">Manage the hospital network and their associated branches.</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
          + Add Hospital
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <input 
            type="text" 
            placeholder="Search hospitals..." 
            className="w-80 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex space-x-2">
            <button className="px-3 py-1.5 border border-slate-200 text-sm font-medium rounded-md bg-white hover:bg-slate-50">Filter</button>
            <button className="px-3 py-1.5 border border-slate-200 text-sm font-medium rounded-md bg-white hover:bg-slate-50">Sort</button>
          </div>
        </div>
        
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Hospital Name</th>
              <th className="px-6 py-4">Tenant</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Branches</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {hospitals.map(hospital => (
              <tr key={hospital.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{hospital.name}</div>
                  {hospital.legalName && <div className="text-xs text-slate-400">{hospital.legalName}</div>}
                </td>
                <td className="px-6 py-4 font-medium">{hospital.tenant.name}</td>
                <td className="px-6 py-4">{hospital.city || '—'}</td>
                <td className="px-6 py-4 font-medium">{hospital._count.branches}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${hospital.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                    {hospital.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-blue-600 hover:text-blue-800 font-medium">Manage</button>
                </td>
              </tr>
            ))}
            {hospitals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No hospitals configured for this tenant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-sm text-slate-500">
          <div>Showing 1 to {hospitals.length} of {hospitals.length} entries</div>
          <div className="flex space-x-1">
            <button className="px-3 py-1 border border-slate-200 rounded-md bg-white disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 border border-slate-200 rounded-md bg-white disabled:opacity-50" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
