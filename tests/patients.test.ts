import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './apps/api/src/index';
import { prisma } from './packages/database/src/index';
import { authService } from './apps/api/src/services/authService';

describe('Workstream D: Master Patient Index (MPI), Allergies, Alerts, Merge & 360', () => {
  let token: string;
  let tenantId: string;
  let hospitalId: string;
  let patientAId: string;
  let patientBId: string;
  let patientAMrn: string;
  let patientBMrn: string;

  beforeAll(async () => {
    // Setup test tenant and hospital
    const tenant = await prisma.tenant.upsert({
      where: { code: 'TEST-TENANT-MPI' },
      update: {},
      create: { name: 'Hospital MPI Test', code: 'TEST-TENANT-MPI' },
    });
    tenantId = tenant.id;

    // Enable patients module
    await prisma.tenantEntitlement.upsert({
      where: {
        tenantId_moduleId: {
          tenantId,
          moduleId: 'patients',
        },
      },
      update: { enabled: true },
      create: {
        tenantId,
        moduleId: 'patients',
        enabled: true,
      },
    });

    const hospital =
      (await prisma.hospital.findFirst({ where: { tenantId } })) ||
      (await prisma.hospital.create({
        data: { tenantId, name: 'MPI Main Clinic' },
      }));
    hospitalId = hospital.id;

    // Create user with patient permissions
    const user = await prisma.user.upsert({
      where: { email: 'clinical.admin@mpi-hospital.com' },
      update: {},
      create: {
        tenantId,
        email: 'clinical.admin@mpi-hospital.com',
        passwordHash: await authService.hashPassword('Password123!'),
        firstName: 'Sarah',
        lastName: 'Connor',
      },
    });

    token = authService.generateAccessToken({
      userId: user.id,
      tenantId,
      email: user.email,
      roles: ['HospitalAdmin', 'Doctor'],
      permissions: [
        'patients.read',
        'patients.create',
        'patients.update',
        'patients.merge',
        'patients.allergies.create',
        'patients.alerts.create',
      ],
      hospitalId,
    });
  });

  it('1. Quick registration: registers walk-in patient with auto-generated MRN', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        hospitalId,
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-06-15',
        gender: 'MALE',
        mobile: '+1-555-0101',
        bloodGroup: 'O_POSITIVE',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.mrn).toMatch(/^MRN-/);
    expect(res.body.data.firstName).toBe('John');
    expect(res.body.data.lastName).toBe('Doe');
    expect(res.body.data.tenantId).toBe(tenantId);

    patientAId = res.body.data.id;
    patientAMrn = res.body.data.mrn;
  });

  it('2. Full registration: registers comprehensive patient record with emergency contact', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        hospitalId,
        firstName: 'Jonathan',
        lastName: 'Doe',
        dateOfBirth: '1985-06-15',
        gender: 'MALE',
        mobile: '+1-555-0101', // intentionally matching mobile for duplicate check test
        bloodGroup: 'O_POSITIVE',
        email: 'jonathan.doe@example.com',
        address: '100 Medical Center Way',
        city: 'Metro City',
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '+1-555-0102',
        emergencyRelationship: 'SPOUSE',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.emergencyContactName).toBe('Jane Doe');

    patientBId = res.body.data.id;
    patientBMrn = res.body.data.mrn;
  });

  it('3. Duplicate detection: flags potential duplicate based on phone or name', async () => {
    const res = await request(app)
      .get('/api/v1/patients/duplicates')
      .set('Authorization', `Bearer ${token}`)
      .query({
        firstName: 'John',
        lastName: 'Doe',
        mobile: '+1-555-0101',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const mrns = res.body.data.map((p: any) => p.mrn);
    expect(mrns).toContain(patientAMrn);
    expect(mrns).toContain(patientBMrn);
  });

  it('4. Allergy documentation: records Penicillin allergy with severity', async () => {
    const res = await request(app)
      .post(`/api/v1/patients/${patientAId}/allergies`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        allergen: 'Penicillin',
        severity: 'SEVERE',
        reaction: 'Anaphylaxis and facial edema',
        notes: 'Life-threatening allergy documented during triage',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.allergen).toBe('Penicillin');
    expect(res.body.data.severity).toBe('SEVERE');
  });

  it('5. Clinical Alert: records Fall Risk alert visible to all clinicians', async () => {
    const res = await request(app)
      .post(`/api/v1/patients/${patientAId}/alerts`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'High Fall Risk - Bed alarm required',
        severity: 'HIGH',
        alertType: 'CLINICAL',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe('High Fall Risk - Bed alarm required');
    expect(res.body.data.severity).toBe('HIGH');
  });

  it('6. Patient 360 detail: returns persistent banner data, allergies, and alerts', async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${patientAId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(patientAId);
    expect(res.body.data.allergies.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.allergies[0].allergen).toBe('Penicillin');
    expect(res.body.data.alerts.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.alerts[0].description).toContain('Fall Risk');
  });

  it('7. Patient merge: merges duplicate record B into primary record A with audit trail', async () => {
    const res = await request(app)
      .post('/api/v1/patients/merge')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourcePatientId: patientBId,
        targetPatientId: patientAId,
        reason: 'Duplicate patient record identified during intake consolidation',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.targetPatientId).toBe(patientAId);
    expect(res.body.data.sourcePatientId).toBe(patientBId);

    // Verify source patient is marked as merged
    const sourceCheck = await prisma.patient.findUnique({
      where: { id: patientBId },
    });
    expect(sourceCheck?.mergedIntoPatientId).toBe(patientAId);
    expect(sourceCheck?.mergedAt).toBeDefined();
  });

  it('8. Document upload: attaches identity document to patient record', async () => {
    const res = await request(app)
      .post(`/api/v1/patients/${patientAId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'National Identity Card Scan',
        documentType: 'ID_PROOF',
        fileUrl: 'https://secure-docs.hospital.org/mpi/id-proof.pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('National Identity Card Scan');
    expect(res.body.data.documentType).toBe('ID_PROOF');
  });

  it('9. Timeline: retrieves clinical timeline of all encounters and events', async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${patientAId}/timeline`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });
});
