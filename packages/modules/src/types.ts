export type ModuleKind = 'foundation' | 'clinical' | 'diagnostic' | 'support' | 'business' | 'platform';

export interface PermissionDef {
  code: string;
  name: string;
  category: string;
  description?: string;
}

export interface NavItem {
  id: string;
  label: string;
  route: string;
  icon: string;
  permission?: string;
  badge?: string;
  children?: NavItem[];
}

export interface ModuleManifest {
  id: string;
  name: string;
  description: string;
  kind: ModuleKind;
  requires: string[];
  integratesWith: string[];
  permissions: PermissionDef[];
  nav: NavItem[];
  apiRoutes?: string[];
  web: { routes: string[] };
  events: {
    emits: string[];
    handles?: Record<string, (event: any) => Promise<void> | void>;
  };
  limits?: Record<string, number>;
}

export interface PresetDef {
  id: string;
  name: string;
  description: string;
  modules: string[];
}

export interface ModuleCapabilities {
  enabledModules: string[];
  availableModules: string[];
  permissions: string[];
  nav: NavItem[];
}

export interface DomainEvent<T = any> {
  id: string;
  name: string;
  tenantId: string;
  hospitalId?: string;
  timestamp: string;
  payload: T;
}

export type EventHandler = (event: DomainEvent) => Promise<void> | void;

// Decoupled Ports
export interface ChargeItem {
  patientId: string;
  encounterId?: string;
  departmentId?: string;
  chargeCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  sourceModule: string;
  sourceReferenceId?: string;
}

export interface ChargeCapturePort {
  postCharge(charge: ChargeItem): Promise<{ success: boolean; billItemId?: string; receiptMode?: 'INVOICE' | 'POS' }>;
}

export interface OrderItem {
  patientId: string;
  encounterId?: string;
  type: 'LAB' | 'RADIOLOGY' | 'PHARMACY';
  orderCode: string;
  orderDescription: string;
  notes?: string;
}

export interface OrderingPort {
  createOrder(order: OrderItem): Promise<{ success: boolean; orderId?: string }>;
}

export interface ResultItem {
  orderId: string;
  patientId: string;
  type: 'LAB' | 'RADIOLOGY';
  status: 'PENDING' | 'PRELIMINARY' | 'FINAL';
  findings: string;
  critical?: boolean;
}

export interface ResultsPort {
  publishResult(result: ResultItem): Promise<{ success: boolean }>;
}

export interface NotificationMessage {
  tenantId: string;
  userId?: string;
  recipient: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
  title: string;
  body: string;
}

export interface NotificationPort {
  send(message: NotificationMessage): Promise<{ success: boolean; messageId?: string }>;
}

export interface PatientSummary {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dob?: string;
  gender?: string;
  allergies: string[];
  alerts: string[];
}

export interface PatientLookupPort {
  getPatient(tenantId: string, patientId: string): Promise<PatientSummary | null>;
}
