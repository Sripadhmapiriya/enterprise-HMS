const fs = require('fs');
const path = 'packages/database/prisma/schema.prisma';

let schema = fs.readFileSync(path, 'utf8');

const phase6Models = `

// ============================================================================
// PHASE 6: REVENUE CYCLE MANAGEMENT & BILLING
// ============================================================================

model ChargeMaster {
  id           String   @id @default(uuid())
  tenantId     String
  code         String   @unique
  name         String
  category     String   // CONSULTATION, LABORATORY, RADIOLOGY, PHARMACY, PROCEDURE, ROOM, BED, NURSING, REGISTRATION, MISC
  description  String?
  isActive     Boolean  @default(true)
  isBillable   Boolean  @default(true)
  taxRate      Float    @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tariffItems  TariffItem[]
  billItems    BillItem[]

  @@map("charge_masters")
}

model Tariff {
  id          String   @id @default(uuid())
  tenantId    String
  hospitalId  String
  name        String
  code        String   @unique
  tariffType  String   // GENERAL, CORPORATE, INSURANCE, TPA
  validFrom   DateTime
  validTo     DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  hospital    Hospital @relation(fields: [hospitalId], references: [id])
  items       TariffItem[]
  bills       Bill[]

  @@map("tariffs")
}

model TariffItem {
  id             String   @id @default(uuid())
  tariffId       String
  chargeMasterId String
  price          Float
  discount       Float    @default(0) // max discount allowed
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  tariff         Tariff       @relation(fields: [tariffId], references: [id])
  chargeMaster   ChargeMaster @relation(fields: [chargeMasterId], references: [id])

  @@unique([tariffId, chargeMasterId])
  @@map("tariff_items")
}

model Bill {
  id               String   @id @default(uuid())
  tenantId         String
  hospitalId       String
  branchId         String
  patientId        String
  encounterId      String?
  billNumber       String   @unique
  billType         String   // OPD, IPD, PHARMACY
  status           String   @default("DRAFT") // DRAFT, FINALIZED, PARTIALLY_PAID, PAID, CANCELLED
  billDate         DateTime @default(now())
  tariffId         String?

  subTotal         Float    @default(0)
  totalDiscount    Float    @default(0)
  totalTax         Float    @default(0)
  grossTotal       Float    @default(0)
  payerExpected    Float    @default(0) // Amount expected from Insurance/TPA
  patientPayable   Float    @default(0)
  paidAmount       Float    @default(0)
  outstandingAmount Float   @default(0)

  createdById      String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  patient          Patient    @relation(fields: [patientId], references: [id])
  encounter        Encounter? @relation(fields: [encounterId], references: [id])
  hospital         Hospital   @relation(fields: [hospitalId], references: [id])
  branch           Branch     @relation(fields: [branchId], references: [id])
  tariff           Tariff?    @relation(fields: [tariffId], references: [id])
  createdBy        User       @relation("BillCreatedBy", fields: [createdById], references: [id])

  items            BillItem[]
  payments         Payment[]
  claims           Claim[]

  @@map("bills")
}

model BillItem {
  id              String   @id @default(uuid())
  billId          String
  chargeMasterId  String
  serviceName     String
  quantity        Int      @default(1)
  unitPrice       Float
  discountAmount  Float    @default(0)
  taxAmount       Float    @default(0)
  lineTotal       Float
  sourceModule    String?  // LAB, RAD, PHARMACY, OPD, IPD
  sourceRefId     String?  // ID of dispensing item, lab order item, etc.

  bill            Bill         @relation(fields: [billId], references: [id])
  chargeMaster    ChargeMaster @relation(fields: [chargeMasterId], references: [id])

  @@map("bill_items")
}

model Payment {
  id             String   @id @default(uuid())
  tenantId       String
  billId         String?
  patientId      String
  receiptNumber  String   @unique
  paymentMethod  String   // CASH, CARD, UPI, BANK_TRANSFER, ONLINE, ADVANCE
  amount         Float
  transactionRef String?
  paymentDate    DateTime @default(now())
  status         String   @default("SUCCESS") // PENDING, SUCCESS, FAILED, REFUNDED
  paymentType    String   @default("BILL_PAYMENT") // BILL_PAYMENT, ADVANCE
  receivedById   String

  bill           Bill?    @relation(fields: [billId], references: [id])
  patient        Patient  @relation(fields: [patientId], references: [id])
  receivedBy     User     @relation("PaymentReceivedBy", fields: [receivedById], references: [id])
  refunds        Refund[]

  @@map("payments")
}

model Refund {
  id             String   @id @default(uuid())
  tenantId       String
  paymentId      String
  amount         Float
  reason         String?
  refundMethod   String
  transactionRef String?
  status         String   @default("COMPLETED")
  refundedById   String
  createdAt      DateTime @default(now())

  payment        Payment  @relation(fields: [paymentId], references: [id])
  refundedBy     User     @relation("PaymentRefundedBy", fields: [refundedById], references: [id])

  @@map("refunds")
}

model InsuranceProvider {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  code        String   @unique
  contact     String?
  email       String?
  address     String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  patientInsurances PatientInsurance[]
  claims            Claim[]

  @@map("insurance_providers")
}

model Tpa {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  code        String   @unique
  contact     String?
  email       String?
  address     String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  patientInsurances PatientInsurance[]
  claims            Claim[]

  @@map("tpas")
}

model PatientInsurance {
  id             String   @id @default(uuid())
  patientId      String
  providerId     String
  tpaId          String?
  policyNumber   String
  memberId       String?
  validFrom      DateTime
  validTo        DateTime
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())

  patient        Patient            @relation(fields: [patientId], references: [id])
  provider       InsuranceProvider  @relation(fields: [providerId], references: [id])
  tpa            Tpa?               @relation(fields: [tpaId], references: [id])

  @@map("patient_insurance")
}

model Claim {
  id                 String   @id @default(uuid())
  tenantId           String
  billId             String
  providerId         String
  tpaId              String?
  claimNumber        String   @unique
  claimedAmount      Float
  approvedAmount     Float?
  patientResponsibility Float?
  status             String   @default("SUBMITTED") // DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, PARTIALLY_APPROVED, REJECTED, SETTLED
  submissionDate     DateTime @default(now())
  settlementDate     DateTime?
  remarks            String?

  bill               Bill               @relation(fields: [billId], references: [id])
  provider           InsuranceProvider  @relation(fields: [providerId], references: [id])
  tpa                Tpa?               @relation(fields: [tpaId], references: [id])
  settlements        ClaimSettlement[]

  @@map("claims")
}

model ClaimSettlement {
  id               String   @id @default(uuid())
  claimId          String
  amount           Float
  transactionRef   String?
  settlementDate   DateTime @default(now())
  recordedById     String

  claim            Claim    @relation(fields: [claimId], references: [id])
  recordedBy       User     @relation(fields: [recordedById], references: [id])

  @@map("claim_settlements")
}

`;

schema = schema + phase6Models;

function addRelations(modelName, relations) {
    const regex = new RegExp(`(model\\s+${modelName}\\s+\\{[\\s\\S]*?)(?:\\n\\s*@@|\\n\\})`, 'g');
    schema = schema.replace(regex, (match, p1) => {
        return p1.trimEnd() + '\n' + relations.map(r => '  ' + r).join('\n') + '\n\n' + match.substring(p1.length);
    });
}

addRelations('Patient', [
  'bills              Bill[]',
  'payments           Payment[]',
  'patientInsurances  PatientInsurance[]'
]);

addRelations('User', [
  'billsCreated       Bill[] @relation("BillCreatedBy")',
  'paymentsReceived   Payment[] @relation("PaymentReceivedBy")',
  'refundsProcessed   Refund[] @relation("PaymentRefundedBy")',
  'claimSettlements   ClaimSettlement[]'
]);

addRelations('Encounter', [
  'bills              Bill[]'
]);

addRelations('Hospital', [
  'tariffs            Tariff[]',
  'bills              Bill[]'
]);

addRelations('Branch', [
  'bills              Bill[]'
]);

fs.writeFileSync(path, schema);
console.log('Schema fixed for Phase 6');
