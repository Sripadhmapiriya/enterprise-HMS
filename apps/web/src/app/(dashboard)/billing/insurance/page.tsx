import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function InsuranceDashboard() {
  const providers = await prisma.insuranceProvider.findMany({
    include: { patientInsurances: true, claims: true }
  });

  const claims = await prisma.claim.findMany({
    include: { bill: { include: { patient: true } }, provider: true, tpa: true },
    orderBy: { submissionDate: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Insurance & Claims</h1>
          <p className="text-slate-500 mt-1">Manage payers, track claim statuses, and view settlements.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Insurance Providers</p>
          <p className="text-3xl font-bold text-slate-900">{providers.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Active Claims</p>
          <p className="text-3xl font-bold text-blue-600">
            {claims.filter(c => c.status !== 'SETTLED' && c.status !== 'REJECTED').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Claimed Amount</p>
          <p className="text-3xl font-bold text-emerald-600">
            ${claims.reduce((sum, c) => sum + c.claimedAmount, 0).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800">Recent Claims</h3>
        </div>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Claim No / Date</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Payer</th>
              <th className="px-6 py-4 text-right">Claimed</th>
              <th className="px-6 py-4 text-right">Approved</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {claims.map(c => (
              <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-medium font-mono text-slate-900">{c.claimNumber}</span><br />
                  <span className="text-xs text-slate-500">{new Date(c.submissionDate).toLocaleDateString()}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{c.bill.patient.firstName} {c.bill.patient.lastName}</div>
                  <div className="text-xs text-slate-500">Bill: {c.bill.billNumber}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="font-medium text-slate-700">{c.provider.name}</span>
                  {c.tpa && <><br /><span className="text-xs text-slate-500">via {c.tpa.name}</span></>}
                </td>
                <td className="px-6 py-4 text-right font-medium text-slate-900">
                  ${c.claimedAmount.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right text-emerald-600 font-medium">
                  {c.approvedAmount ? `$${c.approvedAmount.toFixed(2)}` : '—'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    c.status === 'SETTLED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    c.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No claims found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
