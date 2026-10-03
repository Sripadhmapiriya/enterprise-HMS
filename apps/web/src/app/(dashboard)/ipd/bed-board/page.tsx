import { prisma } from '@enterprise-hms/database';
import Link from 'next/link';

export const revalidate = 0;

export default async function BedBoard() {
  const wards = await prisma.ward.findMany({
    include: {
      rooms: {
        include: {
          beds: {
            include: {
              allocations: {
                where: { status: 'ACTIVE' },
                include: { admission: { include: { patient: true } } }
              }
            }
          }
        }
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bed Board</h1>
          <p className="text-slate-500 mt-1">Enterprise Bed Management and Occupancy</p>
        </div>
      </div>

      <div className="space-y-8">
        {wards.map(ward => (
          <div key={ward.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-slate-800 text-lg">{ward.name}</h3>
                <p className="text-xs text-slate-500">{ward.wardType} • Floor: {ward.floor}</p>
              </div>
              <div className="text-sm font-medium text-slate-600">
                Capacity: {ward.capacity}
              </div>
            </div>
            
            <div className="p-6">
              {ward.rooms.map(room => (
                <div key={room.id} className="mb-6 last:mb-0">
                  <h4 className="font-medium text-slate-700 mb-3 pb-2 border-b border-slate-100">{room.name}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {room.beds.map(bed => {
                      const isActive = bed.allocations.length > 0;
                      const activeAllocation = isActive ? bed.allocations[0] : null;
                      
                      let bgClass = "bg-emerald-50 border-emerald-200";
                      let textClass = "text-emerald-700";
                      let icon = "🟢";
                      
                      if (bed.status === 'OCCUPIED') {
                        bgClass = "bg-rose-50 border-rose-200";
                        textClass = "text-rose-700";
                        icon = "🛏️";
                      } else if (bed.status === 'CLEANING') {
                        bgClass = "bg-amber-50 border-amber-200";
                        textClass = "text-amber-700";
                        icon = "🧹";
                      }

                      return (
                        <div key={bed.id} className={`p-4 rounded-xl border ${bgClass} shadow-sm flex flex-col justify-between h-32 relative group cursor-pointer transition-all hover:shadow-md`}>
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-800">{bed.bedNumber}</span>
                            <span className="text-xs" title={bed.status}>{icon}</span>
                          </div>
                          
                          <div className="mt-auto">
                            {isActive && activeAllocation ? (
                              <>
                                <p className={`font-semibold text-sm truncate ${textClass}`}>
                                  {activeAllocation.admission.patient.firstName} {activeAllocation.admission.patient.lastName.charAt(0)}.
                                </p>
                                <p className="text-xs opacity-80">{activeAllocation.admission.admissionNumber}</p>
                              </>
                            ) : (
                              <p className={`font-medium text-sm ${textClass}`}>Available</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {ward.rooms.length === 0 && <p className="text-slate-500 text-sm">No rooms configured in this ward.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
