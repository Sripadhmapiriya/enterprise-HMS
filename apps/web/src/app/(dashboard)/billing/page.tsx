'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CreditCard, FileText, ArrowUpRight, DollarSign, Clock, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { billingApi, patientsApi } from '@/lib/api';
import { Button, Badge, Dialog, Input, Select } from '@enterprise-hms/ui';

export default function BillingDashboard() {
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Bill Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    patientId: '',
    billType: 'OPD',
    serviceName: 'General Clinical Consultation',
    quantity: 1,
    unitPrice: 50.0,
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [billsRes, paymentsRes, patientsRes] = await Promise.all([
        billingApi.getBills({ limit: 10 }),
        billingApi.getPayments(),
        patientsApi.list({ limit: 50 }),
      ]);

      if (billsRes.data) setBills(billsRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (patientsRes.data) setPatients(patientsRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load billing metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientId) return;

    setIsSubmitting(true);
    try {
      await billingApi.createBill({
        patientId: form.patientId,
        billType: form.billType,
        items: [
          {
            serviceName: form.serviceName,
            quantity: Number(form.quantity),
            unitPrice: Number(form.unitPrice),
          },
        ],
      });
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create bill invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalOutstanding = bills.reduce((sum, b) => sum + (b.outstandingAmount || 0), 0);
  const draftBills = bills.filter((b) => b.status === 'DRAFT').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <CreditCard className="w-6 h-6 text-info" />
            <h1 className="text-2xl font-bold text-text tracking-tight">Revenue & Billing Hub</h1>
          </div>
          <p className="text-text-muted mt-1">Financial operations, patient invoices, payments, and claims</p>
        </div>
        <div className="flex space-x-3">
          <Link href="/billing/invoices">
            <Button variant="secondary">All Invoices</Button>
          </Link>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Create Bill
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-critical-bg border border-critical-border p-4 rounded-xl text-critical-text text-sm flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-critical" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase">Total Collections</span>
            <DollarSign className="w-4 h-4 text-stable" />
          </div>
          <p className="text-3xl font-bold text-stable mt-2 tabular-nums">${totalRevenue.toFixed(2)}</p>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-warning-border shadow-sm bg-warning-bg/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-warning-text uppercase">Outstanding Receivables</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <p className="text-3xl font-bold text-warning-text mt-2 tabular-nums">${totalOutstanding.toFixed(2)}</p>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase">Recent Invoices</span>
            <FileText className="w-4 h-4 text-text-muted" />
          </div>
          <p className="text-3xl font-bold text-text mt-2 tabular-nums">{bills.length}</p>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase">Draft / Unfinalized</span>
            <AlertCircle className="w-4 h-4 text-info" />
          </div>
          <p className="text-3xl font-bold text-text mt-2 tabular-nums">{draftBills}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bills */}
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center bg-surface-subtle/50">
            <h3 className="font-semibold text-text text-sm">Recent Invoices</h3>
            <Link href="/billing/invoices" className="text-xs font-semibold text-info hover:text-info-text flex items-center">
              View All <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {bills.map((b) => (
              <div key={b.id} className="p-4 hover:bg-surface-subtle/60 transition-colors flex justify-between items-center">
                <div>
                  <p className="font-semibold text-text text-sm">
                    {b.patient?.firstName} {b.patient?.lastName}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5 font-mono">
                    {b.billNumber} &bull; {b.billType}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={b.status === 'PAID' ? 'stable' : b.status === 'FINALIZED' ? 'warning' : 'neutral'} size="sm">
                    {b.status}
                  </Badge>
                  <p className="text-sm font-bold text-text mt-1 tabular-nums">${(b.grossTotal || 0).toFixed(2)}</p>
                </div>
              </div>
            ))}
            {bills.length === 0 && !loading && (
              <div className="p-6 text-center text-sm text-text-muted">No recent bills found.</div>
            )}
          </div>
        </div>

        {/* Recent Collections */}
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center bg-surface-subtle/50">
            <h3 className="font-semibold text-text text-sm">Recent Payment Receipts</h3>
            <Link href="/billing/payments" className="text-xs font-semibold text-info hover:text-info-text flex items-center">
              View Collections <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {payments.map((p) => (
              <div key={p.id} className="p-4 hover:bg-surface-subtle/60 transition-colors flex justify-between items-center">
                <div>
                  <p className="font-mono font-bold text-text text-sm">{p.receiptNumber}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : 'Patient'} &bull; {p.paymentMethod}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="stable" size="sm">
                    {p.status}
                  </Badge>
                  <p className="text-sm font-bold text-stable mt-1 tabular-nums">+${(p.amount || 0).toFixed(2)}</p>
                </div>
              </div>
            ))}
            {payments.length === 0 && !loading && (
              <div className="p-6 text-center text-sm text-text-muted">No payment receipts recorded yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Create Bill Modal */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Bill Invoice">
        <form onSubmit={handleCreateBill} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1">Select Patient *</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
              required
            >
              <option value="">-- Choose Patient --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} (MRN: {p.mrn})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Bill Type</label>
              <select
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
                value={form.billType}
                onChange={(e) => setForm({ ...form, billType: e.target.value })}
              >
                <option value="OPD">OPD Consultation</option>
                <option value="IPD">Inpatient Stay</option>
                <option value="EMERGENCY">Emergency Care</option>
                <option value="PHARMACY">Pharmacy Medication</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Quantity</label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value, 10) || 1 })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Service / Item Description *</label>
            <Input
              value={form.serviceName}
              onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
              placeholder="e.g. Cardiology OPD Specialist Consultation"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Unit Price ($) *</label>
            <Input
              type="number"
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-border">
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !form.patientId}>
              {isSubmitting ? 'Creating...' : 'Create Invoice'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
