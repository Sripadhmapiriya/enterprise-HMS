'use client';

import { useState, useEffect } from 'react';
import { dietaryApi, patientsApi, encountersApi } from '@/lib/api';
import { Select } from '@enterprise-hms/ui';

export default function DietaryDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'worklist' | 'orders' | 'types'>('worklist');
  const [kitchenData, setKitchenData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [dietTypes, setDietTypes] = useState<any[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Order Modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDietTypeId, setSelectedDietTypeId] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [kitchRes, ordRes, typesRes] = await Promise.all([
        dietaryApi.getKitchenWorklist(),
        dietaryApi.getOrders(),
        dietaryApi.getDietTypes(),
      ]);
      setKitchenData(kitchRes.data || null);
      setOrders(ordRes.data || []);
      setDietTypes(typesRes.data || []);
    } catch (err: any) {
      console.error('Failed to load dietary data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openOrderModal = async () => {
    setShowOrderModal(true);
    setNotice(null);
    try {
      const res = await patientsApi.getAll({ limit: 50 });
      setPatients(res.data || []);
      if (dietTypes.length > 0) setSelectedDietTypeId(dietTypes[0].id);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedDietTypeId) {
      setNotice({ type: 'error', text: 'Patient and Diet Type are required' });
      return;
    }

    try {
      setSubmitting(true);
      const encRes = await encountersApi.create({
        patientId: selectedPatientId,
        type: 'INPATIENT',
        priority: 'ROUTINE',
      });

      await dietaryApi.createOrder({
        patientId: selectedPatientId,
        encounterId: encRes.data.id,
        dietTypeId: selectedDietTypeId,
        restrictions,
      });

      setNotice({ type: 'success', text: 'Diet order created and kitchen worklist updated' });
      setShowOrderModal(false);
      setRestrictions('');
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to place diet order' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscontinue = async (orderId: string) => {
    try {
      await dietaryApi.updateOrderStatus(orderId, 'DISCONTINUED');
      setNotice({ type: 'success', text: 'Diet order discontinued' });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Update failed' });
    }
  };

  const worklist = kitchenData?.worklist || [];
  const summary = kitchenData?.summary || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Clinical Dietary & Kitchen Services</h1>
          <p className="text-text-muted text-sm mt-0.5">
            Nutritional therapy orders, food allergies/restrictions, and kitchen meal tray delivery worklists.
          </p>
        </div>
        <button
          onClick={openOrderModal}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-brand-foreground bg-brand hover:bg-brand-hover shadow-sm"
        >
          + Prescribe Diet Order
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
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Total Meals to Prepare</p>
          <p className="text-2xl font-bold text-text mt-2">{kitchenData?.totalMeals ?? worklist.length}</p>
          <p className="text-xs text-text-muted mt-1">Active inpatient census trays</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Therapeutic Diets</p>
          <p className="text-2xl font-bold text-info mt-2">
            {Object.keys(summary).length}
          </p>
          <p className="text-xs text-text-muted mt-1">Specialized nutrition profiles</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">NPO Orders</p>
          <p className="text-2xl font-bold text-critical mt-2">
            {worklist.filter((w: any) => w.isNpo).length}
          </p>
          <p className="text-xs text-text-muted mt-1">Nil per os (Withhold food & fluid)</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Clinical Prescriptions</p>
          <p className="text-2xl font-bold text-stable mt-2">
            {orders.filter((o) => o.status === 'ACTIVE').length}
          </p>
          <p className="text-xs text-text-muted mt-1">Active physician orders</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border gap-1 text-sm font-medium">
        <button
          onClick={() => setActiveTab('worklist')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${ activeTab ==='worklist' ? 'border-brand text-info font-semibold' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Kitchen Tray Delivery Worklist ({worklist.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${ activeTab ==='orders' ? 'border-brand text-info font-semibold' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Physician Diet Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${ activeTab ==='types' ? 'border-brand text-info font-semibold' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Diet Types Catalog ({dietTypes.length})
        </button>
      </div>

      {/* TAB 1: KITCHEN WORKLIST */}
      {activeTab === 'worklist' && (
        <div className="space-y-4">
          {/* Diet Summary Pill Strip */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary).map(([diet, count]) => (
              <span key={diet} className="px-3 py-1 bg-surface border border-border rounded-lg text-xs font-semibold text-text shadow-sm">
                {diet}: <strong className="text-info font-bold">{count as number}</strong>
              </span>
            ))}
          </div>

          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="text-base font-semibold text-text">Current Inpatient Meal Assembly Worklist</h2>
              <span className="text-xs text-text-muted">Live roster from inpatient census</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-muted">
                <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-5 py-3">Ward & Bed</th>
                    <th className="px-5 py-3">Patient</th>
                    <th className="px-5 py-3">Prescribed Diet</th>
                    <th className="px-5 py-3">Clinical Restrictions</th>
                    <th className="px-5 py-3">Meal Tray Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-text-muted">
                        Loading kitchen delivery worklist...
                      </td>
                    </tr>
                  ) : worklist.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-text-muted">
                        No active inpatients in census.
                      </td>
                    </tr>
                  ) : (
                    worklist.map((item: any) => (
                      <tr key={item.admissionId} className={item.isNpo ? 'bg-critical-bg/40' : 'hover:bg-surface-subtle/50'}>
                        <td className="px-5 py-4">
                          <strong className="text-text block text-sm">{item.bedNumber}</strong>
                          <span className="text-text-muted text-[11px]">{item.wardName}</span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-text">
                          {item.patientName}
                          <span className="text-text-muted block text-[11px] font-normal">{item.gender}</span>
                        </td>
                        <td className="px-5 py-4">
                          {item.isNpo ? (
                            <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-critical-bg text-critical-text">
                              NPO (DO NOT FEED)
                            </span>
                          ) : (
                            <span className="font-bold text-text">
                              {item.dietType}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-text">
                          {item.restrictions !== 'None' ? (
                            <span className="bg-warning-bg text-warning-text border border-warning-border px-2 py-0.5 rounded font-medium text-[11px]">
                              {item.restrictions}
                            </span>
                          ) : (
                            <span className="text-text-muted">No restrictions</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {item.isNpo ? (
                            <span className="text-critical-text font-bold">Withheld</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-stable-bg text-stable-text border border-stable-border">
                              Tray Prepared
                            </span>
                          )}
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

      {/* TAB 2: PHYSICIAN ORDERS */}
      {activeTab === 'orders' && (
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-base font-semibold text-text">Clinical Diet Orders Log</h2>
            <button
              onClick={openOrderModal}
              className="px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold"
            >
              + Prescribe Diet Order
            </button>
          </div>

          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3">Order Date</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Diet Type</th>
                <th className="px-5 py-3">Clinical Restrictions</th>
                <th className="px-5 py-3">Prescribing Doctor</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-text-muted">
                    No diet orders placed yet.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-subtle/50">
                    <td className="px-5 py-3 text-text-muted font-mono">
                      {new Date(o.startDate || o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 font-semibold text-text">
                      {o.patient?.firstName} {o.patient?.lastName}
                    </td>
                    <td className="px-5 py-3 font-bold text-text">
                      {o.dietType?.name}
                    </td>
                    <td className="px-5 py-3 text-text">
                      {o.restrictions || 'None'}
                    </td>
                    <td className="px-5 py-3 text-text-muted">
                      Dr. {o.doctor?.user?.name || 'Attending'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ o.status ==='ACTIVE' ? 'bg-stable-bg text-stable-text' : 'bg-surface-subtle text-text-muted'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {o.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleDiscontinue(o.id)}
                          className="px-2.5 py-1 bg-surface-subtle hover:bg-surface-subtle text-text rounded text-[11px] font-medium"
                        >
                          Discontinue
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: DIET TYPES CATALOG */}
      {activeTab === 'types' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dietTypes.map((dt) => (
            <div key={dt.id} className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-text">{dt.name}</span>
                <span className="font-mono text-xs text-info-text bg-info-bg px-2 py-0.5 rounded font-bold">
                  {dt.code}
                </span>
              </div>
              <p className="text-xs text-text-muted">{dt.description || 'Standard therapeutic diet profile.'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Prescribe Diet Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 bg-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-text">Prescribe Clinical Diet Order</h3>
                <p className="text-xs text-text-muted">Therapeutic diet profile and restrictions</p>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="text-text-muted font-bold">x</button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text mb-1">Select Patient *</label>
                <Select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface"
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} (MRN: {p.mrn})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Diet Type *</label>
                <Select
                  value={selectedDietTypeId}
                  onChange={(e) => setSelectedDietTypeId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface font-semibold"
                  required
                >
                  {dietTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.name} ({dt.code})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Clinical Restrictions / Allergies</label>
                <input
                  type="text"
                  value={restrictions}
                  onChange={(e) => setRestrictions(e.target.value)}
                  placeholder="e.g. Low sodium, gluten-free, puree consistency..."
                  className="w-full px-3 py-1.5 border border-border rounded text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Prescribing...' : 'Prescribe Diet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
