import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function IpdDashboard() {
  const admissions = await prisma.admission.findMany({
    where: { status: 'ADMITTED' },
    include: { patient: true, bedAllocations: { include: { bed: { include: { room: { include: { ward: true } } } } } } }
  });

  const pendingAdmissions = await prisma.admission.findMany({
    where: { status: 'APPROVED' },
    include: { patient: true }
  });

  const beds = await prisma.bed.findMany();
  const occupiedBeds = beds.filter(b => b.status === 'OCCUPIED').length;
  const availableBeds = beds.filter(b => b.status === 'AVAILABLE').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IPD Dashboard</h1>
          <p className="text-slate-500 mt-1">Inpatient Management and Operations</p>
        </div>
        <Link href="/ipd/admissions/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-600/20">
          + New Admission
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Current Inpatients</p>
          <p className="text-3xl font-bold text-slate-900">{admissions.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pending Admissions</p>
          <p className="text-3xl font-bold text-amber-600">{pendingAdmissions.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Occupied Beds</p>
          <p className="text-3xl font-bold text-rose-600">{occupiedBeds}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Available Beds</p>
          <p className="text-3xl font-bold text-emerald-600">{availableBeds}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Recent Admissions</h3>
            <Link href="/ipd/admissions" className="text-sm text-blue-600 font-medium hover:underline">View All</Link>
          </div>
          <div className="p-0">
            {admissions.length === 0 ? (
              <p className="p-6 text-center text-slate-500 text-sm">No active admissions.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {admissions.map(adm => {
                  const currentBed = adm.bedAllocations.find(b => b.status === 'ACTIVE');
                  return (
                    <li key={adm.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                      <div>
                        <p className="font-medium text-slate-900">{adm.patient.firstName} {adm.patient.lastName}</p>
                        <p className="text-xs text-slate-500">{adm.admissionNumber} • {currentBed ? `${currentBed.bed.room?.ward.name} - Bed ${currentBed.bed.bedNumber}` : 'Unallocated'}</p>
                      </div>
                      <Link href={`/ipd/chart/${adm.id}`} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded font-medium">Chart</Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Pending Admissions</h3>
          </div>
          <div className="p-0">
            {pendingAdmissions.length === 0 ? (
              <p className="p-6 text-center text-slate-500 text-sm">No pending admissions.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingAdmissions.map(adm => (
                  <li key={adm.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                    <div>
                      <p className="font-medium text-slate-900">{adm.patient.firstName} {adm.patient.lastName}</p>
                      <p className="text-xs text-slate-500">{adm.admissionType} • {adm.reason}</p>
                    </div>
                    <button className="text-sm bg-emerald-50 text-emerald-700 px-3 py-1 rounded font-medium border border-emerald-200">Allocate Bed</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
