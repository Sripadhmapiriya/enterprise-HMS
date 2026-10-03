const fs = require('fs');
const path = 'packages/database/prisma/schema.prisma';

let schema = fs.readFileSync(path, 'utf8');

const phase8Models = `
// ============================================================================
// PHASE 8: ENTERPRISE PLATFORM & HR / FINANCE
// ============================================================================

// --- ENTERPRISE ADMINISTRATION ---

model Enterprise {
  id               String   @id @default(uuid())
  name             String
  code             String   @unique
  contactEmail     String?
  contactPhone     String?
  status           String   @default("ACTIVE") // ACTIVE, SUSPENDED, CHURNED
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  subscriptions    Subscription[]
  hospitals        Hospital[] @relation("EnterpriseHospitals")

  @@map("enterprises")
}

model Subscription {
  id               String   @id @default(uuid())
  enterpriseId     String
  planName         String
  startDate        DateTime
  endDate          DateTime?
  status           String   @default("ACTIVE") // ACTIVE, EXPIRED, CANCELLED
  createdAt        DateTime @default(now())

  enterprise       Enterprise @relation(fields: [enterpriseId], references: [id])
  entitlements     FeatureEntitlement[]

  @@map("subscriptions")
}

model FeatureEntitlement {
  id               String   @id @default(uuid())
  subscriptionId   String
  featureCode      String   // E.g., "HR_MODULE", "FINANCE_MODULE", "ABDM_INTEGRATION"
  isEnabled        Boolean  @default(true)
  limits           Json?    // E.g., { "maxUsers": 1000 }
  
  subscription     Subscription @relation(fields: [subscriptionId], references: [id])

  @@map("feature_entitlements")
}

model SystemConfiguration {
  id               String   @id @default(uuid())
  tenantId         String
  hospitalId       String?
  branchId         String?
  configKey        String
  configValue      Json
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([tenantId, hospitalId, branchId, configKey])
  @@map("system_configurations")
}

// --- HR & WORKFORCE ---

model Employee {
  id               String   @id @default(uuid())
  userId           String   @unique
  tenantId         String
  employeeCode     String   @unique
  departmentId     String?
  designation      String?
  employmentType   String   // FULL_TIME, PART_TIME, CONTRACT
  joiningDate      DateTime
  reportingManagerId String?
  status           String   @default("ACTIVE") // ACTIVE, NOTICE_PERIOD, TERMINATED, RESIGNED
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user             User        @relation(fields: [userId], references: [id])
  department       Department? @relation(fields: [departmentId], references: [id])
  manager          Employee?   @relation("ReportingManager", fields: [reportingManagerId], references: [id])
  directReports    Employee[]  @relation("ReportingManager")
  credentials      EmployeeCredential[]
  attendances      Attendance[]
  leaveRequests    LeaveRequest[]
  payslips         Payslip[]
  assignedAssets   Asset[]

  @@map("employees")
}

model EmployeeCredential {
  id               String   @id @default(uuid())
  employeeId       String
  credentialType   String   // DEGREE, LICENSE, REGISTRATION
  authority        String?
  registrationNumber String?
  issueDate        DateTime?
  expiryDate       DateTime?
  status           String   @default("VALID") // VALID, EXPIRED, REVOKED

  employee         Employee @relation(fields: [employeeId], references: [id])

  @@map("employee_credentials")
}

model Attendance {
  id               String   @id @default(uuid())
  employeeId       String
  date             DateTime
  checkIn          DateTime?
  checkOut         DateTime?
  status           String   // PRESENT, ABSENT, HALF_DAY, LATE, LEAVE
  overtimeHours    Float    @default(0)
  createdAt        DateTime @default(now())

  employee         Employee @relation(fields: [employeeId], references: [id])

  @@unique([employeeId, date])
  @@map("attendances")
}

model LeaveRequest {
  id               String   @id @default(uuid())
  employeeId       String
  leaveType        String   // CASUAL, SICK, EARNED, MATERNITY
  startDate        DateTime
  endDate          DateTime
  status           String   @default("PENDING") // PENDING, APPROVED, REJECTED, CANCELLED
  reason           String?
  approvedById     String?
  createdAt        DateTime @default(now())

  employee         Employee @relation(fields: [employeeId], references: [id])
  approvedBy       User?    @relation("LeaveApprovedBy", fields: [approvedById], references: [id])

  @@map("leave_requests")
}

// --- PAYROLL ---

model SalaryStructure {
  id               String   @id @default(uuid())
  employeeId       String   @unique
  basicSalary      Float
  allowances       Json?
  deductions       Json?
  effectiveFrom    DateTime
  status           String   @default("ACTIVE") // ACTIVE, INACTIVE

  @@map("salary_structures")
}

model Payslip {
  id               String   @id @default(uuid())
  employeeId       String
  payrollPeriodId  String
  basicPay         Float
  totalAllowances  Float
  totalDeductions  Float
  netPay           Float
  status           String   @default("GENERATED") // GENERATED, APPROVED, PAID
  createdAt        DateTime @default(now())

  employee         Employee @relation(fields: [employeeId], references: [id])
  payrollPeriod    PayrollPeriod @relation(fields: [payrollPeriodId], references: [id])

  @@map("payslips")
}

model PayrollPeriod {
  id               String   @id @default(uuid())
  tenantId         String
  month            Int
  year             Int
  status           String   @default("DRAFT") // DRAFT, PROCESSING, FINALIZED, PAID
  createdAt        DateTime @default(now())

  payslips         Payslip[]

  @@unique([tenantId, month, year])
  @@map("payroll_periods")
}

// --- FINANCE & GENERAL LEDGER ---

model ChartOfAccount {
  id               String   @id @default(uuid())
  tenantId         String
  accountCode      String
  accountName      String
  accountType      String   // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  parentAccountId  String?
  isActive         Boolean  @default(true)

  parent           ChartOfAccount?  @relation("AccountHierarchy", fields: [parentAccountId], references: [id])
  children         ChartOfAccount[] @relation("AccountHierarchy")
  journalLines     JournalLine[]

  @@unique([tenantId, accountCode])
  @@map("chart_of_accounts")
}

model Journal {
  id               String   @id @default(uuid())
  tenantId         String
  journalNumber    String   @unique
  date             DateTime @default(now())
  reference        String?
  description      String?
  status           String   @default("POSTED") // DRAFT, POSTED, REVERSED
  createdById      String
  createdAt        DateTime @default(now())

  createdBy        User     @relation("JournalCreatedBy", fields: [createdById], references: [id])
  lines            JournalLine[]

  @@map("journals")
}

model JournalLine {
  id               String   @id @default(uuid())
  journalId        String
  accountId        String
  debit            Float    @default(0)
  credit           Float    @default(0)
  description      String?

  journal          Journal        @relation(fields: [journalId], references: [id])
  account          ChartOfAccount @relation(fields: [accountId], references: [id])

  @@map("journal_lines")
}

// --- ASSET MANAGEMENT ---

model Asset {
  id               String   @id @default(uuid())
  tenantId         String
  assetCode        String   @unique
  name             String
  category         String
  purchaseDate     DateTime?
  purchaseCost     Float?
  locationId       String?
  assignedToId     String?
  status           String   @default("ACTIVE") // ACTIVE, MAINTENANCE, DISPOSED
  createdAt        DateTime @default(now())

  assignedTo       Employee? @relation(fields: [assignedToId], references: [id])
  maintenanceTasks MaintenanceTask[]

  @@map("assets")
}

// --- MAINTENANCE (CMMS) ---

model MaintenanceTask {
  id               String   @id @default(uuid())
  tenantId         String
  assetId          String?
  description      String   @db.Text
  priority         String   // LOW, MEDIUM, HIGH, CRITICAL
  status           String   @default("REQUESTED") // REQUESTED, ASSIGNED, IN_PROGRESS, COMPLETED
  assignedToId     String?
  createdAt        DateTime @default(now())

  asset            Asset?   @relation(fields: [assetId], references: [id])
  assignedTo       User?    @relation("MaintenanceAssignedTo", fields: [assignedToId], references: [id])

  @@map("maintenance_tasks")
}

// --- CRM & PATIENT ENGAGEMENT ---

model PatientFeedback {
  id               String   @id @default(uuid())
  tenantId         String
  patientId        String
  encounterId      String?
  rating           Int
  category         String   // CLINICAL, NURSING, FOOD, CLEANLINESS, BILLING
  comments         String?  @db.Text
  status           String   @default("NEW") // NEW, REVIEWED, RESOLVED
  createdAt        DateTime @default(now())

  patient          Patient    @relation(fields: [patientId], references: [id])
  encounter        Encounter? @relation(fields: [encounterId], references: [id])

  @@map("patient_feedbacks")
}

// --- INTEGRATIONS & API ---

model Integration {
  id               String   @id @default(uuid())
  tenantId         String
  provider         String   // ABDM, PACS, FHIR, EXTERNAL_LAB
  config           Json
  status           String   @default("ACTIVE")
  createdAt        DateTime @default(now())

  @@map("integrations")
}

model SecurityEvent {
  id               String   @id @default(uuid())
  tenantId         String
  userId           String?
  eventType        String   // LOGIN, LOGOUT, FAILED_LOGIN, MFA_ENABLED, ROLE_CHANGED
  ipAddress        String?
  userAgent        String?
  timestamp        DateTime @default(now())
  details          Json?

  user             User?    @relation(fields: [userId], references: [id])

  @@map("security_events")
}
`;

