export const revalidate = 0;

export default async function AmbulanceDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ambulance Fleet</h1>
          <p className="text-slate-500 mt-1">Manage vehicles, drivers, and transport requests.</p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-12 text-center text-slate-500">
        Ambulance dispatch module active.
      </div>
    </div>
  );
}
