import React from 'react';
import { User, ShieldAlert, AlertTriangle, Bed, Phone, Stethoscope } from 'lucide-react';
import { Badge } from './Badge';
import { PatientBannerData } from './types';
import { cn } from './utils';

export interface PatientBannerProps {
  patient: PatientBannerData;
  className?: string;
  actions?: React.ReactNode;
}

export function PatientBanner({ patient, className, actions }: PatientBannerProps) {
  const ageDisplay = patient.ageYears
    ? `${patient.ageYears}y`
    : patient.dateOfBirth
    ? `${calculateAge(patient.dateOfBirth)}y`
    : 'Unknown age';

  return (
    <section
      aria-label="Active Patient Summary Banner"
      className={cn(
        'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xs',
        className
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Core Demographics */}
        <div className="flex items-start md:items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-950 text-[#0891B2] flex items-center justify-center shrink-0">
            <User className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {patient.name}
              </h1>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                MRN: {patient.mrn}
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 capitalize">
                {patient.gender} • <span className="tabular-nums">{ageDisplay}</span>
              </span>
              {patient.bloodGroup && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 tabular-nums">
                  {patient.bloodGroup}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
              {patient.wardName && (
                <span className="flex items-center gap-1">
                  <Bed className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span>
                    {patient.wardName} {patient.roomNumber ? `• Rm ${patient.roomNumber}` : ''} {patient.bedNumber ? `• Bed ${patient.bedNumber}` : ''}
                  </span>
                </span>
              )}
              {patient.primaryDoctor && (
                <span className="flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span>Dr. {patient.primaryDoctor}</span>
                </span>
              )}
              {patient.mobile && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span className="tabular-nums">{patient.mobile}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Clinical Alerts & Allergies */}
        <div className="flex items-center gap-2 flex-wrap lg:justify-end">
          {/* Allergies */}
          {patient.allergies && patient.allergies.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                <span>Allergies:</span>
              </span>
              {patient.allergies.map((allergy, idx) => (
                <Badge
                  key={allergy.id || idx}
                  variant={allergy.severity === 'severe' ? 'critical' : 'warning'}
                  size="sm"
                >
                  {allergy.substance}
                </Badge>
              ))}
            </div>
          ) : (
            <Badge variant="stable" size="sm">
              NKDA (No Known Drug Allergies)
            </Badge>
          )}

          {/* Clinical Alerts */}
          {patient.alerts && patient.alerts.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                <span>Alerts:</span>
              </span>
              {patient.alerts.map((alert, idx) => (
                <Badge key={alert.id || idx} variant={alert.level === 'critical' ? 'critical' : 'warning'} size="sm">
                  {alert.message}
                </Badge>
              ))}
            </div>
          )}

          {actions && <div className="ml-auto lg:ml-2 shrink-0">{actions}</div>}
        </div>
      </div>
    </section>
  );
}

function calculateAge(dobString: string): number {
  const dob = new Date(dobString);
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}
