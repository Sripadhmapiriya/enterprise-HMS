import { prisma } from '@enterprise-hms/database';

describe('Workstream A: Baseline & Hygiene Verification', () => {
  it('should load database client export successfully', () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma.$connect).toBe('function');
  });

  it('should verify monorepo workspaces are defined', () => {
    const pkg = require('../package.json');
    expect(pkg.workspaces).toBeDefined();
    expect(pkg.workspaces).toContain('apps/*');
    expect(pkg.workspaces).toContain('packages/*');
  });

  it('should verify vitest harness is operational', () => {
    expect(true).toBe(true);
  });
});
