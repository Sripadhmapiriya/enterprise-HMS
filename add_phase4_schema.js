const fs = require('fs');

const path = 'packages/database/prisma/schema.prisma';
let schema = fs.readFileSync(path, 'utf8');

const phase4Models = `

// ============================================================================
// PHASE 4: DIAGNOSTICS MANAGEMENT
// ============================================================================

model DiagnosticCategory {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  description String?
  type        String   // LABORATORY, RADIOLOGY, PATHOLOGY
  status      String   @default("ACTIVE")
  createdAt   DateTime @default(now())

  services    DiagnosticService[]

  @@map("diagnostic_categories")
}

model DiagnosticService {
  id               String   @id @default(uuid())
  tenantId         String
  categoryId       String
  name             String
  code             String
  departmentId     String?
  specimenTypeId   String?
  sampleRequired   Boolean  @default(true)
  turnaroundTime   Int?     // In minutes
  price            Float?
  status           String   @default("ACTIVE")
  instructions     String?
  resultType       String   @default("NUMERIC") // NUMERIC, TEXT, BOOLEAN, PANEL, ATTACHMENT
  createdAt        DateTime @default(now())

  category         DiagnosticCategory @relation(fields: [categoryId], references: [id])
  specimenType     SpecimenType?      @relation(fields: [specimenTypeId], references: [id])
  panels           DiagnosticPanel[]
  orderItems       InvestigationOrderItem[]

  @@map("diagnostic_services")
}

model DiagnosticPanel {
  id               String   @id @default(uuid())
  serviceId        String
  parameterId      String
  displayOrder     Int      @default(0)
  
  service          DiagnosticService @relation(fields: [serviceId], references: [id])
  parameter        DiagnosticParameter @relation(fields: [parameterId], references: [id])

  @@map("diagnostic_panels")
}

model DiagnosticParameter {
  id               String   @id @default(uuid())
  tenantId         String
  name             String
  code             String
  unit             String?
  resultType       String   @default("NUMERIC")
  status           String   @default("ACTIVE")

  panels           DiagnosticPanel[]
  ranges           DiagnosticParameterRange[]
  results          LabResult[]

  @@map("diagnostic_parameters")
}

model DiagnosticParameterRange {
  id               String   @id @default(uuid())
  parameterId      String
  gender           String?  // MALE, FEMALE, ANY
  minAge           Int?
  maxAge           Int?
  minRange         Float?
  maxRange         Float?
  criticalLow      Float?
  criticalHigh     Float?
  normalText       String?  // For TEXT/BOOLEAN result types

  parameter        DiagnosticParameter @relation(fields: [parameterId], references: [id])

  @@map("diagnostic_parameter_ranges")
}

model SpecimenType {
  id               String   @id @default(uuid())
  tenantId         String
  name             String   // Blood, Urine, Stool
  code             String
  status           String   @default("ACTIVE")

  services         DiagnosticService[]
  samples          LabSample[]

  @@map("specimen_types")
}

model LabSample {
  id               String   @id @default(uuid())
  tenantId         String
  sampleId         String   @unique // LAB-2026-000001
  orderItemId      String   @unique
  patientId        String
  specimenTypeId   String
  collectionTime   DateTime?
  collectedById    String?
  status           String   @default("PENDING") // PENDING, COLLECTED, RECEIVED, REJECTED, PROCESSING, COMPLETED, CANCELLED
  rejectionReason  String?
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  orderItem        InvestigationOrderItem @relation(fields: [orderItemId], references: [id])
  patient          Patient                @relation(fields: [patientId], references: [id])
  specimenType     SpecimenType           @relation(fields: [specimenTypeId], references: [id])
  collectedBy      User?                  @relation("SampleCollectedBy", fields: [collectedById], references: [id])
  results          LabResult[]

  @@map("lab_samples")
}

model LabResult {
  id               String   @id @default(uuid())
  sampleId         String
  parameterId      String?
  value            String
  unit             String?
  referenceRange   String?
  flag             String?  // NORMAL, LOW, HIGH, CRITICAL_LOW, CRITICAL_HIGH, ABNORMAL, POSITIVE, NEGATIVE
  method           String?
  notes            String?
  enteredById      String
  verifiedById     String?
  status           String   @default("DRAFT") // DRAFT, SUBMITTED, VERIFIED, REPORTED
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  sample           LabSample              @relation(fields: [sampleId], references: [id])
  parameter        DiagnosticParameter?   @relation(fields: [parameterId], references: [id])
  enteredBy        User                   @relation("ResultEnteredBy", fields: [enteredById], references: [id])
  verifiedBy       User?                  @relation("ResultVerifiedBy", fields: [verifiedById], references: [id])

  @@map("lab_results")
}

model CriticalResult {
  id               String   @id @default(uuid())
  tenantId         String
  patientId        String
  orderItemId      String
  resultValue      String
  status           String   @default("PENDING") // PENDING, ACKNOWLEDGED
  createdAt        DateTime @default(now())

  patient          Patient                @relation(fields: [patientId], references: [id])
  orderItem        InvestigationOrderItem @relation(fields: [orderItemId], references: [id])
  acknowledgments  CriticalResultAcknowledgment[]

  @@map("critical_results")
}

model CriticalResultAcknowledgment {
  id               String   @id @default(uuid())
  criticalResultId String
  acknowledgedById String
  method           String
  notes            String?
  createdAt        DateTime @default(now())

  criticalResult   CriticalResult @relation(fields: [criticalResultId], references: [id])
  acknowledgedBy   User           @relation(fields: [acknowledgedById], references: [id])

  @@map("critical_result_acknowledgments")
}

model RadiologyStudy {
  id               String   @id @default(uuid())
  tenantId         String
  studyNumber      String   @unique // RAD-2026-000001
  orderItemId      String   @unique
  patientId        String
  modality         String   // X-Ray, MRI, CT
  bodyPart         String?
  priority         String   @default("ROUTINE")
  scheduledTime    DateTime?
  performedTime    DateTime?
  technicianId     String?
  status           String   @default("SCHEDULED") // SCHEDULED, ARRIVED, IN_PROGRESS, COMPLETED, REPORTED, VERIFIED, CANCELLED
  pacsReference    String?  // Study UID
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  orderItem        InvestigationOrderItem @relation(fields: [orderItemId], references: [id])
  patient          Patient                @relation(fields: [patientId], references: [id])
  technician       User?                  @relation("StudyPerformedBy", fields: [technicianId], references: [id])
  report           RadiologyReport?

  @@map("radiology_studies")
}

model RadiologyReport {
  id               String   @id @default(uuid())
  studyId          String   @unique
  clinicalIndication String? @db.Text
  technique        String?  @db.Text
  findings         String   @db.Text
  impression       String   @db.Text
  recommendations  String?  @db.Text
  status           String   @default("DRAFT") // DRAFT, SUBMITTED, VERIFIED
  reportedById     String
  verifiedById     String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  study            RadiologyStudy @relation(fields: [studyId], references: [id])
  reportedBy       User           @relation("RadiologyReportedBy", fields: [reportedById], references: [id])
  verifiedBy       User?          @relation("RadiologyVerifiedBy", fields: [verifiedById], references: [id])

  @@map("radiology_reports")
}
`;

