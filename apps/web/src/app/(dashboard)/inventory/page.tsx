import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export const revalidate = 0;

export default async function InventoryDashboard() {
  const products = await prisma.product.findMany();
  const batches = await prisma.inventoryBatch.findMany({
    include: { product: true, location: true, supplier: true }
  });

  const totalProducts = products.length;
  const totalStockQty = batches.reduce((sum, b) => sum + b.availableQty, 0);
  const stockValue = batches.reduce((sum, b) => sum + (b.availableQty * b.purchaseRate), 0);
  const lowStock = batches.filter(b => b.availableQty > 0 && b.availableQty < b.product.reorderLevel).length;
  const outOfStock = products.filter(p => !batches.some(b => b.productId === p.id && b.availableQty > 0)).length;
  const expired = batches.filter(b => new Date(b.expiryDate) < new Date()).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory Dashboard</h1>
          <p className="text-slate-500 mt-1">Stock overview, batches, and ledger alerts</p>
        </div>
        <div className="flex space-x-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm">
            Receive GRN
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-600/20">
            Stock Adjustment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Products</p>
          <p className="text-3xl font-bold text-slate-900">{totalProducts}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Stock Value</p>
          <p className="text-3xl font-bold text-emerald-600">${stockValue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Out of Stock Items</p>
          <p className="text-3xl font-bold text-rose-600">{outOfStock}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/50">
          <p className="text-sm font-medium text-amber-700 flex items-center">
            <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600 inline" aria-hidden="true" />
            Low Stock / Expired
          </p>
          <p className="text-3xl font-bold text-amber-700 tabular-nums">{lowStock} / {expired}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
            <h3 className="font-semibold text-slate-800">Current Batches</h3>
          </div>
          <div className="p-0">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Product / SKU</th>
                  <th className="px-6 py-4">Batch Number</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4 text-right">Available Qty</th>
                  <th className="px-6 py-4 text-right">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-900">{b.product.name}</span><br/>
                      <span className="text-xs text-slate-500">{b.product.code}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">{b.batchNumber}</td>
                    <td className="px-6 py-4">{b.location.name}</td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-700">{b.availableQty}</td>
                    <td className="px-6 py-4 text-right">
                      {new Date(b.expiryDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No inventory batches found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
