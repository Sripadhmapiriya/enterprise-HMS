'use client';

import { useState, useEffect } from 'react';
import { cssdApi } from '@/lib/api';
import { Select } from '@enterprise-hms/ui';

export default function CSSDDashboard() {
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Cycle Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [machineId, setMachineId] = useState('AUTOCLAVE-01');
  const [method, setMethod] = useState('AUTOCLAVE');
  const [loads, setLoads] = useState('Major Laparotomy Set (2 Trays), Ortho Power Drill Set');
  const [submitting, setSubmitting] = useState(false);

  // Complete Cycle Modal
  const [completeCycleId, setCompleteCycleId] = useState<string | null>(null);
  const [chemIndicator, setChemIndicator] = useState(true);
  const [bioIndicator, setBioIndicator] = useState(true);
  const [completing, setCompleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cycRes, statRes] = await Promise.all([
        cssdApi.getCycles(),
        cssdApi.getStats(),
      ]);
      setCycles(cycRes.data || []);
      setStats(statRes.data || null);
    } catch (err: any) {
      console.error('Failed to load CSSD data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await cssdApi.createCycle({
        machineId,
        method,
      });
      setNotice({ type: 'success', text: `Cycle ${res.data?.cycleNumber} started on ${machineId}` });
      setShowNewModal(false);
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to start cycle' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeCycleId) return;

    try {
      setCompleting(true);
      const res = await cssdApi.completeCycle(completeCycleId, {
        result: chemIndicator && bioIndicator ? 'PASSED' : 'FAILED',
        chemicalIndicatorPassed: chemIndicator,
        biologicalIndicatorPassed: bioIndicator,
      });
      setNotice({ type: 'success', text: res.message || 'Sterilization cycle certified' });
      setCompleteCycleId(null);
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to complete cycle' });
    } finally {
      setCompleting(false);
    }
  };

  const filtered = cycles.filter((c) => {
    const matchesMethod = methodFilter === 'ALL' || c.method === methodFilter;
    const matchesResult = resultFilter === 'ALL' || c.result === resultFilter;
    return matchesMethod && matchesResult;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">CSSD Central Sterile Services</h1>
          <p className="text-text-muted text-sm mt-0.5">
            Surgical instrument decontam, autoclave & ETO sterilization cycles, biological QA indicator validation.
          </p>
        </div>
        <button
          onClick={() => {
            setShowNewModal(true);
            setNotice(null);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-brand-foreground bg-brand hover:bg-brand-hover shadow-sm"
        >
          + Start Sterilization Cycle
        </button>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium flex justify-between items-center ${ notice.type ==='success'
              ? 'bg-stable-bg border border-stable-border text-stable-text'
              : 'bg-critical-bg border border-critical-border text-critical-text'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="font-bold">x</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Cycles Run Today</p>
          <p className="text-2xl font-bold text-text mt-2">{stats?.totalToday ?? cycles.length}</p>
          <p className="text-xs text-text-muted mt-1">Processed batches</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Active In-Chamber</p>
          <p className="text-2xl font-bold text-info mt-2">{stats?.activeCycles ?? cycles.filter((c) => c.result === 'PENDING').length}</p>
          <p className="text-xs text-text-muted mt-1">Currently undergoing cycle</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Passed / Certified</p>
          <p className="text-2xl font-bold text-stable mt-2">{stats?.passedToday ?? cycles.filter((c) => c.result === 'PASSED').length}</p>
          <p className="text-xs text-text-muted mt-1">Ready for OT dispatch</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Failed / Quarantined</p>
          <p className="text-2xl font-bold text-critical mt-2">{stats?.failedToday ?? cycles.filter((c) => c.result === 'FAILED').length}</p>
          <p className="text-xs text-text-muted mt-1">Indicator test failures</p>
        </div>
      </div>

      {/* Sterilization Cycles Worklist */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-text">Sterilization Cycles</h2>
            <span className="text-xs text-text-muted">({filtered.length} cycles)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-lg text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="ALL">All Methods</option>
              <option value="AUTOCLAVE">Autoclave (Steam)</option>
              <option value="ETO">ETO (Gas)</option>
              <option value="PLASMA">Plasma (H2O2)</option>
            </Select>

            <Select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-lg text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="ALL">All Results</option>
              <option value="PENDING">In Progress (Pending)</option>
              <option value="PASSED">Passed (Certified)</option>
              <option value="FAILED">Failed (Quarantined)</option>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3">Cycle #</th>
                <th className="px-5 py-3">Machine & Method</th>
                <th className="px-5 py-3">Start Time</th>
                <th className="px-5 py-3">End Time</th>
                <th className="px-5 py-3">Operator</th>
                <th className="px-5 py-3">Quality Result</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-text-muted">
                    Loading sterilization cycles...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-text-muted">
                    No sterilization cycles found. Start a new cycle to initiate processing.
                  </td>
                </tr>
              ) : (
                filtered.map((cyc) => (
                  <tr key={cyc.id} className="hover:bg-surface-subtle/50">
                    <td className="px-5 py-4 font-mono font-bold text-text">{cyc.cycleNumber}</td>
                    <td className="px-5 py-4">
                      <strong className="text-text block">{cyc.machineId}</strong>
                      <span className="text-text-muted text-[11px]">{cyc.method}</span>
                    </td>
                    <td className="px-5 py-4 text-text-muted font-mono">
                      {new Date(cyc.startTime).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-text-muted font-mono">
                      {cyc.endTime ? new Date(cyc.endTime).toLocaleString() : 'In Progress...'}
                    </td>
                    <td className="px-5 py-4 text-text font-medium">
                      {cyc.operator?.name || 'CSSD Technician'}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${ cyc.result ==='PASSED'
                            ? 'bg-stable-bg text-stable-text'
                            : cyc.result === 'FAILED'
                            ? 'bg-critical-bg text-critical-text'
                            : 'bg-info-bg text-info-text'
                        }`}
                      >
                        {cyc.result}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {cyc.result === 'PENDING' ? (
                        <button
                          onClick={() => {
                            setCompleteCycleId(cyc.id);
                            setChemIndicator(true);
                            setBioIndicator(true);
                          }}
                          className="px-3 py-1 bg-stable hover:bg-stable text-brand-foreground rounded text-xs font-semibold shadow-sm"
                        >
                          Certify QA
                        </button>
                      ) : (
                        <span className="text-text-muted font-medium text-[11px]">Certified</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Start Cycle Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-text">Start Sterilization Cycle</h3>
                <p className="text-xs text-text-muted">Initiate chamber load sterilization process.</p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="text-text-muted font-bold">x</button>
            </div>

            <form onSubmit={handleStartCycle} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text mb-1">Machine / Chamber ID *</label>
                <Select
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface"
                  required
                >
                  <option value="AUTOCLAVE-01">Autoclave Chamber 01 (Pre-vacuum Steam 134°C)</option>
                  <option value="AUTOCLAVE-02">Autoclave Chamber 02 (Gravity Steam 121°C)</option>
                  <option value="ETO-CHAMBER-1">ETO Gas Chamber 01 (Low Temp 55°C)</option>
                  <option value="PLASMA-UNIT-01">Hydrogen Peroxide Plasma Sterilizer</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Method *</label>
                <Select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface font-semibold"
                >
                  <option value="AUTOCLAVE">Autoclave (High Pressure Steam)</option>
                  <option value="ETO">Ethylene Oxide (ETO)</option>
                  <option value="PLASMA">Hydrogen Peroxide Plasma</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Instrument Trays / Loads</label>
                <textarea
                  rows={2}
                  value={loads}
                  onChange={(e) => setLoads(e.target.value)}
                  className="w-full px-3 py-1.5 border border-border rounded text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Starting...' : 'Start Cycle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Certify Cycle QA Modal */}
      {completeCycleId && (
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-text">Certify Sterilization Quality Check</h3>
                <p className="text-xs text-text-muted">Verify chemical strip and biological spore indicators.</p>
              </div>
              <button onClick={() => setCompleteCycleId(null)} className="text-text-muted font-bold">x</button>
            </div>

            <form onSubmit={handleCompleteCycle} className="space-y-4 text-xs">
              <div className="p-3 bg-surface-subtle border border-border rounded-lg space-y-3">
                <label className="flex items-center gap-2.5 font-medium text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chemIndicator}
                    onChange={(e) => setChemIndicator(e.target.checked)}
                    className="rounded text-info"
                  />
                  <span>Chemical Integrator Strip Passed (Color Shift Confirmed)</span>
                </label>

                <label className="flex items-center gap-2.5 font-medium text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bioIndicator}
                    onChange={(e) => setBioIndicator(e.target.checked)}
                    className="rounded text-info"
                  />
                  <span>Biological Spore Indicator Negative (No Bacterial Growth)</span>
                </label>
              </div>

              {!chemIndicator || !bioIndicator ? (
                <div className="p-3 bg-critical-bg border border-critical-border text-critical-text rounded font-semibold">
                  Warning: Failed indicators will cause this cycle to be QUARANTINED and all loads re-processed.
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCompleteCycleId(null)}
                  className="px-4 py-2 border border-border rounded-lg text-xs text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completing}
                  className="px-4 py-2 bg-stable hover:bg-stable text-brand-foreground rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {completing ? 'Certifying...' : 'Commit QA Certification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
