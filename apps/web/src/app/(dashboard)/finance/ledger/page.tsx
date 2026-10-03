import { prisma } from '@enterprise-hms/database';

export const revalidate = 0;

export default async function GeneralLedger() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">General Ledger</h1>
          <p className="text-slate-500 mt-1">Enterprise chart of accounts and journal entries.</p>
        </div>
        <button className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 shadow-sm">
          + New Journal Entry
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center text-slate-500">
        Finance & GL module active. Awaiting initial CoA import.
      </div>
    </div>
  );
}
