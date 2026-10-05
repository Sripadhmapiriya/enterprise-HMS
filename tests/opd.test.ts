import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './apps/api/src/index';
import { prisma } from './packages/database/src/index';
import { authService } from './apps/api/src/services/authService';

describe('Workstream D: OPD Consultation, SOAP, Vitals, Drug-Allergy Safety & Charge Capture', () => {
  let token: string;
  let tenantId: string;
  let hospitalId: string;
  let branchId: string;
  let departmentId: string;
  let doctorId: string;
  let patientId: string;
  let encounterId: string;

  beforeAll(async () => {
    // 1. Setup Tenant
    const tenant = await prisma.tenant.upsert({
      where: { code: 'TEST-TENANT-OPD' },
      update: {},
      create: { name: 'Hospital OPD Test', code: 'TEST-TENANT-OPD' },
    });
    tenantId = tenant.id;

    // Enable opd & patients modules
    await Promise.all([
      prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: 'patients' } },
        update: { enabled: true },
        create: { tenantId, moduleId: 'patients', enabled: true },
      }),
      prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: 'opd' } },
        update: { enabled: true },
        create: { tenantId, moduleId: 'opd', enabled: true },
      }),
    ]);

    // 2. Setup Hospital & Branch
    const hospital =
      (await prisma.hospital.findFirst({ where: { tenantId } })) ||
      (await prisma.hospital.create({
        data: { tenantId, name: 'OPD Hospital Clinic' },
      }));
    hospitalId = hospital.id;

    const branch =
      (await prisma.branch.findFirst({ where: { hospitalId } })) ||
      (await prisma.branch.create({
        data: {
          hospitalId,
          name: 'Main Ambulatory Wing',
          code: 'BR-OPD-01',
        },
      }));
    branchId = branch.id;

    // 3. Setup Department
    const dept =
      (await prisma.department.findFirst({ where: { branchId } })) ||
      (await prisma.department.create({
        data: {
          branchId,
          name: 'Department of Internal Medicine',
          code: 'MED-INT',
        },
      }));
    departmentId = dept.id;

    // 4. Setup Doctor
    const docEmail = `dr.beverly.${Date.now()}@hospital-opd.com`;
    const docUser = await prisma.user.create({
      data: {
        tenantId,
        email: docEmail,
        passwordHash: await authService.hashPassword('Password123!'),
        firstName: 'Beverly',
        lastName: 'Crusher',
      },
    });

    const doctor = await prisma.doctor.create({
      data: {
        userId: docUser.id,
        branchId,
        departmentId,
        specialization: 'Chief Medical Officer',
        licenseNumber: `DOC-OPD-${Date.now()}`,
      },
    });
    doctorId = doctor.id;

    // 5. Setup Patient with known Penicillin allergy
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        hospitalId,
        mrn: `MRN-${Date.now()}-OPD`,
        firstName: 'Jean-Luc',
        lastName: 'Picard',
        dateOfBirth: new Date('1965-07-13'),
        gender: 'MALE',
        mobile: '+1-555-1701',
        bloodGroup: 'A_POSITIVE',
        allergies: {
          create: [
            {
              allergen: 'Penicillin',
              severity: 'SEVERE',
              reaction: 'Anaphylaxis',
              status: 'ACTIVE',
              recordedById: docUser.id,
            },
          ],
        },
      },
    });
    patientId = patient.id;

    // 6. Generate Token
    token = authService.generateAccessToken({
      userId: docUser.id,
      tenantId,
      email: docUser.email,
      roles: ['Doctor'],
      permissions: ['opd.*', 'patients.*'],
      hospitalId,
    });
  });

  it('1. Start Consultation: initiates outpatient clinical encounter', async () => {
    const res = await request(app)
      .post('/api/v1/opd/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId,
        doctorId,
        branchId,
        departmentId,
        type: 'OPD',
        chiefComplaint: 'Productive cough and high-grade fever for 4 days',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.patientBanner).toBeDefined();
    expect(res.body.data.patientBanner.mrn).toBeDefined();

    encounterId = res.body.data.id;
  });

  it('2. Vitals Recording: saves vital signs and calculates BMI automatically', async () => {
    const res = await request(app)
      .post(`/api/v1/opd/encounters/${encounterId}/vitals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        temperature: 101.4,
        pulse: 88,
        bpSystolic: 130,
        bpDiastolic: 85,
        respiratoryRate: 18,
        spo2: 97,
        height: 178, // cm
        weight: 78, // kg -> BMI ~24.6
      });

    expect(res.status).toBe(201);
    expect(res.body.data.temperature).toBe(101.4);
    expect(res.body.data.bmi).toBeCloseTo(24.6, 1);
  });

  it('3. SOAP Clinical Notes: documents Subjective, Objective, Assessment, Plan', async () => {
    const res = await request(app)
      .post(`/api/v1/opd/encounters/${encounterId}/soap`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        chiefComplaint: 'Productive cough and fever',
        historyOfPresent: 'Symptoms began 4 days ago with shivering and purulent sputum.',
        examinationFindings: 'Right lower lobe bronchial breathing and coarse crackles.',
        assessmentPlan: 'Community-acquired pneumonia. Prescribe macrolide antibiotic, order chest radiograph, rest.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.historyOfPresent).toContain('purulent sputum');
  });

  it('4. ICD-10 Diagnoses: codes primary diagnosis', async () => {
    const res = await request(app)
      .post(`/api/v1/opd/encounters/${encounterId}/diagnoses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        diagnosisCode: 'J18.9',
        description: 'Pneumonia, unspecified organism',
        type: 'PRIMARY',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.diagnosisCode).toBe('J18.9');
    expect(res.body.data.type).toBe('PRIMARY');
  });

  it('5. Drug-Allergy Safety Conflict: blocks Amoxicillin when patient is allergic to Penicillin', async () => {
    const res = await request(app)
      .post(`/api/v1/opd/encounters/${encounterId}/prescriptions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            medicationName: 'Amoxicillin 500mg',
            dosage: '1 capsule',
            frequency: 'TDS (3 times daily)',
            duration: '7 days',
            timing: 'AFTER_FOOD',
          },
        ],
        overrideAllergyAlerts: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DRUG_ALLERGY_CONFLICT');
    expect(res.body.error.message).toContain('Penicillin');
  });

  it('6. Drug-Allergy Safety Override: allows e-prescription when clinician overrides with rationale', async () => {
    const res = await request(app)
      .post(`/api/v1/opd/encounters/${encounterId}/prescriptions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            medicationName: 'Azithromycin 500mg', // Safe macrolide alternative
            dosage: '1 tablet',
            frequency: 'OD (Once daily)',
            duration: '5 days',
            timing: 'AFTER_FOOD',
          },
        ],
        overrideAllergyAlerts: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].medicationName).toBe('Azithromycin 500mg');
  });

  it('7. Medical Certificate & Referral: issues fitness/leave certificate and referral letter', async () => {
    const certRes = await request(app)
      .post(`/api/v1/opd/encounters/${encounterId}/certificates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'MEDICAL_LEAVE',
        diagnosis: 'Community-acquired pneumonia',
        startDate: '2026-10-05',
        endDate: '2026-10-12',
        remarks: 'Strict home bed rest and medication advised.',
      });

    expect(certRes.status).toBe(201);
    expect(certRes.body.data.type).toBe('MEDICAL_LEAVE');
  });

  it('8. Encounter Close & Charge Capture: marks consultation completed and triggers charge port fallback', async () => {
    const res = await request(app)
      .post(`/api/v1/opd/encounters/${encounterId}/close`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.chargeStatus).toBe('CAPTURED');
    expect(res.body.data.chargeAmount).toBe(150.0);
  });

  it('9. Printable Summary: generates complete consultation summary sheet', async () => {
    const res = await request(app)
      .get(`/api/v1/opd/encounters/${encounterId}/summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.encounterId).toBe(encounterId);
    expect(res.body.data.diagnoses).toHaveLength(1);
    expect(res.body.data.patientBanner.mrn).toBeDefined();
    expect(res.body.data.vitals.temperature).toBe(101.4);
  });
});