schema = schema + phase8Models;

// Also add a relation field on Hospital to Enterprise
const hospitalRegex = /(model\s+Hospital\s+\{[\s\S]*?)(?:\n\s*@@|\n\})/;
schema = schema.replace(hospitalRegex, (match, p1) => {
    return p1.trimEnd() + '\n  enterpriseId      String?\n  enterprise        Enterprise? @relation("EnterpriseHospitals", fields: [enterpriseId], references: [id])\n\n' + match.substring(p1.length);
});

function addRelations(modelName, relations) {
    const regex = new RegExp(`(model\\s+${modelName}\\s+\\{[\\s\\S]*?)(?:\\n\\s*@@|\\n\\})`, 'g');
    schema = schema.replace(regex, (match, p1) => {
        return p1.trimEnd() + '\n' + relations.map(r => '  ' + r).join('\n') + '\n\n' + match.substring(p1.length);
    });
}

// Inject reverse relations
addRelations('User', [
  'employeeProfile          Employee?',
  'approvedLeaves           LeaveRequest[] @relation("LeaveApprovedBy")',
  'createdJournals          Journal[] @relation("JournalCreatedBy")',
  'assignedMaintenance      MaintenanceTask[] @relation("MaintenanceAssignedTo")',
  'securityEvents           SecurityEvent[]'
]);

addRelations('Patient', [
  'feedbacks                PatientFeedback[]'
]);

addRelations('Encounter', [
  'feedbacks                PatientFeedback[]'
]);

fs.writeFileSync(path, schema);
console.log('Schema fixed for Phase 8');
