import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function OTDashboard() {
  const theaters = await prisma.operatingTheatre.findMany();
  const schedules = await prisma.surgerySchedule.findMany({
    include: {
      request: { include: { patient: true, requestedBy: true } },
      ot: true
    },
    orderBy: { scheduledStart: 'asc' },
    take: 10
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operating Theatre (OT)</h1>
          <p className="text-slate-500 mt-1">Manage surgery schedules, checklists, and procedure notes.</p>
        </div>
        <div className="flex space-x-3">
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm shadow-indigo-600/20">
            Schedule Surgery
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Active OTs</p>
          <p className="text-3xl font-bold text-slate-900">{theaters.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Today&apos;s Surgeries</p>
          <p className="text-3xl font-bold text-indigo-600">
            {schedules.filter(s => new Date(s.scheduledStart).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/30">
          <p className="text-sm font-medium text-emerald-700 flex items-center"><span className="mr-2">✓</span> Completed</p>
          <p className="text-3xl font-bold text-emerald-700">{schedules.filter(s => s.status === 'COMPLETED').length}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800">Surgery Schedule</h3>
        </div>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">Theatre</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Procedure</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schedules.map(s => (
              <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-medium text-slate-900">
                    {new Date(s.scheduledStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                    {new Date(s.scheduledEnd).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                  <br />
                  <span className="text-xs text-slate-500">{new Date(s.scheduledStart).toLocaleDateString()}</span>
                </td>
                <td className="px-6 py-4 font-medium text-slate-700">
                  {s.ot.name}
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{s.request.patient.firstName} {s.request.patient.lastName}</div>
                  <div className="text-xs text-slate-500">MRN: {s.request.patient.mrn}</div>
                </td>
                <td className="px-6 py-4 text-slate-700">
                  {s.request.procedureName}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium \${
                    s.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                    s.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No surgeries scheduled.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
