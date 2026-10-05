'use client';

import { useState, useEffect } from 'react';
import { ambulanceApi, patientsApi, encountersApi } from '@/lib/api';

export default function AmbulanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'fleet' | 'trips'>('fleet');
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Ambulance Modal
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('BLS');
  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);

  // Dispatch Trip Modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [destination, setDestination] = useState('Emergency Department - Triage Bay 1');
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ambRes, tripsRes, statRes] = await Promise.all([
        ambulanceApi.getAmbulances(),
        ambulanceApi.getTrips(),
        ambulanceApi.getStats(),
      ]);
      setAmbulances(ambRes.data || []);
      setTrips(tripsRes.data || []);
      setStats(statRes.data || null);
    } catch (err: any) {
      console.error('Failed to load ambulance data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterAmbulance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNumber.trim()) {
      setNotice({ type: 'error', text: 'Vehicle number is required' });
      return;
    }
    try {
      setVehicleSubmitting(true);
      await ambulanceApi.createAmbulance({
        vehicleNumber,
        vehicleType,
      });
      setNotice({ type: 'success', text: `Ambulance ${vehicleNumber} added to fleet` });
      setShowVehicleModal(false);
      setVehicleNumber('');
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to add ambulance' });
    } finally {
      setVehicleSubmitting(false);
    }
  };

  const openDispatchModal = async (ambId?: string) => {
    if (ambId) setSelectedAmbulanceId(ambId);
    else {
      const avail = ambulances.find((a) => a.status === 'AVAILABLE');
      if (avail) setSelectedAmbulanceId(avail.id);
    }
    setShowDispatchModal(true);
    setNotice(null);
    try {
      const res = await patientsApi.getAll({ limit: 50 });
      setPatients(res.data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDispatchTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmbulanceId || !pickupLocation.trim() || !destination.trim()) {
      setNotice({ type: 'error', text: 'Ambulance, pickup, and destination are required' });
      return;
    }

    try {
      setDispatchSubmitting(true);
      let encId = undefined;
      if (selectedPatientId) {
        const encRes = await encountersApi.create({
          patientId: selectedPatientId,
          type: 'EMERGENCY',
          priority: 'URGENT',
        });
        encId = encRes.data.id;
      }

      await ambulanceApi.dispatchTrip({
        ambulanceId: selectedAmbulanceId,
        patientId: selectedPatientId || undefined,
        encounterId: encId,
        pickupLocation,
        destination,
      });

      setNotice({ type: 'success', text: 'Ambulance dispatched successfully' });
      setShowDispatchModal(false);
      setPickupLocation('');
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Dispatch failed' });
    } finally {
      setDispatchSubmitting(false);
    }
  };

  const handleUpdateTripStatus = async (tripId: string, status: string) => {
    try {
      const res = await ambulanceApi.updateTripStatus(tripId, status);
      setNotice({ type: 'success', text: res.message || `Trip status updated to ${status}` });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Action failed' });
    }
  };

  const handleUpdateVehicleStatus = async (ambId: string, status: string) => {
    try {
      await ambulanceApi.updateAmbulanceStatus(ambId, status);
      setNotice({ type: 'success', text: `Ambulance vehicle status set to ${status}` });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Action failed' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ambulance Fleet & EMS Dispatch</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Emergency vehicle telemetry, BLS/ALS capability tracking, and real-time transit dispatching.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowVehicleModal(true);
              setNotice(null);
            }}
            className="inline-flex items-center px-3.5 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
          >
            + Add Vehicle
          </button>
          <button
            onClick={() => openDispatchModal()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
          >
            Dispatch Ambulance
          </button>
        </div>
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Total Fleet</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats?.totalVehicles ?? ambulances.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Available</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{stats?.availableVehicles ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Dispatched</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{stats?.dispatchedVehicles ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Maintenance</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{stats?.maintenanceVehicles ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Active Trips</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats?.activeTrips ?? 0}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-1 text-sm font-medium">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${
            activeTab === 'fleet' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Vehicle Fleet ({ambulances.length})
        </button>
        <button
          onClick={() => setActiveTab('trips')}
          className={`px-4 py-2.5 border-b-2 whitespace-nowrap ${
            activeTab === 'trips' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Dispatch & Trips Log ({trips.length})
        </button>
      </div>

      {/* TAB 1: FLEET LIST */}
      {activeTab === 'fleet' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ambulances.map((amb) => {
            const isAvail = amb.status === 'AVAILABLE';
            const isDisp = amb.status === 'DISPATCHED';

            return (
              <div key={amb.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono font-bold text-base text-slate-900 block">{amb.vehicleNumber}</span>
                    <span className="text-xs text-slate-500 font-medium">
                      Type: <strong>{amb.vehicleType}</strong> ({
                        amb.vehicleType === 'ALS'
                          ? 'Advanced Life Support'
                          : amb.vehicleType === 'BLS'
                          ? 'Basic Life Support'
                          : 'Patient Transport'
                      })
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isAvail
                        ? 'bg-emerald-100 text-emerald-800'
                        : isDisp
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {amb.status}
                  </span>
                </div>

                {amb.trips && amb.trips.length > 0 && (
                  <div className="p-2.5 bg-blue-50 border border-blue-100 rounded text-xs text-blue-900 space-y-1">
                    <p className="font-bold text-[11px]">Active Transport Assignment</p>
                    <p>Destination: {amb.trips[0].destination}</p>
                    {amb.trips[0].patient && (
                      <p>Patient: {amb.trips[0].patient.firstName} {amb.trips[0].patient.lastName}</p>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  {isAvail && (
                    <button
                      onClick={() => openDispatchModal(amb.id)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-[11px]"
                    >
                      Dispatch Now
                    </button>
                  )}
                  {amb.status !== 'MAINTENANCE' && !isDisp && (
                    <button
                      onClick={() => handleUpdateVehicleStatus(amb.id, 'MAINTENANCE')}
                      className="text-slate-500 hover:text-slate-700 text-[11px]"
                    >
                      Take Offline
                    </button>
                  )}
                  {amb.status === 'MAINTENANCE' && (
                    <button
                      onClick={() => handleUpdateVehicleStatus(amb.id, 'AVAILABLE')}
                      className="text-emerald-700 hover:text-emerald-900 font-semibold text-[11px]"
                    >
                      Restore to Available
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: TRIPS LOG */}
      {activeTab === 'trips' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-base font-semibold text-slate-900">Ambulance Trip Log</h2>
            <span className="text-xs text-slate-500">{trips.length} dispatch trips</span>
          </div>

          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-5 py-3">Vehicle</th>
                <th className="px-5 py-3">Pickup Location</th>
                <th className="px-5 py-3">Destination</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Dispatched Time</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading trips...
                  </td>
                </tr>
              ) : trips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No trips recorded in log.
                  </td>
                </tr>
              ) : (
                trips.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-mono font-bold text-slate-900">
                      {tr.ambulance?.vehicleNumber}
                    </td>
                    <td className="px-5 py-4 text-slate-800 font-medium">
                      {tr.pickupLocation}
                    </td>
                    <td className="px-5 py-4 text-slate-800 font-medium">
                      {tr.destination}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {tr.patient ? `${tr.patient.firstName} ${tr.patient.lastName}` : 'Direct Call / Unregistered'}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-500">
                      {new Date(tr.dispatchTime).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        tr.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tr.status === 'EN_ROUTE'
                          ? 'bg-amber-100 text-amber-800'
                          : tr.status === 'ARRIVED'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {tr.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right space-x-1.5">
                      {tr.status === 'DISPATCHED' && (
                        <button
                          onClick={() => handleUpdateTripStatus(tr.id, 'EN_ROUTE')}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold"
                        >
                          En Route
                        </button>
                      )}
                      {tr.status === 'EN_ROUTE' && (
                        <button
                          onClick={() => handleUpdateTripStatus(tr.id, 'ARRIVED')}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold"
                        >
                          Arrived at Scene
                        </button>
                      )}
                      {tr.status === 'ARRIVED' && (
                        <button
                          onClick={() => handleUpdateTripStatus(tr.id, 'COMPLETED')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                        >
                          Complete Trip
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

      {/* Add Vehicle Modal */}
      {showVehicleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Register Ambulance Vehicle</h3>
                <p className="text-xs text-slate-500">Add emergency vehicle to active transport fleet</p>
              </div>
              <button onClick={() => setShowVehicleModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleRegisterAmbulance} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle License / Number *</label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="e.g. AMB-ALS-04"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle Type / Capability *</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                >
                  <option value="BLS">Basic Life Support (BLS - EMT, Oxygen, AED)</option>
                  <option value="ALS">Advanced Life Support (ALS - Paramedic, Defib, Ventilator)</option>
                  <option value="PTS">Patient Transport Service (PTS - Non-emergency Wheelchair/Stretcher)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={vehicleSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {vehicleSubmitting ? 'Registering...' : 'Add to Fleet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Trip Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Dispatch Ambulance</h3>
                <p className="text-xs text-slate-500">Initiate emergency transport mission</p>
              </div>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleDispatchTrip} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Available Vehicle *</label>
                <select
                  value={selectedAmbulanceId}
                  onChange={(e) => setSelectedAmbulanceId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                  required
                >
                  <option value="">-- Choose Ambulance --</option>
                  {ambulances
                    .filter((a) => a.status === 'AVAILABLE')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.vehicleNumber} ({a.vehicleType})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Patient (Optional)</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="">-- Unknown / Scene Pickup --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} (MRN: {p.mrn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Pickup Location *</label>
                <input
                  type="text"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  placeholder="e.g. 104 Park Avenue / Highway Incident Marker 42"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Destination *</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatchSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {dispatchSubmitting ? 'Dispatching...' : 'Authorize Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
