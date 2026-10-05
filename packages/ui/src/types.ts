import { ReactNode } from 'react';

export type ClinicalStatus = 'critical' | 'warning' | 'stable' | 'info' | 'neutral';

export interface PatientBannerData {
  id: string;
  mrn: string;
  name: string;
  gender: string;
  ageYears?: number;
  dateOfBirth?: string;
  bloodGroup?: string;
  mobile?: string;
  bedNumber?: string;
  roomNumber?: string;
  wardName?: string;
  allergies?: Array<{
    id?: string;
    substance: string;
    severity?: 'mild' | 'moderate' | 'severe';
  }>;
  alerts?: Array<{
    id?: string;
    message: string;
    level: 'critical' | 'warning' | 'info';
  }>;
  primaryDoctor?: string;
}

export interface NavGroup {
  label: string;
  items: Array<{
    id: string;
    label: string;
    href: string;
    iconName?: string;
    badge?: string;
    permission?: string;
  }>;
}

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Actions' | 'Patients' | 'Modules';
  href?: string;
  onSelect?: () => void;
  keywords?: string[];
}
