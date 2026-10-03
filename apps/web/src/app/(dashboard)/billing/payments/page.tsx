import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function PaymentsList() {
  const payments = await prisma.payment.findMany({
    include: { patient: true, receivedBy: true, bill: true },
    orderBy: { paymentDate: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payments & Receipts</h1>
          <p className="text-slate-500 mt-1">View payment history, advances, and issue refunds.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <input 
            type="text" 
            placeholder="Search by Receipt No, Bill No..." 
            className="w-80 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Receipt / Date</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Bill No</th>
              <th className="px-6 py-4">Method / Ref</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map(p => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-medium font-mono text-slate-900">{p.receiptNumber}</span><br />
                  <span className="text-xs text-slate-500">{new Date(p.paymentDate).toLocaleString()}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{p.patient.firstName} {p.patient.lastName}</div>
                </td>
                <td className="px-6 py-4 font-mono text-slate-700">
                  {p.bill?.billNumber || '—'}
                </td>
                <td className="px-6 py-4">
                  <span className="font-medium text-slate-700">{p.paymentMethod}</span><br />
                  <span className="text-xs text-slate-500">{p.transactionRef || 'N/A'}</span>
                </td>
                <td className="px-6 py-4 text-right font-medium text-slate-900">
                  ${p.amount.toFixed(2)}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    p.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No payments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
