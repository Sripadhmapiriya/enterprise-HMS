import { prisma } from '@enterprise-hms/database';

export const revalidate = 0;

export default async function EmployeeMaster() {
  const employees = await prisma.employee.findMany({
    include: { user: true, department: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Employee Master</h1>
          <p className="text-slate-500 mt-1">Manage HR profiles, credentials, and work status.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm shadow-indigo-600/20">
          + Add Employee
        </button>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Employee Code</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Department</th>
              <th className="px-6 py-4">Designation</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No employee records found. Run HR sync to import users.
                </td>
              </tr>
            )}
            {employees.map(e => (
              <tr key={e.id}>
                <td className="px-6 py-4 font-medium text-slate-900">{e.employeeCode}</td>
                <td className="px-6 py-4">{e.user.firstName} {e.user.lastName}</td>
                <td className="px-6 py-4">{e.department?.name || '—'}</td>
                <td className="px-6 py-4">{e.designation || '—'}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
