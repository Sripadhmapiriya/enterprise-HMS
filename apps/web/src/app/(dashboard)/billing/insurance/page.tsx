'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, CheckCircle2, Clock, RefreshCw, DollarSign } from 'lucide-react';
import { insuranceApi, billingApi } from '@/lib/api';
import { Button, Badge, Dialog, Input, Select } from '@enterprise-hms/ui';

export default function InsuranceDashboard() {
  const [providers, setProviders] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Submit Claim Modal
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimRemarks, setClaimRemarks] = useState('');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  // Settle Claim Modal
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [activeClaim, setActiveClaim] = useState<any | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [deductAmount, setDeductAmount] = useState('0');
  const [settleRef, setSettleRef] = useState('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, bRes] = await Promise.all([
        insuranceApi.getProviders(),
        insuranceApi.getClaims(),
        billingApi.getBills({ limit: 50 }),
      ]);
      if (pRes.data) setProviders(pRes.data);
      if (cRes.data) setClaims(cRes.data);
      if (bRes.data) setBills(bRes.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBillId || !selectedProviderId) return;

    setIsSubmittingClaim(true);
    try {
      await insuranceApi.createClaim({
        billId: selectedBillId,
        providerId: selectedProviderId,
        claimedAmount: parseFloat(claimAmount),
        remarks: claimRemarks || undefined,
      });
      setIsSubmitOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit insurance claim');
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const handleOpenSettle = (claim: any) => {
    setActiveClaim(claim);
    setSettleAmount(String(claim.claimedAmount));
    setDeductAmount('0');
    setSettleRef(`SETTLE-${Date.now().toString().slice(-6)}`);
    setIsSettleOpen(true);
  };

  const handleProcessSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClaim) return;

    setIsSubmittingSettle(true);
    try {
      await insuranceApi.settleClaim(activeClaim.id, {
        approvedAmount: parseFloat(settleAmount),
        deductionAmount: parseFloat(deductAmount) || 0,
        transactionRef: settleRef || undefined,
      });
      setIsSettleOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Settlement failed');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const totalClaimed = claims.reduce((sum, c) => sum + (c.claimedAmount || 0), 0);
  const activeCount = claims.filter((c) => c.status !== 'SETTLED' && c.status !== 'REJECTED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-info" />
            <h1 className="text-2xl font-bold text-text tracking-tight">Insurance & Third-Party Claims</h1>
          </div>
          <p className="text-text-muted mt-1">Pre-authorization, payer master, claims adjudication, and cashless settlements</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="secondary" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ?'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsSubmitOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Submit Claim
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <span className="text-xs font-semibold text-text-muted uppercase">Recognized Payers & TPAs</span>
          <p className="text-3xl font-bold text-text mt-2">{providers.length}</p>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-warning-border shadow-sm bg-warning-bg/20">
          <span className="text-xs font-semibold text-warning-text uppercase">Active / Pending Adjudication</span>
          <p className="text-3xl font-bold text-warning-text mt-2">{activeCount}</p>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <span className="text-xs font-semibold text-text-muted uppercase">Total Claimed Value</span>
          <p className="text-3xl font-bold text-stable mt-2 tabular-nums">${totalClaimed.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-surface-subtle/60">
          <h3 className="font-semibold text-text text-sm">Insurance Claims Ledger</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3.5">Claim # / Date</th>
                <th className="px-5 py-3.5">Patient</th>
                <th className="px-5 py-3.5">Payer / TPA</th>
                <th className="px-5 py-3.5 text-right">Claimed</th>
                <th className="px-5 py-3.5 text-right">Approved</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {claims.map((c) => (
                <tr key={c.id} className="hover:bg-surface-subtle/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-bold font-mono text-text">{c.claimNumber}</span>
                    <div className="text-xs text-text-muted">{new Date(c.submissionDate).toLocaleDateString()}</div>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-text">
                    {c.bill?.patient?.firstName} {c.bill?.patient?.lastName}
                    <div className="text-xs text-text-muted font-mono">Bill: {c.bill?.billNumber}</div>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-text">
                    {c.provider?.name}
                    {c.tpa && <div className="text-xs text-text-muted">TPA: {c.tpa.name}</div>}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-text tabular-nums">
                    ${(c.claimedAmount || 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-stable tabular-nums">
                    {c.approvedAmount != null ? `$${c.approvedAmount.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={
                        c.status === 'SETTLED'
                          ? 'stable'
                          : c.status === 'APPROVED' || c.status === 'PARTIALLY_APPROVED'
                          ? 'info'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {c.status !== 'SETTLED' && c.status !== 'REJECTED' && (
                      <Button size="sm" variant="secondary" onClick={() => handleOpenSettle(c)}>
                        Settle
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {claims.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-text-muted">
                    No insurance claims submitted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Claim Modal */}
      <Dialog isOpen={isSubmitOpen} onClose={() => setIsSubmitOpen(false)} title="Submit Insurance Claim">
        <form onSubmit={handleSubmitClaim} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1">Select Bill Invoice *</label>
            <Select
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
              value={selectedBillId}
              onChange={(e) => {
                setSelectedBillId(e.target.value);
                const b = bills.find((x) => x.id === e.target.value);
                if (b) setClaimAmount(String(b.grossTotal));
              }}
              required
            >
              <option value="">-- Choose Finalized Bill --</option>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.billNumber} - {b.patient?.firstName} {b.patient?.lastName} (${b.grossTotal.toFixed(2)})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Insurance Provider *</label>
            <Select
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              required
            >
              <option value="">-- Choose Payer --</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Claimed Amount ($) *</label>
            <Input
              type="number"
              step="0.01"
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Remarks / Diagnosis Notes</label>
            <Input
              value={claimRemarks}
              onChange={(e) => setClaimRemarks(e.target.value)}
              placeholder="e.g. Acute emergency trauma and lab diagnostics"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-border">
            <Button variant="secondary" type="button" onClick={() => setIsSubmitOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmittingClaim || !selectedBillId || !selectedProviderId}>
              {isSubmittingClaim ? 'Submitting...' : 'Submit Claim'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Settle Claim Modal */}
      <Dialog isOpen={isSettleOpen} onClose={() => setIsSettleOpen(false)} title={`Settle Claim ${activeClaim?.claimNumber}`}>
        <form onSubmit={handleProcessSettle} className="space-y-4">
          <div className="p-3 bg-surface-subtle rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">Payer:</span>
              <span className="font-semibold text-text">{activeClaim?.provider?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Claimed Amount:</span>
              <span className="font-bold text-text">${(activeClaim?.claimedAmount || 0).toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Approved Settlement Amount ($) *</label>
            <Input
              type="number"
              step="0.01"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Deduction / Patient Responsibility ($)</label>
            <Input
              type="number"
              step="0.01"
              value={deductAmount}
              onChange={(e) => setDeductAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Settlement Bank / NEFT Ref #</label>
            <Input
              value={settleRef}
              onChange={(e) => setSettleRef(e.target.value)}
              placeholder="e.g. NEFT-987654321"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-border">
            <Button variant="secondary" type="button" onClick={() => setIsSettleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmittingSettle || !settleAmount}>
              {isSubmittingSettle ? 'Processing...' : 'Confirm Settlement'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
