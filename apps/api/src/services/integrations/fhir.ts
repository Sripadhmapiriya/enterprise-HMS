/**
 * HL7 FHIR R4 Resource Mapping & Ingestion Service
 */

export interface FhirPatient {
  resourceType: 'Patient';
  id: string;
  identifier: Array<{ system: string; value: string }>;
  name: Array<{ use: string; family: string; given: string[] }>;
  telecom?: Array<{ system: string; value: string; use?: string }>;
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  address?: Array<{ text?: string; city?: string; state?: string; country?: string }>;
}

export interface FhirEncounter {
  resourceType: 'Encounter';
  id: string;
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled';
  class: { system: string; code: string; display: string };
  subject: { reference: string; display?: string };
  period: { start: string; end?: string };
}

export interface FhirObservation {
  resourceType: 'Observation';
  id: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended';
  category?: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  code: { coding: Array<{ system: string; code: string; display: string }> };
  subject: { reference: string; display?: string };
  effectiveDateTime: string;
  valueQuantity?: { value: number; unit: string; system?: string; code?: string };
  valueString?: string;
  referenceRange?: Array<{ low?: { value: number; unit: string }; high?: { value: number; unit: string }; text?: string }>;
}

export interface FhirDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id: string;
  status: 'registered' | 'partial' | 'preliminary' | 'final';
  code: { coding: Array<{ system: string; code: string; display: string }> };
  subject: { reference: string; display?: string };
  effectiveDateTime: string;
  result: Array<{ reference: string; display?: string }>;
  conclusion?: string;
}

export class FhirService {
  toPatientResource(patient: any): FhirPatient {
    return {
      resourceType: 'Patient',
      id: patient.id,
      identifier: [
        { system: 'urn:enterprise-hms:mrn', value: patient.mrn },
        ...(patient.identifiers || []).map((id: any) => ({
          system: `urn:enterprise-hms:${id.idType || 'national-id'}`,
          value: id.idNumber,
        })),
      ],
      name: [
        {
          use: 'official',
          family: patient.lastName || '',
          given: [patient.firstName || ''],
        },
      ],
      telecom: [
        ...(patient.mobile ? [{ system: 'phone', value: patient.mobile, use: 'mobile' }] : []),
        ...(patient.email ? [{ system: 'email', value: patient.email }] : []),
      ],
      gender: (patient.gender?.toLowerCase() as any) || 'unknown',
      birthDate: patient.dateOfBirth
        ? new Date(patient.dateOfBirth).toISOString().split('T')[0]
        : undefined,
    };
  }

  toEncounterResource(encounter: any): FhirEncounter {
    let encounterClass = 'AMB'; // Ambulatory / OPD default
    if (encounter.type === 'EMERGENCY') encounterClass = 'EMER';
    if (encounter.type === 'INPATIENT') encounterClass = 'IMP';

    return {
      resourceType: 'Encounter',
      id: encounter.id,
      status: encounter.status === 'COMPLETED' ? 'finished' : 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: encounterClass,
        display: encounter.type || 'Ambulatory',
      },
      subject: {
        reference: `Patient/${encounter.patientId}`,
        display: encounter.patient ? `${encounter.patient.firstName} ${encounter.patient.lastName}` : undefined,
      },
      period: {
        start: new Date(encounter.startDate || encounter.createdAt).toISOString(),
        end: encounter.endDate ? new Date(encounter.endDate).toISOString() : undefined,
      },
    };
  }

  toObservationResource(obs: any): FhirObservation {
    return {
      resourceType: 'Observation',
      id: obs.id || 'obs-' + Math.random().toString(36).substring(2, 8),
      status: 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: obs.code || '883-9',
            display: obs.name || obs.parameter || 'Clinical Observation',
          },
        ],
      },
      subject: {
        reference: `Patient/${obs.patientId}`,
      },
      effectiveDateTime: new Date(obs.date || Date.now()).toISOString(),
      valueQuantity: obs.numericValue
        ? {
            value: Number(obs.numericValue),
            unit: obs.unit || '',
          }
        : undefined,
      valueString: obs.numericValue ? undefined : String(obs.value || ''),
    };
  }

  parseBundle(bundle: any): { entries: any[]; resourceCounts: Record<string, number> } {
    if (bundle.resourceType !== 'Bundle' || !Array.isArray(bundle.entry)) {
      throw new Error('Invalid FHIR R4 Bundle: Expected resourceType "Bundle" with entry array');
    }

    const counts: Record<string, number> = {};
    const entries = bundle.entry.map((e: any) => {
      const res = e.resource;
      if (res && res.resourceType) {
        counts[res.resourceType] = (counts[res.resourceType] || 0) + 1;
      }
      return res;
    });

    return { entries, resourceCounts: counts };
  }
}

export const fhirService = new FhirService();
