import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function BillingDashboard() {
  const bills = await prisma.bill.findMany({
    include: { patient: true, items: true },
    orderBy: { createdAt: 'desc' }
  });

  const payments = await prisma.payment.findMany({
    orderBy: { paymentDate: 'desc' }
  });

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = bills.reduce((sum, b) => sum + b.outstandingAmount, 0);
  const draftBills = bills.filter(b => b.status === 'DRAFT').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Revenue Dashboard</h1>
          <p className="text-slate-500 mt-1">Financial overview, collections, and outstanding receivables</p>
        </div>
        <div className="flex space-x-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm">
            Generate Report
          </button>
          <Link href="/billing/invoices/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-600/20">
            Create Bill
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Collections</p>
          <p className="text-3xl font-bold text-emerald-600">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/50">
          <p className="text-sm font-medium text-amber-700 flex items-center"><span className="mr-2">⏳</span> Total Outstanding</p>
          <p className="text-3xl font-bold text-amber-700">${outstanding.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Bills</p>
          <p className="text-3xl font-bold text-slate-900">{bills.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Draft / Pending Bills</p>
          <p className="text-3xl font-bold text-slate-900">{draftBills}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-semibold text-slate-800">Recent Bills</h3>
            <Link href="/billing/invoices" className="text-blue-600 text-sm hover:underline font-medium">View All</Link>
          </div>
          <div className="p-0">
            <ul className="divide-y divide-slate-100">
              {bills.slice(0, 5).map(b => (
                <li key={b.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900">
                      {b.patient.firstName} {b.patient.lastName}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      {b.billNumber} • {b.billType}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      b.status === 'PAID' || b.status === 'FINALIZED' && b.outstandingAmount === 0 ? 'bg-emerald-50 text-emerald-700' :
                      b.status === 'FINALIZED' && b.outstandingAmount > 0 ? 'bg-rose-50 text-rose-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {b.status}
                    </span>
                    <p className="text-sm font-semibold text-slate-700 mt-2">${b.grossTotal.toFixed(2)}</p>
                  </div>
                </li>
              ))}
              {bills.length === 0 && <li className="p-6 text-center text-slate-500 text-sm">No bills found.</li>}
            </ul>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-semibold text-slate-800">Recent Payments</h3>
            <Link href="/billing/payments" className="text-blue-600 text-sm hover:underline font-medium">View All</Link>
          </div>
          <div className="p-0">
            <ul className="divide-y divide-slate-100">
              {payments.slice(0, 5).map(p => (
                <li key={p.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900 font-mono">
                      {p.receiptNumber}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(p.paymentDate).toLocaleString()} • {p.paymentMethod}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      {p.status}
                    </span>
                    <p className="text-sm font-bold text-emerald-600 mt-2">+${p.amount.toFixed(2)}</p>
                  </div>
                </li>
              ))}
              {payments.length === 0 && <li className="p-6 text-center text-slate-500 text-sm">No payments recorded.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
