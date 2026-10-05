'use client';

import { useState, useEffect } from 'react';
import { dietaryApi, patientsApi, encountersApi } from '@/lib/api';

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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clinical Dietary & Kitchen Services</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Nutritional therapy orders, food allergies/restrictions, and kitchen meal tray delivery worklists.
          </p>
        </div>
        <button
          onClick={openOrderModal}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
        >
          + Prescribe Diet Order
        </button>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium flex justify-between items-center ${
            notice.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Meals to Prepare</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{kitchenData?.totalMeals ?? worklist.length}</p>
          <p className="text-xs text-slate-400 mt-1">Active inpatient census trays</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Therapeutic Diets</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {Object.keys(summary).length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Specialized nutrition profiles</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">NPO Orders</p>
          <p className="text-2xl font-bold text-rose-600 mt-2">
            {worklist.filter((w: any) => w.isNpo).length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Nil per os (Withhold food & fluid)</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Clinical Prescriptions</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {orders.filter((o) => o.status === 'ACTIVE').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Active physician orders</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-1 text-sm font-medium">
        <button
          onClick={() => setActiveTab('worklist')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${
            activeTab === 'worklist' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Kitchen Tray Delivery Worklist ({worklist.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${
            activeTab === 'orders' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Physician Diet Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${
            activeTab === 'types' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'
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
              <span key={diet} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm">
                {diet}: <strong className="text-blue-600 font-bold">{count as number}</strong>
              </span>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-900">Current Inpatient Meal Assembly Worklist</h2>
              <span className="text-xs text-slate-500">Live roster from inpatient census</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-5 py-3">Ward & Bed</th>
                    <th className="px-5 py-3">Patient</th>
                    <th className="px-5 py-3">Prescribed Diet</th>
                    <th className="px-5 py-3">Clinical Restrictions</th>
                    <th className="px-5 py-3">Meal Tray Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                        Loading kitchen delivery worklist...
                      </td>
                    </tr>
                  ) : worklist.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                        No active inpatients in census.
                      </td>
                    </tr>
                  ) : (
                    worklist.map((item: any) => (
                      <tr key={item.admissionId} className={item.isNpo ? 'bg-rose-50/40' : 'hover:bg-slate-50/50'}>
                        <td className="px-5 py-4">
                          <strong className="text-slate-900 block text-sm">{item.bedNumber}</strong>
                          <span className="text-slate-500 text-[11px]">{item.wardName}</span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {item.patientName}
                          <span className="text-slate-400 block text-[11px] font-normal">{item.gender}</span>
                        </td>
                        <td className="px-5 py-4">
                          {item.isNpo ? (
                            <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-rose-200 text-rose-900">
                              NPO (DO NOT FEED)
                            </span>
                          ) : (
                            <span className="font-bold text-slate-800">
                              {item.dietType}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {item.restrictions !== 'None' ? (
                            <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded font-medium text-[11px]">
                              {item.restrictions}
                            </span>
                          ) : (
                            <span className="text-slate-400">No restrictions</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {item.isNpo ? (
                            <span className="text-rose-700 font-bold">Withheld</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-base font-semibold text-slate-900">Clinical Diet Orders Log</h2>
            <button
              onClick={openOrderModal}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
            >
              + Prescribe Diet Order
            </button>
          </div>

          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
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
            <tbody className="divide-y divide-slate-100 text-xs">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No diet orders placed yet.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-500 font-mono">
                      {new Date(o.startDate || o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {o.patient?.firstName} {o.patient?.lastName}
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-800">
                      {o.dietType?.name}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {o.restrictions || 'None'}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      Dr. {o.doctor?.user?.name || 'Attending'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        o.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {o.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleDiscontinue(o.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium"
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
            <div key={dt.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-slate-900">{dt.name}</span>
                <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold">
                  {dt.code}
                </span>
              </div>
              <p className="text-xs text-slate-600">{dt.description || 'Standard therapeutic diet profile.'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Prescribe Diet Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Prescribe Clinical Diet Order</h3>
                <p className="text-xs text-slate-500">Therapeutic diet profile and restrictions</p>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Patient *</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} (MRN: {p.mrn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Diet Type *</label>
                <select
                  value={selectedDietTypeId}
                  onChange={(e) => setSelectedDietTypeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                  required
                >
                  {dietTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.name} ({dt.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Clinical Restrictions / Allergies</label>
                <input
                  type="text"
                  value={restrictions}
                  onChange={(e) => setRestrictions(e.target.value)}
                  placeholder="e.g. Low sodium, gluten-free, puree consistency..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
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
