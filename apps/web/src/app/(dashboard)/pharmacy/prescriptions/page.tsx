import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function PrescriptionQueue() {
  const prescriptions = await prisma.prescription.findMany({
    include: {
      patient: true,
      doctor: { include: { user: true } },
      items: true,
      dispensings: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Prescription Queue</h1>
          <p className="text-slate-500 mt-1">Review and dispense patient prescriptions.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <input 
            type="text" 
            placeholder="Search by Rx ID, Patient, or Doctor..." 
            className="w-80 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex space-x-2">
            <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
              <option>All Statuses</option>
              <option>Pending</option>
              <option>Partially Dispensed</option>
              <option>Completed</option>
            </select>
          </div>
        </div>
        
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Rx ID / Time</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Doctor</th>
              <th className="px-6 py-4">Items</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {prescriptions.map(rx => {
              const isDispensed = rx.dispensings.length > 0;
              
              return (
                <tr key={rx.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-900">{rx.id.substring(0,8).toUpperCase()}</span><br />
                    <span className="text-xs text-slate-500">{new Date(rx.createdAt).toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{rx.patient.firstName} {rx.patient.lastName}</div>
                    <div className="text-xs text-slate-500">MRN: {rx.patient.mrn}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">
                    Dr. {rx.doctor.user.lastName}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">{rx.items.length} items</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isDispensed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      rx.status === 'ACTIVE' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-slate-50 text-slate-700 border border-slate-200'
                    }`}>
                      {isDispensed ? 'DISPENSED' : 'PENDING'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    {!isDispensed ? (
                      <button className="text-blue-600 font-medium hover:underline text-sm">Review & Dispense</button>
                    ) : (
                      <button className="text-emerald-600 font-medium hover:underline text-sm">View Record</button>
                    )}
                  </td>
                </tr>
              )
            })}
            {prescriptions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No prescriptions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
