import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function RadiologyWorklist() {
  const radItems = await prisma.investigationOrderItem.findMany({
    where: { category: 'RADIOLOGY' },
    include: {
      order: { include: { patient: true, doctor: { include: { user: true } } } },
      service: true,
      radiologyStudy: { include: { report: true } }
    },
    orderBy: { order: { createdAt: 'desc' } }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Radiology Worklist</h1>
          <p className="text-slate-500 mt-1">Manage imaging studies and reporting workflow.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <input 
            type="text" 
            placeholder="Search by Study ID, Patient, or Modality..." 
            className="w-80 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex space-x-2">
            <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
              <option>All Modalities</option>
              <option>X-Ray</option>
              <option>MRI</option>
              <option>CT</option>
            </select>
          </div>
        </div>
        
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Order / Time</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Modality / Study</th>
              <th className="px-6 py-4">Study ID</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {radItems.map(item => {
              const study = item.radiologyStudy;
              const displayStatus = study ? study.status : item.status;
              
              return (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-900">{item.orderId.substring(0,8).toUpperCase()}</span><br />
                    <span className="text-xs text-slate-500">{new Date(item.order.createdAt).toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{item.order.patient.firstName} {item.order.patient.lastName}</div>
                    <div className="text-xs text-slate-500">Dr. {item.order.doctor.user.lastName}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">
                    {study?.modality || 'Imaging'} <br/>
                    <span className="text-xs font-normal text-slate-500">{item.testName}</span>
                  </td>
                  <td className="px-6 py-4">
                    {study ? (
                      <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{study.studyNumber}</span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Not Scheduled</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      displayStatus === 'ORDERED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      displayStatus === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      displayStatus === 'SCHEDULED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      'bg-slate-50 text-slate-700 border border-slate-200'
                    }`}>
                      {displayStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    {!study ? (
                      <button className="text-blue-600 font-medium hover:underline text-sm">Schedule</button>
                    ) : study.status === 'SCHEDULED' ? (
                      <button className="text-blue-600 font-medium hover:underline text-sm">Perform</button>
                    ) : study.status === 'VERIFIED' ? (
                      <button className="text-emerald-600 font-medium hover:underline text-sm">View Report</button>
                    ) : (
                      <button className="text-blue-600 font-medium hover:underline text-sm">Draft Report</button>
                    )}
                  </td>
                </tr>
              )
            })}
            {radItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No radiology orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
