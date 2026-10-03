import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function QueuePage() {
  const queues = await prisma.queue.findMany({
    include: { patient: true, doctor: { include: { user: true } }, department: true },
    orderBy: [{ queueDate: 'desc' }, { queueNumber: 'asc' }]
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Live Queue</h1>
          <p className="text-slate-500 mt-1">Manage OPD waiting lists and check-ins.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-sm font-medium text-slate-500">Waiting</p>
          <p className="text-3xl font-bold text-slate-900">{queues.filter(q => q.status === 'WAITING').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-sm font-medium text-slate-500">In Consultation</p>
          <p className="text-3xl font-bold text-blue-600">{queues.filter(q => q.status === 'IN_CONSULTATION').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-sm font-medium text-slate-500">Completed</p>
          <p className="text-3xl font-bold text-emerald-600">{queues.filter(q => q.status === 'COMPLETED').length}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Queue #</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Doctor</th>
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {queues.map(q => (
              <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-bold text-lg text-slate-900 bg-slate-100 px-3 py-1 rounded-md">{q.queueNumber}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{q.patient.firstName} {q.patient.lastName}</div>
                  <div className="text-xs text-slate-500">{q.patient.mrn}</div>
                </td>
                <td className="px-6 py-4 font-medium text-slate-700">Dr. {q.doctor.user.lastName}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${q.priority === 'EMERGENCY' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{q.priority}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    q.status === 'WAITING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    q.status === 'IN_CONSULTATION' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {q.status === 'WAITING' && (
                    <button className="text-blue-600 font-medium mr-3 border border-blue-200 px-3 py-1 rounded hover:bg-blue-50">Call</button>
                  )}
                  {q.status === 'WAITING' && (
                    <form action={`/api/v1/encounters/start?queueId=${q.id}`} method="POST" className="inline">
                       <button className="bg-emerald-600 text-white font-medium px-3 py-1 rounded hover:bg-emerald-700">Start OPD</button>
                    </form>
                  )}
                  {q.status === 'IN_CONSULTATION' && (
                     <span className="text-blue-600 italic text-xs">Consultation in progress...</span>
                  )}
                </td>
              </tr>
            ))}
            {queues.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No active queue entries today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
