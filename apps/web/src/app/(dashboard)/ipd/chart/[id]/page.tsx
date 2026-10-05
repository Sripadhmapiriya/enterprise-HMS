import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export const revalidate = 0;

export default async function IpdChart({ params }: { params: { id: string } }) {
  const admission = await prisma.admission.findUnique({
    where: { id: params.id },
    include: {
      patient: true,
      encounter: {
        include: {
          careTeam: { include: { members: { include: { user: true } } } },
          vitals: { orderBy: { recordedAt: 'desc' } }
        }
      },
      bedAllocations: { where: { status: 'ACTIVE' }, include: { bed: { include: { room: { include: { ward: true } } } } } },
      admittingDoctor: { include: { user: true } },
      attendingDoctor: { include: { user: true } },
      nursingAssessments: true,
      carePlans: true,
      doctorRounds: { orderBy: { createdAt: 'desc' }, include: { doctor: { include: { user: true } } } },
      medicationOrders: { include: { administrations: true } }
    }
  });

  if (!admission) return <div>Admission not found</div>;

  const currentBed = admission.bedAllocations[0];
  const age = new Date().getFullYear() - new Date(admission.patient.dateOfBirth).getFullYear();

  return (
    <div className="space-y-6">
      {/* Patient Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl">
            {admission.patient.firstName.charAt(0)}{admission.patient.lastName.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{admission.patient.firstName} {admission.patient.lastName}</h1>
            <p className="text-slate-500">
              MRN: {admission.patient.mrn} • {age}y / {admission.patient.gender.charAt(0)} • Blood: {admission.patient.bloodGroup || 'Unknown'}
            </p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 text-right">
          <div className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{admission.status}</span>
          </div>
          <p className="text-slate-600 font-medium mt-2">{currentBed ? `${currentBed.bed.room?.ward.name} - Bed ${currentBed.bed.bedNumber}` : 'Bed Unallocated'}</p>
          <p className="text-xs text-slate-500">Admitted: {new Date(admission.admissionDate).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Info */}
        <div className="col-span-1 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wider">Admission Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">IPD No</span><span className="font-medium">{admission.admissionNumber}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-medium">{admission.admissionType}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Admitting Dr</span><span className="font-medium text-right">Dr. {admission.admittingDoctor.user.lastName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Attending Dr</span><span className="font-medium text-right">Dr. {admission.attendingDoctor.user.lastName}</span></div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-2 text-sm uppercase tracking-wider">Care Team</h3>
              <div className="space-y-2">
                {admission.encounter.careTeam?.members.map(member => (
                  <div key={member.id} className="text-sm flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span className="text-slate-700">{member.user.firstName} {member.user.lastName} <span className="text-xs text-slate-400">({member.role})</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="bg-rose-50 p-5 rounded-xl border border-rose-100 shadow-sm">
            <h3 className="font-semibold text-rose-800 mb-2 flex items-center text-sm uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 mr-2 text-rose-600 shrink-0" aria-hidden="true" />
              Alerts
            </h3>
            <p className="text-sm text-rose-600">No active alerts recorded.</p>
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
            {/* Tabs (Static for now, would be interactive on client) */}
            <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 scrollbar-hide">
              {['Overview', 'Vitals', 'Doctor Rounds', 'Nursing', 'Medications', 'Orders'].map((tab, i) => (
                <button key={tab} className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${i === 0 ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {tab}
                </button>
              ))}
            </div>
            
            <div className="p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Clinical Overview</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Reason for Admission</h3>
                  <p className="text-slate-800 bg-slate-50 p-4 rounded-lg border border-slate-100">{admission.reason}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Latest Vitals</h3>
                    {admission.encounter.vitals.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-slate-500">Temp:</span> <span className="font-medium text-rose-600">{admission.encounter.vitals[0].temperature}°F</span></div>
                        <div><span className="text-slate-500">BP:</span> <span className="font-medium">{admission.encounter.vitals[0].bpSystolic}/{admission.encounter.vitals[0].bpDiastolic}</span></div>
                        <div><span className="text-slate-500">Pulse:</span> <span className="font-medium">{admission.encounter.vitals[0].pulse} bpm</span></div>
                        <div><span className="text-slate-500">SpO2:</span> <span className="font-medium text-emerald-600">{admission.encounter.vitals[0].spo2}%</span></div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No vitals recorded.</p>
                    )}
                  </div>
                  
                  <div className="border border-slate-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Medications</h3>
                    {admission.medicationOrders.length > 0 ? (
                      <ul className="space-y-2 text-sm">
                        {admission.medicationOrders.filter(m => m.status === 'ACTIVE').map(med => (
                          <li key={med.id} className="flex justify-between border-b border-slate-100 pb-1 last:border-0">
                            <span className="font-medium text-slate-800">{med.medicationName}</span>
                            <span className="text-slate-500">{med.dose} {med.frequency}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">No active medications.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Doctor Rounds</h3>
                  {admission.doctorRounds.length > 0 ? (
                    <div className="space-y-3">
                      {admission.doctorRounds.slice(0, 2).map(round => (
                        <div key={round.id} className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-slate-900">Dr. {round.doctor.user.lastName}</span>
                            <span className="text-xs text-slate-500">{new Date(round.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-slate-700">{round.progressNote}</p>
                          {round.plan && <p className="text-sm text-slate-700 mt-2"><span className="font-medium">Plan:</span> {round.plan}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No rounds recorded yet.</p>
                  )}
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
