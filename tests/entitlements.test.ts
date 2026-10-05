import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './apps/api/src/index';
import { prisma } from './packages/database/src/index';
import { authService } from './apps/api/src/services/authService';
import { entitlementService } from './apps/api/src/services/entitlementService';

describe('Workstream B: Entitlements, RBAC & Route-Level Tenancy', () => {
  let tenantAToken: string;
  let tenantBToken: string;
  let tenantAId: string;
  let tenantBId: string;
  let patientAId: string;

  beforeAll(async () => {
    // 1. Setup Tenant A
    const tenantA = await prisma.tenant.upsert({
      where: { code: 'TEST-TENANT-ALPHA' },
      update: {},
      create: { name: 'Hospital Alpha', code: 'TEST-TENANT-ALPHA' },
    });
    tenantAId = tenantA.id;

    // 2. Setup Tenant B
    const tenantB = await prisma.tenant.upsert({
      where: { code: 'TEST-TENANT-BETA' },
      update: {},
      create: { name: 'Hospital Beta', code: 'TEST-TENANT-BETA' },
    });
    tenantBId = tenantB.id;

    // 3. Ensure Hospital records exist for foreign keys
    const hospA = await prisma.hospital.findFirst({ where: { tenantId: tenantAId } }) ||
      await prisma.hospital.create({ data: { tenantId: tenantAId, name: 'Alpha Main Hospital' } });

    const hospB = await prisma.hospital.findFirst({ where: { tenantId: tenantBId } }) ||
      await prisma.hospital.create({ data: { tenantId: tenantBId, name: 'Beta Main Hospital' } });

    // 4. Create user for Tenant A with full patient permissions
    const userA = await prisma.user.upsert({
      where: { email: 'admin@alpha-hospital.com' },
      update: {},
      create: {
        tenantId: tenantAId,
        email: 'admin@alpha-hospital.com',
        passwordHash: await authService.hashPassword('Password123!'),
        firstName: 'Alice',
        lastName: 'Alpha',
      },
    });

    tenantAToken = authService.generateAccessToken({
      userId: userA.id,
      tenantId: tenantAId,
      email: userA.email,
      roles: ['HospitalAdmin'],
      permissions: ['patients.read', 'patients.create'],
      hospitalId: hospA.id,
    });

    // 5. Create user for Tenant B
    const userB = await prisma.user.upsert({
      where: { email: 'admin@beta-hospital.com' },
      update: {},
      create: {
        tenantId: tenantBId,
        email: 'admin@beta-hospital.com',
        passwordHash: await authService.hashPassword('Password123!'),
        firstName: 'Bob',
        lastName: 'Beta',
      },
    });

    tenantBToken = authService.generateAccessToken({
      userId: userB.id,
      tenantId: tenantBId,
      email: userB.email,
      roles: ['HospitalAdmin'],
      permissions: ['patients.read', 'patients.create'],
      hospitalId: hospB.id,
    });

    // Configure both Tenant A and Tenant B with 'patients' enabled initially
    await entitlementService.setTenantModules(tenantAId, ['patients']);
    await entitlementService.setTenantModules(tenantBId, ['patients']);
  }, 30000);

  it('POST /api/v1/patients should create a patient in Tenant A context', async () => {
    const hospA = await prisma.hospital.findFirst({ where: { tenantId: tenantAId } });

    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        hospitalId: hospA!.id,
        mrn: `MRN-ALPHA-${Date.now()}`,
        firstName: 'Jane',
        lastName: 'Doe',
        gender: 'FEMALE',
        mobile: '+15551234567',
        dateOfBirth: '1995-05-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.tenantId).toBe(tenantAId);

    patientAId = res.body.data.id;
  });

  it('GET /api/v1/patients in Tenant B context should NOT return Tenant A patients (Zero Leaks)', async () => {
    const res = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${tenantBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const patients = res.body.data;
    const foundPatientA = patients.find((p: any) => p.id === patientAId);
    expect(foundPatientA).toBeUndefined();
  });

  it('GET /api/v1/patients/:id targeting foreign tenant patient should return 404 (Not Found)', async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${patientAId}`)
      .set('Authorization', `Bearer ${tenantBToken}`);

    // Must return 404 rather than disclosing patient's existence in another tenant
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('requireModule should return 404 MODULE_NOT_ENABLED when module is disabled for tenant', async () => {
    // Disable patients module for Tenant B
    await entitlementService.setTenantModules(tenantBId, ['inventory']);

    const res = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${tenantBToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MODULE_NOT_ENABLED');
    expect(res.body.error.message).toContain('patients');
  });

  it('requirePermission should reject user missing required permission with 403 FORBIDDEN', async () => {
    // Issue token with no 'patients.create' permission
    const readOnlyToken = authService.generateAccessToken({
      userId: 'readonly-user',
      tenantId: tenantAId,
      email: 'readonly@alpha.com',
      roles: ['Viewer'],
      permissions: ['patients.read'],
    });

    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .send({
        hospitalId: 'some-hosp',
        mrn: 'MRN-FORBIDDEN',
        firstName: 'Test',
        lastName: 'Test',
        gender: 'MALE',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('patients.create');
  });
});
