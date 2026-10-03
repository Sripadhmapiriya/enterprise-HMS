const fs = require('fs');
const path = 'packages/database/prisma/schema.prisma';

let schema = fs.readFileSync(path, 'utf8');

const phase7Models = `
// ============================================================================
// PHASE 7: HOSPITAL OPERATIONS
// ============================================================================

// --- EMERGENCY ---

model TriageAssessment {
  id               String   @id @default(uuid())
  encounterId      String   @unique
  arrivalMode      String   // AMBULANCE, WALK_IN, WHEELCHAIR
  priority         String   // RED, ORANGE, YELLOW, GREEN, BLUE
  chiefComplaint   String   @db.Text
  consciousness    String   // ALERT, VERBAL, PAIN, UNRESPONSIVE (AVPU)
  painScore        Int?
  triageNurseId    String
  triageTime       DateTime @default(now())
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  encounter        Encounter @relation(fields: [encounterId], references: [id])
  triageNurse      User      @relation(fields: [triageNurseId], references: [id])

  @@map("triage_assessments")
}

model EmergencyResuscitationEvent {
  id               String   @id @default(uuid())
  encounterId      String
  startTime        DateTime
  endTime          DateTime?
  eventDescription String   @db.Text
  interventions    String   @db.Text
  outcome          String?
  recordedById     String
  createdAt        DateTime @default(now())

  encounter        Encounter @relation(fields: [encounterId], references: [id])
  recordedBy       User      @relation(fields: [recordedById], references: [id])

  @@map("emergency_resuscitation_events")
}

// --- OPERATING THEATRE (OT) ---

model OperatingTheatre {
  id               String   @id @default(uuid())
  tenantId         String
  branchId         String
  name             String
  code             String
  type             String   // MAJOR, MINOR, ENDOSCOPY, CARDIAC
  status           String   @default("AVAILABLE") // AVAILABLE, IN_USE, MAINTENANCE
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())

  branch           Branch   @relation(fields: [branchId], references: [id])
  schedules        SurgerySchedule[]

  @@map("operating_theatres")
}

model SurgeryRequest {
  id               String   @id @default(uuid())
  tenantId         String
  patientId        String
  encounterId      String
  requestedById    String
  procedureName    String
  diagnosis        String?
  priority         String   // ROUTINE, URGENT, EMERGENCY
  preferredDate    DateTime?
  status           String   @default("REQUESTED") // REQUESTED, APPROVED, SCHEDULED, CANCELLED
  createdAt        DateTime @default(now())

  patient          Patient   @relation(fields: [patientId], references: [id])
  encounter        Encounter @relation(fields: [encounterId], references: [id])
  requestedBy      Doctor    @relation(fields: [requestedById], references: [id])
  schedules        SurgerySchedule[]

  @@map("surgery_requests")
}

model SurgerySchedule {
  id               String   @id @default(uuid())
  requestId        String
  otId             String
  scheduledStart   DateTime
  scheduledEnd     DateTime
  actualStart      DateTime?
  actualEnd        DateTime?
  status           String   @default("SCHEDULED") // SCHEDULED, PREPARING, IN_PROGRESS, COMPLETED, CANCELLED
  createdAt        DateTime @default(now())

  request          SurgeryRequest   @relation(fields: [requestId], references: [id])
  ot               OperatingTheatre @relation(fields: [otId], references: [id])
  team             SurgicalTeam[]
  notes            OTProcedureNote[]
  implants         ImplantRecord[]

  @@map("surgery_schedules")
}

model SurgicalTeam {
  id               String   @id @default(uuid())
  scheduleId       String
  userId           String
  role             String   // SURGEON, ASST_SURGEON, ANESTHETIST, SCRUB_NURSE, CIRCULATING_NURSE

  schedule         SurgerySchedule @relation(fields: [scheduleId], references: [id])
  user             User            @relation(fields: [userId], references: [id])

  @@map("surgical_teams")
}

model OTProcedureNote {
  id               String   @id @default(uuid())
  scheduleId       String
  authorId         String
  preOpDiagnosis   String?  @db.Text
  postOpDiagnosis  String?  @db.Text
  findings         String   @db.Text
  procedureDetails String   @db.Text
  complications    String?  @db.Text
  bloodLoss        Int?
  createdAt        DateTime @default(now())

  schedule         SurgerySchedule @relation(fields: [scheduleId], references: [id])
  author           Doctor          @relation(fields: [authorId], references: [id])

  @@map("ot_procedure_notes")
}

model ImplantRecord {
  id               String   @id @default(uuid())
  scheduleId       String
  patientId        String
  implantName      String
  manufacturer     String?
  serialNumber     String?
  lotNumber        String?
  implantDate      DateTime @default(now())

  schedule         SurgerySchedule @relation(fields: [scheduleId], references: [id])
  patient          Patient         @relation(fields: [patientId], references: [id])

  @@map("implant_records")
}

// --- ICU ---

model ICUFlowsheet {
  id               String   @id @default(uuid())
  encounterId      String
  recordedById     String
  recordTime       DateTime @default(now())
  vitalSigns       Json?
  ventilatorParams Json?
  fluidBalance     Json?
  notes            String?  @db.Text

  encounter        Encounter @relation(fields: [encounterId], references: [id])
  recordedBy       User      @relation(fields: [recordedById], references: [id])

  @@map("icu_flowsheets")
}

// --- PROCUREMENT ---

model PurchaseRequest {
  id               String   @id @default(uuid())
  tenantId         String
  branchId         String
  departmentId     String?
  requestedById    String
  prNumber         String   @unique
  priority         String   // LOW, MEDIUM, HIGH, URGENT
  status           String   @default("DRAFT") // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, PO_CREATED
  reason           String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  branch           Branch      @relation(fields: [branchId], references: [id])
  department       Department? @relation(fields: [departmentId], references: [id])
  requestedBy      User        @relation("PRRequestedBy", fields: [requestedById], references: [id])
  items            PurchaseRequestItem[]
  purchaseOrders   PurchaseOrder[]

  @@map("purchase_requests")
}

model PurchaseRequestItem {
  id               String   @id @default(uuid())
  requestId        String
  productId        String
  quantity         Int
  approvedQuantity Int?

  request          PurchaseRequest @relation(fields: [requestId], references: [id])
  product          Product         @relation(fields: [productId], references: [id])

  @@map("purchase_request_items")
}

model PurchaseOrder {
  id               String   @id @default(uuid())
  tenantId         String
  supplierId       String
  requestId        String?
  poNumber         String   @unique
  status           String   @default("DRAFT") // DRAFT, SENT, PARTIAL, COMPLETED, CANCELLED
  expectedDelivery DateTime?
  totalAmount      Float    @default(0)
  createdById      String
  createdAt        DateTime @default(now())

  supplier         Supplier         @relation(fields: [supplierId], references: [id])
  request          PurchaseRequest? @relation(fields: [requestId], references: [id])
  createdBy        User             @relation("POCreatedBy", fields: [createdById], references: [id])
  items            PurchaseOrderItem[]

  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id               String   @id @default(uuid())
  poId             String
  productId        String
  quantity         Int
  unitPrice        Float
  taxAmount        Float    @default(0)
  discount         Float    @default(0)
  lineTotal        Float

  po               PurchaseOrder @relation(fields: [poId], references: [id])
  product          Product       @relation(fields: [productId], references: [id])

  @@map("purchase_order_items")
}

// --- BLOOD BANK ---

model Donor {
  id               String   @id @default(uuid())
  tenantId         String
  donorId          String   @unique
  firstName        String
  lastName         String
  bloodGroup       String
  gender           String
  dateOfBirth      DateTime
  mobile           String
  eligibilityStatus String  @default("ELIGIBLE") // ELIGIBLE, TEMPORARY_DEFERRAL, PERMANENT_DEFERRAL
  createdAt        DateTime @default(now())

  donations        BloodDonation[]

  @@map("donors")
}

model BloodDonation {
  id               String   @id @default(uuid())
  donorId          String
  donationDate     DateTime @default(now())
  bagId            String   @unique
  volume           Int
  status           String   @default("COLLECTED") // COLLECTED, TESTED, PROCESSED, DISCARDED
  collectedById    String

  donor            Donor    @relation(fields: [donorId], references: [id])
  collectedBy      User     @relation("BloodCollectedBy", fields: [collectedById], references: [id])
  components       BloodComponent[]

  @@map("blood_donations")
}

model BloodComponent {
  id               String   @id @default(uuid())
  donationId       String
  unitId           String   @unique
  componentType    String   // WHOLE_BLOOD, PRBC, FFP, PLATELETS
  bloodGroup       String
  expiryDate       DateTime
  status           String   @default("AVAILABLE") // AVAILABLE, RESERVED, ISSUED, TRANSFUSED, DISCARDED
  locationId       String?

  donation         BloodDonation @relation(fields: [donationId], references: [id])
  issues           BloodIssue[]

  @@map("blood_components")
}

model BloodIssue {
  id               String   @id @default(uuid())
  componentId      String
  patientId        String
  encounterId      String
  issuedById       String
  issueDate        DateTime @default(now())
  transfusionStatus String  @default("PENDING") // PENDING, COMPLETED, REACTION, RETURNED

  component        BloodComponent @relation(fields: [componentId], references: [id])
  patient          Patient        @relation(fields: [patientId], references: [id])
  encounter        Encounter      @relation(fields: [encounterId], references: [id])
  issuedBy         User           @relation("BloodIssuedBy", fields: [issuedById], references: [id])

  @@map("blood_issues")
}

// --- CSSD (Central Sterile Services) ---

model SterilizationCycle {
  id               String   @id @default(uuid())
  tenantId         String
  cycleNumber      String   @unique
  machineId        String
  method           String   // AUTOCLAVE, ETO, PLASMA
  startTime        DateTime
  endTime          DateTime?
  operatorId       String
  result           String   @default("PENDING") // PENDING, PASSED, FAILED
  createdAt        DateTime @default(now())

  operator         User     @relation("CycleOperator", fields: [operatorId], references: [id])

  @@map("sterilization_cycles")
}

// --- DIETARY ---

model DietType {
  id               String   @id @default(uuid())
  tenantId         String
  code             String   @unique
  name             String
  description      String?
  isActive         Boolean  @default(true)

  orders           DietOrder[]

  @@map("diet_types")
}

model DietOrder {
  id               String   @id @default(uuid())
  patientId        String
  encounterId      String
  dietTypeId       String
  doctorId         String
  startDate        DateTime
  endDate          DateTime?
  restrictions     String?
  status           String   @default("ACTIVE") // ACTIVE, DISCONTINUED
  createdAt        DateTime @default(now())

  patient          Patient   @relation(fields: [patientId], references: [id])
  encounter        Encounter @relation(fields: [encounterId], references: [id])
  dietType         DietType  @relation(fields: [dietTypeId], references: [id])
  doctor           Doctor    @relation(fields: [doctorId], references: [id])

  @@map("diet_orders")
}

// --- HOUSEKEEPING ---

model HousekeepingTask {
  id               String   @id @default(uuid())
  tenantId         String
  branchId         String
  locationRef      String   // ID of Ward/Room/OT/Area
  locationType     String   // WARD, ROOM, OT, ICU, AREA
  taskType         String   // ROUTINE, TERMINAL, SPILL
  priority         String   // LOW, NORMAL, HIGH, URGENT
  assignedToId     String?
  status           String   @default("REQUESTED") // REQUESTED, ASSIGNED, IN_PROGRESS, COMPLETED, VERIFIED
  requestedTime    DateTime @default(now())
  completedTime    DateTime?

  branch           Branch   @relation(fields: [branchId], references: [id])
  assignedTo       User?    @relation("TaskAssignedTo", fields: [assignedToId], references: [id])

  @@map("housekeeping_tasks")
}

// --- AMBULANCE ---

model Ambulance {
  id               String   @id @default(uuid())
  tenantId         String
  vehicleNumber    String   @unique
  vehicleType      String   // BLS, ALS, PTS
  status           String   @default("AVAILABLE") // AVAILABLE, DISPATCHED, MAINTENANCE
  isActive         Boolean  @default(true)
  
  trips            AmbulanceTrip[]

  @@map("ambulances")
}

model AmbulanceTrip {
  id               String   @id @default(uuid())
  tenantId         String
  ambulanceId      String
  patientId        String?
  encounterId      String?
  driverId         String
  pickupLocation   String
  destination      String
  dispatchTime     DateTime
  completionTime   DateTime?
  status           String   @default("DISPATCHED") // DISPATCHED, EN_ROUTE, ARRIVED, COMPLETED, CANCELLED

  ambulance        Ambulance  @relation(fields: [ambulanceId], references: [id])
  patient          Patient?   @relation(fields: [patientId], references: [id])
  encounter        Encounter? @relation(fields: [encounterId], references: [id])
  driver           User       @relation("AmbulanceDriver", fields: [driverId], references: [id])

  @@map("ambulance_trips")
}
`;

