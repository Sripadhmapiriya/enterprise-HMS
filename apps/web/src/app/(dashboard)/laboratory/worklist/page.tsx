'use client';

import React, { useState, useEffect } from 'react';
import { FlaskConical, CheckCircle2, Download, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import { laboratoryApi } from '@/lib/api';
import { Button, Badge, Dialog, Input } from '@enterprise-hms/ui';

export default function LaboratoryWorklist() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const loadWorklist = async () => {
    setLoading(true);
    try {
      const res = await laboratoryApi.getWorklist();
      if (res.data) setItems(res.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorklist();
  }, []);

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
    setParamVal('14.2');
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

  const filteredItems = items.filter((i) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const test = (i.testName || '').toLowerCase();
    const pat = `${i.order?.patient?.firstName || ''} ${i.order?.patient?.lastName || ''}`.toLowerCase();
    const mrn = (i.order?.patient?.mrn || '').toLowerCase();
    return test.includes(term) || pat.includes(term) || mrn.includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FlaskConical className="w-6 h-6 text-info" />
            <h1 className="text-2xl font-bold text-text tracking-tight">Laboratory Worklist & Queue</h1>
          </div>
          <p className="text-text-muted mt-1">Specimen collection barcode printing, parameter result capture, and validation</p>
        </div>
        <Button variant="secondary" onClick={() => loadWorklist()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ?'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-surface-subtle/60 flex items-center justify-between">
          <Input
            placeholder="Search by Test, Patient, or MRN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 bg-surface"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3.5">Investigation Test</th>
                <th className="px-5 py-3.5">Patient Details</th>
                <th className="px-5 py-3.5">Sample ID / Specimen</th>
                <th className="px-5 py-3.5">Workflow Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((item) => {
                const sample = item.sample;
                const status = sample ? sample.status : 'PENDING';
                return (
                  <tr key={item.id} className="hover:bg-surface-subtle/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-text">{item.testName}</div>
                      <div className="text-xs text-text-muted font-mono">{item.testCode}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-text">
                        {item.order?.patient?.firstName} {item.order?.patient?.lastName}
                      </div>
                      <div className="text-xs text-text-muted font-mono">
                        MRN: {item.order?.patient?.mrn} &bull; {item.order?.patient?.gender}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {sample ? (
                        <div>
                          <span className="font-mono font-bold text-text text-xs bg-surface-subtle px-2 py-0.5 rounded">
                            {sample.sampleId}
                          </span>
                          <div className="text-xs text-text-muted mt-1">{sample.specimenType?.name}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted italic">Not yet collected</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        variant={
                          status === 'COMPLETED'
                            ? 'stable'
                            : status === 'PROCESSING' || status === 'COLLECTED'
                            ? 'info'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      {!sample && (
                        <Button size="sm" onClick={() => handleOpenCollect(item)}>
                          Collect Sample
                        </Button>
                      )}
                      {sample && status !== 'COMPLETED' && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => handleOpenResult(item)}>
                            Enter Result
                          </Button>
                          {sample.results?.length > 0 && (
                            <Button size="sm" onClick={() => handleValidate(sample.id)}>
                              Validate & Sign
                            </Button>
                          )}
                        </>
                      )}
                      {sample && status === 'COMPLETED' && (
                        <a
                          href={laboratoryApi.getReportPdfUrl(sample.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border text-text hover:bg-surface-subtle"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Report PDF
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-text-muted">
                    No active lab worklist items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Sample Modal */}
      <Dialog isOpen={isCollectOpen} onClose={() => setIsCollectOpen(false)} title="Collect Specimen Sample">
        <form onSubmit={handleCollect} className="space-y-4">
          <div className="p-3 bg-surface-subtle rounded-lg text-xs space-y-1">
            <div className="font-semibold text-text">{selectedItem?.testName}</div>
            <div className="text-text-muted">
              Patient: {selectedItem?.order?.patient?.firstName} {selectedItem?.order?.patient?.lastName}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">Specimen Tube / Type *</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
              value={specimenType}
              onChange={(e) => setSpecimenType(e.target.value)}
            >
              <option value="Whole Blood (EDTA)">Whole Blood (EDTA - Purple Top)</option>
              <option value="Serum (SST)">Serum (SST - Gold Top)</option>
              <option value="Plasma (Sodium Citrate)">Plasma (Sodium Citrate - Blue Top)</option>
              <option value="Midstream Urine">Midstream Urine (Sterile Cup)</option>
              <option value="Swab Specimen">Viral / Bacterial Swab</option>
            </select>
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
            <label className="block text-xs font-semibold text-text mb-1">Parameter Name *</label>
            <Input value={paramName} onChange={(e) => setParamName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Observed Value *</label>
              <Input value={paramVal} onChange={(e) => setParamVal(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Unit</label>
              <Input value={paramUnit} onChange={(e) => setParamUnit(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Reference Range</label>
              <Input value={paramRange} onChange={(e) => setParamRange(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Flag</label>
              <select
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
                value={paramFlag}
                onChange={(e: any) => setParamFlag(e.target.value)}
              >
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical / Panic Value</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-border">
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
