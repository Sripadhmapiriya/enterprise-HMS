'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FlaskConical, CheckCircle2, Download, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { laboratoryApi } from '@/lib/api';
import { Button, Badge, Dialog, Input, Select } from '@enterprise-hms/ui';

export default function LaboratoryWorklist() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Tabs and pagination
  const [activeTab, setActiveTab] = useState('TO_COLLECT');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [meta, setMeta] = useState<any>({ total: 0, totalPages: 1 });
  
  const tabs = [
    { id: 'TO_COLLECT', label: 'To Collect' },
    { id: 'IN_PROCESS', label: 'In Process' },
    { id: 'TO_VALIDATE', label: 'To Validate' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'CRITICAL', label: 'Critical' },
  ];

  // Collect Sample Modal
  const [isCollectOpen, setIsCollectOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [specimenType, setSpecimenType] = useState('Whole Blood (EDTA)');
  const [isCollecting, setIsCollecting] = useState(false);

  // Result Entry Modal
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [paramName, setParamName] = useState('');
  const [paramVal, setParamVal] = useState('');
  const [paramUnit, setParamUnit] = useState('g/dL');
  const [paramRange, setParamRange] = useState('13.0 - 17.0');
  const [paramFlag, setParamFlag] = useState<'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL'>('NORMAL');
  const [isSubmittingResult, setIsSubmittingResult] = useState(false);

  const [priority, setPriority] = useState('');
  
  const loadWorklist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await laboratoryApi.getWorklist({
        status: activeTab,
        page,
        limit,
        search,
        priority
      });
      if (res.data) {
        setItems(res.data);
        setMeta(res.meta || { total: 0, totalPages: 1 });
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, limit, search, priority]);

  useEffect(() => {
    loadWorklist();
  }, [loadWorklist]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      loadWorklist();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadWorklist]);

  const handleOpenCollect = (item: any) => {
    setSelectedItem(item);
    setSpecimenType('Whole Blood (EDTA)');
    setIsCollectOpen(true);
  };

  const handleCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setIsCollecting(true);
    try {
      await laboratoryApi.collectSample({
        orderItemId: selectedItem.id,
        specimenTypeName: specimenType,
      });
      setIsCollectOpen(false);
      loadWorklist();
    } catch (err: any) {
      alert(err.message || 'Sample collection failed');
    } finally {
      setIsCollecting(false);
    }
  };

  const handleOpenResult = (item: any) => {
    setSelectedItem(item);
    setParamName(item.testName || 'Complete Blood Count');
    setParamVal('');
    setParamUnit('g/dL');
    setParamRange('13.0 - 17.0');
    setParamFlag('NORMAL');
    setIsResultOpen(true);
  };

  const handleEnterResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem?.sample) return;

    setIsSubmittingResult(true);
    try {
      await laboratoryApi.enterResults(selectedItem.sample.id, [
        {
          parameterName: paramName,
          value: paramVal,
          unit: paramUnit,
          referenceRange: paramRange,
          flag: paramFlag,
        },
      ]);
      setIsResultOpen(false);
      loadWorklist();
    } catch (err: any) {
      alert(err.message || 'Result entry failed');
    } finally {
      setIsSubmittingResult(false);
    }
  };

  const handleValidate = async (sampleId: string) => {
    try {
      await laboratoryApi.validateSample(sampleId);
      loadWorklist();
    } catch (err: any) {
      alert(err.message || 'Validation failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FlaskConical className="w-6 h-6 text-info" />
            <h1 className="text-2xl font-bold text-text tracking-tight">Laboratory Worklist</h1>
          </div>
          <p className="text-text-muted mt-1">Unified view of lab orders, specimen collection, results, and validation.</p>
        </div>
        <Button variant="secondary" onClick={() => loadWorklist()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex space-x-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-brand text-brand bg-surface'
                : 'border-transparent text-text-muted hover:text-text hover:bg-surface-subtle'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border bg-surface-subtle/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Input
              placeholder="Search by Test, Patient, or MRN..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-80 bg-surface"
            />
            <Select 
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-32 bg-surface px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">All Priorities</option>
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="STAT">STAT</option>
            </Select>
          </div>
          <div className="text-sm text-text-muted">
            Showing {meta.total > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, meta.total || 0)} of {meta.total || 0}
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3.5">Ordered At / Priority</th>
                <th className="px-5 py-3.5">Patient Details</th>
                <th className="px-5 py-3.5">Investigation Test</th>
                <th className="px-5 py-3.5">Sample ID / Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-text-muted">Loading...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-text-muted">No items found for this tab.</td>
                </tr>
              ) : (
                items.map((item) => {
                  const sample = item.sample;
                  const isStat = item.order?.priority === 'STAT';
                  const status = sample ? sample.status : 'ORDERED';
                  
                  return (
                    <tr key={item.id} className="hover:bg-surface-subtle/60 transition-colors">
                      <td className="px-5 py-3.5 align-top">
                        <div className="text-text font-medium">
                          {new Date(item.orderedAt || item.order?.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        {isStat && (
                          <div className="mt-1 inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-critical-bg text-critical border border-critical-border">
                            <AlertCircle className="w-3 h-3 mr-1" /> STAT
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <div className="font-semibold text-text">
                          {item.order?.patient?.firstName} {item.order?.patient?.lastName}
                        </div>
                        <div className="text-xs text-text-muted font-mono mt-0.5">
                          MRN: {item.order?.patient?.mrn}
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          Dept: {item.order?.department?.name || 'General'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <div className="font-bold text-text">{item.testName}</div>
                        <div className="text-xs text-text-muted font-mono">{item.testCode}</div>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        {sample ? (
                          <div className="mb-1">
                            <span className="font-mono font-bold text-text text-xs bg-surface-subtle border border-border px-1.5 py-0.5 rounded flex items-center w-max gap-1">
                              {sample.sampleId}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted italic block mb-1">Not yet collected</span>
                        )}
                        <Badge
                          variant={
                            status === 'VERIFIED'
                              ? 'stable'
                              : status === 'CRITICAL'
                              ? 'critical'
                              : 'info'
                          }
                          size="sm"
                        >
                          {status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 align-top text-right space-x-2 space-y-2">
                        {!sample && (
                          <Button size="sm" onClick={() => handleOpenCollect(item)}>
                            Collect Sample
                          </Button>
                        )}
                        {sample && status !== 'VERIFIED' && (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => handleOpenResult(item)}>
                              Enter Result
                            </Button>
                            {sample.results?.length > 0 && (
                              <Button size="sm" onClick={() => handleValidate(sample.id)}>
                                Validate
                              </Button>
                            )}
                          </>
                        )}
                        {sample && status === 'VERIFIED' && (
                          <button
                            type="button"
                            onClick={() => laboratoryApi.downloadReportPdf(sample.id, `LabReport-${sample.sampleId || sample.id}.pdf`)}
                            className="inline-flex justify-center items-center text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-text hover:bg-surface-subtle transition-colors shadow-sm bg-surface cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Report
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3 border-t border-border bg-surface flex justify-between items-center">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={page <= 1} 
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Prev
          </Button>
          <span className="text-sm text-text-muted font-medium">Page {page} of {meta.totalPages || 1}</span>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={page >= (meta.totalPages || 1)} 
            onClick={() => setPage(p => Math.min(meta.totalPages || 1, p + 1))}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Collect Sample Modal */}
      <Dialog isOpen={isCollectOpen} onClose={() => setIsCollectOpen(false)} title="Collect Specimen Sample">
        <form onSubmit={handleCollect} className="space-y-4">
          <div className="p-3 bg-surface-subtle border border-border rounded-lg text-sm space-y-1">
            <div className="font-semibold text-text">{selectedItem?.testName}</div>
            <div className="text-text-muted">
              Patient: {selectedItem?.order?.patient?.firstName} {selectedItem?.order?.patient?.lastName}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-1.5">Specimen Tube / Type *</label>
            <Select
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
              value={specimenType}
              onChange={(e) => setSpecimenType(e.target.value)}
            >
              <option value="Whole Blood (EDTA)">Whole Blood (EDTA - Purple Top)</option>
              <option value="Serum (SST)">Serum (SST - Gold Top)</option>
              <option value="Plasma (Sodium Citrate)">Plasma (Sodium Citrate - Blue Top)</option>
              <option value="Midstream Urine">Midstream Urine (Sterile Cup)</option>
              <option value="Swab Specimen">Viral / Bacterial Swab</option>
            </Select>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-border">
            <Button variant="secondary" type="button" onClick={() => setIsCollectOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCollecting}>
              {isCollecting ? 'Accessioning...' : 'Assign Barcode & Collect'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Enter Result Modal */}
      <Dialog isOpen={isResultOpen} onClose={() => setIsResultOpen(false)} title="Enter Test Parameter Result">
        <form onSubmit={handleEnterResult} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text mb-1.5">Parameter Name *</label>
            <Input value={paramName} onChange={(e) => setParamName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1.5">Observed Value *</label>
              <Input value={paramVal} onChange={(e) => setParamVal(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text mb-1.5">Unit</label>
              <Input value={paramUnit} onChange={(e) => setParamUnit(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1.5">Reference Range</label>
              <Input value={paramRange} onChange={(e) => setParamRange(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text mb-1.5">Flag</label>
              <Select
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
                value={paramFlag}
                onChange={(e: any) => setParamFlag(e.target.value)}
              >
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical / Panic Value</option>
              </Select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-2">
            <Button variant="secondary" type="button" onClick={() => setIsResultOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmittingResult || !paramVal}>
              {isSubmittingResult ? 'Saving...' : 'Save Result'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
