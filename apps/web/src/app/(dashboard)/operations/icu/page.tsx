import { prisma } from '@enterprise-hms/database';

export const revalidate = 0;

export default async function ICUDashboard() {
  const flowsheets = await prisma.iCUFlowsheet.findMany({
    take: 20,
    orderBy: { recordTime: 'desc' },
    include: { encounter: { include: { patient: true, admission: { include: { bedAllocations: { include: { bed: true } } } } } } }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ICU / Critical Care</h1>
          <p className="text-slate-500 mt-1">Monitor critical patients, flowsheets, and vital statistics.</p>
        </div>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800">Recent Flowsheet Entries</h3>
        </div>
        <div className="p-6 text-center text-slate-500">
          No active ICU records to display.
        </div>
      </div>
    </div>
  );
}
