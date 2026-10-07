import React from 'react';
import { User, ShieldAlert, AlertTriangle, Bed, Phone, Stethoscope } from 'lucide-react';
import { Badge } from './Badge';
import { PatientBannerData } from './types';
import { cn } from './utils';

export interface PatientBannerProps {
  patient: PatientBannerData;
  className?: string;
  actions?: React.ReactNode;
  onConfirmNKDA?: () => void;
}

export function PatientBanner({ patient, className, actions, onConfirmNKDA }: PatientBannerProps) {
  const ageDisplay = patient.ageYears
    ? `${patient.ageYears}y`
    : patient.dateOfBirth
    ? `${calculateAge(patient.dateOfBirth)}y`
    : 'Unknown age';

  return (
    <section
      aria-label="Active Patient Summary Banner"
      className={cn(
        'w-full bg-surface border border-border rounded-lg p-3 shadow-xs',
        className
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Core Demographics */}
        <div className="flex items-start md:items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-info-bg text-info flex items-center justify-center shrink-0">
            <User className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-text tracking-tight">
                {patient.name}
              </h1>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-surface-subtle text-text tabular-nums">
                MRN: {patient.mrn}
              </span>
              <span className="text-xs font-medium text-muted capitalize">
                {patient.gender} • <span className="tabular-nums">{ageDisplay}</span>
              </span>
              {patient.bloodGroup && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-critical-bg text-critical-text tabular-nums">
                  {patient.bloodGroup}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted mt-1 flex-wrap">
              {patient.wardName && (
                <span className="flex items-center gap-1">
                  <Bed className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                  <span>
                    {patient.wardName} {patient.roomNumber ? `• Rm ${patient.roomNumber}` : ''} {patient.bedNumber ? `• Bed ${patient.bedNumber}` : ''}
                  </span>
                </span>
              )}
              {patient.primaryDoctor && (
                <span className="flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                  <span>Dr. {patient.primaryDoctor}</span>
                </span>
              )}
              {patient.mobile && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                  <span className="tabular-nums">{patient.mobile}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Clinical Alerts & Allergies */}
        <div className="flex items-center gap-2 flex-wrap lg:justify-end">
          {/* Allergies */}
          {patient.allergyStatus === 'HAS_ALLERGIES' || (patient.allergies && patient.allergies.length > 0) ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-muted flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
                <span>Allergies:</span>
              </span>
              {patient.allergies?.map((allergy, idx) => (
                <Badge
                  key={allergy.id || idx}
                  variant={allergy.severity === 'severe' ? 'critical' : 'warning'}
                  size="sm"
                >
                  {allergy.substance}
                </Badge>
              ))}
            </div>
          ) : patient.allergyStatus === 'NKDA_CONFIRMED' ? (
            <Badge variant="stable" size="sm">
              No Known Drug Allergies
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="neutral" size="sm" className="bg-surface-subtle text-muted">
                Allergies Not Assessed
              </Badge>
              {onConfirmNKDA && (
                <button
                  type="button"
                  onClick={onConfirmNKDA}
                  className="text-[10px] px-2 py-0.5 border border-border rounded bg-surface hover:bg-surface-subtle text-text transition-colors font-medium cursor-pointer"
                >
                  Confirm NKDA
                </button>
              )}
            </div>
          )}

          {/* Clinical Alerts */}
          {patient.alerts && patient.alerts.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-critical-text flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-critical" aria-hidden="true" />
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
