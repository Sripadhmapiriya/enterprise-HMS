import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './apps/api/src/index';
import { prisma } from './packages/database/src/index';
import { authService } from './apps/api/src/services/authService';
import { clearEntitlementsCache } from './apps/api/src/middleware/auth';

describe('Workstream H: Procurement, HR, Finance, Assets, CRM & Section 9 Procurement-to-Pharmacy-Stock Journey', () => {
  let token: string;
  let tenantId: string;
  let hospitalId: string;
  let branchId: string;
  let departmentId: string;
  let pharmacyLocationId: string;
  let medicineProductId: string;
  let adminUserId: string;
  let employeeId: string;
  let patientId: string;

  beforeAll(async () => {
    // 1. Setup Tenant
    const tenant = await prisma.tenant.upsert({
      where: { code: 'TEST-BIZ-OPS' },
      update: {},
      create: { name: 'Metro Health Enterprise Services', code: 'TEST-BIZ-OPS' },
    });
    tenantId = tenant.id;

    // Enable all required modules for Workstream H
    const modulesToEnable = [
      'procurement',
      'inventory',
      'hr',
      'finance',
      'assets',
      'crm',
      'patients',
      'pharmacy',
      'billing',
    ];

    for (const mod of modulesToEnable) {
      await prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: mod } },
        update: { enabled: true },
        create: { tenantId, moduleId: mod, enabled: true },
      });
    }

    clearEntitlementsCache(tenantId);

    // 2. Setup Hospital & Branch
    const hospital =
      (await prisma.hospital.findFirst({ where: { tenantId } })) ||
      (await prisma.hospital.create({
        data: { tenantId, name: 'Metro Central Enterprise Hospital' },
      }));
    hospitalId = hospital.id;

    const branch =
      (await prisma.branch.findFirst({ where: { hospitalId } })) ||
      (await prisma.branch.create({
        data: { hospitalId, name: 'Main Campus Operations Hub', code: 'MAIN-HUB-01' },
      }));
    branchId = branch.id;

    // 3. Setup Department
    const dept =
      (await prisma.department.findFirst({ where: { branchId } })) ||
      (await prisma.department.create({
        data: { branchId, name: 'Pharmacy & Therapeutics', code: 'PHARM-THERAP' },
      }));
    departmentId = dept.id;

    // 4. Setup Admin User
    const adminUser = await prisma.user.create({
      data: {
        tenantId,
        email: `ops.director.${Date.now()}@metrohealth.org`,
        passwordHash: await authService.hashPassword('Password123!'),
        firstName: 'Eleanor',
        lastName: 'Vance',
      },
    });
    adminUserId = adminUser.id;

    // 5. Setup Pharmacy Inventory Location
    const location = await prisma.inventoryLocation.create({
      data: {
        tenantId,
        hospitalId,
        branchId,
        name: `Inpatient Central Pharmacy Store ${Date.now().toString().slice(-4)}`,
        type: 'PHARMACY',
      },
    });
    pharmacyLocationId = location.id;

    // 6. Setup Product Category & Unit for Medicine
    const category = await prisma.productCategory.create({
      data: {
        tenantId,
        name: `Antimicrobial-${Date.now().toString().slice(-4)}`,
      },
    });

    const unit = await prisma.unit.upsert({
      where: { name: 'Vial' },
      update: {},
      create: { tenantId, name: 'Vial' },
    });

    const product = await prisma.product.create({
      data: {
        tenantId,
        name: 'Meropenem 1g Injection',
        code: `MED-MERO-${Date.now().toString().slice(-4)}`,
        categoryId: category.id,
        unitId: unit.id,
      },
    });
    medicineProductId = product.id;

    // 7. Setup Patient for CRM Tests
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        hospitalId,
        mrn: `MRN-CRM-${Date.now().toString().slice(-5)}`,
        firstName: 'Elena',
        lastName: 'Rostova',
        gender: 'FEMALE',
        mobile: '+15554321098',
        dateOfBirth: new Date('1988-06-20'),
      },
    });
    patientId = patient.id;

    // 8. JWT Token with SuperAdmin permissions
    token = authService.generateAccessToken({
      userId: adminUser.id,
      tenantId,
      email: adminUser.email,
      roles: ['SuperAdmin', 'HospitalAdmin', 'HRManager', 'FinanceDirector', 'BiomedicalLead'],
      permissions: ['*'],
      hospitalId,
      branchId,
    });
  });

  // =========================================================================
  // 1. PROCUREMENT WORKFLOW & SECTION 9 PROCUREMENT-TO-PHARMACY-STOCK JOURNEY
  // =========================================================================
  describe('Procurement Workflow & Section 9 Procurement-to-Pharmacy Stock Journey', () => {
    let supplierId: string;
    let purchaseRequestId: string;
    let purchaseOrderId: string;
    let goodsReceiptId: string;
    const testBatchNumber = `MERO-BATCH-${Date.now().toString().slice(-5)}`;

    it('POST /api/v1/procurement/suppliers should register an accredited medical vendor', async () => {
      const res = await request(app)
        .post('/api/v1/procurement/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Apex Pharmaceutical Distributors Ltd',
          code: `SUP-APEX-${Date.now().toString().slice(-4)}`,
          email: 'orders@apexpharma.com',
          phone: '+15558889999',
          contactName: 'David Miller',
          address: '400 Logistics Parkway, Suite 100',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      supplierId = res.body.data.id;
    });

    it('GET /api/v1/procurement/suppliers should list suppliers with filters', async () => {
      const res = await request(app)
        .get('/api/v1/procurement/suppliers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((s: any) => s.id === supplierId)).toBe(true);
    });

    it('POST /api/v1/procurement/requests should create a clinical Purchase Request (PR)', async () => {
      const res = await request(app)
        .post('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId,
          priority: 'HIGH',
          reason: 'Urgent restocking for intensive care antimicrobials',
          items: [
            {
              productId: medicineProductId,
              quantity: 200,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('PENDING_APPROVAL');
      purchaseRequestId = res.body.data.id;
    });

    it('PATCH /api/v1/procurement/requests/:id/approve should approve the requisition', async () => {
      const res = await request(app)
        .patch(`/api/v1/procurement/requests/${purchaseRequestId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          approved: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('POST /api/v1/procurement/orders should issue a Purchase Order (PO) to vendor', async () => {
      const res = await request(app)
        .post('/api/v1/procurement/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierId,
          requestId: purchaseRequestId,
          expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          items: [
            {
              productId: medicineProductId,
              quantity: 200,
              unitPrice: 45.0,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.totalAmount).toBe(9000);
      expect(res.body.data.status).toBe('SENT');
      purchaseOrderId = res.body.data.id;
    });

    it('POST /api/v1/procurement/goods-receipts should complete Section 9 journey: stock appears in pharmacy batch list', async () => {
      // Prior to GRN, verify batch does not exist
      const preBatch = await prisma.inventoryBatch.findUnique({
        where: {
          productId_locationId_batchNumber: {
            productId: medicineProductId,
            locationId: pharmacyLocationId,
            batchNumber: testBatchNumber,
          },
        },
      });
      expect(preBatch).toBeNull();

      // Receive GRN at destination pharmacy location
      const res = await request(app)
        .post('/api/v1/procurement/goods-receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purchaseOrderId,
          supplierId,
          destinationLocationId: pharmacyLocationId,
          invoiceNumber: `INV-APEX-${Date.now().toString().slice(-6)}`,
          items: [
            {
              productId: medicineProductId,
              batchNumber: testBatchNumber,
              expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              quantity: 200,
              purchaseRate: 45.0,
              sellingRate: 56.0,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('COMPLETED');
      goodsReceiptId = res.body.data.id;

      // Section 9 verification: Check that inventory batch was created in destination pharmacy location
      const postBatch = await prisma.inventoryBatch.findUnique({
        where: {
          productId_locationId_batchNumber: {
            productId: medicineProductId,
            locationId: pharmacyLocationId,
            batchNumber: testBatchNumber,
          },
        },
      });

      expect(postBatch).not.toBeNull();
      expect(postBatch!.availableQty).toBe(200);
      expect(postBatch!.batchNumber).toBe(testBatchNumber);

      // Verify inventory ledger transaction
      const ledgerEntry = await prisma.inventoryLedger.findFirst({
        where: {
          tenantId,
          productId: medicineProductId,
          batchId: postBatch!.id,
          transactionType: 'PURCHASE',
        },
      });
      expect(ledgerEntry).not.toBeNull();
      expect(ledgerEntry!.quantity).toBe(200);
    });

    it('GET /api/v1/procurement/orders should return POs with receipt tracking', async () => {
      const res = await request(app)
        .get('/api/v1/procurement/orders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const po = res.body.data.find((o: any) => o.id === purchaseOrderId);
      expect(po).toBeDefined();
      expect(po.supplier).toBeDefined();
    });
  });

  // =========================================================================
  // 2. HUMAN RESOURCES (HR) & WORKFORCE MANAGEMENT
  // =========================================================================
  describe('Human Resources (HR) & Workforce Management', () => {
    let credentialId: string;
    let leaveRequestId: string;
    let periodId: string;

    it('POST /api/v1/hr/employees should onboard a clinical employee profile', async () => {
      const res = await request(app)
        .post('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Julian',
          lastName: 'Bashir',
          email: `dr.bashir.${Date.now()}@metrohealth.org`,
          employeeCode: `EMP-MD-${Date.now().toString().slice(-4)}`,
          departmentId,
          designation: 'Chief Medical Officer',
          employmentType: 'FULL_TIME',
          joiningDate: '2024-01-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.employeeCode).toBeDefined();
      employeeId = res.body.data.id;
    });

    it('POST /api/v1/hr/employees/:id/credentials should record professional license with expiry', async () => {
      // Expiry within 45 days to test expiry alert logic
      const expiringDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const res = await request(app)
        .post(`/api/v1/hr/employees/${employeeId}/credentials`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          credentialType: 'LICENSE',
          registrationNumber: `LIC-MED-${Date.now().toString().slice(-6)}`,
          authority: 'State Board of Medical Examiners',
          issueDate: '2023-01-01',
          expiryDate: expiringDate,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      credentialId = res.body.data.id;
    });

    it('GET /api/v1/hr/credentials should flag credentials expiring soon (<90 days)', async () => {
      const res = await request(app)
        .get('/api/v1/hr/credentials?compliance=EXPIRING')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const targetCred = res.body.data.find((c: any) => c.id === credentialId);
      expect(targetCred).toBeDefined();
      expect(targetCred.isExpiringSoon).toBe(true);
      expect(targetCred.isExpired).toBe(false);
      expect(targetCred.daysUntilExpiry).toBeLessThanOrEqual(90);
    });

    it('POST /api/v1/hr/attendance should record biometric punch', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .post('/api/v1/hr/attendance')
        .set('Authorization', `Bearer ${token}`)
        .send({
          employeeId,
          date: today,
          checkIn: `${today}T08:00:00Z`,
          checkOut: `${today}T17:00:00Z`,
          status: 'PRESENT',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PRESENT');
    });

    it('POST /api/v1/hr/leave and PATCH /api/v1/hr/leave/:id should process leave approvals', async () => {
      // Submit leave
      const submitRes = await request(app)
        .post('/api/v1/hr/leave')
        .set('Authorization', `Bearer ${token}`)
        .send({
          employeeId,
          leaveType: 'CASUAL',
          startDate: '2026-11-01',
          endDate: '2026-11-03',
          reason: 'Medical conference attendance',
        });

      expect(submitRes.status).toBe(201);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.data.status).toBe('PENDING');
      leaveRequestId = submitRes.body.data.id;

      // Review & Approve
      const reviewRes = await request(app)
        .patch(`/api/v1/hr/leave/${leaveRequestId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'APPROVED',
          reviewNotes: 'Approved by Department Chair',
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.success).toBe(true);
      expect(reviewRes.body.data.status).toBe('APPROVED');
    });

    it('POST /api/v1/hr/payroll/run should calculate payroll and generate employee payslips', async () => {
      const res = await request(app)
        .post('/api/v1/hr/payroll/run')
        .set('Authorization', `Bearer ${token}`)
        .send({
          month: 10,
          year: 2026,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period).toBeDefined();
      expect(res.body.data.period.status).toBe('FINALIZED');
      expect(res.body.data.payslipsCount).toBeGreaterThanOrEqual(1);
      periodId = res.body.data.period.id;

      // Verify payslip retrieval
      const slipRes = await request(app)
        .get(`/api/v1/hr/payroll/payslips?periodId=${periodId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(slipRes.status).toBe(200);
      expect(slipRes.body.success).toBe(true);
      expect(slipRes.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 3. FINANCE & GENERAL LEDGER
  // =========================================================================
  describe('Finance & General Ledger', () => {
    let accounts: any[] = [];

    it('GET /api/v1/finance/accounts should auto-seed default Chart of Accounts if empty', async () => {
      const res = await request(app)
        .get('/api/v1/finance/accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(5);
      accounts = res.body.data;
    });

    it('POST /api/v1/finance/journals should reject unbalanced journal entries (Debits != Credits)', async () => {
      const cashAccount = accounts.find((a: any) => a.accountCode === '1010') || accounts[0];
      const revenueAccount = accounts.find((a: any) => a.accountCode === '4010') || accounts[1];

      const res = await request(app)
        .post('/api/v1/finance/journals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          entryDate: new Date().toISOString().split('T')[0],
          referenceNumber: `JRN-UNBAL-${Date.now().toString().slice(-4)}`,
          description: 'Faulty unbalanced entry test',
          lines: [
            { accountId: cashAccount.id, debit: 500, credit: 0 },
            { accountId: revenueAccount.id, debit: 0, credit: 400 }, // $100 imbalance!
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBeDefined();
    });

    it('POST /api/v1/finance/journals should accept balanced double-entry journals', async () => {
      const cashAccount = accounts.find((a: any) => a.accountCode === '1010') || accounts[0];
      const expenseAccount = accounts.find((a: any) => a.accountCode === '5020') || accounts[ accounts.length - 1 ];

      const res = await request(app)
        .post('/api/v1/finance/journals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          entryDate: new Date().toISOString().split('T')[0],
          referenceNumber: `JRN-BAL-${Date.now().toString().slice(-4)}`,
          description: 'Payment for biomedical calibration services',
          lines: [
            { accountId: expenseAccount.id, debit: 750, credit: 0 },
            { accountId: cashAccount.id, debit: 0, credit: 750 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('POSTED');
    });

    it('GET /api/v1/finance/trial-balance should return trial balance with isBalanced: true', async () => {
      const res = await request(app)
        .get('/api/v1/finance/trial-balance')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalDebits).toBeDefined();
      expect(res.body.data.totalCredits).toBeDefined();
      expect(res.body.data.isBalanced).toBe(true);
    });

    it('GET /api/v1/finance/aging-summary should calculate AP and AR aging distributions', async () => {
      const res = await request(app)
        .get('/api/v1/finance/aging-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ar).toBeDefined();
      expect(res.body.data.ap).toBeDefined();
    });
  });

  // =========================================================================
  // 4. BIOMEDICAL ASSETS & CMMS
  // =========================================================================
  describe('Biomedical Assets & CMMS Maintenance', () => {
    let assetId: string;
    let maintenanceTaskId: string;

    it('POST /api/v1/assets should register a clinical biomedical device', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          assetCode: `BME-DEFIB-${Date.now().toString().slice(-4)}`,
          name: 'Zoll R Series Biphasic Defibrillator',
          category: 'BIOMEDICAL_LIFE_SUPPORT',
          purchaseDate: '2024-03-01',
          purchaseCost: 12500,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('ACTIVE');
      assetId = res.body.data.id;
    });

    it('POST /api/v1/assets/breakdown should report fault and instantly mark device MAINTENANCE', async () => {
      const res = await request(app)
        .post('/api/v1/assets/breakdown')
        .set('Authorization', `Bearer ${token}`)
        .send({
          assetId,
          description: 'Capacitor discharge self-test failure during morning round check',
          priority: 'CRITICAL',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task).toBeDefined();
      expect(res.body.data.task.status).toBe('SCHEDULED');
      expect(res.body.data.task.priority).toBe('CRITICAL');
      maintenanceTaskId = res.body.data.task.id;

      // Verify asset status changed to MAINTENANCE
      const assetCheck = await prisma.asset.findUnique({ where: { id: assetId } });
      expect(assetCheck?.status).toBe('MAINTENANCE');
    });

    it('PATCH /api/v1/assets/maintenance/:id/complete should complete work order and restore asset to ACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/v1/assets/maintenance/${maintenanceTaskId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          resolutionNotes: 'Replaced main capacitor bank; passed automated 200J energy output test.',
          calibrationPassed: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('COMPLETED');

      // Verify asset status restored to ACTIVE
      const assetCheck = await prisma.asset.findUnique({ where: { id: assetId } });
      expect(assetCheck?.status).toBe('ACTIVE');
    });
  });

  // =========================================================================
  // 5. CRM & PATIENT EXPERIENCE
  // =========================================================================
  describe('CRM & Patient Feedback', () => {
    let feedbackId: string;

    it('POST /api/v1/crm/feedback should record patient feedback with rating and category', async () => {
      const res = await request(app)
        .post('/api/v1/crm/feedback')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          rating: 5,
          category: 'NURSING',
          comments: 'Exceptional nursing staff in the surgical ICU! Compassionate and attentive.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.status).toBe('NEW');
      feedbackId = res.body.data.id;
    });

    it('GET /api/v1/crm/feedback/escalations should query SLA compliance', async () => {
      const res = await request(app)
        .get('/api/v1/crm/feedback/escalations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('PATCH /api/v1/crm/feedback/:id/status should update feedback resolution', async () => {
      const res = await request(app)
        .patch(`/api/v1/crm/feedback/${feedbackId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'RESOLVED',
          resolutionNote: 'Commendation shared with ward nursing supervisor during morning huddle.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('RESOLVED');
      expect(res.body.data.resolutionNote).toBeDefined();
    });

    it('GET /api/v1/crm/analytics should calculate Net Promoter Score (NPS) and category volume', async () => {
      const res = await request(app)
        .get('/api/v1/crm/analytics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalFeedback).toBeGreaterThanOrEqual(1);
      expect(res.body.data.npsScore).toBeDefined();
      expect(res.body.data.averageRating).toBeGreaterThanOrEqual(1);
      expect(res.body.data.byCategory).toBeDefined();
    });
  });

  // =========================================================================
  // 6. ENTITLEMENT MATRIX ENFORCEMENT FOR WORKSTREAM H MODULES
  // =========================================================================
  describe('Entitlement Matrix Enforcement for Workstream H Modules', () => {
    const workstreamHModules = [
      { module: 'procurement', testPath: '/api/v1/procurement/suppliers' },
      { module: 'hr', testPath: '/api/v1/hr/employees' },
      { module: 'finance', testPath: '/api/v1/finance/accounts' },
      { module: 'assets', testPath: '/api/v1/assets' },
      { module: 'crm', testPath: '/api/v1/crm/feedback' },
    ];

    for (const { module, testPath } of workstreamHModules) {
      it(`disabling module '${module}' returns 404 MODULE_NOT_ENABLED and re-enabling returns 200`, async () => {
        // 1. Disable the module in tenant entitlements
        await prisma.tenantEntitlement.upsert({
          where: { tenantId_moduleId: { tenantId, moduleId: module } },
          update: { enabled: false },
          create: { tenantId, moduleId: module, enabled: false },
        });
        clearEntitlementsCache(tenantId);

        // 2. Request endpoint -> must return 404 MODULE_NOT_ENABLED
        const disabledRes = await request(app)
          .get(testPath)
          .set('Authorization', `Bearer ${token}`);

        expect(disabledRes.status).toBe(404);
        expect(disabledRes.body.error.code).toBe('MODULE_NOT_ENABLED');

        // 3. Re-enable the module
        await prisma.tenantEntitlement.upsert({
          where: { tenantId_moduleId: { tenantId, moduleId: module } },
          update: { enabled: true },
          create: { tenantId, moduleId: module, enabled: true },
        });
        clearEntitlementsCache(tenantId);

        // 4. Request endpoint -> must return 200 OK
        const enabledRes = await request(app)
          .get(testPath)
          .set('Authorization', `Bearer ${token}`);

        expect(enabledRes.status).toBe(200);
      });
    }
  });
});
