import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function PatientProfile({ params }: { params: { id: string } }) {
  const patient = await prisma.patient.findUnique({
    where: { id: params.id },
    include: {
      appointments: {
        include: { doctor: { include: { user: true } }, department: true },
        orderBy: { appointmentDate: 'desc' }
      },
      encounters: {
        include: { doctor: { include: { user: true } }, department: true, diagnoses: true, prescriptions: true },
        orderBy: { startTime: 'desc' }
      }
    }
  });

  if (!patient) return <div>Patient not found</div>;
  const age = new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{patient.firstName} {patient.lastName}</h1>
          <p className="text-slate-500 mt-1">MRN: {patient.mrn} • {age} years • {patient.gender}</p>
        </div>
        <div className="flex space-x-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm">
            Edit Patient
          </button>
          <Link href={`/appointments/new?patientId=${patient.id}`} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-600/20">
            Book Appointment
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4">Patient Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Blood Group</span><span className="font-medium text-slate-900">{patient.bloodGroup || 'Unknown'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Mobile</span><span className="font-medium text-slate-900">{patient.mobile}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">City</span><span className="font-medium text-slate-900">{patient.city || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="font-medium text-emerald-600">{patient.status}</span></div>
            </div>
          </div>
          
          <div className="bg-rose-50 p-6 rounded-xl border border-rose-100 shadow-sm">
            <h3 className="font-semibold text-rose-800 mb-2 flex items-center"><span className="mr-2">⚠️</span> Clinical Alerts</h3>
            <p className="text-sm text-rose-600">No active alerts or allergies recorded.</p>
          </div>
        </div>

        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-800">Timeline & Encounters</h3>
            </div>
            <div className="p-6">
              {patient.encounters.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No past encounters.</p>
              ) : (
                <div className="space-y-6 border-l-2 border-slate-100 ml-3 pl-6">
                  {patient.encounters.map(enc => (
                    <div key={enc.id} className="relative">
                      <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[31px] top-1.5 border-4 border-white"></div>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-slate-900">{enc.type} Consultation</h4>
                            <p className="text-xs text-slate-500 mt-1">Dr. {enc.doctor.user.lastName} • {enc.department.name} • {enc.startTime.toLocaleDateString()}</p>
                          </div>
                          <Link href={`/consultation/${enc.id}`} className="text-blue-600 text-xs font-medium bg-blue-50 px-2 py-1 rounded">View Record</Link>
                        </div>
                        {enc.diagnoses.length > 0 && (
                          <div className="mt-3 text-sm">
                            <span className="font-medium text-slate-700">Diagnosis:</span> {enc.diagnoses.map(d => d.description).join(', ')}
                          </div>
                        )}
                        {enc.prescriptions.length > 0 && (
                          <div className="mt-2 text-sm text-emerald-600 flex items-center">
                            <span>💊 Rx Generated</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
