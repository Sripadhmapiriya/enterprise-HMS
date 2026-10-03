import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function AdmissionsPage() {
  const admissions = await prisma.admission.findMany({
    include: { patient: true, department: true, admittingDoctor: { include: { user: true } }, bedAllocations: { where: { status: 'ACTIVE' }, include: { bed: true } } },
    orderBy: { admissionDate: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IPD Admissions</h1>
          <p className="text-slate-500 mt-1">Manage inpatient admissions and records.</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-600/20">
          + New Admission
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <input 
            type="text" 
            placeholder="Search by IPD no, name, MRN..." 
            className="w-80 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">IPD No. & Date</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Doctor & Dept</th>
              <th className="px-6 py-4">Bed Location</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {admissions.map(adm => {
              const bed = adm.bedAllocations[0]?.bed;
              return (
                <tr key={adm.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {adm.admissionNumber} <br />
                    <span className="text-xs text-slate-500">{new Date(adm.admissionDate).toLocaleDateString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{adm.patient.firstName} {adm.patient.lastName}</div>
                    <div className="text-xs text-slate-500">{adm.patient.mrn}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-700">Dr. {adm.admittingDoctor.user.lastName}</div>
                    <div className="text-xs text-slate-500">{adm.department.name}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-medium">
                    {bed ? `Bed ${bed.bedNumber}` : <span className="text-slate-400 italic">Unallocated</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      adm.status === 'ADMITTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      adm.status === 'REQUESTED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      adm.status === 'DISCHARGED' ? 'bg-slate-50 text-slate-700 border border-slate-200' :
                      'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {adm.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/ipd/chart/${adm.id}`} className="text-blue-600 font-medium hover:underline">Chart</Link>
                  </td>
                </tr>
              )
            })}
            {admissions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No admissions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
