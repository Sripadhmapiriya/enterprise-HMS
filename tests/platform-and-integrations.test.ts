import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../apps/api/src/index';
import { prisma } from '../packages/database/src/index';
import { authService } from '../apps/api/src/services/authService';
import { entitlementService } from '../apps/api/src/services/entitlementService';
import { pdfEngine } from '../apps/api/src/services/pdf-engine';

describe('Workstream I: Analytics, Integrations, Enterprise Admin & Platform Services', () => {
  let tenantId: string;
  let hospitalId: string;
  let authToken: string;
  let patientId: string;
  let encounterId: string;

  beforeAll(async () => {
    // 1. Create Tenant
    const tenant = await prisma.tenant.upsert({
      where: { code: 'TEST-PLATFORM-TENANT' },
      update: {},
      create: {
        name: 'Enterprise Platform Test Hospital',
        code: 'TEST-PLATFORM-TENANT',
      },
    });
    tenantId = tenant.id;

    // 2. Create Hospital & Branch
    const hosp =
      (await prisma.hospital.findFirst({ where: { tenantId } })) ||
      (await prisma.hospital.create({
        data: {
          tenantId,
          name: 'Platform Central Medical Center',
          city: 'Metropolis',
          country: 'USA',
          timezone: 'America/New_York',
          currency: 'USD',
        },
      }));
    hospitalId = hosp.id;

    // 3. Create Admin User with Full Permissions
    const user = await prisma.user.upsert({
      where: { email: 'platform-admin@enterprise-hms.com' },
      update: {},
      create: {
        tenantId,
        email: 'platform-admin@enterprise-hms.com',
        passwordHash: await authService.hashPassword('Platform123!'),
        firstName: 'System',
        lastName: 'Architect',
      },
    });

    authToken = authService.generateAccessToken({
      userId: user.id,
      tenantId,
      email: user.email,
      roles: ['HospitalAdmin'],
      permissions: [
        'analytics.view',
        'integrations.manage',
        'enterprise.manage',
        'enterprise.modules.read',
        'enterprise.modules.manage',
        'patients.read',
        'patients.create',
      ],
      hospitalId,
    });

    // 4. Enable Workstream I modules
    await entitlementService.setTenantModules(tenantId, [
      'analytics',
      'integrations',
      'enterprise',
      'patients',
      'opd',
      'billing',
    ]);

    // 5. Seed Branch, Department, Doctor
    const branch =
      (await prisma.branch.findFirst({ where: { hospitalId } })) ||
      (await prisma.branch.create({
        data: {
          hospitalId,
          name: 'Platform Main Campus',
          code: `BR-PLT-${Date.now()}`,
        },
      }));

    const dept =
      (await prisma.department.findFirst({ where: { branchId: branch.id } })) ||
      (await prisma.department.create({
        data: {
          branchId: branch.id,
          name: 'General Medicine',
          code: `DEPT-MED-${Date.now()}`,
        },
      }));

    const doctor =
      (await prisma.doctor.findFirst({ where: { branchId: branch.id } })) ||
      (await prisma.doctor.create({
        data: {
          userId: user.id,
          branchId: branch.id,
          departmentId: dept.id,
          specialization: 'Internal Medicine',
          licenseNumber: `DOC-LIC-${Date.now()}`,
        },
      }));

    // 6. Seed Test Patient & Encounter
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        hospitalId,
        mrn: `MRN-PLT-${Date.now()}`,
        firstName: 'Alice',
        lastName: 'Walker',
        gender: 'FEMALE',
        dateOfBirth: new Date('1990-08-14'),
        mobile: '+15559876543',
        email: 'alice.walker@example.com',
      },
    });
    patientId = patient.id;

    const encounter = await prisma.encounter.create({
      data: {
        tenantId,
        hospitalId,
        branchId: branch.id,
        departmentId: dept.id,
        doctorId: doctor.id,
        patientId,
        type: 'AMBULATORY',
        status: 'IN_PROGRESS',
      },
    });
    encounterId = encounter.id;
  }, 30000);

  // ==========================================
  // 1. ANALYTICS MODULE TESTS
  // ==========================================

  describe('Analytics & MIS Module', () => {
    it('GET /api/v1/analytics/kpis returns clinical and financial scorecards', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/kpis')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.clinical).toBeDefined();
      expect(res.body.data.clinical.averageLengthOfStayDays).toBeGreaterThan(0);
      expect(res.body.data.financial).toBeDefined();
      expect(res.body.data.financial.collectionRatioPercent).toBeDefined();
    });

    it('GET /api/v1/analytics/mis-pack returns comprehensive monthly pack', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/mis-pack')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.departments)).toBe(true);
      expect(Array.isArray(res.body.data.topMedications)).toBe(true);
      expect(Array.isArray(res.body.data.topLabTests)).toBe(true);
      expect(res.body.data.hospitalTurnaround.averageOpdWaitMinutes).toBeDefined();
    });

    it('GET /api/v1/analytics/trends returns 7-day operational timeline', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/trends?days=7')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(7);
      expect(res.body.data[0].opdVisits).toBeDefined();
      expect(res.body.data[0].revenue).toBeDefined();
    });

    it('POST /api/v1/analytics/export generates CSV and queued async exports', async () => {
      // 1. Synchronous CSV export
      const csvRes = await request(app)
        .post('/api/v1/analytics/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reportType: 'MIS_PACK', format: 'csv', async: false });

      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toContain('text/csv');
      expect(csvRes.text).toContain('ReportType');

      // 2. Asynchronous export via worker queue
      const asyncRes = await request(app)
        .post('/api/v1/analytics/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reportType: 'FINANCIAL_SUMMARY', format: 'json', async: true });

      expect(asyncRes.status).toBe(202);
      expect(asyncRes.body.data.id).toBeDefined();
      expect(asyncRes.body.data.jobType).toBe('report_generation');
    });
  });

  // ==========================================
  // 2. INTEGRATIONS MODULE TESTS
  // ==========================================

  describe('Integrations & Interoperability Module', () => {
    it('GET /api/v1/integrations/status returns adapter registry status', async () => {
      const res = await request(app)
        .get('/api/v1/integrations/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.adapters.length).toBeGreaterThanOrEqual(5);
      const abdmAdapter = res.body.data.adapters.find((a: any) => a.id === 'abdm');
      expect(abdmAdapter).toBeDefined();
      expect(abdmAdapter.isSimulator).toBe(true);
    });

    it('ABDM M1/M2 Flow: generate ABHA, verify OTP, and link Care Context', async () => {
      // Step 1: Request OTP for ABHA generation
      const genRes = await request(app)
        .post('/api/v1/integrations/abdm/generate-abha')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          aadhaarOrMobile: '998877665544',
          name: 'Jane Doe',
          gender: 'FEMALE',
          yearOfBirth: '1995',
        });

      expect(genRes.status).toBe(200);
      expect(genRes.body.data.txnId).toBeDefined();
      expect(genRes.body.data.otpSent).toBe(true);

      const txnId = genRes.body.data.txnId;

      // Step 2: Verify OTP (using sandbox OTP 123456)
      const verifyRes = await request(app)
        .post('/api/v1/integrations/abdm/verify-otp')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ txnId, otp: '123456' });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.verified).toBe(true);
      expect(verifyRes.body.data.abhaNumber).toBeDefined();
      expect(verifyRes.body.data.abhaAddress).toContain('@abdm');

      const abhaAddress = verifyRes.body.data.abhaAddress;

      // Step 3: Link Care Context
      const linkRes = await request(app)
        .post('/api/v1/integrations/abdm/link-care-context')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          abhaAddress,
          patientId,
          encounterId,
          careContextReference: `ENC-${encounterId}`,
          display: 'General OPD Consultation Consultation Visit',
        });

      expect(linkRes.status).toBe(200);
      expect(linkRes.body.data.success).toBe(true);
      expect(linkRes.body.data.linkRefNumber).toBeDefined();
    });

    it('HL7 FHIR R4: serialize Patient resource and parse Bundle', async () => {
      // 1. Query FHIR Patient
      const fhirRes = await request(app)
        .get(`/api/v1/integrations/fhir/r4/Patient/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(fhirRes.status).toBe(200);
      expect(fhirRes.headers['content-type']).toContain('application/fhir+json');
      expect(fhirRes.body.resourceType).toBe('Patient');
      expect(fhirRes.body.id).toBe(patientId);
      expect(fhirRes.body.name[0].given[0]).toBe('Alice');

      // 2. Submit FHIR Bundle
      const bundleRes = await request(app)
        .post('/api/v1/integrations/fhir/r4/Bundle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resourceType: 'Bundle',
          type: 'transaction',
          entry: [
            { resource: { resourceType: 'Patient', id: 'p1' } },
            { resource: { resourceType: 'Observation', id: 'o1' } },
          ],
        });

      expect(bundleRes.status).toBe(200);
      expect(bundleRes.body.resourceType).toBe('Bundle');
      expect(bundleRes.body.meta.processedResources.Patient).toBe(1);
      expect(bundleRes.body.meta.processedResources.Observation).toBe(1);
    });

    it('HL7 v2: parse ADT and ORU messages and generate ADT^A01 string', async () => {
      const sampleHl7 =
        'MSH|^~\\&|LAB|HOSP|ENTERPRISE|HMS|20261005120000||ORU^R01|MSG001|P|2.5\r' +
        'PID|1||MRN-999||Smith^John||19850512|M\r' +
        'OBX|1|NM|HGB^Hemoglobin||14.2|g/dL|12.0-15.5|N';

      const parseRes = await request(app)
        .post('/api/v1/integrations/hl7/v2/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: sampleHl7 });

      expect(parseRes.status).toBe(200);
      expect(parseRes.body.data.messageType).toBe('ORU');
      expect(parseRes.body.data.patient.lastName).toBe('Smith');
      expect(parseRes.body.data.observations[0].testName).toBe('Hemoglobin');
      expect(parseRes.body.data.observations[0].value).toBe('14.2');
    });

    it('Laboratory Analyzer Feed: processes automated instrument results and flags critical values', async () => {
      const feedRes = await request(app)
        .post('/api/v1/integrations/analyzers/feed')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          analyzerId: 'ROCHE-COBAS-6000',
          analyzerModel: 'Automated Clinical Chemistry Analyzer',
          sampleBarcode: 'SMP-2026-8812',
          results: [
            { parameterCode: 'GLU', parameterName: 'Glucose', value: 95, unit: 'mg/dL', referenceRange: '70-140' },
            { parameterCode: 'POT', parameterName: 'Potassium', value: 7.2, unit: 'mmol/L', referenceRange: '3.5-5.0', criticalHigh: 6.5 },
          ],
        });

      expect(feedRes.status).toBe(201);
      expect(feedRes.body.data.sampleBarcode).toBe('SMP-2026-8812');
      expect(feedRes.body.data.criticalValuesFlagged).toBe(1);
      expect(feedRes.body.data.status).toBe('CRITICAL_ALERT_TRIGGERED');
    });

    it('Payment Gateway: create order and simulate verified payment', async () => {
      const orderRes = await request(app)
        .post('/api/v1/integrations/payments/create-order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invoiceId: 'INV-TEST-001', amount: 250 });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.data.orderId).toBeDefined();

      const orderId = orderRes.body.data.orderId;

      const verifyRes = await request(app)
        .post('/api/v1/integrations/payments/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ orderId, paymentId: 'pay_sim_99182', signature: 'sig_sim_valid' });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.verified).toBe(true);
      expect(verifyRes.body.data.status).toBe('CAPTURED');
    });
  });

  // ==========================================
  // 3. ENTERPRISE ADMIN MODULE TESTS
  // ==========================================

  describe('Enterprise Multi-Hospital Admin Module', () => {
    it('GET /api/v1/enterprise/hospitals lists network facilities', async () => {
      const res = await request(app)
        .get('/api/v1/enterprise/hospitals')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/enterprise/hospitals registers new network facility', async () => {
      const res = await request(app)
        .post('/api/v1/enterprise/hospitals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'St. Jude Trauma & Surgical Wing',
          city: 'Chicago',
          state: 'IL',
          currency: 'USD',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('St. Jude Trauma & Surgical Wing');
      expect(res.body.data.mainBranchId).toBeDefined();
    });

    it('GET /api/v1/enterprise/cross-site-metrics aggregates network capacity', async () => {
      const res = await request(app)
        .get('/api/v1/enterprise/cross-site-metrics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.networkOverview.totalHospitals).toBeGreaterThanOrEqual(1);
      expect(res.body.data.networkOverview.totalLicensedBeds).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 4. PLATFORM SERVICES TESTS
  // ==========================================

  describe('Platform Services (Worker, Storage, Notifications, Import, PDF)', () => {
    it('Worker Queue: enqueues background job and queries status', async () => {
      const enqueueRes = await request(app)
        .post('/api/v1/platform/jobs/enqueue')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobType: 'reminders',
          payload: { appointmentIds: ['apt-1', 'apt-2'], channel: 'SMS' },
        });

      expect(enqueueRes.status).toBe(202);
      expect(enqueueRes.body.data.id).toBeDefined();

      const jobId = enqueueRes.body.data.id;

      const statusRes = await request(app)
        .get(`/api/v1/platform/jobs/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.jobType).toBe('reminders');
    });

    it('File Storage: generates presigned URL, validates MIME, and rejects EICAR virus scan', async () => {
      // 1. Presigned upload URL
      const urlRes = await request(app)
        .post('/api/v1/platform/files/upload-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          filename: 'chest-xray.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024 * 500,
        });

      expect(urlRes.status).toBe(200);
      expect(urlRes.body.data.uploadUrl).toBeDefined();
      expect(urlRes.body.data.key).toContain('tenants/');

      // 2. Direct upload valid file
      const validContent = Buffer.from('Valid PDF Document Data').toString('base64');
      const uploadRes = await request(app)
        .post('/api/v1/platform/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          filename: 'report.pdf',
          mimeType: 'application/pdf',
          content: validContent,
        });

      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.data.virusScanPassed).toBe(true);

      // 3. Virus scan rejection on EICAR test signature
      const eicarString = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
      const infectedContent = Buffer.from(eicarString).toString('base64');
      const infectedRes = await request(app)
        .post('/api/v1/platform/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          filename: 'infected.pdf',
          mimeType: 'application/pdf',
          content: infectedContent,
        });

      expect(infectedRes.status).toBe(422);
      expect(infectedRes.body.error.code).toBe('VIRUS_DETECTED');
    });

    it('Notifications: dispatches across channels and checks simulator outbox', async () => {
      // 1. In-App Notification
      const inAppRes = await request(app)
        .post('/api/v1/platform/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientId: 'user-doc-01',
          title: 'Critical Lab Result Ready',
          message: 'Potassium 7.2 mmol/L flagged for Patient Alice Walker',
          channel: 'IN_APP',
          priority: 'CRITICAL',
        });

      expect(inAppRes.status).toBe(201);
      const notifId = inAppRes.body.data.notificationId;

      // 2. Query in-app notification & mark as read
      const listRes = await request(app)
        .get('/api/v1/platform/notifications?recipientId=user-doc-01')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

      const readRes = await request(app)
        .put(`/api/v1/platform/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(readRes.status).toBe(200);

      // 3. External SMS/WhatsApp Notification to Simulator Outbox
      await request(app)
        .post('/api/v1/platform/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientId: 'patient-alice',
          recipientContact: '+15559876543',
          title: 'Appointment Reminder',
          message: 'Reminder: Doctor appointment at 10:00 AM tomorrow',
          channel: 'SMS',
        });

      const outboxRes = await request(app)
        .get('/api/v1/platform/notifications/simulator-outbox')
        .set('Authorization', `Bearer ${authToken}`);

      expect(outboxRes.status).toBe(200);
      expect(outboxRes.body.data.length).toBeGreaterThanOrEqual(1);
      const smsLog = outboxRes.body.data.find((l: any) => l.channel === 'SMS');
      expect(smsLog).toBeDefined();
      expect(smsLog.recipientContact).toBe('+15559876543');
    });

    it('CSV Import Tool: parses CSV, generates discrepancy validation report, and commits records', async () => {
      // CSV containing 2 valid patients and 1 invalid row (bad DOB and gender)
      const testCsv =
        'mrn,firstName,lastName,gender,dateOfBirth,mobile,email,bloodGroup\n' +
        'MRN-IMPORT-1,David,Miller,MALE,1984-06-12,+15551239999,david.m@test.com,O_POSITIVE\n' +
        'MRN-IMPORT-2,Sarah,Connor,FEMALE,1990-11-20,+15551238888,sarah.c@test.com,A_POSITIVE\n' +
        'INVALID-ROW,Bob,Invalid,UNKNOWN_GENDER,invalid-date,123,,';

      // 1. Dry run validate
      const valRes = await request(app)
        .post('/api/v1/platform/import/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ domain: 'patients', csvContent: testCsv });

      expect(valRes.status).toBe(200);
      expect(valRes.body.data.totalRows).toBe(3);
      expect(valRes.body.data.validRows).toBe(2);
      expect(valRes.body.data.invalidRows).toBe(1);
      expect(valRes.body.data.errors.length).toBeGreaterThanOrEqual(1);

      // 2. Commit valid rows
      const commitRes = await request(app)
        .post('/api/v1/platform/import/commit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ domain: 'patients', csvContent: testCsv, hospitalId });

      expect(commitRes.status).toBe(200);
      expect(commitRes.body.data.importedCount).toBe(2);

      // Verify records in DB
      const importedPatient = await prisma.patient.findFirst({
        where: { tenantId, mrn: 'MRN-IMPORT-1' },
      });
      expect(importedPatient).toBeDefined();
      expect(importedPatient?.firstName).toBe('David');
    });

    it('PDF Engine: generates valid binary PDF documents for all 8 templates', async () => {
      const templates: Array<
        | 'invoice'
        | 'receipt'
        | 'prescription'
        | 'lab_report'
        | 'radiology_report'
        | 'discharge_summary'
        | 'wristband'
        | 'barcode_label'
      > = [
        'invoice',
        'receipt',
        'prescription',
        'lab_report',
        'radiology_report',
        'discharge_summary',
        'wristband',
        'barcode_label',
      ];

      for (const t of templates) {
        const buffer = await pdfEngine.generatePdf({
          template: t,
          hospitalName: 'Platform Central Medical Center',
          data: {
            patientName: 'Alice Walker',
            mrn: 'MRN-PLT-1001',
            invoiceNumber: 'INV-2026-901',
            receiptNumber: 'REC-2026-901',
            sampleId: 'SMP-2026-901',
          },
        });

        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(500); // Valid PDF length
        // PDF magic header %PDF-
        expect(buffer.toString('utf-8', 0, 5)).toContain('%PDF-');
      }
    });
  });

  // ==========================================
  // 5. TENANT ENTITLEMENT MATRIX ENFORCEMENT
  // ==========================================

  describe('Tenant Entitlement Matrix Enforcement', () => {
    it('returns 404 MODULE_NOT_ENABLED when module is toggled off for tenant', async () => {
      // Temporarily disable 'analytics' module for this tenant
      await entitlementService.setTenantModules(tenantId, ['integrations', 'enterprise', 'patients']);

      const res = await request(app)
        .get('/api/v1/analytics/kpis')
        .set('Authorization', `Bearer ${authToken}`);

      // Must return 404 MODULE_NOT_ENABLED to hide module existence
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MODULE_NOT_ENABLED');

      // Re-enable analytics module
      await entitlementService.setTenantModules(tenantId, [
        'analytics',
        'integrations',
        'enterprise',
        'patients',
      ]);

      const recheck = await request(app)
        .get('/api/v1/analytics/kpis')
        .set('Authorization', `Bearer ${authToken}`);

      expect(recheck.status).toBe(200);
      expect(recheck.body.success).toBe(true);
    });
  });
});
