'use client';

import { useState, useEffect } from 'react';
import { bloodBankApi, patientsApi, encountersApi } from '@/lib/api';
import { Select } from '@enterprise-hms/ui';

export default function BloodBankDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'donors' | 'donations' | 'crossmatch' | 'issues'>('inventory');
  const [summary, setSummary] = useState<any>(null);
  const [donors, setDonors] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals & Forms
  const [showDonorModal, setShowDonorModal] = useState(false);
  const [donorForm, setDonorForm] = useState({
    firstName: '',
    lastName: '',
    bloodGroup: 'O+',
    gender: 'MALE',
    dateOfBirth: '',
    mobile: '',
    eligibilityStatus: 'ELIGIBLE',
  });

  const [showDonationModal, setShowDonationModal] = useState(false);
  const [selectedDonorId, setSelectedDonorId] = useState('');
  const [donationVolume, setDonationVolume] = useState(450);

  // Crossmatch State
  const [checkPatientGroup, setCheckPatientGroup] = useState('');
  const [checkComponentId, setCheckComponentId] = useState('');
  const [crossmatchResult, setCrossmatchResult] = useState<any>(null);

  // Issue Modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueComponentId, setIssueComponentId] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [issuePatientId, setIssuePatientId] = useState('');
  const [issueSubmitting, setIssueSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumRes, donRes, collRes, compRes, issRes] = await Promise.all([
        bloodBankApi.getInventorySummary(),
        bloodBankApi.getDonors(),
        bloodBankApi.getDonations(),
        bloodBankApi.getComponents({ status: 'AVAILABLE' }),
        bloodBankApi.getIssues(),
      ]);
      setSummary(sumRes.data || null);
      setDonors(donRes.data || []);
      setDonations(collRes.data || []);
      setComponents(compRes.data || []);
      setIssues(issRes.data || []);
    } catch (err: any) {
      console.error('Failed to load blood bank data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await bloodBankApi.createDonor(donorForm);
      setNotice({ type: 'success', text: 'Blood donor registered successfully' });
      setShowDonorModal(false);
      setDonorForm({ firstName: '', lastName: '', bloodGroup: 'O+', gender: 'MALE', dateOfBirth: '1995-01-01', mobile: '', eligibilityStatus: 'ELIGIBLE' });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to register donor' });
    }
  };

  const handleRecordDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonorId) {
      setNotice({ type: 'error', text: 'Please select an eligible donor' });
      return;
    }
    try {
      const donRes = await bloodBankApi.recordDonation({
        donorId: selectedDonorId,
        volume: Number(donationVolume),
      });
      // Auto-process into PRBC, FFP, PLATELETS
      await bloodBankApi.processDonation(donRes.data.id, {
        components: ['PRBC', 'FFP', 'PLATELETS'],
      });
      setNotice({ type: 'success', text: 'Blood collected and processed into PRBC, FFP, and Platelets units' });
      setShowDonationModal(false);
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Donation recording failed' });
    }
  };

  const handleRunCrossmatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkComponentId) {
      setNotice({ type: 'error', text: 'Select an available component unit' });
      return;
    }
    try {
      const res = await bloodBankApi.crossmatchCheck({
        patientBloodGroup: checkPatientGroup,
        componentId: checkComponentId,
      });
      setCrossmatchResult(res.data);
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Crossmatch check failed' });
    }
  };

  const openIssueModal = async (compId: string) => {
    setIssueComponentId(compId);
    setShowIssueModal(true);
    setNotice(null);
    try {
      const res = await patientsApi.getAll({ limit: 50 });
      setPatients(res.data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleIssueBlood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueComponentId || !issuePatientId) {
      setNotice({ type: 'error', text: 'Select a patient for blood issue' });
      return;
    }
    try {
      setIssueSubmitting(true);
      const encRes = await encountersApi.create({
        patientId: issuePatientId,
        type: 'INPATIENT',
        priority: 'URGENT',
      });

      await bloodBankApi.issueBlood({
        componentId: issueComponentId,
        patientId: issuePatientId,
        encounterId: encRes.data.id,
      });

      setNotice({ type: 'success', text: 'Blood component unit issued for transfusion' });
      setShowIssueModal(false);
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Issue failed' });
    } finally {
      setIssueSubmitting(false);
    }
  };

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Blood Bank & Transfusion Medicine</h1>
          <p className="text-text-muted text-sm mt-0.5">
            Donor screening, component fractionation, ABO/Rh crossmatching, and transfusion tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDonorModal(true)}
            className="inline-flex items-center px-3.5 py-2 border border-border text-sm font-medium rounded-lg text-text bg-surface hover:bg-surface-subtle shadow-sm"
          >
            + Register Donor
          </button>
          <button
            onClick={() => setShowDonationModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-brand-foreground bg-brand hover:bg-brand-hover shadow-sm"
          >
            Record Donation
          </button>
        </div>
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
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Available Blood Units</p>
          <p className="text-2xl font-bold text-critical mt-2">{summary?.totalAvailableUnits ?? components.length}</p>
          <p className="text-xs text-text-muted mt-1">Tested & unexpired inventory</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Registered Donors</p>
          <p className="text-2xl font-bold text-text mt-2">{donors.length}</p>
          <p className="text-xs text-text-muted mt-1">Eligible voluntary donors</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Units Issued</p>
          <p className="text-2xl font-bold text-info mt-2">{issues.length}</p>
          <p className="text-xs text-text-muted mt-1">Transfusions fulfilled</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Crossmatch Safety</p>
          <p className="text-2xl font-bold text-stable mt-2">Enforced</p>
          <p className="text-xs text-text-muted mt-1">Zero hemolytic mismatch policy</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border gap-1 text-sm font-medium">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${ activeTab ==='inventory' ? 'border-brand text-info font-semibold' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Inventory Grid
        </button>
        <button
          onClick={() => setActiveTab('crossmatch')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${ activeTab ==='crossmatch' ? 'border-brand text-info font-semibold' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Crossmatch Checker
        </button>
        <button
          onClick={() => setActiveTab('donors')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${ activeTab ==='donors' ? 'border-brand text-info font-semibold' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Donors ({donors.length})
        </button>
        <button
          onClick={() => setActiveTab('donations')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${ activeTab ==='donations' ? 'border-brand text-info font-semibold' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Collections ({donations.length})
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${ activeTab ==='issues' ? 'border-brand text-info font-semibold' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Issue & Transfusion Log ({issues.length})
        </button>
      </div>

      {/* TAB 1: INVENTORY GRID */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-base font-semibold text-text">ABO & Rh Inventory Matrix</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {bloodGroups.map((bg) => {
                const bgData = summary?.summary?.[bg] || { PRBC: 0, FFP: 0, PLATELETS: 0, WHOLE_BLOOD: 0 };
                const total = (bgData.PRBC || 0) + (bgData.FFP || 0) + (bgData.PLATELETS || 0) + (bgData.WHOLE_BLOOD || 0);

                return (
                  <div key={bg} className="p-3 bg-surface-subtle rounded-lg border border-border text-center">
                    <p className="font-extrabold text-lg text-critical-text">{bg}</p>
                    <p className="font-bold text-sm text-text mt-0.5">{total} units</p>
                    <div className="mt-2 pt-2 border-t border-border text-[10px] text-text-muted text-left space-y-0.5">
                      <div>PRBC: <strong>{bgData.PRBC || 0}</strong></div>
                      <div>FFP: <strong>{bgData.FFP || 0}</strong></div>
                      <div>Plt: <strong>{bgData.PLATELETS || 0}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Available Units Table */}
          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="text-base font-semibold text-text">Available Component Units</h2>
              <span className="text-xs text-text-muted">{components.length} units ready</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-muted">
                <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-5 py-3">Unit ID</th>
                    <th className="px-5 py-3">Blood Group</th>
                    <th className="px-5 py-3">Component Type</th>
                    <th className="px-5 py-3">Expiry Date</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {components.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                        No blood components currently available. Record a donation to process units.
                      </td>
                    </tr>
                  ) : (
                    components.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-subtle/50">
                        <td className="px-5 py-3 font-mono font-semibold text-text">{c.unitId}</td>
                        <td className="px-5 py-3 font-extrabold text-critical-text">{c.bloodGroup}</td>
                        <td className="px-5 py-3 font-medium text-text">{c.componentType}</td>
                        <td className="px-5 py-3 text-text-muted">
                          {new Date(c.expiryDate).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-stable-bg text-stable-text">
                            {c.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => openIssueModal(c.id)}
                            className="px-3 py-1 bg-brand hover:bg-brand-hover text-brand-foreground rounded text-xs font-semibold"
                          >
                            Issue Unit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CROSSMATCH CHECKER */}
      {activeTab === 'crossmatch' && (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4 max-w-xl">
          <h2 className="text-base font-semibold text-text">ABO / Rh Compatibility & Crossmatch Check</h2>
          <p className="text-xs text-text-muted">
            Automated serological verification against patient recipient blood group prior to issue.
          </p>

          <form onSubmit={handleRunCrossmatch} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text mb-1">Patient Blood Group</label>
              <Select
                value={checkPatientGroup}
                onChange={(e) => setCheckPatientGroup(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface font-bold"
              >
                {bloodGroups.map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text mb-1">Select Blood Component Unit</label>
              <Select
                value={checkComponentId}
                onChange={(e) => setCheckComponentId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface"
                required
              >
                <option value="">-- Choose Unit --</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.unitId} ({c.bloodGroup} • {c.componentType} • Exp: {new Date(c.expiryDate).toLocaleDateString()})
                  </option>
                ))}
              </Select>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold"
            >
              Verify Compatibility
            </button>
          </form>

          {crossmatchResult && (
            <div
              className={`p-4 rounded-lg border text-xs space-y-2 mt-4 ${ crossmatchResult.isCompatible ?'bg-stable-bg border-stable-border text-stable-text'
                  : 'bg-critical-bg border-critical-border text-critical-text'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm uppercase">
                  {crossmatchResult.isCompatible ? 'COMPATIBLE' : 'INCOMPATIBLE'}
                </span>
                <span className="text-[11px] font-mono">{crossmatchResult.unitId}</span>
              </div>
              <p>Donor Unit: <strong>{crossmatchResult.donorBloodGroup}</strong> ({crossmatchResult.componentType})</p>
              <p>Patient Recipient: <strong>{crossmatchResult.patientBloodGroup}</strong></p>
              <p className="font-medium">{crossmatchResult.message}</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DONORS */}
      {activeTab === 'donors' && (
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-base font-semibold text-text">Registered Donors</h2>
            <button
              onClick={() => setShowDonorModal(true)}
              className="px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold"
            >
              + Register Donor
            </button>
          </div>

          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3">Donor ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Blood Group</th>
                <th className="px-5 py-3">Gender / DOB</th>
                <th className="px-5 py-3">Mobile</th>
                <th className="px-5 py-3">Eligibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {donors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                    No donors registered yet.
                  </td>
                </tr>
              ) : (
                donors.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-subtle/50">
                    <td className="px-5 py-3 font-mono font-semibold text-text">{d.donorId}</td>
                    <td className="px-5 py-3 font-medium text-text">{d.firstName} {d.lastName}</td>
                    <td className="px-5 py-3 font-extrabold text-critical-text">{d.bloodGroup}</td>
                    <td className="px-5 py-3 text-text-muted">{d.gender} • {new Date(d.dateOfBirth).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-text-muted">{d.mobile}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ d.eligibilityStatus ==='ELIGIBLE' ? 'bg-stable-bg text-stable-text' : 'bg-critical-bg text-critical-text'
                      }`}>
                        {d.eligibilityStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: DONATIONS */}
      {activeTab === 'donations' && (
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-base font-semibold text-text">Donation Collection Log</h2>
            <button
              onClick={() => setShowDonationModal(true)}
              className="px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold"
            >
              + Record Donation
            </button>
          </div>

          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3">Bag ID</th>
                <th className="px-5 py-3">Donor</th>
                <th className="px-5 py-3">Blood Group</th>
                <th className="px-5 py-3">Volume</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {donations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                    No donations recorded yet.
                  </td>
                </tr>
              ) : (
                donations.map((don) => (
                  <tr key={don.id} className="hover:bg-surface-subtle/50">
                    <td className="px-5 py-3 font-mono font-semibold text-text">{don.bagId}</td>
                    <td className="px-5 py-3 font-medium text-text">{don.donor?.firstName} {don.donor?.lastName}</td>
                    <td className="px-5 py-3 font-extrabold text-critical-text">{don.donor?.bloodGroup}</td>
                    <td className="px-5 py-3 text-text font-semibold">{don.volume} ml</td>
                    <td className="px-5 py-3 text-text-muted">{new Date(don.donationDate).toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-info-bg text-info-text">
                        {don.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: ISSUES */}
      {activeTab === 'issues' && (
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-base font-semibold text-text">Blood Issue & Transfusion Log</h2>
            <span className="text-xs text-text-muted">{issues.length} issued units</span>
          </div>

          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3">Issue Date</th>
                <th className="px-5 py-3">Unit ID</th>
                <th className="px-5 py-3">Component / Group</th>
                <th className="px-5 py-3">Recipient Patient</th>
                <th className="px-5 py-3">Transfusion Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {issues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-text-muted">
                    No blood units issued yet.
                  </td>
                </tr>
              ) : (
                issues.map((iss) => (
                  <tr key={iss.id} className="hover:bg-surface-subtle/50">
                    <td className="px-5 py-3 text-text-muted font-mono">
                      {new Date(iss.issueDate).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-mono font-semibold text-text">
                      {iss.component?.unitId}
                    </td>
                    <td className="px-5 py-3">
                      <strong className="text-critical-text">{iss.component?.bloodGroup}</strong> • {iss.component?.componentType}
                    </td>
                    <td className="px-5 py-3 font-medium text-text">
                      {iss.patient?.firstName} {iss.patient?.lastName} (MRN: {iss.patient?.mrn})
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stable-bg text-stable-text">
                        {iss.transfusionStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Donor Modal */}
      {showDonorModal && (
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-text">Register Blood Donor</h3>
              <button onClick={() => setShowDonorModal(false)} className="text-text-muted font-bold">x</button>
            </div>
            <form onSubmit={handleRegisterDonor} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">First Name *</label>
                  <input
                    type="text"
                    value={donorForm.firstName}
                    onChange={(e) => setDonorForm({ ...donorForm, firstName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-border rounded text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={donorForm.lastName}
                    onChange={(e) => setDonorForm({ ...donorForm, lastName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-border rounded text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Blood Group *</label>
                  <Select
                    value={donorForm.bloodGroup}
                    onChange={(e) => setDonorForm({ ...donorForm, bloodGroup: e.target.value })}
                    className="w-full px-3 py-1.5 border border-border rounded text-xs bg-surface font-bold"
                  >
                    {bloodGroups.map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Gender</label>
                  <Select
                    value={donorForm.gender}
                    onChange={(e) => setDonorForm({ ...donorForm, gender: e.target.value })}
                    className="w-full px-3 py-1.5 border border-border rounded text-xs bg-surface"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={donorForm.dateOfBirth}
                    onChange={(e) => setDonorForm({ ...donorForm, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-1.5 border border-border rounded text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Mobile Phone *</label>
                  <input
                    type="text"
                    value={donorForm.mobile}
                    onChange={(e) => setDonorForm({ ...donorForm, mobile: e.target.value })}
                    className="w-full px-3 py-1.5 border border-border rounded text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowDonorModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold"
                >
                  Register Donor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Donation Modal */}
      {showDonationModal && (
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-text">Record Blood Donation</h3>
              <button onClick={() => setShowDonationModal(false)} className="text-text-muted font-bold">x</button>
            </div>
            <form onSubmit={handleRecordDonation} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text mb-1">Select Donor *</label>
                <Select
                  value={selectedDonorId}
                  onChange={(e) => setSelectedDonorId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface"
                  required
                >
                  <option value="">-- Choose Donor --</option>
                  {donors
                    .filter((d) => d.eligibilityStatus === 'ELIGIBLE')
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.firstName} {d.lastName} ({d.bloodGroup} • ID: {d.donorId})
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Collected Volume (ml)</label>
                <input
                  type="number"
                  min="200"
                  max="600"
                  value={donationVolume}
                  onChange={(e) => setDonationVolume(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-border rounded text-xs"
                />
              </div>

              <div className="p-3 bg-info-bg border border-info-border rounded text-xs text-info-text">
                Automatic Fractionation: Unit will be separated into PRBC (Packed Red Cells), FFP (Fresh Frozen Plasma), and Platelets.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowDonationModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold"
                >
                  Record & Process
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-text">Issue Blood Component</h3>
              <button onClick={() => setShowIssueModal(false)} className="text-text-muted font-bold">x</button>
            </div>
            <form onSubmit={handleIssueBlood} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text mb-1">Select Recipient Patient *</label>
                <Select
                  value={issuePatientId}
                  onChange={(e) => setIssuePatientId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface"
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} (MRN: {p.mrn} • Blood: {p.bloodGroup || 'Unspecified'})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issueSubmitting}
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {issueSubmitting ? 'Issuing...' : 'Authorize Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
