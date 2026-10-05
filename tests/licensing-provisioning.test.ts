import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './apps/api/src/index';
import { prisma } from './packages/database/src/index';
import { authService } from './apps/api/src/services/authService';
import { LicensingService } from './packages/modules/src/licensing';
import { provisionTenant } from './scripts/provision';

describe('Workstream D: Ed25519 Licensing, Provisioning CLI & Module Manager', () => {
  let superAdminToken: string;
  let tenantId: string;
  let hospitalId: string;

  beforeAll(async () => {
    // 1. Setup Tenant
    const tenant = await prisma.tenant.upsert({
      where: { code: 'TEST-TENANT-LIC' },
      update: {},
      create: { name: 'Hospital Licensing Test', code: 'TEST-TENANT-LIC' },
    });
    tenantId = tenant.id;

    // Enable enterprise & patients modules
    await Promise.all([
      prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: 'enterprise' } },
        update: { enabled: true },
        create: { tenantId, moduleId: 'enterprise', enabled: true },
      }),
      prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: 'patients' } },
        update: { enabled: true },
        create: { tenantId, moduleId: 'patients', enabled: true },
      }),
    ]);

    const hospital =
      (await prisma.hospital.findFirst({ where: { tenantId } })) ||
      (await prisma.hospital.create({
        data: { tenantId, name: 'Licensing Test Center' },
      }));
    hospitalId = hospital.id;

    // Create Super Admin user
    const adminUser = await prisma.user.upsert({
      where: { email: 'super.admin@licensing-test.com' },
      update: {},
      create: {
        tenantId,
        email: 'super.admin@licensing-test.com',
        passwordHash: await authService.hashPassword('Password123!'),
        firstName: 'System',
        lastName: 'Admin',
      },
    });

    superAdminToken = authService.generateAccessToken({
      userId: adminUser.id,
      tenantId,
      email: adminUser.email,
      roles: ['HospitalAdmin', 'SuperAdmin'],
      permissions: ['*'],
      hospitalId,
    });
  });

  describe('1. Ed25519 Cryptographic Licensing Service', () => {
    const keyPair = LicensingService.generateKeyPair();

    it('generates, signs, and validates a valid Ed25519 license', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

      const license = LicensingService.issueLicense(
        {
          clientId: 'HOSPITAL-ALBANY-01',
          clientName: 'Albany Medical Center',
          tier: 'STANDARD',
          modules: ['patients', 'scheduling', 'opd'],
          limits: { users: 50, beds: 100, hospitals: 1 },
          issuedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
        keyPair.privateKey
      );

      expect(license.signature).toBeDefined();
      expect(license.payload.clientId).toBe('HOSPITAL-ALBANY-01');

      const verification = LicensingService.verifyLicense(license, keyPair.publicKey);
      expect(verification.isValid).toBe(true);
      expect(verification.readOnly).toBe(false);
      expect(verification.inGracePeriod).toBe(false);
    });

    it('detects and rejects a tampered license payload', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const license = LicensingService.issueLicense(
        {
          clientId: 'HOSPITAL-HONEST-01',
          clientName: 'Honest Care',
          tier: 'BASIC',
          modules: ['patients'],
          limits: { users: 5, beds: 10, hospitals: 1 },
          issuedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
        keyPair.privateKey
      );

      // Malicious tamper: inject extra module into payload without resigning
      const tampered = JSON.parse(JSON.stringify(license));
      tampered.payload.modules.push('billing', 'pharmacy');

      const verification = LicensingService.verifyLicense(tampered, keyPair.publicKey);
      expect(verification.isValid).toBe(false);
      expect(verification.reason).toBe('INVALID_SIGNATURE');
    });

    it('enforces 14-day clinical safety grace period on expired license', () => {
      const now = new Date();
      // Expired 5 days ago (well within 14-day grace period)
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

      const license = LicensingService.issueLicense(
        {
          clientId: 'HOSPITAL-EXPIRED-GRACE',
          clientName: 'Grace Hospital',
          tier: 'BASIC',
          modules: ['patients'],
          limits: { users: 10, beds: 10, hospitals: 1 },
          issuedAt: fortyDaysAgo.toISOString(),
          expiresAt: fiveDaysAgo.toISOString(),
        },
        keyPair.privateKey
      );

      const verification = LicensingService.verifyLicense(license, keyPair.publicKey);
      expect(verification.isValid).toBe(false);
      expect(verification.inGracePeriod).toBe(true);
      expect(verification.readOnly).toBe(false); // Grace period keeps critical workflows operational
    });

    it('enforces read-only safety fallback when expiration exceeds 14-day grace period', () => {
      const now = new Date();
      // Expired 30 days ago (past the 14-day grace period)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const license = LicensingService.issueLicense(
        {
          clientId: 'HOSPITAL-EXPIRED-LOCKED',
          clientName: 'Locked Out Clinic',
          tier: 'BASIC',
          modules: ['patients'],
          limits: { users: 10, beds: 10, hospitals: 1 },
          issuedAt: sixtyDaysAgo.toISOString(),
          expiresAt: thirtyDaysAgo.toISOString(),
        },
        keyPair.privateKey
      );

      const verification = LicensingService.verifyLicense(license, keyPair.publicKey);
      expect(verification.isValid).toBe(false);
      expect(verification.inGracePeriod).toBe(false);
      expect(verification.readOnly).toBe(true); // Read-only mode for historical record lookup without writing
    });
  });

  describe('2. Idempotent Provisioning Engine', () => {
    it('provisions a complete client edition with tenant, branch, admin, entitlements, and license', async () => {
      const result = await provisionTenant({
        clientName: 'Prov St Jude Care',
        clientCode: 'TEST-ST-JUDE',
        preset: 'patients-only',
        adminEmail: 'admin@st-jude-test.com',
        adminFirstName: 'Francis',
        adminLastName: 'Jude',
        adminPassword: 'TemporaryPass123!',
      });

      expect(result.tenant.id).toBeDefined();
      expect(result.tenant.code).toBe('TEST-ST-JUDE');
      expect(result.hospital.id).toBeDefined();
      expect(result.branch.id).toBeDefined();
      expect(result.adminUser.email).toBe('admin@st-jude-test.com');
      expect(result.adminUser.requiresPasswordChange).toBe(true);
      expect(result.entitlements.length).toBeGreaterThanOrEqual(2); // foundation, patients
      expect(result.license).toBeDefined();
      expect(result.license.signature).toBeDefined();

      // Idempotency: run again for same client code
      const secondRun = await provisionTenant({
        clientName: 'Prov St Jude Care',
        clientCode: 'TEST-ST-JUDE',
        preset: 'patients-only',
        adminEmail: 'admin@st-jude-test.com',
        adminFirstName: 'Francis',
        adminLastName: 'Jude',
      });

      expect(secondRun.tenant.id).toBe(result.tenant.id);
      expect(secondRun.hospital.id).toBe(result.hospital.id);
    }, 60000);
  });

  describe('3. Module Manager API & Dynamic Entitlements', () => {
    it('retrieves active modules and available presets for tenant', async () => {
      const res = await request(app)
        .get('/api/v1/enterprise/modules')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('modules');
      expect(res.body.data).toHaveProperty('presets');
      expect(res.body.data.presets.length).toBeGreaterThanOrEqual(6);
    });

    it('applies client edition preset (e.g. opd-clinic)', async () => {
      const res = await request(app)
        .post('/api/v1/enterprise/modules/apply-preset')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          presetId: 'opd-clinic',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.enabledModules).toContain('patients');
      expect(res.body.data.enabledModules).toContain('scheduling');
      expect(res.body.data.enabledModules).toContain('opd');
    });

    it('rejects disabling a module that other active modules require', async () => {
      // With opd-clinic active, opd requires patients. Attempting to disable patients must be rejected.
      const res = await request(app)
        .put('/api/v1/enterprise/modules/patients')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          enabled: false,
          autoEnableDependencies: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MODULE_DEPENDENCY_ERROR');
      expect(res.body.error.message).toContain('required by');
    });
  });
});
