import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function RadiologyDashboard() {
  const studies = await prisma.radiologyStudy.findMany({
    include: { orderItem: { include: { order: { include: { patient: true } } } } },
    orderBy: { createdAt: 'desc' }
  });

  const scheduled = studies.filter(s => s.status === 'SCHEDULED').length;
  const inProgress = studies.filter(s => s.status === 'IN_PROGRESS' || s.status === 'ARRIVED').length;
  const verificationPending = studies.filter(s => s.status === 'REPORTED').length;
  const completedToday = studies.filter(s => s.status === 'VERIFIED' && new Date(s.updatedAt).toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Radiology Dashboard</h1>
          <p className="text-slate-500 mt-1">Imaging studies, scheduling, and reporting</p>
        </div>
        <div className="flex space-x-3">
          <Link href="/radiology/worklist" className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm">
            View Worklist
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Scheduled</p>
          <p className="text-3xl font-bold text-slate-900">{scheduled}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">In Progress</p>
          <p className="text-3xl font-bold text-blue-600">{inProgress}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Verification Pending</p>
          <p className="text-3xl font-bold text-amber-600">{verificationPending}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Verified Today</p>
          <p className="text-3xl font-bold text-emerald-600">{completedToday}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
            <h3 className="font-semibold text-slate-800">Recent Studies</h3>
          </div>
          <div className="p-0">
            <ul className="divide-y divide-slate-100">
              {studies.slice(0, 10).map(study => (
                <li key={study.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900">{study.studyNumber} • {study.modality}</p>
                    <p className="text-xs text-slate-500">
                      {study.orderItem.testName} • {study.orderItem.order.patient.firstName} {study.orderItem.order.patient.lastName}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    study.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700' :
                    study.status === 'REPORTED' ? 'bg-amber-50 text-amber-700' :
                    study.status === 'SCHEDULED' ? 'bg-slate-100 text-slate-700' :
                    'bg-blue-50 text-blue-700'
                  }`}>
                    {study.status}
                  </span>
                </li>
              ))}
              {studies.length === 0 && <li className="p-6 text-center text-slate-500 text-sm">No studies found.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
