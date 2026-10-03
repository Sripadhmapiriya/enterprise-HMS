const fs = require('fs');
const path = 'packages/database/prisma/schema.prisma';

let schema = fs.readFileSync(path, 'utf8');

const phase5Models = `

// ============================================================================
// PHASE 5: PHARMACY & INVENTORY MANAGEMENT
// ============================================================================

model ProductCategory {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  products    Product[]

  @@map("product_categories")
}

model GenericMedicine {
  id          String   @id @default(uuid())
  tenantId    String
  name        String   @unique
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  products    Product[]

  @@map("generic_medicines")
}

model Unit {
  id          String   @id @default(uuid())
  tenantId    String
  name        String   @unique // Tablet, Bottle, ml, mg
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  products    Product[]

  @@map("units")
}

model Supplier {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  code        String   @unique
  contactName String?
  phone       String?
  email       String?
  address     String?
  taxInfo     String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  receipts    GoodsReceipt[]
  batches     InventoryBatch[]

  @@map("suppliers")
}

model Product {
  id               String   @id @default(uuid())
  tenantId         String
  name             String
  code             String   @unique
  categoryId       String
  genericId        String?
  unitId           String
  dosageForm       String?
  strength         String?
  manufacturer     String?
  requiresPrescription Boolean @default(false)
  reorderLevel     Int      @default(0)
  taxRate          Float    @default(0)
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  category         ProductCategory  @relation(fields: [categoryId], references: [id])
  generic          GenericMedicine? @relation(fields: [genericId], references: [id])
  unit             Unit             @relation(fields: [unitId], references: [id])

  batches          InventoryBatch[]
  receiptItems     GoodsReceiptItem[]
  dispensingItems  PharmacyDispensingItem[]
  ledgerEntries    InventoryLedger[]

  @@map("products")
}

model InventoryLocation {
  id          String   @id @default(uuid())
  tenantId    String
  hospitalId  String
  branchId    String
  departmentId String?
  name        String
  type        String   // PHARMACY, MAIN_STORE, WARD_STORE
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  batches     InventoryBatch[]
  ledgerEntries InventoryLedger[]
  dispensings PharmacyDispensing[]

  @@map("inventory_locations")
}

model InventoryBatch {
  id            String   @id @default(uuid())
  tenantId      String
  productId     String
  locationId    String
  batchNumber   String
  expiryDate    DateTime
  manufactureDate DateTime?
  purchaseRate  Float
  mrp           Float
  sellingRate   Float
  availableQty  Int      @default(0)
  supplierId    String?
  status        String   @default("ACTIVE") // ACTIVE, EXPIRED, QUARANTINED
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  product       Product           @relation(fields: [productId], references: [id])
  location      InventoryLocation @relation(fields: [locationId], references: [id])
  supplier      Supplier?         @relation(fields: [supplierId], references: [id])

  ledgerEntries InventoryLedger[]
  dispensingItems PharmacyDispensingItem[]

  @@unique([productId, locationId, batchNumber])
  @@map("inventory_batches")
}

model InventoryLedger {
  id              String   @id @default(uuid())
  tenantId        String
  productId       String
  batchId         String
  locationId      String
  transactionType String   // OPENING, PURCHASE, DISPENSE, ISSUE, TRANSFER_OUT, TRANSFER_IN, RETURN, ADJUSTMENT
  quantity        Int      // Positive for inward, negative for outward
  referenceId     String?  // ID of GRN, Dispensing, Transfer, etc.
  userId          String
  notes           String?
  createdAt       DateTime @default(now())

  product         Product           @relation(fields: [productId], references: [id])
  batch           InventoryBatch    @relation(fields: [batchId], references: [id])
  location        InventoryLocation @relation(fields: [locationId], references: [id])
  user            User              @relation(fields: [userId], references: [id])

  @@map("inventory_ledgers")
}

model GoodsReceipt {
  id            String   @id @default(uuid())
  tenantId      String
  supplierId    String
  invoiceNumber String
  invoiceDate   DateTime
  totalAmount   Float
  status        String   @default("DRAFT") // DRAFT, COMPLETED
  receivedById  String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  supplier      Supplier           @relation(fields: [supplierId], references: [id])
  receivedBy    User               @relation(fields: [receivedById], references: [id])
  items         GoodsReceiptItem[]

  @@map("goods_receipts")
}

model GoodsReceiptItem {
  id            String   @id @default(uuid())
  receiptId     String
  productId     String
  batchNumber   String
  expiryDate    DateTime
  quantity      Int
  purchaseRate  Float
  mrp           Float
  sellingRate   Float
  taxAmount     Float    @default(0)
  totalAmount   Float

  receipt       GoodsReceipt @relation(fields: [receiptId], references: [id])
  product       Product      @relation(fields: [productId], references: [id])

  @@map("goods_receipt_items")
}

model PharmacyDispensing {
  id             String   @id @default(uuid())
  tenantId       String
  locationId     String
  prescriptionId String?
  patientId      String
  dispensedById  String
  status         String   @default("COMPLETED") // COMPLETED, PARTIAL, RETURNED
  totalAmount    Float    @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  location       InventoryLocation  @relation(fields: [locationId], references: [id])
  prescription   Prescription?      @relation(fields: [prescriptionId], references: [id])
  patient        Patient            @relation(fields: [patientId], references: [id])
  dispensedBy    User               @relation(fields: [dispensedById], references: [id])
  items          PharmacyDispensingItem[]

  @@map("pharmacy_dispensings")
}

model PharmacyDispensingItem {
  id            String   @id @default(uuid())
  dispensingId  String
  productId     String
  batchId       String
  quantity      Int
  unitPrice     Float
  totalPrice    Float
  
  dispensing    PharmacyDispensing @relation(fields: [dispensingId], references: [id])
  product       Product            @relation(fields: [productId], references: [id])
  batch         InventoryBatch     @relation(fields: [batchId], references: [id])

  @@map("pharmacy_dispensing_items")
}

`;

schema = schema + phase5Models;

function addRelations(modelName, relations) {
    const regex = new RegExp(`(model\\s+${modelName}\\s+\\{[\\s\\S]*?)(?:\\n\\s*@@|\\n\\})`, 'g');
    schema = schema.replace(regex, (match, p1) => {
        return p1.trimEnd() + '\n' + relations.map(r => '  ' + r).join('\n') + '\n\n' + match.substring(p1.length);
    });
}

addRelations('Patient', [
  'dispensings       PharmacyDispensing[]'
]);

addRelations('User', [
  'dispensingsDone   PharmacyDispensing[] @relation',
  'ledgerEntries     InventoryLedger[]',
  'goodsReceived     GoodsReceipt[]'
]);

addRelations('Prescription', [
  'dispensings       PharmacyDispensing[]'
]);

fs.writeFileSync(path, schema);
console.log('Schema fixed for Phase 5');
