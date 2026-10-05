'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Download, DollarSign, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { billingApi } from '@/lib/api';
import { Button, Badge, Dialog, Input, Select } from '@enterprise-hms/ui';

export default function InvoicesList() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  // Payment Modal
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [transRef, setTransRef] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const loadBills = async () => {
    setLoading(true);
    try {
      const res = await billingApi.getBills({
        status: filterStatus || undefined,
        billType: filterType || undefined,
        limit: 100,
      });
      if (res.data) setBills(res.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, [filterStatus, filterType]);

  const handleOpenPay = (bill: any) => {
    setSelectedBill(bill);
    setPayAmount(String(bill.outstandingAmount || bill.grossTotal));
    setTransRef('');
    setIsPayOpen(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;

    setIsSubmittingPay(true);
    try {
      await billingApi.processPayment(selectedBill.id, {
        amount: parseFloat(payAmount),
        paymentMethod: payMethod,
        transactionRef: transRef || undefined,
      });
      setIsPayOpen(false);
      loadBills();
    } catch (err: any) {
      alert(err.message || 'Payment failed');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleFinalize = async (billId: string) => {
    try {
      await billingApi.finalizeBill(billId);
      loadBills();
    } catch (err: any) {
      alert(err.message || 'Finalization failed');
    }
  };

  const filteredBills = bills.filter((b) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const num = (b.billNumber || '').toLowerCase();
    const pat = `${b.patient?.firstName || ''} ${b.patient?.lastName || ''}`.toLowerCase();
    const mrn = (b.patient?.mrn || '').toLowerCase();
    return num.includes(term) || pat.includes(term) || mrn.includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FileText className="w-6 h-6 text-sky-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Patient Invoices & Bills</h1>
          </div>
          <p className="text-slate-500 mt-1">Review finalized bills, outstanding balances, and print official tax invoices</p>
        </div>
        <Button variant="secondary" onClick={() => loadBills()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Input
            placeholder="Search by Bill #, Patient, or MRN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 bg-white"
          />
          <div className="flex space-x-3 w-full sm:w-auto">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Care Types</option>
              <option value="OPD">OPD Consultation</option>
              <option value="IPD">Inpatient</option>
              <option value="EMERGENCY">Emergency Care</option>
              <option value="PHARMACY">Pharmacy</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="FINALIZED">Finalized</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid in Full</option>
            </select>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3.5">Bill # / Date</th>
                <th className="px-5 py-3.5">Patient</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Gross Total</th>
                <th className="px-5 py-3.5 text-right">Outstanding</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBills.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-bold font-mono text-slate-900">{b.billNumber}</span>
                    <div className="text-xs text-slate-500">{new Date(b.billDate).toLocaleDateString()}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-900">
                      {b.patient?.firstName} {b.patient?.lastName}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">MRN: {b.patient?.mrn}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {b.billType}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={
                        b.status === 'PAID'
                          ? 'stable'
                          : b.status === 'FINALIZED' || b.status === 'PARTIALLY_PAID'
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {b.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                    ${(b.grossTotal || 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold tabular-nums">
                    <span className={b.outstandingAmount > 0 ? 'text-rose-600' : 'text-slate-500'}>
                      ${(b.outstandingAmount || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-2">
                    {b.status === 'DRAFT' && (
                      <Button variant="secondary" size="sm" onClick={() => handleFinalize(b.id)}>
                        Finalize
                      </Button>
                    )}
                    {b.outstandingAmount > 0 && (
                      <Button size="sm" onClick={() => handleOpenPay(b)}>
                        <DollarSign className="w-3.5 h-3.5 mr-1" />
                        Pay
                      </Button>
                    )}
                    <a
                      href={billingApi.getInvoicePdfUrl(b.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
              {filteredBills.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                    No matching invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Payment Modal */}
      <Dialog isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} title={`Collect Payment for ${selectedBill?.billNumber}`}>
        <form onSubmit={handleProcessPayment} className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Patient:</span>
              <span className="font-semibold text-slate-800">
                {selectedBill?.patient?.firstName} {selectedBill?.patient?.lastName} ({selectedBill?.patient?.mrn})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Gross:</span>
              <span className="font-semibold text-slate-800">${(selectedBill?.grossTotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Outstanding:</span>
              <span className="font-bold text-rose-600">${(selectedBill?.outstandingAmount || 0).toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Amount to Pay ($) *</label>
            <Input
              type="number"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={payMethod}
              onChange={(e: any) => setPayMethod(e.target.value)}
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Credit / Debit Card</option>
              <option value="UPI">UPI Digital Payment</option>
              <option value="BANK_TRANSFER">Bank Wire Transfer</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Reference (Optional)</label>
            <Input
              value={transRef}
              onChange={(e) => setTransRef(e.target.value)}
              placeholder="e.g. Card Authorization Code or UPI Ref #"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setIsPayOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmittingPay || !payAmount}>
              {isSubmittingPay ? 'Processing...' : 'Confirm Receipt'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
