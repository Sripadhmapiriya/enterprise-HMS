import { ModuleManifest } from './types';

export const FOUNDATION_MODULE: ModuleManifest = {
  id: 'foundation',
  name: 'Foundation Platform',
  description: 'Core security, multi-tenancy, RBAC, settings, audit logging, and module registry',
  kind: 'foundation',
  requires: [],
  integratesWith: [],
  permissions: [
    { code: 'auth.login', name: 'User Login', category: 'auth' },
    { code: 'users.manage', name: 'Manage Users', category: 'users' },
    { code: 'roles.manage', name: 'Manage Roles', category: 'roles' },
    { code: 'audit.view', name: 'View Audit Logs', category: 'audit' },
    { code: 'settings.manage', name: 'Manage Organization Settings', category: 'settings' },
  ],
  nav: [
    { id: 'dashboard', label: 'Dashboard', route: '/dashboard', icon: 'LayoutDashboard' },
    { id: 'settings', label: 'Settings', route: '/settings', icon: 'Settings', permission: 'settings.manage' },
  ],
  web: { routes: ['/dashboard', '/settings', '/login'] },
  events: { emits: ['tenant.created', 'user.authenticated', 'security.event'] },
};

export const MODULE_CATALOG: Record<string, ModuleManifest> = {
  patients: {
    id: 'patients',
    name: 'Patient Management',
    description: 'Master patient index, Patient 360, clinical alerts, allergies, and duplicate resolution',
    kind: 'clinical',
    requires: ['foundation'],
    integratesWith: ['billing', 'opd', 'ipd', 'emergency'],
    permissions: [
      { code: 'patients.read', name: 'View Patient Records', category: 'patients' },
      { code: 'patients.create', name: 'Register Patient', category: 'patients' },
      { code: 'patients.update', name: 'Update Patient Details', category: 'patients' },
    ],
    nav: [
      { id: 'patients', label: 'Patients', route: '/patients', icon: 'Users', permission: 'patients.read' },
    ],
    web: { routes: ['/patients'] },
    events: { emits: ['patient.created', 'patient.updated', 'patient.merged'] },
  },

  scheduling: {
    id: 'scheduling',
    name: 'Appointment & Queue Scheduling',
    description: 'Doctor schedules, slot allocation, token generation, and waitlist queues',
    kind: 'clinical',
    requires: ['patients'],
    integratesWith: ['opd', 'billing'],
    permissions: [
      { code: 'scheduling.read', name: 'View Appointments', category: 'scheduling' },
      { code: 'scheduling.create', name: 'Book Appointment', category: 'scheduling' },
      { code: 'scheduling.queue.manage', name: 'Manage OPD Queue', category: 'scheduling' },
    ],
    nav: [
      { id: 'appointments', label: 'Appointments', route: '/appointments', icon: 'Calendar', permission: 'scheduling.read' },
      { id: 'queue', label: 'Queue Board', route: '/queue', icon: 'ListOrdered', permission: 'scheduling.queue.manage' },
    ],
    web: { routes: ['/appointments', '/queue'] },
    events: { emits: ['appointment.booked', 'appointment.rescheduled', 'appointment.cancelled'] },
  },

  opd: {
    id: 'opd',
    name: 'Outpatient Care (OPD)',
    description: 'Physician consultation workspace, encounters, e-prescriptions, and order entry',
    kind: 'clinical',
    requires: ['patients'],
    integratesWith: ['scheduling', 'pharmacy', 'laboratory', 'radiology', 'billing'],
    permissions: [
      { code: 'opd.encounter.view', name: 'View Consultations', category: 'opd' },
      { code: 'opd.encounter.conduct', name: 'Conduct Consultation', category: 'opd' },
      { code: 'opd.prescription.write', name: 'Write Prescription', category: 'opd' },
    ],
    nav: [
      { id: 'opd', label: 'OPD Consultations', route: '/opd', icon: 'Stethoscope', permission: 'opd.encounter.view' },
    ],
    web: { routes: ['/opd'] },
    events: { emits: ['encounter.started', 'encounter.closed', 'prescription.issued'] },
  },

  emergency: {
    id: 'emergency',
    name: 'Emergency Department (ER)',
    description: 'ESI triage assessment, emergency tracking board, MLC documentation, and resuscitation',
    kind: 'clinical',
    requires: ['patients'],
    integratesWith: ['ipd', 'pharmacy', 'laboratory', 'billing'],
    permissions: [
      { code: 'emergency.triage', name: 'Perform Triage', category: 'emergency' },
      { code: 'emergency.board.view', name: 'View Tracking Board', category: 'emergency' },
    ],
    nav: [
      { id: 'emergency', label: 'Emergency Room', route: '/operations/emergency', icon: 'Activity', permission: 'emergency.board.view' },
    ],
    web: { routes: ['/operations/emergency'] },
    events: { emits: ['emergency.admitted', 'emergency.triaged', 'emergency.dispositioned'] },
  },

  ipd: {
    id: 'ipd',
    name: 'Inpatient Care (IPD & ADT)',
    description: 'Admission, discharge, transfers (ADT), ward bed board, nursing care, and MAR',
    kind: 'clinical',
    requires: ['patients'],
    integratesWith: ['icu', 'dietary', 'pharmacy', 'billing'],
    permissions: [
      { code: 'ipd.admit', name: 'Admit Inpatient', category: 'ipd' },
      { code: 'ipd.nursing.mar', name: 'Administer Medications (MAR)', category: 'ipd' },
      { code: 'ipd.discharge', name: 'Discharge Patient', category: 'ipd' },
    ],
    nav: [
      { id: 'ipd', label: 'Inpatient (IPD)', route: '/ipd', icon: 'BedDouble', permission: 'ipd.admit' },
      { id: 'bed-board', label: 'Bed Board', route: '/ipd/bed-board', icon: 'Grid', permission: 'ipd.admit' },
    ],
    web: { routes: ['/ipd', '/ipd/admissions', '/ipd/bed-board', '/ipd/nursing', '/ipd/rounds', '/ipd/chart'] },
    events: { emits: ['admission.created', 'bed.allocated', 'discharge.completed'] },
  },

  icu: {
    id: 'icu',
    name: 'Intensive Care Unit (ICU)',
    description: 'Continuous flowsheets, severity scores (SOFA/APACHE), and ventilator charting',
    kind: 'clinical',
    requires: ['ipd'],
    integratesWith: ['laboratory', 'pharmacy'],
    permissions: [
      { code: 'icu.chart.manage', name: 'Manage ICU Flowsheet', category: 'icu' },
    ],
    nav: [
      { id: 'icu', label: 'ICU Monitoring', route: '/operations/icu', icon: 'HeartPulse', permission: 'icu.chart.manage' },
    ],
    web: { routes: ['/operations/icu'] },
    events: { emits: ['icu.alert.triggered'] },
  },

  ot: {
    id: 'ot',
    name: 'Operating Theatre (OT)',
    description: 'Surgical scheduling, WHO surgical safety checklist, anaesthesia charting, and implant records',
    kind: 'clinical',
    requires: ['patients'],
    integratesWith: ['ipd', 'cssd', 'pharmacy'],
    permissions: [
      { code: 'ot.schedule', name: 'Schedule Surgery', category: 'ot' },
      { code: 'ot.notes.write', name: 'Record Operative Notes', category: 'ot' },
    ],
    nav: [
      { id: 'ot', label: 'Operating Theatre', route: '/operations/ot', icon: 'Scissors', permission: 'ot.schedule' },
    ],
    web: { routes: ['/operations/ot'] },
    events: { emits: ['surgery.scheduled', 'surgery.completed'] },
  },

  laboratory: {
    id: 'laboratory',
    name: 'Laboratory Information System (LIS)',
    description: 'Sample collection with barcode scanning, worklist validation, reference ranges, and reports',
    kind: 'diagnostic',
    requires: ['patients'],
    integratesWith: ['billing', 'opd', 'ipd'],
    permissions: [
      { code: 'lab.sample.collect', name: 'Collect Lab Sample', category: 'laboratory' },
      { code: 'lab.results.enter', name: 'Enter Lab Results', category: 'laboratory' },
      { code: 'lab.results.validate', name: 'Authorize Lab Report', category: 'laboratory' },
    ],
    nav: [
      { id: 'laboratory', label: 'Laboratory', route: '/laboratory', icon: 'FlaskConical', permission: 'lab.sample.collect' },
      { id: 'lab-worklist', label: 'Lab Worklist', route: '/laboratory/worklist', icon: 'ClipboardCheck', permission: 'lab.results.enter' },
    ],
    web: { routes: ['/laboratory', '/laboratory/worklist'] },
    events: { emits: ['lab.sample.received', 'lab.result.authorized', 'lab.critical.alert'] },
  },

  radiology: {
    id: 'radiology',
    name: 'Radiology & Imaging (RIS)',
    description: 'Imaging orders, study worklists, diagnostic templates, and PACS viewer integrations',
    kind: 'diagnostic',
    requires: ['patients'],
    integratesWith: ['billing', 'opd', 'ipd'],
    permissions: [
      { code: 'radiology.worklist.view', name: 'View Study Worklist', category: 'radiology' },
      { code: 'radiology.report.write', name: 'Authorize Radiology Report', category: 'radiology' },
    ],
    nav: [
      { id: 'radiology', label: 'Radiology', route: '/radiology', icon: 'Scan', permission: 'radiology.worklist.view' },
      { id: 'radiology-worklist', label: 'Imaging Worklist', route: '/radiology/worklist', icon: 'Layers', permission: 'radiology.worklist.view' },
    ],
    web: { routes: ['/radiology', '/radiology/worklist'] },
    events: { emits: ['radiology.study.performed', 'radiology.report.authorized'] },
  },

  pharmacy: {
    id: 'pharmacy',
    name: 'Pharmacy & Dispensing',
    description: 'Prescription queue fulfillment, FEFO batch picking, walk-in POS, and narcotics registry',
    kind: 'support',
    requires: ['patients', 'inventory'],
    integratesWith: ['billing', 'opd', 'ipd'],
    permissions: [
      { code: 'pharmacy.dispense', name: 'Dispense Medications', category: 'pharmacy' },
      { code: 'pharmacy.pos', name: 'Walk-in OTC Sale', category: 'pharmacy' },
    ],
    nav: [
      { id: 'pharmacy', label: 'Pharmacy', route: '/pharmacy', icon: 'Pill', permission: 'pharmacy.dispense' },
      { id: 'prescriptions', label: 'Prescription Queue', route: '/pharmacy/prescriptions', icon: 'FileText', permission: 'pharmacy.dispense' },
    ],
    web: { routes: ['/pharmacy', '/pharmacy/prescriptions'] },
    events: { emits: ['pharmacy.dispensed', 'pharmacy.batch.depleted'] },
  },

  inventory: {
    id: 'inventory',
    name: 'Inventory & Materials Management',
    description: 'Multi-store stock tracking, batch FEFO control, expiry alerts, indents, and stock audits',
    kind: 'support',
    requires: ['foundation'],
    integratesWith: ['procurement', 'pharmacy', 'finance'],
    permissions: [
      { code: 'inventory.view', name: 'View Stock Ledger', category: 'inventory' },
      { code: 'inventory.adjust', name: 'Adjust Stock & Transfer', category: 'inventory' },
    ],
    nav: [
      { id: 'inventory', label: 'Inventory Stores', route: '/inventory', icon: 'Boxes', permission: 'inventory.view' },
    ],
    web: { routes: ['/inventory'] },
    events: { emits: ['stock.adjusted', 'stock.low_alert'] },
  },

  procurement: {
    id: 'procurement',
    name: 'Procurement & Purchasing',
    description: 'Requisition approvals, purchase orders (PO), goods received notes (GRN), and 3-way matching',
    kind: 'business',
    requires: ['inventory'],
    integratesWith: ['finance'],
    permissions: [
      { code: 'procurement.create_po', name: 'Create Purchase Orders', category: 'procurement' },
      { code: 'procurement.receive_grn', name: 'Receive Goods (GRN)', category: 'procurement' },
    ],
    nav: [
      { id: 'procurement', label: 'Procurement', route: '/operations/procurement', icon: 'ShoppingCart', permission: 'procurement.create_po' },
    ],
    web: { routes: ['/operations/procurement'] },
    events: { emits: ['po.issued', 'grn.verified'] },
  },

  billing: {
    id: 'billing',
    name: 'Billing & Revenue Cycle (RCM)',
    description: 'Tariffs, auto charge capture, interim/final invoices, deposits, refunds, and cashier shifts',
    kind: 'business',
    requires: ['patients'],
    integratesWith: ['insurance', 'finance', 'opd', 'ipd'],
    permissions: [
      { code: 'billing.create', name: 'Generate Invoices', category: 'billing' },
      { code: 'billing.payment', name: 'Collect Payments', category: 'billing' },
      { code: 'billing.reports', name: 'View Shift Closures', category: 'billing' },
    ],
    nav: [
      { id: 'billing', label: 'Billing & Invoices', route: '/billing', icon: 'Receipt', permission: 'billing.create' },
      { id: 'payments', label: 'Payments & Shifts', route: '/billing/payments', icon: 'CreditCard', permission: 'billing.payment' },
    ],
    web: { routes: ['/billing', '/billing/invoices', '/billing/payments', '/billing/insurance'] },
    events: { emits: ['charge.posted', 'invoice.finalized', 'payment.collected'] },
  },

  insurance: {
    id: 'insurance',
    name: 'Insurance & TPA Claims',
    description: 'Payer contracts, pre-authorization workflows, claims submission, and denial settlement',
    kind: 'business',
    requires: ['billing'],
    integratesWith: ['ipd', 'finance'],
    permissions: [
      { code: 'insurance.claims.manage', name: 'Submit & Manage Claims', category: 'insurance' },
    ],
    nav: [
      { id: 'insurance', label: 'Insurance (TPA)', route: '/billing/insurance', icon: 'ShieldCheck', permission: 'insurance.claims.manage' },
    ],
    web: { routes: ['/billing/insurance'] },
    events: { emits: ['claim.submitted', 'claim.adjudicated'] },
  },

  bloodbank: {
    id: 'bloodbank',
    name: 'Blood Bank Management',
    description: 'Donor registries, viral screening, component separation, crossmatching, and transfusion monitoring',
    kind: 'support',
    requires: ['patients'],
    integratesWith: ['laboratory', 'ot', 'ipd'],
    permissions: [
      { code: 'bloodbank.manage', name: 'Manage Blood Inventory', category: 'bloodbank' },
    ],
    nav: [
      { id: 'bloodbank', label: 'Blood Bank', route: '/operations/blood-bank', icon: 'Droplets', permission: 'bloodbank.manage' },
    ],
    web: { routes: ['/operations/blood-bank'] },
    events: { emits: ['blood.collected', 'blood.crossmatched', 'blood.issued'] },
  },

  cssd: {
    id: 'cssd',
    name: 'Sterilization & CSSD',
    description: 'Surgical instrument packs, autoclave cycles, sterile shelf-life tracking, and issue audits',
    kind: 'support',
    requires: ['foundation'],
    integratesWith: ['ot'],
    permissions: [
      { code: 'cssd.cycles', name: 'Manage Autoclave Cycles', category: 'cssd' },
    ],
    nav: [
      { id: 'cssd', label: 'CSSD Sterilization', route: '/operations/cssd', icon: 'Sparkles', permission: 'cssd.cycles' },
    ],
    web: { routes: ['/operations/cssd'] },
    events: { emits: ['sterilization.completed'] },
  },

  dietary: {
    id: 'dietary',
    name: 'Dietary & Nutrition Services',
    description: 'Clinical diet ordering, allergen control, kitchen meal planning, and ward tray delivery',
    kind: 'support',
    requires: ['ipd'],
    integratesWith: ['ipd'],
    permissions: [
      { code: 'dietary.orders', name: 'Manage Meal Orders', category: 'dietary' },
    ],
    nav: [
      { id: 'dietary', label: 'Dietary Services', route: '/operations/dietary', icon: 'Utensils', permission: 'dietary.orders' },
    ],
    web: { routes: ['/operations/dietary'] },
    events: { emits: ['diet.ordered', 'diet.delivered'] },
  },

  housekeeping: {
    id: 'housekeeping',
    name: 'Housekeeping & Sanitization',
    description: 'Bed turnaround management, ward cleaning schedules, inspection checklists, and task tracking',
    kind: 'support',
    requires: ['foundation'],
    integratesWith: ['ipd', 'emergency'],
    permissions: [
      { code: 'housekeeping.tasks', name: 'Manage Cleaning Tasks', category: 'housekeeping' },
    ],
    nav: [
      { id: 'housekeeping', label: 'Housekeeping', route: '/operations/housekeeping', icon: 'Brush', permission: 'housekeeping.tasks' },
    ],
    web: { routes: ['/operations/housekeeping'] },
    events: { emits: ['bed.cleaned', 'task.dispatched'] },
  },

  ambulance: {
    id: 'ambulance',
    name: 'Ambulance & Emergency Dispatch',
    description: 'Vehicle fleet management, paramedic dispatch, trip logs, and emergency coordination',
    kind: 'support',
    requires: ['foundation'],
    integratesWith: ['emergency', 'billing'],
    permissions: [
      { code: 'ambulance.dispatch', name: 'Dispatch Ambulance', category: 'ambulance' },
    ],
    nav: [
      { id: 'ambulance', label: 'Ambulance Fleet', route: '/operations/ambulance', icon: 'Siren', permission: 'ambulance.dispatch' },
    ],
    web: { routes: ['/operations/ambulance'] },
    events: { emits: ['ambulance.dispatched', 'ambulance.arrived'] },
  },

  hr: {
    id: 'hr',
    name: 'Human Resources & Payroll',
    description: 'Staff directory, credential compliance, biometric attendance, shift rosters, and payroll',
    kind: 'business',
    requires: ['foundation'],
    integratesWith: ['finance'],
    permissions: [
      { code: 'hr.employees.manage', name: 'Manage Employees', category: 'hr' },
      { code: 'hr.roster.manage', name: 'Manage Shift Rosters', category: 'hr' },
    ],
    nav: [
      { id: 'hr', label: 'HR & Employees', route: '/hr/employees', icon: 'UserCheck', permission: 'hr.employees.manage' },
    ],
    web: { routes: ['/hr/employees'] },
    events: { emits: ['employee.onboarded', 'payroll.calculated'] },
  },

  finance: {
    id: 'finance',
    name: 'Finance & General Ledger',
    description: 'Double-entry journal auto-posting, chart of accounts, accounts payable/receivable, trial balance',
    kind: 'business',
    requires: ['foundation'],
    integratesWith: ['billing', 'procurement', 'assets'],
    permissions: [
      { code: 'finance.ledger.view', name: 'View Financial Ledger', category: 'finance' },
      { code: 'finance.journals.post', name: 'Post Journal Entries', category: 'finance' },
    ],
    nav: [
      { id: 'finance', label: 'Financial Ledger', route: '/finance/ledger', icon: 'BookOpen', permission: 'finance.ledger.view' },
    ],
    web: { routes: ['/finance/ledger'] },
    events: { emits: ['journal.posted'] },
  },

  assets: {
    id: 'assets',
    name: 'Biomedical Engineering & CMMS',
    description: 'Asset register, preventive maintenance schedules (PPM), work orders, and calibration audits',
    kind: 'support',
    requires: ['foundation'],
    integratesWith: ['finance'],
    permissions: [
      { code: 'assets.manage', name: 'Manage Equipment & AMC', category: 'assets' },
    ],
    nav: [
      { id: 'assets', label: 'Biomedical Assets', route: '/finance/assets', icon: 'Wrench', permission: 'assets.manage' },
    ],
    web: { routes: ['/finance/assets'] },
    events: { emits: ['asset.breakdown', 'maintenance.completed'] },
  },

  crm: {
    id: 'crm',
    name: 'Patient Relationship & Feedback',
    description: 'Patient feedback capture, complaint SLA escalations, surveys, and health campaign outreach',
    kind: 'business',
    requires: ['patients'],
    integratesWith: ['patients'],
    permissions: [
      { code: 'crm.feedback.view', name: 'Manage Patient Feedback', category: 'crm' },
    ],
    nav: [
      { id: 'crm', label: 'Patient CRM', route: '/crm/feedback', icon: 'MessageSquare', permission: 'crm.feedback.view' },
    ],
    web: { routes: ['/crm/feedback'] },
    events: { emits: ['feedback.received', 'complaint.escalated'] },
  },

  analytics: {
    id: 'analytics',
    name: 'Clinical & Operational Analytics',
    description: 'Hospital KPI dashboards, occupancy rates, average length of stay (ALOS), and scheduled MIS packs',
    kind: 'platform',
    requires: ['foundation'],
    integratesWith: [],
    permissions: [
      { code: 'analytics.view', name: 'View Analytics Dashboards', category: 'analytics' },
    ],
    nav: [
      { id: 'analytics', label: 'Analytics & MIS', route: '/analytics', icon: 'BarChart3', permission: 'analytics.view' },
    ],
    web: { routes: ['/analytics'] },
    events: { emits: ['report.generated'] },
  },

  integrations: {
    id: 'integrations',
    name: 'Interoperability & Integrations',
    description: 'HL7 / FHIR connectors, ABDM/ABHA gateways, SMS/WhatsApp adapters, and payment gateways',
    kind: 'platform',
    requires: ['foundation'],
    integratesWith: [],
    permissions: [
      { code: 'integrations.manage', name: 'Configure Integrations', category: 'integrations' },
    ],
    nav: [
      { id: 'integrations', label: 'Integrations', route: '/integrations', icon: 'Network', permission: 'integrations.manage' },
    ],
    web: { routes: ['/integrations'] },
    events: { emits: ['integration.sync'] },
  },

  enterprise: {
    id: 'enterprise',
    name: 'Multi-Hospital Enterprise Admin',
    description: 'Multi-hospital network administration, branch switchers, centralized policies, and module license manager',
    kind: 'platform',
    requires: ['foundation'],
    integratesWith: [],
    permissions: [
      { code: 'enterprise.manage', name: 'Enterprise Administration', category: 'enterprise' },
    ],
    nav: [
      { id: 'enterprise-admin', label: 'Enterprise Admin', route: '/enterprise/admin', icon: 'Building2', permission: 'enterprise.manage' },
    ],
    web: { routes: ['/enterprise/admin'] },
    events: { emits: ['hospital.enrolled', 'module.toggled'] },
  },
};
