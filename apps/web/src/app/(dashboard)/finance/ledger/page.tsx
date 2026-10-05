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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Finance & General Ledger</h1>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise Chart of Accounts, balanced double-entry journals, trial balance, and AP/AR aging.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsNewJournalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Journal Entry
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Trial Balance Total</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              ${Number(trialBalance?.totalDebits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`inline-flex items-center text-xs font-semibold ${trialBalance?.isBalanced ? 'text-emerald-700' : 'text-rose-600'}`}>
                {trialBalance?.isBalanced ? 'Strictly Balanced' : 'Imbalance Detected'}
              </span>
            </div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Scale className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Accounts Receivable (AR)</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              ${Number(agingSummary?.totalOutstandingAR || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-1">Patient & Payer receivables</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Accounts Payable (AP)</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              ${Number(agingSummary?.totalOutstandingAP || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-1">Vendor & Supplier liabilities</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Chart of Accounts</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{accounts.length}</p>
            <p className="text-xs text-slate-500 mt-1">Configured general ledger codes</p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl px-4 pt-3">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab('journals')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'journals'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            General Ledger Journals ({journals.length})
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'accounts'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Chart of Accounts ({accounts.length})
          </button>
          <button
            onClick={() => setActiveTab('trialBalance')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'trialBalance'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scale className="w-4 h-4" />
            Trial Balance
          </button>
          <button
            onClick={() => setActiveTab('aging')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'aging'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PieChart className="w-4 h-4" />
            AP & AR Aging Analysis
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={loadData} className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* TAB 1: JOURNALS */}
      {activeTab === 'journals' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Journal Audit Trail</h2>
                <p className="text-xs text-slate-500">Chronological posted double-entry journal transactions</p>
              </div>
              <button
                onClick={() => setIsNewJournalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                + Post Entry
              </button>
            </div>

            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Reference #</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Debits / Credits Breakdown</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {journals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No journals posted yet. Click &quot;New Journal Entry&quot; to record the first ledger entry.
                    </td>
                  </tr>
                ) : (
                  journals.map((jrn) => (
                    <tr key={jrn.id} className="hover:bg-slate-50/80 align-top">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">{jrn.referenceNumber}</td>
                      <td className="px-6 py-4">{new Date(jrn.entryDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-medium text-slate-800 max-w-xs">{jrn.description}</td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 font-mono text-xs">
                          {jrn.lines?.map((line: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center gap-4">
                              <span className="text-slate-600">
                                {line.account?.accountCode} - {line.account?.accountName}
                              </span>
                              <span>
                                {Number(line.debit) > 0 ? (
                                  <span className="font-semibold text-emerald-700">Dr ${Number(line.debit).toFixed(2)}</span>
                                ) : (
                                  <span className="font-semibold text-slate-700">Cr ${Number(line.credit).toFixed(2)}</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
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
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3 border border-slate-200 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search account code, title or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <button
              onClick={() => setIsNewAccountOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              Add GL Account
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Account Title</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Currency</th>
                  <th className="px-6 py-4 text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{acc.accountCode}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{acc.accountName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                        acc.accountType === 'ASSET' ? 'bg-blue-100 text-blue-800' :
                        acc.accountType === 'LIABILITY' ? 'bg-amber-100 text-amber-800' :
                        acc.accountType === 'EQUITY' ? 'bg-purple-100 text-purple-800' :
                        acc.accountType === 'REVENUE' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {acc.accountType}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500">{acc.currency || 'USD'}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
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
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900">General Ledger Trial Balance</h2>
              <p className="text-xs text-slate-500">Summary of all debit and credit positions across active accounts</p>
            </div>
            <div>
              {trialBalance?.isBalanced ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" /> BALANCED ($0.00 VARIANCE)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-bold">
                  <AlertTriangle className="w-4 h-4" /> OUT OF BALANCE
                </span>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Account Code</th>
                  <th className="px-6 py-4">Account Name</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Debit ($)</th>
                  <th className="px-6 py-4 text-right">Credit ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {trialBalance?.accounts?.map((row: any) => (
                  <tr key={row.accountId} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4 font-bold text-slate-900">{row.accountCode}</td>
                    <td className="px-6 py-4 font-sans font-medium text-slate-800">{row.accountName}</td>
                    <td className="px-6 py-4 font-sans text-xs text-slate-500">{row.accountType}</td>
                    <td className="px-6 py-4 text-right">
                      {row.debit > 0 ? `$${Number(row.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {row.credit > 0 ? `$${Number(row.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-mono font-bold text-slate-900">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right font-sans text-sm uppercase">Total Positions:</td>
                  <td className="px-6 py-4 text-right text-emerald-700">
                    ${Number(trialBalance?.totalDebits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-emerald-700">
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
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-bold text-slate-900">Accounts Receivable (AR) Aging</h3>
                  <p className="text-xs text-slate-500">Uncollected patient & insurance invoices</p>
                </div>
                <span className="font-mono font-bold text-lg text-blue-600">
                  ${Number(agingSummary?.totalOutstandingAR || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between p-2 bg-slate-50 rounded">
                  <span className="font-sans text-slate-600">Current (0 - 30 Days)</span>
                  <span className="font-semibold text-slate-900">
                    ${Number(agingSummary?.ar?.current || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded">
                  <span className="font-sans text-slate-600">31 - 60 Days</span>
                  <span className="font-semibold text-slate-900">
                    ${Number(agingSummary?.ar?.days30to60 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded">
                  <span className="font-sans text-slate-600">61 - 90 Days</span>
                  <span className="font-semibold text-amber-600">
                    ${Number(agingSummary?.ar?.days61to90 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded">
                  <span className="font-sans text-slate-600">&gt; 90 Days Past Due</span>
                  <span className="font-semibold text-rose-600">
                    ${Number(agingSummary?.ar?.over90 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* AP Aging */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-bold text-slate-900">Accounts Payable (AP) Aging</h3>
                  <p className="text-xs text-slate-500">Outstanding vendor and supplier purchase liabilities</p>
                </div>
                <span className="font-mono font-bold text-lg text-amber-600">
                  ${Number(agingSummary?.totalOutstandingAP || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between p-2 bg-slate-50 rounded">
                  <span className="font-sans text-slate-600">Current (0 - 30 Days)</span>
                  <span className="font-semibold text-slate-900">
                    ${Number(agingSummary?.ap?.current || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded">
                  <span className="font-sans text-slate-600">31 - 60 Days</span>
                  <span className="font-semibold text-slate-900">
                    ${Number(agingSummary?.ap?.days30to60 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded">
                  <span className="font-sans text-slate-600">61 - 90 Days</span>
                  <span className="font-semibold text-amber-600">
                    ${Number(agingSummary?.ap?.days61to90 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded">
                  <span className="font-sans text-slate-600">&gt; 90 Days Past Due</span>
                  <span className="font-semibold text-rose-600">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Post Double-Entry Journal</h2>
                <p className="text-xs text-slate-500">Every journal entry must strictly satisfy Debits = Credits</p>
              </div>
              <div className={`px-3 py-1 rounded text-xs font-bold font-mono ${
                isJournalBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {isJournalBalanced ? 'BALANCED' : `DIFF: $${Math.abs(totalDebits - totalCredits).toFixed(2)}`}
              </div>
            </div>

            <form onSubmit={handlePostJournal} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Entry Date</label>
                  <input
                    type="date"
                    required
                    value={journalForm.entryDate}
                    onChange={(e) => setJournalForm({ ...journalForm, entryDate: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Reference #</label>
                  <input
                    type="text"
                    required
                    value={journalForm.referenceNumber}
                    onChange={(e) => setJournalForm({ ...journalForm, referenceNumber: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg font-mono focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Memo / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biomedical equipment calibration expenses"
                  value={journalForm.description}
                  onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Journal Lines */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 uppercase">Journal Lines</span>
                  <button
                    type="button"
                    onClick={handleAddJournalLine}
                    className="text-xs font-semibold text-slate-900 hover:underline"
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
                          className="text-xs text-rose-500 hover:text-rose-700 disabled:opacity-30"
                        >
                          x
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-12 gap-2 pt-2 border-t font-mono text-xs font-bold text-slate-800">
                  <div className="col-span-5 text-right pr-2">Totals:</div>
                  <div className="col-span-3 text-emerald-700">${totalDebits.toFixed(2)}</div>
                  <div className="col-span-3 text-emerald-700">${totalCredits.toFixed(2)}</div>
                  <div className="col-span-1"></div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewJournalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isJournalBalanced}
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Add Chart of Account</h2>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Account Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5210"
                  value={accountForm.accountCode}
                  onChange={(e) => setAccountForm({ ...accountForm, accountCode: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg font-mono focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diagnostic Equipment Maintenance"
                  value={accountForm.accountName}
                  onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Category / Type</label>
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
                <label className="text-xs font-semibold text-slate-700">Description (Optional)</label>
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
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow"
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
