'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  DollarSign,
  Scale,
  TrendingUp,
  TrendingDown,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  PieChart,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { financeApi } from '@/lib/api';

export default function GeneralLedgerPage() {
  const [activeTab, setActiveTab] = useState<'journals' | 'accounts' | 'trialBalance' | 'aging'>('journals');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [trialBalance, setTrialBalance] = useState<any | null>(null);
  const [agingSummary, setAgingSummary] = useState<any | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isNewJournalOpen, setIsNewJournalOpen] = useState(false);
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);

  // New Journal Form state
  const [journalForm, setJournalForm] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    referenceNumber: `JRN-${Date.now().toString().slice(-6)}`,
    description: '',
    lines: [
      { accountId: '', debit: '', credit: '', memo: '' },
      { accountId: '', debit: '', credit: '', memo: '' },
    ],
  });

  // New Account Form state
  const [accountForm, setAccountForm] = useState({
    accountCode: '',
    accountName: '',
    accountType: 'EXPENSE',
    description: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [accRes, jrnRes, tbRes, ageRes] = await Promise.all([
        financeApi.getAccounts(),
        financeApi.getJournals(),
        financeApi.getTrialBalance(),
        financeApi.getAgingSummary(),
      ]);

      setAccounts(accRes.data || []);
      setJournals(jrnRes.data || []);
      setTrialBalance(tbRes.data || null);
      setAgingSummary(ageRes.data || null);
    } catch (err: any) {
      console.error('Failed to load finance data:', err);
      setError(err?.response?.data?.error?.message || 'Failed to load General Ledger data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute live Debit/Credit balance in Journal Form
  const totalDebits = journalForm.lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
  const totalCredits = journalForm.lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
  const isJournalBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const handleAddJournalLine = () => {
    setJournalForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { accountId: '', debit: '', credit: '', memo: '' }],
    }));
  };

  const handleRemoveJournalLine = (index: number) => {
    if (journalForm.lines.length <= 2) return;
    setJournalForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const handlePostJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isJournalBalanced) {
      alert(`Journal is out of balance. Debits ($${totalDebits.toFixed(2)}) must equal Credits ($${totalCredits.toFixed(2)})`);
      return;
    }

    try {
      const payload = {
        entryDate: journalForm.entryDate,
        referenceNumber: journalForm.referenceNumber,
        description: journalForm.description,
        lines: journalForm.lines
          .filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
          .map((l) => ({
            accountId: l.accountId,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
            memo: l.memo || undefined,
          })),
      };

      await financeApi.postJournal(payload);
      setIsNewJournalOpen(false);
      setJournalForm({
        entryDate: new Date().toISOString().split('T')[0],
        referenceNumber: `JRN-${Date.now().toString().slice(-6)}`,
        description: '',
        lines: [
          { accountId: '', debit: '', credit: '', memo: '' },
          { accountId: '', debit: '', credit: '', memo: '' },
        ],
      });
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error posting journal entry');
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await financeApi.createAccount(accountForm);
      setIsNewAccountOpen(false);
      setAccountForm({
        accountCode: '',
        accountName: '',
        accountType: 'EXPENSE',
        description: '',
      });
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error creating account');
    }
  };

  // Filter accounts
  const filteredAccounts = accounts.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.accountCode?.toLowerCase().includes(q) ||
      a.accountName?.toLowerCase().includes(q) ||
      a.accountType?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Finance & General Ledger</h1>
          <p className="text-sm text-text-muted mt-1">
            Enterprise Chart of Accounts, balanced double-entry journals, trial balance, and AP/AR aging.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-surface-subtle"
          >
            <RefreshCw className={`w-4 h-4 ${loading ?'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsNewJournalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-foreground bg-surface rounded-lg hover:bg-surface-raised shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Journal Entry
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-surface border border-border rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-muted uppercase">Trial Balance Total</p>
            <p className="text-2xl font-bold text-text mt-1">
              ${Number(trialBalance?.totalDebits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`inline-flex items-center text-xs font-semibold ${trialBalance?.isBalanced ?'text-stable-text' : 'text-critical'}`}>
                {trialBalance?.isBalanced ? 'Strictly Balanced' : 'Imbalance Detected'}
              </span>
            </div>
          </div>
          <div className="p-3 bg-stable-bg text-stable rounded-lg">
            <Scale className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-muted uppercase">Accounts Receivable (AR)</p>
            <p className="text-2xl font-bold text-info mt-1">
              ${Number(agingSummary?.totalOutstandingAR || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-text-muted mt-1">Patient & Payer receivables</p>
          </div>
          <div className="p-3 bg-info-bg text-info rounded-lg">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-muted uppercase">Accounts Payable (AP)</p>
            <p className="text-2xl font-bold text-warning mt-1">
              ${Number(agingSummary?.totalOutstandingAP || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-text-muted mt-1">Vendor & Supplier liabilities</p>
          </div>
          <div className="p-3 bg-warning-bg text-warning rounded-lg">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-muted uppercase">Chart of Accounts</p>
            <p className="text-2xl font-bold text-text mt-1">{accounts.length}</p>
            <p className="text-xs text-text-muted mt-1">Configured general ledger codes</p>
          </div>
          <div className="p-3 bg-surface-subtle text-brand rounded-lg">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border bg-surface rounded-t-xl px-4 pt-3">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab('journals')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${ activeTab ==='journals'
                ? 'border-border text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <FileText className="w-4 h-4" />
            General Ledger Journals ({journals.length})
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${ activeTab ==='accounts'
                ? 'border-border text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Chart of Accounts ({accounts.length})
          </button>
          <button
            onClick={() => setActiveTab('trialBalance')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${ activeTab ==='trialBalance'
                ? 'border-border text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <Scale className="w-4 h-4" />
            Trial Balance
          </button>
          <button
            onClick={() => setActiveTab('aging')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${ activeTab ==='aging'
                ? 'border-border text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <PieChart className="w-4 h-4" />
            AP & AR Aging Analysis
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-critical-bg border border-critical-border rounded-xl text-critical-text flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-critical" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={loadData} className="px-3 py-1 bg-critical-bg hover:bg-critical-bg text-critical-text rounded text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* TAB 1: JOURNALS */}
      {activeTab === 'journals' && (
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-text">Journal Audit Trail</h2>
                <p className="text-xs text-text-muted">Chronological posted double-entry journal transactions</p>
              </div>
              <button
                onClick={() => setIsNewJournalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-brand-foreground bg-surface hover:bg-surface-raised rounded-lg"
              >
                + Post Entry
              </button>
            </div>

            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Reference #</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Debits / Credits Breakdown</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {journals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                      No journals posted yet. Click &quot;New Journal Entry&quot; to record the first ledger entry.
                    </td>
                  </tr>
                ) : (
                  journals.map((jrn) => (
                    <tr key={jrn.id} className="hover:bg-surface-subtle/80 align-top">
                      <td className="px-6 py-4 font-mono font-bold text-text">{jrn.referenceNumber}</td>
                      <td className="px-6 py-4">{new Date(jrn.entryDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-medium text-text max-w-xs">{jrn.description}</td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 font-mono text-xs">
                          {jrn.lines?.map((line: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center gap-4">
                              <span className="text-text-muted">
                                {line.account?.accountCode} - {line.account?.accountName}
                              </span>
                              <span>
                                {Number(line.debit) > 0 ? (
                                  <span className="font-semibold text-stable-text">Dr ${Number(line.debit).toFixed(2)}</span>
                                ) : (
                                  <span className="font-semibold text-text">Cr ${Number(line.credit).toFixed(2)}</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-stable-bg text-stable-text">
                          {jrn.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CHART OF ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-surface p-3 border border-border rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search account code, title or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={() => setIsNewAccountOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-foreground bg-surface hover:bg-surface-raised rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              Add GL Account
            </button>
          </div>

          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Account Title</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Currency</th>
                  <th className="px-6 py-4 text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-surface-subtle/80">
                    <td className="px-6 py-4 font-mono font-bold text-text">{acc.accountCode}</td>
                    <td className="px-6 py-4 font-medium text-text">{acc.accountName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${ acc.accountType ==='ASSET' ? 'bg-info-bg text-info-text' :
                        acc.accountType === 'LIABILITY' ? 'bg-warning-bg text-warning-text' :
                        acc.accountType === 'EQUITY' ? 'bg-surface-subtle text-brand' :
                        acc.accountType === 'REVENUE' ? 'bg-stable-bg text-stable-text' :
                        'bg-critical-bg text-critical-text'
                      }`}>
                        {acc.accountType}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-text-muted">{acc.currency || 'USD'}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-text">
                      ${Number(acc.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TRIAL BALANCE */}
      {activeTab === 'trialBalance' && (
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl shadow-sm p-4 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-text">General Ledger Trial Balance</h2>
              <p className="text-xs text-text-muted">Summary of all debit and credit positions across active accounts</p>
            </div>
            <div>
              {trialBalance?.isBalanced ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-stable-bg text-stable-text rounded-full text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" /> BALANCED ($0.00 VARIANCE)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-critical-bg text-critical-text rounded-full text-xs font-bold">
                  <AlertTriangle className="w-4 h-4" /> OUT OF BALANCE
                </span>
              )}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Account Code</th>
                  <th className="px-6 py-4">Account Name</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Debit ($)</th>
                  <th className="px-6 py-4 text-right">Credit ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {trialBalance?.accounts?.map((row: any) => (
                  <tr key={row.accountId} className="hover:bg-surface-subtle/80">
                    <td className="px-6 py-4 font-bold text-text">{row.accountCode}</td>
                    <td className="px-6 py-4 font-sans font-medium text-text">{row.accountName}</td>
                    <td className="px-6 py-4 font-sans text-xs text-text-muted">{row.accountType}</td>
                    <td className="px-6 py-4 text-right">
                      {row.debit > 0 ? `$${Number(row.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {row.credit > 0 ? `$${Number(row.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-subtle border-t-2 border-border font-mono font-bold text-text">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right font-sans text-sm uppercase">Total Positions:</td>
                  <td className="px-6 py-4 text-right text-stable-text">
                    ${Number(trialBalance?.totalDebits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-stable-text">
                    ${Number(trialBalance?.totalCredits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AGING ANALYSIS */}
      {activeTab === 'aging' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AR Aging */}
            <div className="bg-surface border border-border rounded-xl shadow-sm p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-bold text-text">Accounts Receivable (AR) Aging</h3>
                  <p className="text-xs text-text-muted">Uncollected patient & insurance invoices</p>
                </div>
                <span className="font-mono font-bold text-lg text-info">
                  ${Number(agingSummary?.totalOutstandingAR || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between p-2 bg-surface-subtle rounded">
                  <span className="font-sans text-text-muted">Current (0 - 30 Days)</span>
                  <span className="font-semibold text-text">
                    ${Number(agingSummary?.ar?.current || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-surface-subtle rounded">
                  <span className="font-sans text-text-muted">31 - 60 Days</span>
                  <span className="font-semibold text-text">
                    ${Number(agingSummary?.ar?.days30to60 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-surface-subtle rounded">
                  <span className="font-sans text-text-muted">61 - 90 Days</span>
                  <span className="font-semibold text-warning">
                    ${Number(agingSummary?.ar?.days61to90 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-surface-subtle rounded">
                  <span className="font-sans text-text-muted">&gt; 90 Days Past Due</span>
                  <span className="font-semibold text-critical">
                    ${Number(agingSummary?.ar?.over90 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* AP Aging */}
            <div className="bg-surface border border-border rounded-xl shadow-sm p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-bold text-text">Accounts Payable (AP) Aging</h3>
                  <p className="text-xs text-text-muted">Outstanding vendor and supplier purchase liabilities</p>
                </div>
                <span className="font-mono font-bold text-lg text-warning">
                  ${Number(agingSummary?.totalOutstandingAP || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between p-2 bg-surface-subtle rounded">
                  <span className="font-sans text-text-muted">Current (0 - 30 Days)</span>
                  <span className="font-semibold text-text">
                    ${Number(agingSummary?.ap?.current || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-surface-subtle rounded">
                  <span className="font-sans text-text-muted">31 - 60 Days</span>
                  <span className="font-semibold text-text">
                    ${Number(agingSummary?.ap?.days30to60 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-surface-subtle rounded">
                  <span className="font-sans text-text-muted">61 - 90 Days</span>
                  <span className="font-semibold text-warning">
                    ${Number(agingSummary?.ap?.days61to90 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-surface-subtle rounded">
                  <span className="font-sans text-text-muted">&gt; 90 Days Past Due</span>
                  <span className="font-semibold text-critical">
                    ${Number(agingSummary?.ap?.over90 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: POST NEW JOURNAL ENTRY */}
      {isNewJournalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-text">Post Double-Entry Journal</h2>
                <p className="text-xs text-text-muted">Every journal entry must strictly satisfy Debits = Credits</p>
              </div>
              <div className={`px-3 py-1 rounded text-xs font-bold font-mono ${ isJournalBalanced ?'bg-stable-bg text-stable-text' : 'bg-critical-bg text-critical-text'
              }`}>
                {isJournalBalanced ? 'BALANCED' : `DIFF: $${Math.abs(totalDebits - totalCredits).toFixed(2)}`}
              </div>
            </div>

            <form onSubmit={handlePostJournal} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-text">Entry Date</label>
                  <input
                    type="date"
                    required
                    value={journalForm.entryDate}
                    onChange={(e) => setJournalForm({ ...journalForm, entryDate: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text">Reference #</label>
                  <input
                    type="text"
                    required
                    value={journalForm.referenceNumber}
                    onChange={(e) => setJournalForm({ ...journalForm, referenceNumber: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg font-mono focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text">Memo / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biomedical equipment calibration expenses"
                  value={journalForm.description}
                  onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Journal Lines */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-text uppercase">Journal Lines</span>
                  <button
                    type="button"
                    onClick={handleAddJournalLine}
                    className="text-xs font-semibold text-text hover:underline"
                  >
                    + Add Line
                  </button>
                </div>

                <div className="space-y-2">
                  {journalForm.lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <select
                          required
                          value={line.accountId}
                          onChange={(e) => {
                            const newLines = [...journalForm.lines];
                            newLines[idx].accountId = e.target.value;
                            setJournalForm({ ...journalForm, lines: newLines });
                          }}
                          className="w-full px-2 py-1.5 text-xs border rounded-lg"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.accountCode} - {a.accountName} ({a.accountType})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Debit $"
                          value={line.debit}
                          onChange={(e) => {
                            const newLines = [...journalForm.lines];
                            newLines[idx].debit = e.target.value;
                            if (e.target.value) newLines[idx].credit = '';
                            setJournalForm({ ...journalForm, lines: newLines });
                          }}
                          className="w-full px-2 py-1.5 text-xs border rounded-lg font-mono"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Credit $"
                          value={line.credit}
                          onChange={(e) => {
                            const newLines = [...journalForm.lines];
                            newLines[idx].credit = e.target.value;
                            if (e.target.value) newLines[idx].debit = '';
                            setJournalForm({ ...journalForm, lines: newLines });
                          }}
                          className="w-full px-2 py-1.5 text-xs border rounded-lg font-mono"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          disabled={journalForm.lines.length <= 2}
                          onClick={() => handleRemoveJournalLine(idx)}
                          className="text-xs text-critical hover:text-critical-text disabled:opacity-30"
                        >
                          x
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-12 gap-2 pt-2 border-t font-mono text-xs font-bold text-text">
                  <div className="col-span-5 text-right pr-2">Totals:</div>
                  <div className="col-span-3 text-stable-text">${totalDebits.toFixed(2)}</div>
                  <div className="col-span-3 text-stable-text">${totalCredits.toFixed(2)}</div>
                  <div className="col-span-1"></div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewJournalOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:bg-surface-subtle rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isJournalBalanced}
                  className="px-4 py-2 text-sm font-semibold text-brand-foreground bg-surface hover:bg-surface-raised rounded-lg shadow disabled:opacity-50"
                >
                  Post to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD GL ACCOUNT */}
      {isNewAccountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-text">Add Chart of Account</h2>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text">Account Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5210"
                  value={accountForm.accountCode}
                  onChange={(e) => setAccountForm({ ...accountForm, accountCode: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg font-mono focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diagnostic Equipment Maintenance"
                  value={accountForm.accountName}
                  onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text">Category / Type</label>
                <select
                  value={accountForm.accountType}
                  onChange={(e) => setAccountForm({ ...accountForm, accountType: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                >
                  <option value="ASSET">ASSET</option>
                  <option value="LIABILITY">LIABILITY</option>
                  <option value="EQUITY">EQUITY</option>
                  <option value="REVENUE">REVENUE</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-text">Description (Optional)</label>
                <input
                  type="text"
                  value={accountForm.description}
                  onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewAccountOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:bg-surface-subtle rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-brand-foreground bg-surface hover:bg-surface-raised rounded-lg shadow"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
