import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function LaboratoryDashboard() {
  const samples = await prisma.labSample.findMany({
    include: { orderItem: { include: { order: { include: { patient: true } } } }, specimenType: true }
  });

  const pendingCollection = samples.filter(s => s.status === 'PENDING').length;
  const processing = samples.filter(s => s.status === 'PROCESSING').length;
  const verificationPending = samples.filter(s => s.status === 'COMPLETED').length; // Means result entered, needs verification (adjust logic as needed)
  
  const criticalResults = await prisma.criticalResult.count({
    where: { status: 'PENDING' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Laboratory Dashboard</h1>
          <p className="text-slate-500 mt-1">Diagnostic samples, results, and critical alerts</p>
        </div>
        <div className="flex space-x-3">
          <Link href="/laboratory/worklist" className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm">
            View Worklist
          </Link>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-600/20">
            + Quick Collect
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pending Collection</p>
          <p className="text-3xl font-bold text-slate-900">{pendingCollection}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Processing</p>
          <p className="text-3xl font-bold text-blue-600">{processing}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pending Verification</p>
          <p className="text-3xl font-bold text-amber-600">{verificationPending}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm bg-rose-50/50">
          <p className="text-sm font-medium text-rose-600 flex items-center"><span className="mr-2">⚠️</span> Critical Results</p>
          <p className="text-3xl font-bold text-rose-700">{criticalResults}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
            <h3 className="font-semibold text-slate-800">Recent Samples</h3>
            <Link href="/laboratory/samples" className="text-sm text-blue-600 font-medium hover:underline">View All</Link>
          </div>
          <div className="p-0">
            <ul className="divide-y divide-slate-100">
              {samples.slice(0, 5).map(sample => (
                <li key={sample.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900">{sample.sampleId}</p>
                    <p className="text-xs text-slate-500">
                      {sample.orderItem.testName} • {sample.orderItem.order.patient.firstName} {sample.orderItem.order.patient.lastName}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    sample.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                    sample.status === 'PROCESSING' ? 'bg-blue-50 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {sample.status}
                  </span>
                </li>
              ))}
              {samples.length === 0 && <li className="p-6 text-center text-slate-500 text-sm">No samples found.</li>}
            </ul>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
            <h3 className="font-semibold text-slate-800">Critical Actions Required</h3>
          </div>
          <div className="p-6 flex flex-col items-center justify-center text-center h-48">
            {criticalResults > 0 ? (
              <>
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-2xl mb-3">⚠️</div>
                <h4 className="font-medium text-slate-900 mb-1">{criticalResults} Critical Results Pending</h4>
                <p className="text-sm text-slate-500 mb-4">Immediate acknowledgment required.</p>
                <button className="bg-rose-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-rose-700">Review Now</button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl mb-3">✓</div>
                <h4 className="font-medium text-slate-900">All Clear</h4>
                <p className="text-sm text-slate-500">No pending critical results.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
