import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './apps/api/src/index';
import { prisma } from './packages/database/src/index';
import { authService } from './apps/api/src/services/authService';

describe('Workstream F: Billing, Insurance, Laboratory & Radiology with Section 9 Journeys & Entitlements', () => {
  let token: string;
  let tenantId: string;
  let hospitalId: string;
  let branchId: string;
  let departmentId: string;
  let doctorId: string;
  let doctorUserId: string;
  let patientId: string;
  let pharmacyLocationId: string;
  let testProductId: string;
  let testBatchId: string;

  beforeAll(async () => {
    // 1. Setup Tenant
    const tenant = await prisma.tenant.upsert({
      where: { code: 'TEST-DIAG-BILLING' },
      update: {},
      create: { name: 'Metro Diagnostics & General Hospital', code: 'TEST-DIAG-BILLING' },
    });
    tenantId = tenant.id;

    // Enable all required modules for full clinical tests
    const modulesToEnable = [
      'patients',
      'scheduling',
      'opd',
      'inventory',
      'pharmacy',
      'emergency',
      'billing',
      'insurance',
      'laboratory',
      'radiology',
    ];

    for (const mod of modulesToEnable) {
      await prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: mod } },
        update: { enabled: true },
        create: { tenantId, moduleId: mod, enabled: true },
      });
    }

    // 2. Setup Hospital & Branch
    const hospital =
      (await prisma.hospital.findFirst({ where: { tenantId } })) ||
      (await prisma.hospital.create({
        data: { tenantId, name: 'Metro Central Diagnostic Pavilion' },
      }));
    hospitalId = hospital.id;

    const branch =
      (await prisma.branch.findFirst({ where: { hospitalId } })) ||
      (await prisma.branch.create({
        data: { hospitalId, name: 'Main Clinical Pavilion', code: 'METRO-BR-01' },
      }));
    branchId = branch.id;

    // 3. Setup Department
    const dept =
      (await prisma.department.findFirst({ where: { branchId } })) ||
      (await prisma.department.create({
        data: { branchId, name: 'Diagnostics & Therapeutics', code: 'DIAG-THERAP' },
      }));
    departmentId = dept.id;

    // 4. Setup Doctor & User
    const docEmail = `dr.radlab.${Date.now()}@metromedical.org`;
    const docUser = await prisma.user.create({
      data: {
        tenantId,
        email: docEmail,
        passwordHash: await authService.hashPassword('SecureDoc123!'),
        firstName: 'Alexander',
        lastName: 'Fleming',
      },
    });
    doctorUserId = docUser.id;

    const doctor = await prisma.doctor.create({
      data: {
        user: { connect: { id: docUser.id } },
        branch: { connect: { id: branchId } },
        department: { connect: { id: departmentId } },
        specialization: 'Clinical Pathology & Radiology',
        licenseNumber: `DOC-LIC-${Date.now().toString().slice(-6)}`,
      },
    });
    doctorId = doctor.id;

    // 5. Setup Patient
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        hospitalId,
        mrn: `MRN-DIAG-${Date.now()}`,
        firstName: 'Eleanor',
        lastName: 'Vance',
        dateOfBirth: new Date('1988-07-22'),
        gender: 'FEMALE',
        mobile: '+15559876543',
        bloodGroup: 'O_POSITIVE',
      },
    });
    patientId = patient.id;

    // 6. Token with all relevant roles and permissions
    token = authService.generateAccessToken({
      userId: docUser.id,
      tenantId,
      email: docUser.email,
      roles: ['SuperAdmin', 'HospitalAdmin', 'Doctor', 'Cashier', 'Pathologist', 'Radiologist'],
      permissions: ['*'],
      hospitalId,
      branchId,
    });

    // 7. Setup Pharmacy Location, Product & Batch for OPD dispense via endpoints
    const locRes = await request(app)
      .post('/api/v1/inventory/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Central Outpatient Dispensary',
        type: 'PHARMACY',
      });
    pharmacyLocationId = locRes.body.data.id;

    const prodRes = await request(app)
      .post('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Amoxicillin Trihydrate 500mg',
        code: `AMOX-500-${Date.now()}`,
        categoryName: 'Antibiotics',
        unitName: 'Capsule',
        dosageForm: 'Capsule',
        strength: '500mg',
        reorderLevel: 10,
        sellingPrice: 12.5,
        costPrice: 6.0,
      });
    testProductId = prodRes.body.data.id;

    const batchRes = await request(app)
      .post('/api/v1/inventory/batches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: testProductId,
        locationId: pharmacyLocationId,
        batchNumber: `BAT-AMOX-${Date.now()}`,
        expiryDate: new Date('2028-12-31').toISOString(),
        quantity: 100,
        purchaseRate: 6.0,
        mrp: 12.5,
        sellingRate: 12.5,
      });
    testBatchId = batchRes.body.data.batch.id;
  }, 45000);

  // =========================================================================
  // SUITE 1: BILLING & CHARGE CAPTURE & PDF DOCUMENTS
  // =========================================================================
  describe('1. Billing & Financial Transactions', () => {
    let tariffId: string;
    let createdBillId: string;
    let paymentId: string;

    it('POST /api/v1/billing/tariffs should create a tariff charge master item', async () => {
      const res = await request(app)
        .post('/api/v1/billing/tariffs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Specialist Consultation - Senior MD',
          code: `TAR-CONS-${Date.now()}`,
          category: 'CONSULTATION',
          rate: 150.0,
          taxPercent: 5.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      tariffId = res.body.data.id;
    });

    it('GET /api/v1/billing/tariffs should list active tariffs with filtering', async () => {
      const res = await request(app)
        .get('/api/v1/billing/tariffs?category=CONSULTATION')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((t: any) => t.id === tariffId)).toBe(true);
    });

    it('POST /api/v1/billing/bills should create an initial draft bill with line items', async () => {
      const res = await request(app)
        .post('/api/v1/billing/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          billType: 'OPD',
          items: [
            {
              serviceCode: 'CONS-SPEC',
              description: 'Initial Specialist Outpatient Consultation',
              category: 'CONSULTATION',
              quantity: 1,
              unitPrice: 150.0,
              discountAmount: 10.0,
              taxAmount: 7.0,
            },
            {
              serviceCode: 'BIOCHEM-LIPID',
              description: 'Complete Lipid Profile Assessment',
              category: 'LABORATORY',
              quantity: 1,
              unitPrice: 80.0,
              discountAmount: 0.0,
              taxAmount: 4.0,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRAFT');
      // Subtotal = 150 + 80 = 230; discount = 10; tax = 11; total = 231
      expect(res.body.data.totalAmount).toBe(231);
      expect(res.body.data.balanceAmount).toBe(231);
      createdBillId = res.body.data.id;
    });

    it('POST /api/v1/billing/bills/:id/finalize should convert bill to INVOICED with invoice number', async () => {
      const res = await request(app)
        .post(`/api/v1/billing/bills/${createdBillId}/finalize`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('INVOICED');
      expect(res.body.data.billNumber).toMatch(/^INV-\d{8}-\d{4}$/);
    });

    it('GET /api/v1/billing/bills/:id/invoice-pdf should stream a valid binary PDF invoice', async () => {
      const res = await request(app)
        .get(`/api/v1/billing/bills/${createdBillId}/invoice-pdf`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/pdf');
      // PDF documents start with %PDF- header magic bytes
      const headerStr = res.body.slice(0, 5).toString('utf-8');
      expect(headerStr).toBe('%PDF-');
    });

    it('POST /api/v1/billing/cashier/shifts/open should open a cashier shift', async () => {
      const res = await request(app)
        .post('/api/v1/billing/cashier/shifts/open')
        .set('Authorization', `Bearer ${token}`)
        .send({
          openingBalance: 250.0,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('OPEN');
    });

    it('POST /api/v1/billing/bills/:id/payments should process partial/full payment and generate receipt number', async () => {
      const res = await request(app)
        .post(`/api/v1/billing/bills/${createdBillId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 231.0,
          paymentMode: 'CARD',
          referenceNumber: 'TXN-VISA-994821',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment.receiptNumber).toMatch(/^RCPT-\d{8}-\d{4}$/);
      expect(res.body.data.bill.status).toBe('PAID');
      expect(res.body.data.bill.balanceAmount).toBe(0);
      paymentId = res.body.data.payment.id;
    });

    it('GET /api/v1/billing/payments/:id/receipt-pdf should stream a valid binary PDF receipt', async () => {
      const res = await request(app)
        .get(`/api/v1/billing/payments/${paymentId}/receipt-pdf`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/pdf');
      const headerStr = res.body.slice(0, 5).toString('utf-8');
      expect(headerStr).toBe('%PDF-');
    });

    it('POST /api/v1/billing/cashier/shifts/close should successfully balance and close shift', async () => {
      const res = await request(app)
        .post('/api/v1/billing/cashier/shifts/close')
        .set('Authorization', `Bearer ${token}`)
        .send({
          closingBalance: 250.0,
          notes: 'Daily Outpatient shift closing verified against card batch totals',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CLOSED');
    });
  });

  // =========================================================================
  // SUITE 2: INSURANCE & PRE-AUTH & CLAIMS WORKFLOW
  // =========================================================================
  describe('2. Insurance Provider, Policies & Claims Workflow', () => {
    let providerId: string;
    let policyId: string;
    let preAuthId: string;
    let claimId: string;
    let insuranceBillId: string;

    it('POST /api/v1/insurance/providers should register an insurance payer/TPA', async () => {
      const res = await request(app)
        .post('/api/v1/insurance/providers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Aetna Global Health Payer',
          code: `AETNA-${Date.now()}`,
          payerId: 'PAYER-99120',
          contactPerson: 'Sarah Jenkins',
          email: 'claims@aetna-global.example.com',
          phone: '+18005550199',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      providerId = res.body.data.id;
    });

    it('POST /api/v1/insurance/policies should register a patient insurance policy', async () => {
      const res = await request(app)
        .post('/api/v1/insurance/policies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          providerId,
          policyNumber: `POL-AET-${Date.now().toString().slice(-8)}`,
          sumInsured: 50000.0,
          validFrom: '2025-01-01',
          validTo: '2027-12-31',
          tpaName: 'Paramount TPA Healthcare',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      policyId = res.body.data.id;
    });

    it('POST /api/v1/insurance/pre-auth should request and record pre-authorization approval', async () => {
      const res = await request(app)
        .post('/api/v1/insurance/pre-auth')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          providerId,
          policyId,
          requestedAmount: 1200.0,
          approvedAmount: 1000.0,
          status: 'APPROVED',
          preAuthNumber: `PA-AUTH-${Date.now()}`,
          treatmentDetails: 'Diagnostic contrast CT and comprehensive hematology panel',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.approvedAmount).toBe(1000.0);
      preAuthId = res.body.data.id;
    });

    it('POST /api/v1/insurance/claims should submit an insurance claim against a bill', async () => {
      // First create a bill for this claim
      const billRes = await request(app)
        .post('/api/v1/billing/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          billType: 'OPD',
          items: [
            {
              serviceCode: 'IMG-CT-CHEST',
              description: 'CT Thorax with IV Contrast',
              category: 'RADIOLOGY',
              quantity: 1,
              unitPrice: 1000.0,
              discountAmount: 0.0,
              taxAmount: 0.0,
            },
          ],
        });
      insuranceBillId = billRes.body.data.id;

      // Submit claim
      const claimRes = await request(app)
        .post('/api/v1/insurance/claims')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          providerId,
          billId: insuranceBillId,
          policyNumber: 'POL-AET-VERIFIED',
          claimAmount: 1000.0,
          preAuthNumber: `PA-AUTH-${Date.now()}`,
          diagnosisNotes: 'Evaluated for chronic cough; high-resolution imaging indicated',
        });

      expect(claimRes.status).toBe(201);
      expect(claimRes.body.success).toBe(true);
      expect(claimRes.body.data.claimNumber).toMatch(/^CLM-\d{8}-\d{4}$/);
      expect(claimRes.body.data.status).toBe('SUBMITTED');
      claimId = claimRes.body.data.id;
    });

    it('POST /api/v1/insurance/claims/:id/settle should handle claim adjudication and settlement', async () => {
      const res = await request(app)
        .post(`/api/v1/insurance/claims/${claimId}/settle`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          settledAmount: 900.0,
          coPayAmount: 100.0,
          settlementDate: new Date().toISOString(),
          paymentReference: 'NEFT-INS-SETTLE-88192',
          notes: 'Settled with 10% co-pay deductible applied per policy clause',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PARTIALLY_SETTLED');
      expect(res.body.data.settlement.settledAmount).toBe(900.0);
    });
  });

  // =========================================================================
  // SUITE 3: LABORATORY & CRITICAL VALUE ALERTS & PDF REPORTS
  // =========================================================================
  describe('3. Laboratory Workflow with Critical Values & Validation', () => {
    let orderId: string;
    let orderItemId: string;
    let sampleId: string;
    let criticalAlertId: string;

    it('POST /api/v1/laboratory/orders should place an investigation lab order', async () => {
      const res = await request(app)
        .post('/api/v1/laboratory/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          doctorId,
          priority: 'STAT',
          clinicalNotes: 'Severe diabetic ketoacidosis symptoms; urgent electrolyte and glucose panel',
          items: [
            {
              testName: 'Serum Potassium & Electrolytes',
              testCode: 'LAB-K-SERUM',
              sampleType: 'SERUM',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.items.length).toBe(1);
      orderId = res.body.data.id;
      orderItemId = res.body.data.items[0].id;
    });

    it('POST /api/v1/laboratory/samples/collect should collect sample and generate barcode', async () => {
      const res = await request(app)
        .post('/api/v1/laboratory/samples/collect')
        .set('Authorization', `Bearer ${token}`)
        .send({
          orderItemId,
          specimenType: 'WHOLE_BLOOD_SERUM',
          container: 'GOLD_TOP_SST',
          collectionNotes: 'Collected via left antecubital venipuncture without hemolysis',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sampleNumber).toMatch(/^LAB-\d{8}-\d{4}$/);
      expect(res.body.data.barcode).toBeDefined();
      expect(res.body.data.status).toBe('COLLECTED');
      sampleId = res.body.data.id;
    });

    it('POST /api/v1/laboratory/samples/:id/results should record critical/panic value and trigger alert', async () => {
      // Potassium: Reference interval 3.5 - 5.1 mmol/L. Result: 6.9 mmol/L (Severe Hyperkalemia - Critical Panic Value)
      const res = await request(app)
        .post(`/api/v1/laboratory/samples/${sampleId}/results`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          results: [
            {
              parameter: 'Serum Potassium',
              numericValue: 6.9,
              unit: 'mmol/L',
              referenceRange: '3.5 - 5.1',
              isCritical: true,
              criticalMessage: 'CRITICAL HIGH: Potassium 6.9 mmol/L exceeds panic threshold (6.2). Cardiac arrhythmia risk.',
            },
            {
              parameter: 'Serum Sodium',
              numericValue: 138,
              unit: 'mmol/L',
              referenceRange: '135 - 145',
              isCritical: false,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.criticalTriggered).toBe(true);
      expect(res.body.data.results.length).toBe(2);
      expect(res.body.data.results[0].flag).toBe('CRITICAL');
    });

    it('GET /api/v1/laboratory/critical-results should list unacknowledged panic alerts', async () => {
      const res = await request(app)
        .get('/api/v1/laboratory/critical-results')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const alert = res.body.data.find((a: any) => a.sampleId === sampleId);
      expect(alert).toBeDefined();
      expect(alert.status).toBe('UNACKNOWLEDGED');
      criticalAlertId = alert.id;
    });

    it('POST /api/v1/laboratory/critical-results/:id/acknowledge should acknowledge the panic value', async () => {
      const res = await request(app)
        .post(`/api/v1/laboratory/critical-results/${criticalAlertId}/acknowledge`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          actionTaken: 'Dr. Fleming immediately telephoned; STAT IV calcium gluconate and insulin protocol initiated',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACKNOWLEDGED');
    });

    it('POST /api/v1/laboratory/samples/:id/validate should perform pathologist verification', async () => {
      const res = await request(app)
        .post(`/api/v1/laboratory/samples/${sampleId}/validate`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('VERIFIED');
    });

    it('GET /api/v1/laboratory/samples/:id/report-pdf should stream a valid binary PDF lab report', async () => {
      const res = await request(app)
        .get(`/api/v1/laboratory/samples/${sampleId}/report-pdf`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/pdf');
      const headerStr = res.body.slice(0, 5).toString('utf-8');
      expect(headerStr).toBe('%PDF-');
    });
  });

  // =========================================================================
  // SUITE 4: RADIOLOGY & PACS VIEWER INTEGRATION
  // =========================================================================
  describe('4. Radiology Imaging, Diagnostic Reporting & PACS Integration', () => {
    let imagingOrderId: string;
    let studyId: string;

    it('POST /api/v1/radiology/orders should place an imaging order', async () => {
      const res = await request(app)
        .post('/api/v1/radiology/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          doctorId,
          priority: 'ROUTINE',
          clinicalNotes: 'Persistent dry cough and right-sided pleuritic chest pain',
          items: [
            {
              testName: 'Chest X-Ray PA & Lateral',
              testCode: 'RAD-CXR-PA',
              modality: 'X-RAY',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      imagingOrderId = res.body.data.id;
    });

    it('GET /api/v1/radiology/worklist should show scheduled study with accession number and PACS URL', async () => {
      const res = await request(app)
        .get('/api/v1/radiology/worklist')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const study = res.body.data.find(
        (s: any) => s.orderItem?.order?.patientId === patientId
      );
      expect(study).toBeDefined();
      expect(study.studyNumber).toMatch(/^RAD-\d{8}-\d{4}$/);
      expect(study.pacsUrl).toContain('https://pacs.hospital.internal/ohif/viewer?studyInstanceUIDs=');
      studyId = study.id;
    });

    it('POST /api/v1/radiology/studies/:id/perform should mark study acquisition complete', async () => {
      const res = await request(app)
        .post(`/api/v1/radiology/studies/${studyId}/perform`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });

    it('POST /api/v1/radiology/studies/:id/report should submit radiologist diagnostic report', async () => {
      const res = await request(app)
        .post(`/api/v1/radiology/studies/${studyId}/report`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          indication: 'Right pleuritic pain, r/o consolidation',
          technique: 'Standard erect PA and lateral views of the thorax',
          findings: 'Lungs are clear with no focal consolidation, pleural effusion, or pneumothorax. Cardiomediastinal silhouette normal.',
          impression: 'No acute cardiopulmonary disease identified.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REPORTED');
      expect(res.body.data.report.impression).toContain('No acute cardiopulmonary disease');
    });

    it('POST /api/v1/radiology/studies/:id/verify should sign and verify the report', async () => {
      const res = await request(app)
        .post(`/api/v1/radiology/studies/${studyId}/verify`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('VERIFIED');
    });

    it('GET /api/v1/radiology/studies/:id/pacs-url should return OHIF/DICOM viewer link', async () => {
      const res = await request(app)
        .get(`/api/v1/radiology/studies/${studyId}/pacs-url`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pacsUrl).toContain('https://pacs.hospital.internal/ohif/viewer?studyInstanceUIDs=');
    });
  });

  // =========================================================================
  // SUITE 5: SECTION 9 END-TO-END CLINICAL JOURNEYS
  // =========================================================================
  describe('5. Section 9 End-to-End Clinical Journeys', () => {
    // Journey 5.1: OPD Billing Journey
    it('Journey A: OPD Billing: register patient -> appointment -> queue -> consult -> e-prescription -> pharmacy dispense -> invoice -> payment -> receipt PDF', async () => {
      // 1. Register Patient
      const regRes = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          hospitalId,
          mrn: `MRN-OPD-JOURNEY-${Date.now()}`,
          firstName: 'Marcus',
          lastName: 'Wright',
          dateOfBirth: '1984-11-09',
          gender: 'MALE',
          mobile: '+15554321987',
        });
      expect(regRes.status).toBe(201);
      const journeyPatientId = regRes.body.data.id;

      // 2. Book Appointment
      const apptRes = await request(app)
        .post('/api/v1/scheduling/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: journeyPatientId,
          doctorId,
          branchId,
          departmentId,
          scheduledDate: new Date().toISOString(),
          startTime: '10:00',
          endTime: '10:30',
          type: 'CONSULTATION',
        });
      expect(apptRes.status).toBe(201);
      const appointmentId = apptRes.body.data.id;

      // 3. Queue Token
      const queueRes = await request(app)
        .post('/api/v1/scheduling/queue')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: journeyPatientId,
          branchId,
          departmentId,
          doctorId,
          appointmentId,
        });
      expect(queueRes.status).toBe(201);
      expect(queueRes.body.data.tokenNumber).toBeDefined();

      // 4. Start OPD Encounter
      const encRes = await request(app)
        .post('/api/v1/opd/encounters')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: journeyPatientId,
          doctorId,
          branchId,
          departmentId,
          appointmentId,
          type: 'CONSULTATION',
        });
      expect(encRes.status).toBe(201);
      const encounterId = encRes.body.data.id;

      // 5. Record SOAP & E-Prescription
      await request(app)
        .post(`/api/v1/opd/encounters/${encounterId}/soap`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          subjective: 'Acute productive cough and pharyngitis for 3 days',
          objective: 'Hyperemic posterior pharynx, temp 38.2C',
          assessment: 'Acute streptococcal pharyngitis',
          plan: 'Oral amoxicillin course, symptomatic analgesia',
        });

      const rxRes = await request(app)
        .post(`/api/v1/opd/encounters/${encounterId}/prescriptions`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: testProductId,
              medicineName: 'Amoxicillin Trihydrate 500mg',
              dosage: '500mg',
              frequency: 'TID',
              durationDays: 7,
              quantity: 21,
            },
          ],
        });
      expect(rxRes.status).toBe(201);
      const prescriptionId = rxRes.body.data.id;

      // 6. Pharmacy Dispense
      const dispenseRes = await request(app)
        .post('/api/v1/pharmacy/dispense')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prescriptionId,
          locationId: pharmacyLocationId,
          items: [
            {
              prescriptionItemId: rxRes.body.data.items[0].id,
              productId: testProductId,
              batchId: testBatchId,
              quantity: 21,
              unitPrice: 12.5,
            },
          ],
        });
      expect([200, 201]).toContain(dispenseRes.status);
      expect(dispenseRes.body.success).toBe(true);

      // 7. Auto / Manual Invoice Generation for Pharmacy & Consult
      const billRes = await request(app)
        .post('/api/v1/billing/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: journeyPatientId,
          billType: 'OPD',
          items: [
            {
              serviceCode: 'CONS-OPD',
              description: 'General OPD Consultation',
              category: 'CONSULTATION',
              quantity: 1,
              unitPrice: 100.0,
              discountAmount: 0.0,
              taxAmount: 0.0,
            },
            {
              serviceCode: 'MED-AMOX-500',
              description: 'Amoxicillin Trihydrate 500mg x 21',
              category: 'PHARMACY',
              quantity: 21,
              unitPrice: 12.5,
              discountAmount: 0.0,
              taxAmount: 0.0,
            },
          ],
        });
      expect(billRes.status).toBe(201);
      const opdBillId = billRes.body.data.id;

      // Finalize Invoice
      const finalizeRes = await request(app)
        .post(`/api/v1/billing/bills/${opdBillId}/finalize`)
        .set('Authorization', `Bearer ${token}`);
      expect(finalizeRes.status).toBe(200);
      expect(finalizeRes.body.data.status).toBe('INVOICED');

      // 8. Payment Processed
      const payRes = await request(app)
        .post(`/api/v1/billing/bills/${opdBillId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 362.5, // 100 + 262.5
          paymentMode: 'UPI',
          referenceNumber: 'UPI-TRANS-9812401',
        });
      expect(payRes.status).toBe(201);
      expect(payRes.body.data.bill.status).toBe('PAID');
      const opdPaymentId = payRes.body.data.payment.id;

      // 9. Receipt PDF Stream
      const receiptPdfRes = await request(app)
        .get(`/api/v1/billing/payments/${opdPaymentId}/receipt-pdf`)
        .set('Authorization', `Bearer ${token}`);
      expect(receiptPdfRes.status).toBe(200);
      expect(receiptPdfRes.header['content-type']).toContain('application/pdf');
      expect(receiptPdfRes.body.slice(0, 5).toString('utf-8')).toBe('%PDF-');
    }, 60000);

    // Journey 5.2: Diagnostics Journey
    it('Journey B: Diagnostics: order -> collect -> result -> validate -> critical alert -> report PDF -> visible in Patient 360', async () => {
      // 1. Clinician orders diagnostic tests
      const orderRes = await request(app)
        .post('/api/v1/laboratory/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          doctorId,
          priority: 'URGENT',
          clinicalNotes: 'Cardiac enzyme workup for chest pain',
          items: [
            {
              testName: 'High-Sensitivity Troponin I',
              testCode: 'LAB-TROP-I',
              sampleType: 'PLASMA',
            },
          ],
        });
      expect(orderRes.status).toBe(201);
      const labItemId = orderRes.body.data.items[0].id;

      // 2. Accessioner collects specimen
      const collectRes = await request(app)
        .post('/api/v1/laboratory/samples/collect')
        .set('Authorization', `Bearer ${token}`)
        .send({
          orderItemId: labItemId,
          specimenType: 'HEPARIN_PLASMA',
          container: 'GREEN_TOP_TUBE',
        });
      expect(collectRes.status).toBe(201);
      const jSampleId = collectRes.body.data.id;

      // 3. Technologist enters results with high critical value
      const resultRes = await request(app)
        .post(`/api/v1/laboratory/samples/${jSampleId}/results`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          results: [
            {
              parameter: 'Troponin I (hs-cTnI)',
              numericValue: 420.0,
              unit: 'ng/L',
              referenceRange: '0.0 - 14.0',
              isCritical: true,
              criticalMessage: 'PANIC ALERT: Troponin I 420.0 ng/L indicates acute myocardial injury',
            },
          ],
        });
      expect(resultRes.status).toBe(201);
      expect(resultRes.body.data.criticalTriggered).toBe(true);

      // 4. Critical Alert acknowledged
      const alertsRes = await request(app)
        .get('/api/v1/laboratory/critical-results')
        .set('Authorization', `Bearer ${token}`);
      const jAlert = alertsRes.body.data.find((a: any) => a.sampleId === jSampleId);
      expect(jAlert).toBeDefined();

      await request(app)
        .post(`/api/v1/laboratory/critical-results/${jAlert.id}/acknowledge`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actionTaken: 'Attending cardiologist alerted to activate cath lab' });

      // 5. Pathologist Validates
      const validateRes = await request(app)
        .post(`/api/v1/laboratory/samples/${jSampleId}/validate`)
        .set('Authorization', `Bearer ${token}`);
      expect(validateRes.status).toBe(200);
      expect(validateRes.body.data.status).toBe('VERIFIED');

      // 6. Report PDF Generated
      const pdfRes = await request(app)
        .get(`/api/v1/laboratory/samples/${jSampleId}/report-pdf`)
        .set('Authorization', `Bearer ${token}`);
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.header['content-type']).toContain('application/pdf');

      // 7. Visible in Patient 360 (Patient Timeline & Investigations list)
      const patientRes = await request(app)
        .get(`/api/v1/patients/${patientId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(patientRes.status).toBe(200);
      expect(patientRes.body.data.id).toBe(patientId);
    }, 60000);

    // Journey 5.3: Insurance Journey
    it('Journey C: Insurance: pre-auth -> claim -> settlement', async () => {
      // 1. Create Provider & Policy
      const provRes = await request(app)
        .post('/api/v1/insurance/providers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Blue Cross Shield Network',
          code: `BCS-${Date.now()}`,
          payerId: 'PAY-BCS-001',
          contactPerson: 'David Miller',
          email: 'auth@bcs-network.example.com',
          phone: '+18005550188',
        });
      const providerId = provRes.body.data.id;

      const polRes = await request(app)
        .post('/api/v1/insurance/policies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          providerId,
          policyNumber: `BCS-POL-${Date.now().toString().slice(-8)}`,
          sumInsured: 75000.0,
          validFrom: '2025-01-01',
          validTo: '2027-12-31',
        });
      const policyId = polRes.body.data.id;

      // 2. Pre-auth Request & Approval
      const preAuthRes = await request(app)
        .post('/api/v1/insurance/pre-auth')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          providerId,
          policyId,
          requestedAmount: 3500.0,
          approvedAmount: 3200.0,
          status: 'APPROVED',
          preAuthNumber: `PA-BCS-${Date.now()}`,
          treatmentDetails: 'Urgent cardiac catheterization and stent placement',
        });
      expect(preAuthRes.status).toBe(201);
      expect(preAuthRes.body.data.status).toBe('APPROVED');

      // 3. Bill Creation
      const billRes = await request(app)
        .post('/api/v1/billing/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          billType: 'OPD',
          items: [
            {
              serviceCode: 'CARDIO-CATH',
              description: 'Cardiac Catheterization Procedure',
              category: 'SURGERY',
              quantity: 1,
              unitPrice: 3500.0,
              discountAmount: 0.0,
              taxAmount: 0.0,
            },
          ],
        });
      const cathBillId = billRes.body.data.id;

      // 4. Claim Creation & Submission
      const claimRes = await request(app)
        .post('/api/v1/insurance/claims')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          providerId,
          billId: cathBillId,
          policyNumber: polRes.body.data.policyNumber,
          claimAmount: 3500.0,
          preAuthNumber: preAuthRes.body.data.preAuthNumber,
          diagnosisNotes: 'Acute coronary syndrome managed successfully',
        });
      expect(claimRes.status).toBe(201);
      expect(claimRes.body.data.status).toBe('SUBMITTED');
      const claimId = claimRes.body.data.id;

      // 5. Claim Adjudication & Settlement
      const settleRes = await request(app)
        .post(`/api/v1/insurance/claims/${claimId}/settle`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          settledAmount: 3200.0,
          coPayAmount: 300.0,
          settlementDate: new Date().toISOString(),
          paymentReference: 'WIRE-BCS-CLAIM-9921',
          notes: 'Full pre-authorized sum disbursed; co-pay collected from patient',
        });
      expect(settleRes.status).toBe(200);
      expect(settleRes.body.data.status).toBe('PARTIALLY_SETTLED');
      expect(settleRes.body.data.settlement.settledAmount).toBe(3200.0);
    }, 60000);
  });

  // =========================================================================
  // SUITE 6: ENTITLEMENT MATRIX ENFORCEMENT
  // =========================================================================
  describe('6. Entitlement Matrix Enforcement on Disabled Modules', () => {
    let disabledTenantId: string;
    let disabledTenantToken: string;

    beforeAll(async () => {
      const dTenant = await prisma.tenant.upsert({
        where: { code: 'TEST-ENTITLEMENT-MINIMAL' },
        update: {},
        create: { name: 'Restricted Clinic', code: 'TEST-ENTITLEMENT-MINIMAL' },
      });
      disabledTenantId = dTenant.id;

      // Only enable 'patients', leaving billing, insurance, laboratory, radiology disabled
      await prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId: disabledTenantId, moduleId: 'patients' } },
        update: { enabled: true },
        create: { tenantId: disabledTenantId, moduleId: 'patients', enabled: true },
      });

      // Explicitly disable Workstream F modules
      for (const mod of ['billing', 'insurance', 'laboratory', 'radiology']) {
        await prisma.tenantEntitlement.upsert({
          where: { tenantId_moduleId: { tenantId: disabledTenantId, moduleId: mod } },
          update: { enabled: false },
          create: { tenantId: disabledTenantId, moduleId: mod, enabled: false },
        });
      }

      const dUser = await prisma.user.upsert({
        where: { email: 'admin@restricted-clinic.com' },
        update: {},
        create: {
          tenantId: disabledTenantId,
          email: 'admin@restricted-clinic.com',
          passwordHash: await authService.hashPassword('Pass123!'),
          firstName: 'Restricted',
          lastName: 'User',
        },
      });

      disabledTenantToken = authService.generateAccessToken({
        userId: dUser.id,
        tenantId: disabledTenantId,
        email: dUser.email,
        roles: ['HospitalAdmin'],
        permissions: ['*'],
      });
    });

    it('billing disabled: GET /api/v1/billing/bills returns 404 MODULE_NOT_ENABLED', async () => {
      const res = await request(app)
        .get('/api/v1/billing/bills')
        .set('Authorization', `Bearer ${disabledTenantToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MODULE_NOT_ENABLED');
      expect(res.body.error.message).toContain('billing');
    });

    it('insurance disabled: GET /api/v1/insurance/providers returns 404 MODULE_NOT_ENABLED', async () => {
      const res = await request(app)
        .get('/api/v1/insurance/providers')
        .set('Authorization', `Bearer ${disabledTenantToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MODULE_NOT_ENABLED');
      expect(res.body.error.message).toContain('insurance');
    });

    it('laboratory disabled: GET /api/v1/laboratory/worklist returns 404 MODULE_NOT_ENABLED', async () => {
      const res = await request(app)
        .get('/api/v1/laboratory/worklist')
        .set('Authorization', `Bearer ${disabledTenantToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MODULE_NOT_ENABLED');
      expect(res.body.error.message).toContain('laboratory');
    });

    it('radiology disabled: GET /api/v1/radiology/worklist returns 404 MODULE_NOT_ENABLED', async () => {
      const res = await request(app)
        .get('/api/v1/radiology/worklist')
        .set('Authorization', `Bearer ${disabledTenantToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MODULE_NOT_ENABLED');
      expect(res.body.error.message).toContain('radiology');
    });
  });
});
