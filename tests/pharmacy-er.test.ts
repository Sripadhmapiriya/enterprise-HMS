import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './apps/api/src/index';
import { prisma } from './packages/database/src/index';
import { authService } from './apps/api/src/services/authService';
import { entitlementService } from './apps/api/src/services/entitlementService';
import { buildEdition, restoreOriginalRoutes } from './scripts/build-edition';

describe('Workstream E: Inventory, Pharmacy, Emergency & pharmacy-er Edition', () => {
  let token: string;
  let tenantId: string;
  let hospitalId: string;
  let branchId: string;
  let departmentId: string;
  let doctorId: string;
  let patientId: string;
  let pharmacyLocationId: string;
  let productId: string;
  let batchEarlyId: string;
  let batchLateId: string;

  beforeAll(async () => {
    // 1. Setup Tenant
    const tenant = await prisma.tenant.upsert({
      where: { code: 'TEST-ER-PHARM' },
      update: {},
      create: { name: 'Trauma & Pharmacy Medical Center', code: 'TEST-ER-PHARM' },
    });
    tenantId = tenant.id;

    // Enable inventory, pharmacy, emergency, patients
    await Promise.all([
      prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: 'inventory' } },
        update: { enabled: true },
        create: { tenantId, moduleId: 'inventory', enabled: true },
      }),
      prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: 'pharmacy' } },
        update: { enabled: true },
        create: { tenantId, moduleId: 'pharmacy', enabled: true },
      }),
      prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: 'emergency' } },
        update: { enabled: true },
        create: { tenantId, moduleId: 'emergency', enabled: true },
      }),
      prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: 'patients' } },
        update: { enabled: true },
        create: { tenantId, moduleId: 'patients', enabled: true },
      }),
      // Billing initially disabled for loose coupling tests
      prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: 'billing' } },
        update: { enabled: false },
        create: { tenantId, moduleId: 'billing', enabled: false },
      }),
    ]);

    // 2. Setup Hospital & Branch
    const hospital =
      (await prisma.hospital.findFirst({ where: { tenantId } })) ||
      (await prisma.hospital.create({
        data: { tenantId, name: 'St Jude Emergency Hospital' },
      }));
    hospitalId = hospital.id;

    const branch =
      (await prisma.branch.findFirst({ where: { hospitalId } })) ||
      (await prisma.branch.create({
        data: { hospitalId, name: 'Main Trauma Center', code: 'TC-01' },
      }));
    branchId = branch.id;

    const dept =
      (await prisma.department.findFirst({ where: { branchId } })) ||
      (await prisma.department.create({
        data: {
          branchId,
          name: 'Emergency & General Medicine',
          code: 'ER-GEN',
        },
      }));
    departmentId = dept.id;

    // 3. Setup User & Doctor
    const uniqueEmail = `er.doctor.${Date.now()}@hms-test.com`;
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: uniqueEmail,
        passwordHash: await authService.hashPassword('Password123!'),
        firstName: 'Marcus',
        lastName: 'Welby',
      },
    });

    const doc = await prisma.doctor.create({
      data: {
        userId: user.id,
        branchId,
        specialization: 'Emergency Medicine',
        licenseNumber: `MED-ER-${Date.now()}`,
      },
    });
    doctorId = doc.id;

    token = authService.generateAccessToken({
      userId: user.id,
      tenantId,
      email: user.email,
      roles: ['Doctor', 'Pharmacist', 'HospitalAdmin'],
      permissions: ['*'],
      hospitalId,
      branchId,
    });

    // 4. Setup Patient
    const uniquePhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        hospitalId,
        mrn: `MRN-ER-${Date.now()}`,
        firstName: 'Sarah',
        lastName: 'Connor',
        dateOfBirth: new Date('1985-05-12'),
        gender: 'FEMALE',
        mobile: uniquePhone,
        status: 'ACTIVE',
      },
    });
    patientId = patient.id;
  });

  // =========================================================================
  // 1. INVENTORY MODULE TESTS
  // =========================================================================
  describe('1. Inventory & Materials Management', () => {
    it('creates storage location (Pharmacy Main Store)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Central Pharmacy Dispensary',
          type: 'PHARMACY',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Central Pharmacy Dispensary');
      pharmacyLocationId = res.body.data.id;
    });

    it('creates product in Item Master with reorder level', async () => {
      const uniqueCode = `MED-PARA-${Date.now().toString().slice(-6)}`;
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Paracetamol 500mg IV',
          code: uniqueCode,
          categoryName: 'Analgesics & Antipyretics',
          unitName: 'Vial',
          dosageForm: 'Injection',
          strength: '500mg/50ml',
          reorderLevel: 20,
          requiresPrescription: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Paracetamol 500mg IV');
      expect(res.body.data.reorderLevel).toBe(20);
      productId = res.body.data.id;
    });

    it('receives stock batches with FEFO timestamps and ledger movements', async () => {
      const now = new Date();
      // Batch 1: Expiring in 60 days (Earlier)
      const expEarly = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      // Batch 2: Expiring in 365 days (Later)
      const expLate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      // Inward Batch 1
      const res1 = await request(app)
        .post('/api/v1/inventory/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId,
          locationId: pharmacyLocationId,
          batchNumber: `BATCH-EARLY-${Date.now()}`,
          expiryDate: expEarly.toISOString(),
          quantity: 50,
          purchaseRate: 5.0,
          mrp: 12.0,
          sellingRate: 12.0,
          supplierName: 'Apex Pharma Distributors',
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.batch.availableQty).toBe(50);
      expect(res1.body.data.ledgerId).toBeDefined();
      batchEarlyId = res1.body.data.batch.id;

      // Inward Batch 2
      const res2 = await request(app)
        .post('/api/v1/inventory/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId,
          locationId: pharmacyLocationId,
          batchNumber: `BATCH-LATE-${Date.now()}`,
          expiryDate: expLate.toISOString(),
          quantity: 100,
          purchaseRate: 4.8,
          mrp: 12.0,
          sellingRate: 12.0,
          supplierName: 'Apex Pharma Distributors',
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.batch.availableQty).toBe(100);
      batchLateId = res2.body.data.batch.id;
    });

    it('enforces FEFO ordering (earliest expiring batch listed first)', async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/batches?productId=${productId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      // First batch in FEFO order must be the one expiring in 60 days
      expect(res.body.data[0].id).toBe(batchEarlyId);
      expect(res.body.data[1].id).toBe(batchLateId);
    });

    it('adjusts stock down and records audit in inventory ledger', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId,
          batchId: batchEarlyId,
          locationId: pharmacyLocationId,
          quantity: -5, // write off 5 damaged units
          reason: 'Damaged glass vial during unpacking',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.availableQty).toBe(45); // was 50, now 45
      expect(res.body.data.ledgerId).toBeDefined();

      // Check item detail stock count
      const itemRes = await request(app)
        .get(`/api/v1/inventory/items/${productId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(itemRes.body.data.totalStock).toBe(145); // 45 + 100
    });

    it('reports near-expiry batches expiring within 90 days', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/alerts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.expiringBatches.length).toBeGreaterThanOrEqual(1);
      const earlyAlert = res.body.data.expiringBatches.find((b: any) => b.batchId === batchEarlyId);
      expect(earlyAlert).toBeDefined();
      expect(earlyAlert.daysUntilExpiry).toBeLessThanOrEqual(61);
    });
  });

  // =========================================================================
  // 2. PHARMACY MODULE & DISPENSING TESTS
  // =========================================================================
  describe('2. Pharmacy Dispensing & Automated FEFO Picking', () => {
    let prescriptionId: string;

    beforeAll(async () => {
      // Create encounter first for prescription reference
      const rxEncounter = await prisma.encounter.create({
        data: {
          tenantId,
          hospitalId,
          branchId,
          departmentId,
          doctorId,
          patientId,
          type: 'OPD',
          status: 'OPEN',
        },
      });

      // Create an active prescription for Sarah Connor
      const rx = await prisma.prescription.create({
        data: {
          tenantId,
          patientId,
          encounterId: rxEncounter.id,
          doctorId,
          status: 'ACTIVE',
          items: {
            create: [
              {
                medicationName: 'Paracetamol 500mg IV',
                dosage: '500mg',
                frequency: 'TDS',
                duration: '3 days',
                quantity: 10,
                instructions: 'Infuse over 15 minutes',
              },
            ],
          },
        },
      });
      prescriptionId = rx.id;
    });

    it('retrieves active prescription queue with patient banner details', async () => {
      const res = await request(app)
        .get('/api/v1/pharmacy/queue')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const targetRx = res.body.data.find((r: any) => r.id === prescriptionId);
      expect(targetRx).toBeDefined();
      expect(targetRx.patient.mrn).toBeDefined();
      expect(targetRx.items.length).toBe(1);
    });

    it('fulfills prescription with automated FEFO batch allocation without billing', async () => {
      // Dispense 10 units of Paracetamol. We do NOT specify batchId; FEFO must pick batchEarlyId!
      const res = await request(app)
        .post('/api/v1/pharmacy/dispense')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prescriptionId,
          patientId,
          locationId: pharmacyLocationId,
          items: [
            {
              productId,
              quantity: 10,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.dispensingId).toBeDefined();
      expect(res.body.data.items[0].batchId).toBe(batchEarlyId); // Verified FEFO pick!
      expect(res.body.data.items[0].quantity).toBe(10);
      expect(res.body.data.totalAmount).toBe(120.0); // 10 * 12.0

      // Loose Coupling Verification: Billing disabled -> receiptMode is POS
      expect(res.body.data.receiptMode).toBe('POS');
      expect(res.body.data.isBilled).toBe(false);

      // Verify batch stock decremented from 45 to 35
      const batchCheck = await prisma.inventoryBatch.findUnique({
        where: { id: batchEarlyId },
      });
      expect(batchCheck?.availableQty).toBe(35);

      // Verify prescription status updated to DISPENSED
      const rxCheck = await prisma.prescription.findUnique({
        where: { id: prescriptionId },
      });
      expect(rxCheck?.status).toBe('DISPENSED');
    });

    it('blocks a prescription line with no stock with a clear message', async () => {
      // Create a dummy prescription to fail
      const dummyRx = await prisma.prescription.create({
        data: {
          tenantId,
          patientId,
          doctorId,
          status: 'ACTIVE',
          items: {
            create: [
              {
                medicationName: 'Paracetamol 500mg IV',
                dosage: '500mg',
                frequency: 'TDS',
                duration: '3 days',
                quantity: 1000, // Very large quantity
                instructions: 'Infuse over 15 minutes',
              },
            ],
          },
        },
      });

      const res = await request(app)
        .post('/api/v1/pharmacy/dispense')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prescriptionId: dummyRx.id,
          patientId,
          locationId: pharmacyLocationId,
          items: [
            {
              productId,
              quantity: 1000, // Exceeds stock
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Insufficient');
    });

    it('handles walk-in OTC point-of-sale without doctor prescription', async () => {
      const res = await request(app)
        .post('/api/v1/pharmacy/pos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: 'Retail Walk-in Customer',
          locationId: pharmacyLocationId,
          paymentMethod: 'CASH',
          items: [
            {
              productId,
              quantity: 5,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.receiptNumber).toMatch(/^POS-/);
      expect(res.body.data.totalAmount).toBe(60.0); // 5 * 12.0
      expect(res.body.data.receiptMode).toBe('POS');
      expect(res.body.data.patient.firstName).toBe('Retail Walk-in Customer');

      // Verify batch stock decremented from 35 to 30
      const batchCheck = await prisma.inventoryBatch.findUnique({
        where: { id: batchEarlyId },
      });
      expect(batchCheck?.availableQty).toBe(30);
    });

    it('blocks a failed sale and leaves stock unchanged', async () => {
      const res = await request(app)
        .post('/api/v1/pharmacy/pos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: 'Customer Two',
          locationId: pharmacyLocationId,
          paymentMethod: 'CASH',
          items: [
            {
              productId,
              quantity: 100, // Exceeds available 30
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Insufficient');

      // Stock should still be 30
      const batchCheck = await prisma.inventoryBatch.findUnique({
        where: { id: batchEarlyId },
      });
      expect(batchCheck?.availableQty).toBe(30);
    });
  });

  // =========================================================================
  // 3. EMERGENCY (ER) MODULE TESTS
  // =========================================================================
  describe('3. Emergency (ER) Department, Triage & Resuscitation', () => {
    let erEncounterId: string;
    let traumaPatientId: string;

    it('performs fast-track intake for trauma patient with auto-generated trauma MRN', async () => {
      const res = await request(app)
        .post('/api/v1/emergency/fast-register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Unidentified',
          lastName: 'MVA Trauma',
          gender: 'MALE',
          estimatedAge: 28,
          arrivalMode: 'AMBULANCE',
          chiefComplaint: 'Motor vehicle collision with severe thoracic trauma and blunt abdominal injury',
          isMlc: true,
          policeStation: 'Metropolitan Traffic Division',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.patient.id).toBeDefined();
      expect(res.body.data.patient.mrn).toMatch(/^ER-/);
      expect(res.body.data.encounter.id).toBeDefined();
      expect(res.body.data.encounter.type).toBe('EMERGENCY');
      expect(res.body.data.isMlc).toBe(true);

      erEncounterId = res.body.data.encounter.id;
      traumaPatientId = res.body.data.patient.id;
    });

    it('records ESI Level 1 (Red / Resuscitation) triage assessment and vital signs', async () => {
      const res = await request(app)
        .post('/api/v1/emergency/triage')
        .set('Authorization', `Bearer ${token}`)
        .send({
          encounterId: erEncounterId,
          arrivalMode: 'AMBULANCE',
          priority: 'RED', // ESI Level 1
          chiefComplaint: 'Severe respiratory distress, multiple rib fractures, hemothorax suspected',
          consciousness: 'UNRESPONSIVE',
          painScore: 10,
          vitals: {
            systolic: 75,
            diastolic: 45,
            heartRate: 142,
            oxygenSaturation: 84,
            temperature: 35.8,
            respiratoryRate: 34,
          },
          isMlc: true,
          policeStation: 'Traffic Division North',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.triageAssessment.priority).toBe('RED');
      expect(res.body.data.triageAssessment.consciousness).toBe('UNRESPONSIVE');
      expect(res.body.data.vitals.bloodPressure).toBe('75/45');
      expect(res.body.data.vitals.oxygenSaturation).toBe(84);
      expect(res.body.data.patientBanner.mrn).toBeDefined();

      // Loose Coupling Verification: Billing disabled -> receiptMode is POS
      expect(res.body.data.receiptMode).toBe('POS');
      expect(res.body.data.isBilled).toBe(false);
    });

    it('displays active emergency tracking board sorted by clinical acuity', async () => {
      const res = await request(app)
        .get('/api/v1/emergency/board')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.patients.length).toBeGreaterThanOrEqual(1);

      // The RED patient must be at the very top of the board
      const topPatient = res.body.data.patients[0];
      expect(topPatient.priority).toBe('RED');
      expect(topPatient.priorityRank).toBe(1);
      expect(topPatient.consciousness).toBe('UNRESPONSIVE');
      expect(res.body.data.counts.red).toBeGreaterThanOrEqual(1);
    });

    it('documents emergency resuscitation event and medical interventions', async () => {
      const now = new Date();
      const tenMinutesLater = new Date(now.getTime() + 10 * 60 * 1000);

      const res = await request(app)
        .post(`/api/v1/emergency/encounters/${erEncounterId}/resuscitation`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          startTime: now.toISOString(),
          endTime: tenMinutesLater.toISOString(),
          eventDescription: 'Cardiac arrest following traumatic hemorrhagic shock',
          interventions: 'Endotracheal intubation, bilateral chest tubes, 2 units O-neg PRBCs, 1mg Epinephrine IV',
          outcome: 'ROSC_ACHIEVED',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.outcome).toBe('ROSC_ACHIEVED');
      expect(res.body.data.interventions).toContain('Endotracheal intubation');
    });

    it('records emergency disposition to Intensive Care Unit (ICU)', async () => {
      const res = await request(app)
        .post(`/api/v1/emergency/encounters/${erEncounterId}/disposition`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          disposition: 'ADMIT',
          notes: 'Stabilized post-ROSC; emergent transfer to Trauma ICU Bed 04 for urgent exploratory laparotomy',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.disposition).toBe('ADMIT');
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });
  });

  // =========================================================================
  // 4. LOOSE COUPLING & BILLING CHARGE FLOW VERIFICATION
  // =========================================================================
  describe('4. Loose Coupling: Charges Flow Automatically When Billing is Enabled', () => {
    it('automatically generates Bill and BillItem records when billing module is enabled', async () => {
      // 1. Enable billing module for this tenant
      await prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: 'billing' } },
        update: { enabled: true },
        create: { tenantId, moduleId: 'billing', enabled: true },
      });
      entitlementService.invalidateCache(tenantId);

      // 2. Perform Pharmacy Dispensing with billing ENABLED
      const dispRes = await request(app)
        .post('/api/v1/pharmacy/dispense')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          locationId: pharmacyLocationId,
          items: [
            {
              productId,
              quantity: 2,
            },
          ],
        });

      expect(dispRes.status).toBe(201);
      expect(dispRes.body.data.receiptMode).toBe('INVOICE'); // Invoiced!
      expect(dispRes.body.data.isBilled).toBe(true);
      expect(dispRes.body.data.charge.billId).toBeDefined();

      // 3. Verify in database that Bill and BillItem were created automatically
      const bill = await prisma.bill.findUnique({
        where: { id: dispRes.body.data.charge.billId },
        include: { items: true },
      });

      expect(bill).toBeDefined();
      expect(bill?.status).toBe('DRAFT');
      expect(bill?.subTotal).toBeGreaterThanOrEqual(24.0); // 2 * 12.0
      expect(bill?.items.some((i: any) => i.sourceModule === 'PHARMACY')).toBe(true);

      // 4. Record new ER Triage with billing ENABLED
      const erRes = await request(app)
        .post('/api/v1/emergency/triage')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          arrivalMode: 'WALK_IN',
          priority: 'ORANGE', // ESI Level 2 ($175)
          chiefComplaint: 'Acute crushing retrosternal chest pain radiating to left jaw',
          consciousness: 'ALERT',
          painScore: 8,
        });

      expect(erRes.status).toBe(201);
      expect(erRes.body.data.receiptMode).toBe('INVOICE'); // Invoiced!
      expect(erRes.body.data.isBilled).toBe(true);
      expect(erRes.body.data.charge.billId).toBeDefined();

      // 5. Verify emergency charge added to the bill
      const updatedBill = await prisma.bill.findUnique({
        where: { id: erRes.body.data.charge.billId },
        include: { items: true },
      });
      expect(updatedBill?.items.some((i: any) => i.sourceModule === 'EMERGENCY')).toBe(true);
    });
  });

  // =========================================================================
  // 5. PHARMACY-ER EDITION BUILD & PRUNING VERIFICATION
  // =========================================================================
  describe('5. pharmacy-er Modular Edition Verification', () => {
    it('verifies pharmacy-er edition physically prunes other module routes', () => {
      try {
        const manifest = buildEdition({
          preset: 'pharmacy-er',
          dryRun: true,
        });

        // 1. Verify enabled modules
        expect(manifest.enabledModules).toContain('pharmacy');
        expect(manifest.enabledModules).toContain('emergency');
        expect(manifest.enabledModules).toContain('inventory');
        expect(manifest.enabledModules).toContain('patients');
        expect(manifest.enabledModules).toContain('foundation');

        // 2. Verify disabled modules
        expect(manifest.disabledModules).toContain('opd');
        expect(manifest.disabledModules).toContain('scheduling');
        expect(manifest.disabledModules).toContain('billing');
        expect(manifest.disabledModules).toContain('ipd');
        expect(manifest.disabledModules).toContain('laboratory');
        expect(manifest.disabledModules).toContain('radiology');

        // 3. Verify pruned routes
        expect(manifest.prunedRoutes).toContain('/opd');
        expect(manifest.prunedRoutes).toContain('/appointments');
        expect(manifest.prunedRoutes).toContain('/queue');
        expect(manifest.prunedRoutes).toContain('/billing');
        expect(manifest.prunedRoutes).toContain('/ipd');
      } finally {
        restoreOriginalRoutes();
      }
    });
  });
});
