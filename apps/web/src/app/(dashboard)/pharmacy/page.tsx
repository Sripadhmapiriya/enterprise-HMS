import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';
import { AlertTriangle, AlertOctagon } from 'lucide-react';

export const revalidate = 0;

export default async function PharmacyDashboard() {
  const dispensings = await prisma.pharmacyDispensing.findMany({
    include: { patient: true, items: true, prescription: { include: { doctor: { include: { user: true } } } } },
    orderBy: { createdAt: 'desc' }
  });

  const batches = await prisma.inventoryBatch.findMany({
    include: { product: true }
  });

  const lowStock = batches.filter(b => b.availableQty < b.product.reorderLevel).length;
  const expired = batches.filter(b => new Date(b.expiryDate) < new Date()).length;
  const dispensedToday = dispensings.filter(d => new Date(d.createdAt).toDateString() === new Date().toDateString()).length;
  
  const revenueToday = dispensings
    .filter(d => new Date(d.createdAt).toDateString() === new Date().toDateString())
    .reduce((sum, d) => sum + d.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pharmacy Dashboard</h1>
          <p className="text-slate-500 mt-1">Dispensing, prescriptions, and pharmacy operations</p>
        </div>
        <div className="flex space-x-3">
          <Link href="/pharmacy/prescriptions" className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm">
            Prescription Queue
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Dispensed Today</p>
          <p className="text-3xl font-bold text-slate-900">{dispensedToday}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Today&apos;s Revenue</p>
          <p className="text-3xl font-bold text-emerald-600">${revenueToday.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/50">
          <p className="text-sm font-medium text-amber-700 flex items-center">
            <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600 inline" aria-hidden="true" />
            Low Stock Items
          </p>
          <p className="text-3xl font-bold text-amber-700 tabular-nums">{lowStock}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm bg-rose-50/50">
          <p className="text-sm font-medium text-rose-600 flex items-center">
            <AlertOctagon className="w-4 h-4 mr-1.5 text-rose-600 inline" aria-hidden="true" />
            Expired Batches
          </p>
          <p className="text-3xl font-bold text-rose-700 tabular-nums">{expired}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
            <h3 className="font-semibold text-slate-800">Recent Dispensings</h3>
          </div>
          <div className="p-0">
            <ul className="divide-y divide-slate-100">
              {dispensings.slice(0, 10).map(disp => (
                <li key={disp.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900">
                      {disp.patient.firstName} {disp.patient.lastName}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {disp.items.length} items • Prescribed by Dr. {disp.prescription?.doctor.user.lastName || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      disp.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                      disp.status === 'PARTIAL' ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {disp.status}
                    </span>
                    <p className="text-sm font-semibold text-slate-700 mt-2">${disp.totalAmount.toFixed(2)}</p>
                  </div>
                </li>
              ))}
              {dispensings.length === 0 && <li className="p-6 text-center text-slate-500 text-sm">No dispensings found.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
