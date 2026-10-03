export const revalidate = 0;

export default async function HousekeepingDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Housekeeping</h1>
          <p className="text-slate-500 mt-1">Manage cleaning tasks and hygiene verification.</p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-12 text-center text-slate-500">
        Housekeeping module active.
      </div>
    </div>
  );
}
