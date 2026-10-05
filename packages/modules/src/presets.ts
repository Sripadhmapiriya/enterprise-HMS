import { PresetDef } from './types';
import { defaultResolver } from './resolver';

export const BUILTIN_PRESETS: Record<string, PresetDef> = {
  'patients-only': {
    id: 'patients-only',
    name: 'Patients Master Index Only',
    description: 'Patient registration, master patient index, Patient 360, clinical alerts, and allergies',
    modules: ['patients'],
  },
  'pharmacy-er': {
    id: 'pharmacy-er',
    name: 'Pharmacy and Emergency Care',
    description: 'Emergency triage tracking board, pharmacy medication dispensing, FEFO batching, and inventory',
    modules: ['emergency', 'pharmacy'],
  },
  'opd-clinic': {
    id: 'opd-clinic',
    name: 'Outpatient Clinic Edition',
    description: 'OPD doctor consultations, appointment schedules, queue token display, and outpatient billing',
    modules: ['opd', 'scheduling', 'billing'],
  },
  'diagnostic-centre': {
    id: 'diagnostic-centre',
    name: 'Diagnostic Centre Edition',
    description: 'Laboratory investigations, radiology study worklists, diagnostic reports, and patient billing',
    modules: ['laboratory', 'radiology', 'billing'],
  },
  'hospital-standard': {
    id: 'hospital-standard',
    name: 'Hospital Standard Edition',
    description: 'Standard hospital operations including OPD, IPD, Emergency, Pharmacy, Lab, Radiology, and Billing',
    modules: [
      'patients',
      'scheduling',
      'opd',
      'emergency',
      'ipd',
      'pharmacy',
      'inventory',
      'laboratory',
      'radiology',
      'billing',
      'insurance',
      'housekeeping',
    ],
  },
  'full-enterprise': {
    id: 'full-enterprise',
    name: 'Full Enterprise Edition',
    description: 'All 25 modules enabled across clinical, diagnostic, operational, and financial hospital suites',
    modules: [
      'patients',
      'scheduling',
      'opd',
      'emergency',
      'ipd',
      'icu',
      'ot',
      'laboratory',
      'radiology',
      'pharmacy',
      'inventory',
      'procurement',
      'billing',
      'insurance',
      'bloodbank',
      'cssd',
      'dietary',
      'housekeeping',
      'ambulance',
      'hr',
      'finance',
      'assets',
      'crm',
      'analytics',
      'integrations',
      'enterprise',
    ],
  },
};

export function getPreset(presetId: string): PresetDef | undefined {
  return BUILTIN_PRESETS[presetId];
}

export function listPresets(): PresetDef[] {
  return Object.values(BUILTIN_PRESETS);
}

export function resolvePresetModules(presetId: string): {
  enabled: string[];
  autoEnabled: string[];
  missing: string[];
} {
  const preset = getPreset(presetId);
  if (!preset) {
    throw new Error(`Preset "\${presetId}" not found`);
  }
  return defaultResolver.resolveDependencies(preset.modules);
}