function addRelations(modelName, relations) {
    const regex = new RegExp(`(model\\s+${modelName}\\s+\\{[\\s\\S]*?)(?:\\n\\s*@@|\\n\\})`, 'g');
    schema = schema.replace(regex, (match, p1) => {
        return p1.trimEnd() + '\n' + relations.map(r => '  ' + r).join('\n') + '\n\n' + match.substring(p1.length);
    });
}

schema = schema + phase4Models;

addRelations('InvestigationOrderItem', [
  'serviceId        String?',
  'service          DiagnosticService? @relation(fields: [serviceId], references: [id])',
  'labSample        LabSample?',
  'radiologyStudy   RadiologyStudy?',
  'criticalResults  CriticalResult[]'
]);

addRelations('Patient', [
  'labSamples       LabSample[]',
  'criticalResults  CriticalResult[]',
  'radiologyStudies RadiologyStudy[]'
]);

addRelations('User', [
  'samplesCollected LabSample[] @relation("SampleCollectedBy")',
  'resultsEntered   LabResult[] @relation("ResultEnteredBy")',
  'resultsVerified  LabResult[] @relation("ResultVerifiedBy")',
  'criticalAcks     CriticalResultAcknowledgment[]',
  'studiesPerformed RadiologyStudy[] @relation("StudyPerformedBy")',
  'radiologyReports RadiologyReport[] @relation("RadiologyReportedBy")',
  'radiologyVerifs  RadiologyReport[] @relation("RadiologyVerifiedBy")'
]);

fs.writeFileSync(path, schema);
console.log('Schema fixed for Phase 4');
