'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Download, RefreshCw } from 'lucide-react';
import { billingApi } from '@/lib/api';
import { Button, Badge, Input } from '@enterprise-hms/ui';

export default function PaymentsList() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await billingApi.getPayments();
      if (res.data) setPayments(res.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const filteredPayments = payments.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const rcpt = (p.receiptNumber || '').toLowerCase();
    const pat = `${p.patient?.firstName || ''} ${p.patient?.lastName || ''}`.toLowerCase();
    const bill = (p.bill?.billNumber || '').toLowerCase();
    return rcpt.includes(term) || pat.includes(term) || bill.includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <CreditCard className="w-6 h-6 text-info" />
            <h1 className="text-2xl font-bold text-text tracking-tight">Payments & Receipts</h1>
          </div>
          <p className="text-text-muted mt-1">Audit trail of point-of-sale collections, digital transactions, and payment receipts</p>
        </div>
        <Button variant="secondary" onClick={() => loadPayments()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ?'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-surface-subtle/60 flex items-center justify-between">
          <Input
            placeholder="Search by Receipt #, Patient, or Bill #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 bg-surface"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3.5">Receipt # / Date</th>
                <th className="px-5 py-3.5">Patient</th>
                <th className="px-5 py-3.5">Against Bill #</th>
                <th className="px-5 py-3.5">Method & Ref</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Receipt PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-surface-subtle/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-bold font-mono text-text">{p.receiptNumber}</span>
                    <div className="text-xs text-text-muted">{new Date(p.paymentDate).toLocaleString()}</div>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-text">
                    {p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : 'Walk-in'}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-text">
                    {p.bill?.billNumber || 'Direct Payment'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-text text-xs px-2 py-0.5 rounded bg-surface-subtle">
                      {p.paymentMethod}
                    </span>
                    {p.transactionRef && (
                      <div className="text-xs text-text-muted font-mono mt-0.5">{p.transactionRef}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-stable tabular-nums">
                    ${(p.amount || 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={p.status === 'SUCCESS' ? 'stable' : 'warning'} size="sm">
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <a
                      href={billingApi.getReceiptPdfUrl(p.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border text-text hover:bg-surface-subtle"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Receipt
                    </a>
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-text-muted">
                    No payment receipts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
