import { prisma } from '@enterprise-hms/database';

export const revalidate = 0;

export default async function ProcurementDashboard() {
  const requests = await prisma.purchaseRequest.findMany({
    include: { requestedBy: true, department: true },
    orderBy: { createdAt: 'desc' }
  });
  
  const pos = await prisma.purchaseOrder.findMany({
    include: { supplier: true, createdBy: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Procurement</h1>
          <p className="text-slate-500 mt-1">Manage purchase requests, purchase orders, and supplier receipts.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-800">Purchase Requests (PR)</h3>
          </div>
          <div className="p-6 text-center text-slate-500">
            No purchase requests found.
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-800">Purchase Orders (PO)</h3>
          </div>
          <div className="p-6 text-center text-slate-500">
            No purchase orders found.
          </div>
        </div>
      </div>
    </div>
  );
}
