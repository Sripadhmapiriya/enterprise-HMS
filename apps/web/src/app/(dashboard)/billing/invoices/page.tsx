import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function InvoicesList() {
  const bills = await prisma.bill.findMany({
    include: { patient: true, createdBy: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Invoices & Bills</h1>
          <p className="text-slate-500 mt-1">Manage patient bills, view outstanding balances.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <input 
            type="text" 
            placeholder="Search by Bill No or Patient..." 
            className="w-80 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex space-x-2">
            <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
              <option>All Types</option>
              <option>OPD</option>
              <option>IPD</option>
              <option>PHARMACY</option>
            </select>
          </div>
        </div>
        
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Bill No / Date</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Gross Total</th>
              <th className="px-6 py-4 text-right">Outstanding</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bills.map(b => (
              <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-medium font-mono text-slate-900">{b.billNumber}</span><br />
                  <span className="text-xs text-slate-500">{new Date(b.billDate).toLocaleDateString()}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{b.patient.firstName} {b.patient.lastName}</div>
                  <div className="text-xs text-slate-500">MRN: {b.patient.mrn}</div>
                </td>
                <td className="px-6 py-4 font-medium text-slate-700">
                  {b.billType}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    b.status === 'FINALIZED' && b.outstandingAmount === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    b.status === 'FINALIZED' && b.outstandingAmount > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}>
                    {b.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-medium text-slate-900">
                  ${b.grossTotal.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right font-semibold text-rose-600">
                  ${b.outstandingAmount.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button className="text-blue-600 font-medium hover:underline text-sm">View Details</button>
                  {b.outstandingAmount > 0 && (
                    <button className="text-emerald-600 font-medium hover:underline text-sm">Collect</button>
                  )}
                </td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
