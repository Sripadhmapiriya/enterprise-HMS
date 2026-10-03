import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function EmergencyDashboard() {
  const triageCount = await prisma.triageAssessment.count();
  
  // Since we use the existing Encounter model, we filter for EMERGENCY type
  const encounters = await prisma.encounter.findMany({
    where: { type: 'EMERGENCY' },
    include: { patient: true, doctor: true, triageAssessment: true },
    orderBy: { startTime: 'desc' },
    take: 10
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Emergency Department (ER)</h1>
          <p className="text-slate-500 mt-1">Manage triage, critical patients, and emergency encounters.</p>
        </div>
        <div className="flex space-x-3">
          <button className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700 shadow-sm shadow-rose-600/20">
            + New Triage
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm bg-rose-50/30">
          <p className="text-sm font-medium text-rose-700 flex items-center"><span className="mr-2">🚨</span> Critical (Red)</p>
          <p className="text-3xl font-bold text-rose-700">0</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Waiting Triage</p>
          <p className="text-3xl font-bold text-slate-900">0</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">In Treatment</p>
          <p className="text-3xl font-bold text-blue-600">{encounters.filter(e => e.status === 'IN_PROGRESS').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total ER Visits</p>
          <p className="text-3xl font-bold text-slate-900">{encounters.length}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800">Recent Emergency Encounters</h3>
        </div>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Arrival Time</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Triage Priority</th>
              <th className="px-6 py-4">Chief Complaint</th>
              <th className="px-6 py-4">Attending</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {encounters.map(e => (
              <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-medium text-slate-900">{new Date(e.startTime).toLocaleString()}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{e.patient.firstName} {e.patient.lastName}</div>
                  <div className="text-xs text-slate-500">MRN: {e.patient.mrn}</div>
                </td>
                <td className="px-6 py-4">
                  {e.triageAssessment ? (
                    <span className={`px-2 py-1 rounded-full text-xs font-bold \${
                      e.triageAssessment.priority === 'RED' ? 'bg-rose-100 text-rose-700' :
                      e.triageAssessment.priority === 'YELLOW' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {e.triageAssessment.priority}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Pending</span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-700 truncate max-w-[200px]">
                  {e.triageAssessment?.chiefComplaint || '—'}
                </td>
                <td className="px-6 py-4 text-slate-700">
                  {e.doctor.user ? e.doctor.user.lastName : e.doctorId}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium \${
                    e.status === 'COMPLETED' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
            {encounters.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No emergency encounters currently active.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