schema = schema + phase7Models;

function addRelations(modelName, relations) {
    const regex = new RegExp(`(model\\s+${modelName}\\s+\\{[\\s\\S]*?)(?:\\n\\s*@@|\\n\\})`, 'g');
    schema = schema.replace(regex, (match, p1) => {
        return p1.trimEnd() + '\n' + relations.map(r => '  ' + r).join('\n') + '\n\n' + match.substring(p1.length);
    });
}

// Inject reverse relations
addRelations('Encounter', [
  'triageAssessment         TriageAssessment?',
  'emergencyResuscitations  EmergencyResuscitationEvent[]',
  'surgeryRequests          SurgeryRequest[]',
  'icuFlowsheets            ICUFlowsheet[]',
  'bloodIssues              BloodIssue[]',
  'dietOrders               DietOrder[]',
  'ambulanceTrips           AmbulanceTrip[]'
]);

addRelations('User', [
  'triageAssessments        TriageAssessment[]',
  'emergencyResuscitations  EmergencyResuscitationEvent[]',
  'surgicalTeams            SurgicalTeam[]',
  'icuFlowsheets            ICUFlowsheet[]',
  'prRequested              PurchaseRequest[] @relation("PRRequestedBy")',
  'poCreated                PurchaseOrder[] @relation("POCreatedBy")',
  'bloodCollections         BloodDonation[] @relation("BloodCollectedBy")',
  'bloodIssues              BloodIssue[] @relation("BloodIssuedBy")',
  'sterilizationCycles      SterilizationCycle[] @relation("CycleOperator")',
  'housekeepingTasks        HousekeepingTask[] @relation("TaskAssignedTo")',
  'ambulanceTripsDriven     AmbulanceTrip[] @relation("AmbulanceDriver")'
]);

addRelations('Patient', [
  'surgeryRequests          SurgeryRequest[]',
  'implantRecords           ImplantRecord[]',
  'bloodIssues              BloodIssue[]',
  'dietOrders               DietOrder[]',
  'ambulanceTrips           AmbulanceTrip[]'
]);

addRelations('Branch', [
  'operatingTheatres        OperatingTheatre[]',
  'purchaseRequests         PurchaseRequest[]',
  'housekeepingTasks        HousekeepingTask[]'
]);

addRelations('Doctor', [
  'surgeryRequests          SurgeryRequest[]',
  'otProcedureNotes         OTProcedureNote[]',
  'dietOrders               DietOrder[]'
]);

addRelations('Product', [
  'prItems                  PurchaseRequestItem[]',
  'poItems                  PurchaseOrderItem[]'
]);

addRelations('Department', [
  'purchaseRequests         PurchaseRequest[]'
]);

fs.writeFileSync(path, schema);
console.log('Schema fixed for Phase 7');
