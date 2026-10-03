import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function NursingDashboard() {
  const activeAdmissions = await prisma.admission.findMany({
    where: { status: 'ADMITTED' },
    include: { 
      patient: true,
      encounter: { include: { vitals: { orderBy: { recordedAt: 'desc' }, take: 1 } } },
      bedAllocations: { where: { status: 'ACTIVE' }, include: { bed: { include: { room: { include: { ward: true } } } } } },
      medicationOrders: { include: { administrations: { where: { status: 'SCHEDULED' } } } },
      carePlans: { where: { status: 'ACTIVE' }, include: { items: { where: { status: 'PENDING' } } } }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Nursing Station</h1>
          <p className="text-slate-500 mt-1">Ward management and patient care tasks</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">My Assigned Patients</p>
            <p className="text-3xl font-bold text-slate-900">{activeAdmissions.length}</p>
          </div>
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl">👥</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Pending Medications</p>
            <p className="text-3xl font-bold text-amber-600">
              {activeAdmissions.reduce((acc, adm) => acc + adm.medicationOrders.reduce((acc2, mo) => acc2 + mo.administrations.length, 0), 0)}
            </p>
          </div>
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl">💊</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Vitals Due</p>
            <p className="text-3xl font-bold text-rose-600">3</p>
          </div>
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xl">❤️</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Patient Care List</h3>
          <div className="flex space-x-2">
            <select className="px-3 py-1.5 border border-slate-200 rounded text-sm bg-white outline-none">
              <option>All Wards</option>
              <option>General Ward</option>
            </select>
          </div>
        </div>
        
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Bed</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Latest Vitals</th>
              <th className="px-6 py-4">Tasks</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeAdmissions.map(adm => {
              const bed = adm.bedAllocations[0]?.bed;
              const vitals = adm.encounter.vitals[0];
              const pendingMeds = adm.medicationOrders.reduce((acc, mo) => acc + mo.administrations.length, 0);

              return (
                <tr key={adm.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-md">{bed ? bed.bedNumber : 'None'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{adm.patient.firstName} {adm.patient.lastName}</div>
                    <div className="text-xs text-slate-500">{adm.patient.mrn} • {adm.admissionNumber}</div>
                  </td>
                  <td className="px-6 py-4">
                    {vitals ? (
                      <div className="text-xs space-y-1">
                        <span className="inline-block w-20 text-slate-500">BP: {vitals.bpSystolic}/{vitals.bpDiastolic}</span>
                        <span className="inline-block w-20 text-slate-500">Pulse: {vitals.pulse}</span>
                        <br/>
                        <span className="inline-block w-20 text-slate-500">Temp: {vitals.temperature}°F</span>
                        <span className="inline-block w-20 text-emerald-600 font-medium">SpO2: {vitals.spo2}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No vitals recorded</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      {pendingMeds > 0 && <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-medium">{pendingMeds} Meds Due</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 font-medium mr-3 hover:underline">Record Vitals</button>
                    <Link href={`/ipd/chart/${adm.id}`} className="text-slate-600 hover:text-slate-900 font-medium">Chart</Link>
                  </td>
                </tr>
              )
            })}
            {activeAdmissions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No patients admitted.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
