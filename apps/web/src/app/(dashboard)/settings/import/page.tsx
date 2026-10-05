'use client';

import React, { useState } from 'react';
import {
  Button,
  Badge,
  ErrorState,
} from '@enterprise-hms/ui';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { platformApi } from '@/lib/api';

const SAMPLE_TEMPLATES: Record<string, string> = {
  patients: `mrn,firstName,lastName,gender,dateOfBirth,mobile,email,bloodGroup
MRN-2026-001,John,Smith,MALE,1988-04-12,+15552345678,john.smith@example.com,O_POSITIVE
MRN-2026-002,Sarah,Johnson,FEMALE,1992-09-21,+15559876543,sarah.j@example.com,A_POSITIVE
MRN-2026-003,Robert,Davis,MALE,1975-11-30,+15558765432,,B_NEGATIVE`,

  items: `itemCode,name,category,unit,unitPrice,reorderLevel
MED-AMOX-500,Amoxicillin 500mg,Antibiotics,Capsule,0.45,100
MED-PARA-650,Paracetamol 650mg,Analgesics,Tablet,0.15,250
SURG-GLV-7,Surgical Gloves 7.5,Consumables,Pair,1.20,50`,

  tariffs: `code,name,department,standardRate,taxPercent
OPD-CONS-SPEC,Specialist Doctor Consultation,Outpatient,120.00,0
LAB-CBC-FULL,Complete Blood Count with Platelets,Pathology,35.00,0
RAD-XRAY-CHEST,Chest X-Ray Digital PA View,Radiology,65.00,0`,

  staff: `employeeCode,firstName,lastName,email,role,department,designation
EMP-1001,Alice,Morgan,alice.morgan@hospital.com,Doctor,Emergency Medicine,Senior Attending
EMP-1002,David,Kim,david.kim@hospital.com,Nurse,Critical Care,Charge Nurse
EMP-1003,Elena,Rostova,elena.rostova@hospital.com,Radiologist,Radiology,Lead Consultant`,
};

export default function CsvImportPage() {
  const [domain, setDomain] = useState<'patients' | 'items' | 'tariffs' | 'staff'>('patients');
  const [csvContent, setCsvContent] = useState(SAMPLE_TEMPLATES.patients);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);

  const handleDomainChange = (newDomain: 'patients' | 'items' | 'tariffs' | 'staff') => {
    setDomain(newDomain);
    setCsvContent(SAMPLE_TEMPLATES[newDomain]);
    setReport(null);
    setCommitMessage(null);
  };

  const handleValidate = async () => {
    try {
      setLoading(true);
      setCommitMessage(null);
      const res = await platformApi.validateCsv(domain, csvContent);
      setReport(res.data);
    } catch (err: any) {
      alert(`Validation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    try {
      setLoading(true);
      const res = await platformApi.commitCsv(domain, csvContent);
      setCommitMessage(res.message || 'CSV records successfully committed to hospital database');
      setReport(null);
    } catch (err: any) {
      alert(`Commit failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-7 h-7 text-indigo-600" />
          Hospital Onboarding Data Import
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Bulk import master records for fast hospital onboarding with schema validation and discrepancy reports.
        </p>
      </div>

      {/* Domain Selector Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'patients', label: '1. Master Patients' },
          { id: 'items', label: '2. Items & Medications' },
          { id: 'tariffs', label: '3. Charge Master & Tariffs' },
          { id: 'staff', label: '4. Staff & Roster' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleDomainChange(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              domain === tab.id
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {commitMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{commitMessage}</span>
        </div>
      )}

      {/* CSV Input Area */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-700 uppercase flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            CSV Data Content (Comma-Separated Values)
          </label>
          <button
            type="button"
            onClick={() => setCsvContent(SAMPLE_TEMPLATES[domain])}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Sample Template
          </button>
        </div>

        <textarea
          rows={8}
          value={csvContent}
          onChange={(e) => setCsvContent(e.target.value)}
          className="w-full font-mono text-xs p-3 border border-slate-300 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Click Dry-Run Validate to inspect row errors before committing records to the hospital database.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleValidate} disabled={loading}>
              Dry-Run Validate
            </Button>
            <Button
              size="sm"
              onClick={handleCommit}
              disabled={loading || !csvContent.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Commit Import
            </Button>
          </div>
        </div>
      </div>

      {/* Validation Report */}
      {report && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden space-y-4">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-semibold text-slate-900 text-sm">Validation Report Summary</h3>
            <div className="flex gap-2">
              <Badge variant="neutral">{report.totalRows} Total Rows</Badge>
              <Badge variant="stable">{report.validRows} Valid Rows</Badge>
              {report.invalidRows > 0 && <Badge variant="critical">{report.invalidRows} Errors</Badge>}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {report.errors.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-rose-700 uppercase flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Validation Discrepancies ({report.errors.length})
                </h4>
                <div className="border border-rose-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-rose-50 text-rose-900 font-semibold border-b border-rose-200">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Field</th>
                        <th className="px-3 py-2">Input Value</th>
                        <th className="px-3 py-2">Error Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100">
                      {report.errors.map((err: any, idx: number) => (
                        <tr key={idx} className="hover:bg-rose-50/50">
                          <td className="px-3 py-2 font-bold text-slate-900">{err.row}</td>
                          <td className="px-3 py-2 font-mono text-indigo-700">{err.field}</td>
                          <td className="px-3 py-2 text-slate-500 font-mono">{err.value || '<empty>'}</td>
                          <td className="px-3 py-2 text-rose-700">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                All {report.validRows} rows passed schema validation and are ready for database commit.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
