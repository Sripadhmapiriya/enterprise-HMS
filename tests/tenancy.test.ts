import { describe, it, expect } from 'vitest';
import { prisma, createTenantClient, TenantViolationError } from './packages/database/src/index';

describe('Workstream B: Database Tenant Isolation Extension', () => {
  const tenantAClient = createTenantClient('tenant-alpha', prisma);
  const tenantBClient = createTenantClient('tenant-beta', prisma);

  it('should require a non-empty tenantId to initialize tenant client', () => {
    expect(() => createTenantClient('', prisma)).toThrow(TenantViolationError);
    expect(() => createTenantClient('   ', prisma)).toThrow(TenantViolationError);
  });

  it('should block queries attempting to fetch records from a foreign tenant', async () => {
    // Attempt to override tenantId with foreign tenant inside tenantA client
    await expect(
      tenantAClient.patient.findMany({
        where: { tenantId: 'tenant-beta' } as any,
      })
    ).rejects.toThrow(TenantViolationError);
  });

  it('should block writes targeting a foreign tenant', async () => {
    await expect(
      tenantAClient.patient.create({
        data: {
          tenantId: 'tenant-beta',
          hospitalId: 'hosp-1',
          mrn: `MRN-\${Date.now()}`,
          firstName: 'John',
          lastName: 'Doe',
          gender: 'MALE',
        } as any,
      })
    ).rejects.toThrow(TenantViolationError);
  });
});
