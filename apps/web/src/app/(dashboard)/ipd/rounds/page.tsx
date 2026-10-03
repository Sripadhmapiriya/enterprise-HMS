import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function DoctorRoundsDashboard() {
  const doctor = await prisma.user.findFirst({ where: { email: 'doctor@demo.com' } });
  const doctorProfile = await prisma.doctor.findFirst({ where: { userId: doctor?.id } });

  const myInpatients = await prisma.admission.findMany({
    where: { 
      status: 'ADMITTED',
      OR: [
        { admittingDocId: doctorProfile?.id },
        { attendingDocId: doctorProfile?.id }
      ]
    },
    include: {
      patient: true,
      bedAllocations: { where: { status: 'ACTIVE' }, include: { bed: { include: { room: { include: { ward: true } } } } } },
      doctorRounds: { orderBy: { createdAt: 'desc' }, take: 1 },
      encounter: { include: { vitals: { orderBy: { recordedAt: 'desc' }, take: 1 } } }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Doctor Rounds</h1>
          <p className="text-slate-500 mt-1">My admitted patients and pending rounds</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-sm font-medium text-slate-500">My Inpatients</p>
          <p className="text-3xl font-bold text-slate-900">{myInpatients.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-sm font-medium text-slate-500">Pending Rounds</p>
          <p className="text-3xl font-bold text-rose-600">
            {myInpatients.filter(adm => adm.doctorRounds.length === 0 || new Date(adm.doctorRounds[0].createdAt).toDateString() !== new Date().toDateString()).length}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800">Inpatient List</h3>
        </div>
        
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Bed Location</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Latest Vitals</th>
              <th className="px-6 py-4">Last Round</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {myInpatients.map(adm => {
              const bed = adm.bedAllocations[0]?.bed;
              const vitals = adm.encounter.vitals[0];
              const lastRound = adm.doctorRounds[0];
              const roundedToday = lastRound && new Date(lastRound.createdAt).toDateString() === new Date().toDateString();

              return (
                <tr key={adm.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{bed ? `Bed ${bed.bedNumber}` : 'Unallocated'}</div>
                    <div className="text-xs text-slate-500">{bed?.room?.ward.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{adm.patient.firstName} {adm.patient.lastName}</div>
                    <div className="text-xs text-slate-500">{adm.patient.mrn} • Admitted: {new Date(adm.admissionDate).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    {vitals ? (
                      <span className="text-xs text-slate-600">BP: {vitals.bpSystolic}/{vitals.bpDiastolic}, Pulse: {vitals.pulse}</span>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {roundedToday ? (
                      <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-medium">Completed Today</span>
                    ) : (
                      <span className="text-xs bg-rose-100 text-rose-800 px-2 py-1 rounded font-medium">Pending Round</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-emerald-600 font-medium mr-3 hover:underline">Add Note</button>
                    <Link href={`/ipd/chart/${adm.id}`} className="text-blue-600 font-medium hover:underline">Chart</Link>
                  </td>
                </tr>
              )
            })}
            {myInpatients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No admitted patients currently assigned to you.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
