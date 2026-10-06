'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Badge,
  Skeleton,
  ErrorState,
} from '@enterprise-hms/ui';
import {
  Network,
  Activity,
  ShieldCheck,
  CreditCard,
  Fingerprint,
  FlaskConical,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  Send,
} from 'lucide-react';
import { integrationsApi } from '@/lib/api';

export default function IntegrationsDashboardPage() {
  const [adapters, setAdapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeConsole, setActiveConsole] = useState<'abdm' | 'fhir' | 'analyzer' | 'payment'>('abdm');

  // ABDM state
  const [abdmAadhaar, setAbdmAadhaar] = useState('998877665544');
  const [abdmName, setAbdmName] = useState('Jane Doe');
  const [abdmTxnId, setAbdmTxnId] = useState('');
  const [abdmOtp, setAbdmOtp] = useState('123456');
  const [abdmResult, setAbdmResult] = useState<any>(null);
  const [abdmLoading, setAbdmLoading] = useState(false);

  // FHIR state
  const [fhirPatientId, setFhirPatientId] = useState('');
  const [fhirOutput, setFhirOutput] = useState<any>(null);
  const [fhirLoading, setFhirLoading] = useState(false);

  // Analyzer simulator state
  const [sampleBarcode, setSampleBarcode] = useState('SMP-2026-901');
  const [analyzerResult, setAnalyzerResult] = useState<any>(null);
  const [analyzerLoading, setAnalyzerLoading] = useState(false);

  // Payment simulator state
  const [paymentAmount, setPaymentAmount] = useState('150.00');
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [paymentVerified, setPaymentVerified] = useState<any>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await integrationsApi.getStatus();
      setAdapters(res.data?.adapters || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load integration adapters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ABDM Actions
  const handleGenerateAbha = async () => {
    try {
      setAbdmLoading(true);
      setAbdmResult(null);
      const res = await integrationsApi.generateAbha({
        aadhaarOrMobile: abdmAadhaar,
        name: abdmName,
        gender: 'FEMALE',
        yearOfBirth: '1995',
      });
      setAbdmTxnId(res.data.txnId);
      setAbdmResult({ step: 'OTP_SENT', message: res.data.message, txnId: res.data.txnId });
    } catch (err: any) {
      alert(`ABDM Request failed: ${err.message}`);
    } finally {
      setAbdmLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setAbdmLoading(true);
      const res = await integrationsApi.verifyAbhaOtp({
        txnId: abdmTxnId,
        otp: abdmOtp,
      });
      setAbdmResult({ step: 'VERIFIED', ...res.data });
    } catch (err: any) {
      alert(`ABDM OTP Verification failed: ${err.message}`);
    } finally {
      setAbdmLoading(false);
    }
  };

  // FHIR Actions
  const handleFetchFhir = async () => {
    try {
      setFhirLoading(true);
      setFhirOutput(null);
      // Query demo or specified patient
      const res = await integrationsApi.getFhirPatient(fhirPatientId || 'demo-patient-id');
      setFhirOutput(res);
    } catch (err: any) {
      setFhirOutput({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'not-found', diagnostics: err.message }],
      });
    } finally {
      setFhirLoading(false);
    }
  };

  // Analyzer Actions
  const handleSimulateAnalyzer = async () => {
    try {
      setAnalyzerLoading(true);
      setAnalyzerResult(null);
      const res = await integrationsApi.feedAnalyzerResults({
        analyzerId: 'SYSMEX-XN550-01',
        analyzerModel: 'Automated 5-Part Hematology Analyzer',
        sampleBarcode,
        results: [
          { parameterCode: 'HGB', parameterName: 'Hemoglobin', value: 13.8, unit: 'g/dL', referenceRange: '12.0 - 15.5' },
          { parameterCode: 'WBC', parameterName: 'White Blood Cells', value: 7400, unit: '/mcL', referenceRange: '4500 - 11000' },
          { parameterCode: 'PLT', parameterName: 'Platelets', value: 245000, unit: '/mcL', referenceRange: '150000 - 450000' },
          { parameterCode: 'GLU', parameterName: 'Random Blood Glucose', value: 98, unit: 'mg/dL', referenceRange: '70 - 140' },
        ],
      });
      setAnalyzerResult(res.data);
    } catch (err: any) {
      alert(`Analyzer simulator failed: ${err.message}`);
    } finally {
      setAnalyzerLoading(false);
    }
  };

  // Payment Actions
  const handleCreateOrder = async () => {
    try {
      setPaymentLoading(true);
      setPaymentOrder(null);
      setPaymentVerified(null);
      const res = await integrationsApi.createPaymentOrder({
        invoiceId: 'INV-DEMO-' + Date.now(),
        amount: parseFloat(paymentAmount),
        currency: 'USD',
      });
      setPaymentOrder(res.data);
    } catch (err: any) {
      alert(`Payment order failed: ${err.message}`);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!paymentOrder) return;
    try {
      setPaymentLoading(true);
      const res = await integrationsApi.verifyPayment({
        orderId: paymentOrder.orderId,
        paymentId: 'pay_' + Math.random().toString(36).substring(2, 9),
        signature: 'simulated_sig_' + Math.random().toString(36).substring(2, 8),
      });
      setPaymentVerified(res.data);
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight flex items-center gap-2">
            <Network className="w-7 h-7 text-brand" />
            Interoperability & Integrations Hub
          </h1>
          <p className="text-text-muted text-sm mt-1">
            ABDM Sandbox, HL7 FHIR R4 interfaces, automated laboratory instrument feeds, and payment gateways.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadStatus} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ?'animate-spin' : ''}`} />
          Refresh Adapters
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadStatus} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {adapters.map((a: any) => (
            <div key={a.id} className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-text text-sm">{a.name}</span>
                <Badge variant={a.status.includes('ACTIVE') ? 'stable' : 'info'}>
                  {a.status}
                </Badge>
              </div>
              <div className="text-xs text-text-muted space-y-1">
                <p>Type: <span className="font-medium text-text">{a.type}</span></p>
                <p>Version: <span className="font-medium text-text">{a.version}</span></p>
                <p>Adapter Mode: <span className="font-medium text-brand">{a.isSimulator ? 'Local Sandbox Simulator' : 'Live Gateway'}</span></p>
              </div>
              <div className="flex flex-wrap gap-1 pt-2">
                {a.capabilities.map((c: string, idx: number) => (
                  <span key={idx} className="px-2 py-0.5 bg-surface-subtle text-text-muted rounded text-[11px]">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INTERACTIVE TEST CONSOLES */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-border p-4 bg-surface-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand" />
            <h3 className="font-semibold text-text text-sm">Interactive Integration Test Consoles</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveConsole('abdm')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${ activeConsole ==='abdm' ? 'bg-brand text-brand-foreground' : 'bg-surface border border-border text-text'
              }`}
            >
              ABDM ABHA M1/M2
            </button>
            <button
              onClick={() => setActiveConsole('fhir')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${ activeConsole ==='fhir' ? 'bg-brand text-brand-foreground' : 'bg-surface border border-border text-text'
              }`}
            >
              FHIR R4 Inspector
            </button>
            <button
              onClick={() => setActiveConsole('analyzer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${ activeConsole ==='analyzer' ? 'bg-brand text-brand-foreground' : 'bg-surface border border-border text-text'
              }`}
            >
              LIS Analyzer Feed
            </button>
            <button
              onClick={() => setActiveConsole('payment')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${ activeConsole ==='payment' ? 'bg-brand text-brand-foreground' : 'bg-surface border border-border text-text'
              }`}
            >
              Payment Gateway
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* CONSOLE 1: ABDM */}
          {activeConsole === 'abdm' && (
            <div className="space-y-4 max-w-xl">
              <h4 className="font-bold text-text text-sm">ABDM Sandbox ABHA Registration & OTP Flow</h4>
              <p className="text-xs text-text-muted">
                Emulates the National Health Authority ABDM M1 protocol. Generates 14-digit ABHA ID and links hospital care context.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text">Aadhaar / Mobile Number</label>
                  <input
                    type="text"
                    value={abdmAadhaar}
                    onChange={(e) => setAbdmAadhaar(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text">Full Name</label>
                  <input
                    type="text"
                    value={abdmName}
                    onChange={(e) => setAbdmName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleGenerateAbha} disabled={abdmLoading}>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  1. Request OTP
                </Button>
              </div>

              {abdmTxnId && (
                <div className="p-4 bg-surface-subtle/50 border border-border rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-brand">Step 2: Enter OTP (Sandbox fixed OTP: 123456)</p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={abdmOtp}
                      onChange={(e) => setAbdmOtp(e.target.value)}
                      className="px-3 py-1.5 border border-border rounded-lg text-sm w-32 bg-surface"
                      placeholder="123456"
                    />
                    <Button size="sm" onClick={handleVerifyOtp} disabled={abdmLoading} className="bg-stable hover:bg-stable">
                      Verify & Generate ABHA
                    </Button>
                  </div>
                </div>
              )}

              {abdmResult && (
                <div className="p-4 bg-surface text-text rounded-xl text-xs font-mono overflow-x-auto">
                  <pre>{JSON.stringify(abdmResult, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          {/* CONSOLE 2: FHIR R4 */}
          {activeConsole === 'fhir' && (
            <div className="space-y-4 max-w-xl">
              <h4 className="font-bold text-text text-sm">HL7 FHIR R4 Resource Query</h4>
              <p className="text-xs text-text-muted">
                Transforms relational patient and encounter records into standard HL7 FHIR R4 JSON resources.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={fhirPatientId}
                  onChange={(e) => setFhirPatientId(e.target.value)}
                  placeholder="Enter Patient ID (or leave blank for test)"
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface"
                />
                <Button size="sm" onClick={handleFetchFhir} disabled={fhirLoading}>
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Query FHIR Patient
                </Button>
              </div>

              {fhirOutput && (
                <div className="p-4 bg-surface text-stable rounded-xl text-xs font-mono overflow-x-auto max-h-96">
                  <pre>{JSON.stringify(fhirOutput, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          {/* CONSOLE 3: ANALYZER FEED */}
          {activeConsole === 'analyzer' && (
            <div className="space-y-4 max-w-xl">
              <h4 className="font-bold text-text text-sm">Automated Laboratory Instrument Ingestion</h4>
              <p className="text-xs text-text-muted">
                Simulates ASTM E1394 serial/network packet from a 5-part hematology automated cell counter.
              </p>

              <div>
                <label className="text-xs font-semibold text-text">Specimen Barcode Label</label>
                <input
                  type="text"
                  value={sampleBarcode}
                  onChange={(e) => setSampleBarcode(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface"
                />
              </div>

              <Button size="sm" onClick={handleSimulateAnalyzer} disabled={analyzerLoading} className="bg-brand hover:bg-brand-hover">
                <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                Trigger Automated Instrument Feed
              </Button>

              {analyzerResult && (
                <div className="p-4 bg-surface-subtle border border-border rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-text text-xs">Specimen {analyzerResult.sampleBarcode}</span>
                    <Badge variant="stable">{analyzerResult.status}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {analyzerResult.processedResults.map((r: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs py-1 border-b border-border/60">
                        <span className="text-text-muted font-medium">{r.parameter}</span>
                        <span className="tabular-nums font-bold text-text">{r.value} {r.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONSOLE 4: PAYMENT GATEWAY */}
          {activeConsole === 'payment' && (
            <div className="space-y-4 max-w-xl">
              <h4 className="font-bold text-text text-sm">Payment Gateway Checkout & Verification</h4>
              <p className="text-xs text-text-muted">
                Simulates Razorpay / Stripe payment order creation, digital signature generation, and webhook verification.
              </p>

              <div>
                <label className="text-xs font-semibold text-text">Payment Amount ($ USD)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface"
                />
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateOrder} disabled={paymentLoading}>
                  <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                  Create Order
                </Button>
              </div>

              {paymentOrder && (
                <div className="p-4 bg-stable-bg border border-stable-border rounded-xl space-y-3 text-xs">
                  <p className="font-bold text-stable-text">Order Generated: {paymentOrder.orderId}</p>
                  <p className="text-stable-text">Amount: ${paymentOrder.amount} {paymentOrder.currency}</p>
                  <Button size="sm" onClick={handleVerifyPayment} disabled={paymentLoading} className="bg-stable hover:bg-stable">
                    Simulate Payment Captured & Signature Verify
                  </Button>
                </div>
              )}

              {paymentVerified && (
                <div className="p-4 bg-surface text-stable rounded-xl text-xs font-mono">
                  <pre>{JSON.stringify(paymentVerified, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
