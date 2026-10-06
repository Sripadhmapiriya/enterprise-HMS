'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { radiologyApi } from '@/lib/api';
import { Badge, Button } from '@enterprise-hms/ui';

export default function RadiologyDashboard() {
  const [studies, setStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res: any = await radiologyApi.getWorklist();
      const list = res.data?.studies || res.data || [];
      setStudies(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load radiology dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const scheduled = studies.filter(s => s.status === 'SCHEDULED').length;
  const inProgress = studies.filter(s => s.status === 'IN_PROGRESS' || s.status === 'ARRIVED').length;
  const verificationPending = studies.filter(s => s.status === 'REPORTED').length;
  const verified = studies.filter(s => s.status === 'VERIFIED').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Radiology Imaging & Reporting</h1>
          <p className="text-sm text-text-muted mt-1">DICOM study tracking, modality worklist, and radiologist diagnostic reporting</p>
        </div>
        <div className="flex gap-3">
          <Link href="/radiology/worklist">
            <Button variant="outline">Imaging Worklist</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-critical-bg border border-critical-border text-critical-text text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Scheduled</p>
          <p className="text-3xl font-bold text-text mt-2">{loading ? '...' : scheduled}</p>
          <p className="text-xs text-text-muted mt-1">Pending acquisition</p>
        </div>
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">In Progress</p>
          <p className="text-3xl font-bold text-info mt-2">{loading ? '...' : inProgress}</p>
          <p className="text-xs text-text-muted mt-1">Modality acquisition</p>
        </div>
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Awaiting Verification</p>
          <p className="text-3xl font-bold text-warning mt-2">{loading ? '...' : verificationPending}</p>
          <p className="text-xs text-text-muted mt-1">Report drafted</p>
        </div>
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Verified Reports</p>
          <p className="text-3xl font-bold text-stable mt-2">{loading ? '...' : verified}</p>
          <p className="text-xs text-text-muted mt-1">Signed by radiologist</p>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center bg-surface-subtle">
          <h2 className="text-base font-semibold text-text">Recent Imaging Studies</h2>
          <Button variant="ghost" size="sm" onClick={loadDashboard}>Refresh</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-6 py-3">Study ID</th>
                <th className="px-6 py-3">Patient</th>
                <th className="px-6 py-3">Modality</th>
                <th className="px-6 py-3">Procedure</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">PACS / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {studies.slice(0, 10).map((study) => (
                <tr key={study.id} className="hover:bg-surface-subtle/50">
                  <td className="px-6 py-4 font-mono font-medium text-text text-xs">
                    {study.studyNumber}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-text">
                      {study.orderItem?.order?.patient?.firstName} {study.orderItem?.order?.patient?.lastName}
                    </div>
                    <div className="text-xs text-text-muted">
                      MRN: {study.orderItem?.order?.patient?.mrn}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-text text-xs bg-surface-subtle px-2.5 py-1 rounded">
                      {study.modality}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text">
                    {study.orderItem?.testName || 'Imaging Procedure'}
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
                  <td className="px-6 py-4 text-right">
                    {study.pacsUrl ? (
                      <a
                        href={study.pacsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-info hover:text-info-text underline"
                      >
                        Open PACS Viewer
                      </a>
                    ) : (
                      <span className="text-xs text-text-muted">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
              {studies.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-muted text-sm">
                    No imaging studies found.
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
