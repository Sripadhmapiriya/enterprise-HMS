'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { radiologyApi } from '@/lib/api';
import { Badge, Button, Input, Select } from '@enterprise-hms/ui';

export default function RadiologyWorklist() {
  const [studies, setStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pacsConfigured, setPacsConfigured] = useState(true);
  const [search, setSearch] = useState('');
  const [modalityFilter, setModalityFilter] = useState('ALL');

  // Report modal state
  const [reportingStudy, setReportingStudy] = useState<any | null>(null);
  const [reportForm, setReportForm] = useState({
    indication: '',
    technique: '',
    findings: '',
    impression: '',
  });

  // View modal state
  const [viewingStudy, setViewingStudy] = useState<any | null>(null);

  useEffect(() => {
    loadWorklist();
  }, []);

  const loadWorklist = async () => {
    try {
      setLoading(true);
      setError(null);
      const res: any = await radiologyApi.getWorklist();
      const list = res.data?.studies || res.data || [];
      setStudies(Array.isArray(list) ? list : []);
      if (res.pacsConfigured !== undefined) setPacsConfigured(res.pacsConfigured);
    } catch (err: any) {
      setError(err.message || 'Failed to load radiology worklist.');
    } finally {
      setLoading(false);
    }
  };

  const handlePerform = async (studyId: string) => {
    try {
      setError(null);
      await radiologyApi.performStudy(studyId);
      await loadWorklist();
    } catch (err: any) {
      setError(err.message || 'Failed to update study status.');
    }
  };

  const handleOpenReportModal = (study: any) => {
    setReportingStudy(study);
    setReportForm({
      indication: study.report?.indication || 'Clinical evaluation',
      technique: study.report?.technique || `${study.modality} standard multi-planar imaging`,
      findings: study.report?.findings || '',
      impression: study.report?.impression || '',
    });
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingStudy) return;
    try {
      setError(null);
      await radiologyApi.reportStudy(reportingStudy.id, reportForm);
      setReportingStudy(null);
      await loadWorklist();
    } catch (err: any) {
      setError(err.message || 'Failed to save diagnostic report.');
    }
  };

  const handleVerify = async (studyId: string) => {
    try {
      setError(null);
      await radiologyApi.verifyStudy(studyId);
      await loadWorklist();
    } catch (err: any) {
      setError(err.message || 'Failed to verify radiology report.');
    }
  };

  const filteredStudies = studies.filter((study) => {
    const matchesModality = modalityFilter === 'ALL' || study.modality === modalityFilter;
    const patientName = `${study.orderItem?.order?.patient?.firstName || ''} ${study.orderItem?.order?.patient?.lastName || ''}`.toLowerCase();
    const studyNum = (study.studyNumber || '').toLowerCase();
    const testName = (study.orderItem?.testName || '').toLowerCase();
    const query = search.toLowerCase();
    const matchesSearch = !search || patientName.includes(query) || studyNum.includes(query) || testName.includes(query);
    return matchesModality && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Radiology Worklist & PACS</h1>
          <p className="text-sm text-text-muted mt-1">Manage modality acquisition, radiological review, and diagnostic reports</p>
        </div>
        <div className="flex gap-3">
          <Link href="/radiology">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
          <Button variant="primary" onClick={loadWorklist}>Refresh Worklist</Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-critical-bg border border-critical-border text-critical-text text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between gap-4 bg-surface-subtle">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search patient, MRN, or study..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={modalityFilter}
              onChange={(e) => setModalityFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="ALL">All Modalities</option>
              <option value="X-RAY">X-Ray (CR/DX)</option>
              <option value="CT">Computed Tomography (CT)</option>
              <option value="MRI">Magnetic Resonance (MRI)</option>
              <option value="ULTRASOUND">Ultrasound (US)</option>
              <option value="MAMMOGRAPHY">Mammography (MG)</option>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-6 py-3">Study / Date</th>
                <th className="px-6 py-3">Patient</th>
                <th className="px-6 py-3">Modality & Procedure</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">PACS Viewer</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredStudies.map((study) => {
                const patient = study.orderItem?.order?.patient;
                const doctor = study.orderItem?.order?.doctor;
                return (
                  <tr key={study.id} className="hover:bg-surface-subtle/50">
                    <td className="px-6 py-4">
                      <div className="font-mono font-medium text-text text-xs">{study.studyNumber}</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {new Date(study.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-text">
                        {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}
                      </div>
                      <div className="text-xs text-text-muted">
                        MRN: {patient?.mrn || 'N/A'} • Ref: Dr. {doctor?.user?.lastName || 'Staff'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-xs bg-surface-subtle px-2 py-0.5 rounded text-text">
                        {study.modality}
                      </span>
                      <div className="text-sm font-medium text-text mt-1">
                        {study.orderItem?.testName || 'Radiology Procedure'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          study.status === 'VERIFIED'
                            ? 'stable'
                            : study.status === 'REPORTED'
                            ? 'warning'
                            : study.status === 'IN_PROGRESS'
                            ? 'info'
                            : 'neutral'
                        }
                      >
                        {study.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {study.pacsUrl ? (
                        <a
                          href={study.pacsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs font-semibold text-info hover:text-info-text underline"
                        >
                          Launch DICOM Web
                        </a>
                      ) : study.attachmentUrl ? (
                         <Button variant="outline" size="sm" onClick={() => setViewingStudy(study)}>View Attached Image</Button>
                      ) : !pacsConfigured ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-text-muted">PACS viewer not configured</span>
                          <Link href="/enterprise/admin" className="text-xs text-brand hover:underline">
                            Configure Integration
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">PACS unreachable</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {study.status === 'SCHEDULED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePerform(study.id)}
                        >
                          Perform Study
                        </Button>
                      )}
                      {(study.status === 'IN_PROGRESS' || study.status === 'SCHEDULED') && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleOpenReportModal(study)}
                        >
                          Draft Report
                        </Button>
                      )}
                      {study.status === 'REPORTED' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewingStudy(study)}
                          >
                            View Report
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleVerify(study.id)}
                          >
                            Sign & Verify
                          </Button>
                        </>
                      )}
                      {study.status === 'VERIFIED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingStudy(study)}
                        >
                          View Report
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredStudies.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-muted text-sm">
                    No studies match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drafting Report Modal */}
      {reportingStudy && (
        <div className="fixed inset-0 bg-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-semibold text-lg text-text">Radiology Diagnostic Report</h3>
                <p className="text-xs text-text-muted">
                  {reportingStudy.studyNumber} • {reportingStudy.modality} - {reportingStudy.orderItem?.testName}
                </p>
              </div>
              <button
                onClick={() => setReportingStudy(null)}
                className="text-text-muted hover:text-text-muted"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase">Indication</label>
                <Input
                  className="mt-1"
                  value={reportForm.indication}
                  onChange={(e) => setReportForm({ ...reportForm, indication: e.target.value })}
                  placeholder="e.g. Cough, fever, rule out pneumonia"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase">Technique</label>
                <Input
                  className="mt-1"
                  value={reportForm.technique}
                  onChange={(e) => setReportForm({ ...reportForm, technique: e.target.value })}
                  placeholder="e.g. PA and Lateral chest radiographs obtained with standard technique"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase">Findings</label>
                <textarea
                  className="w-full mt-1 p-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  rows={4}
                  value={reportForm.findings}
                  onChange={(e) => setReportForm({ ...reportForm, findings: e.target.value })}
                  placeholder="Detailed anatomical observations..."
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase">Impression / Conclusion</label>
                <textarea
                  className="w-full mt-1 p-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  rows={2}
                  value={reportForm.impression}
                  onChange={(e) => setReportForm({ ...reportForm, impression: e.target.value })}
                  placeholder="Diagnostic impression summary..."
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setReportingStudy(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Submit Diagnostic Report
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Verified/Reported Study Modal */}
      {viewingStudy && (
        <div className="fixed inset-0 bg-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-semibold text-lg text-text">Diagnostic Radiology Report</h3>
                <p className="text-xs text-text-muted">
                  {viewingStudy.studyNumber} • {viewingStudy.modality}
                </p>
              </div>
              <button
                onClick={() => setViewingStudy(null)}
                className="text-text-muted hover:text-text-muted"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 p-3 bg-surface-subtle rounded-lg text-xs">
                <div><span className="font-semibold text-text-muted">Patient:</span> {viewingStudy.orderItem?.order?.patient?.firstName} {viewingStudy.orderItem?.order?.patient?.lastName}</div>
                <div><span className="font-semibold text-text-muted">MRN:</span> {viewingStudy.orderItem?.order?.patient?.mrn}</div>
                <div><span className="font-semibold text-text-muted">Status:</span> {viewingStudy.status}</div>
                <div><span className="font-semibold text-text-muted">Procedure:</span> {viewingStudy.orderItem?.testName}</div>
              </div>
              <div>
                <span className="font-semibold text-text text-xs uppercase block">Indication:</span>
                <p className="text-text mt-1">{viewingStudy.report?.indication || 'None provided'}</p>
              </div>
              <div>
                <span className="font-semibold text-text text-xs uppercase block">Technique:</span>
                <p className="text-text mt-1">{viewingStudy.report?.technique || 'Standard imaging protocol'}</p>
              </div>
              <div>
                <span className="font-semibold text-text text-xs uppercase block">Findings:</span>
                <p className="text-text mt-1 whitespace-pre-line">{viewingStudy.report?.findings || 'No findings recorded'}</p>
              </div>
              <div>
                <span className="font-semibold text-text text-xs uppercase block">Impression:</span>
                <p className="text-text font-medium mt-1 whitespace-pre-line bg-info-bg p-2.5 rounded border border-info-border">
                  {viewingStudy.report?.impression || 'No impression recorded'}
                </p>
              </div>
              
              {viewingStudy.attachmentUrl && (
                <div className="mt-4 border-t pt-4">
                  <span className="font-semibold text-text text-xs uppercase block mb-2">Attached Image:</span>
                  <img src={viewingStudy.attachmentUrl} alt="Radiology Attachment" className="max-w-full h-auto rounded-lg border border-border" />
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-3 border-t">
              {viewingStudy.pacsUrl ? (
                <a
                  href={viewingStudy.pacsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-info hover:text-info-text underline"
                >
                  Open in PACS DICOM Viewer
                </a>
              ) : <div />}
              <Button variant="outline" onClick={() => setViewingStudy(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
