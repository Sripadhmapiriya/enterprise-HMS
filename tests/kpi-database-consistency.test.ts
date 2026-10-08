import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../apps/api/src/index';
import { prisma } from '../packages/database/src/index';
import { authService } from '../apps/api/src/services/authService';

describe('Workstream 1: KPI & Database Consistency Verification', () => {
  let tenantId: string;
  let hospitalId: string;
  let branchId: string;
  let doctorUser: any;
  let authToken: string;

  beforeAll(async () => {
    // 1. Ensure Tenant exists
    const tenant = await prisma.tenant.upsert({
      where: { code: 'DEMO-TENANT' },
      update: {},
      create: { name: 'Demo Healthcare Organization', code: 'DEMO-TENANT' },
    });
    tenantId = tenant.id;

    // 2. Ensure Hospital & Branch exist
    const hospital = (await prisma.hospital.findFirst({ where: { tenantId } })) ||
      (await prisma.hospital.create({ data: { tenantId, name: 'City General Hospital' } }));
    hospitalId = hospital.id;

    const branch = (await prisma.branch.findFirst({ where: { hospitalId } })) ||
      (await prisma.branch.create({ data: { hospitalId, name: 'Main Branch', code: 'MAIN-01' } }));
    branchId = branch.id;

    // 3. Ensure Doctor User with permissions exists
    doctorUser = await prisma.user.findFirst({ where: { email: 'admin@demo.com' } });
    if (!doctorUser) {
      doctorUser = await prisma.user.create({
        data: {
          tenantId,
          email: 'admin@demo.com',
          passwordHash: await authService.hashPassword('password123'),
          firstName: 'Priya',
          lastName: 'Admin',
        },
      });
    }

    authToken = authService.generateAccessToken({
      userId: doctorUser.id,
      tenantId,
      email: doctorUser.email,
      roles: ['Hospital Admin', 'Doctor'],
      permissions: ['analytics.view', 'billing.read', 'clinical.read', 'ipd.read'],
      hospitalId,
      branchId,
    });
  });

  it('1. GET /api/v1/analytics/kpis returns metrics matching database queries exactly', async () => {
    // Fetch direct database calculations
    const [
      directTotalBeds,
      directOccupiedBeds,
      directActiveAdmissions,
      directBranchCount,
      directDeptCount,
      billAgg,
    ] = await Promise.all([
      prisma.bed.count(),
      prisma.bed.count({ where: { status: 'OCCUPIED' } }),
      prisma.admission.count({ where: { tenantId, status: 'ADMITTED' } }),
      prisma.branch.count({ where: { hospital: { tenantId }, isActive: true } }),
      prisma.department.count({ where: { branch: { hospital: { tenantId } }, isActive: true } }),
      prisma.bill.aggregate({
        where: { tenantId },
        _sum: { grossTotal: true, paidAmount: true, outstandingAmount: true },
      }),
    ]);

    const res = await request(app)
      .get('/api/v1/analytics/kpis')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    // Inpatient census & beds
    expect(data.clinical.totalBeds).toBe(directTotalBeds);
    expect(data.clinical.occupiedBeds).toBe(directOccupiedBeds);
    expect(data.clinical.activeCensus).toBe(directActiveAdmissions);

    // Operations
    expect(data.operational.hospitalBranches).toBe(directBranchCount);
    expect(data.operational.clinicalUnits).toBe(directDeptCount);

    // Financial
    const expectedBilled = Number(billAgg._sum.grossTotal || 0);
    const expectedCollected = Number(billAgg._sum.paidAmount || 0);
    const expectedOutstanding = Number(billAgg._sum.outstandingAmount || 0);

    expect(data.financial.totalBilled).toBe(expectedBilled);
    expect(data.financial.totalCollected).toBe(expectedCollected);
    expect(data.financial.outstandingAr).toBe(expectedOutstanding);
  });

  it('2. GET /api/v1/analytics/dashboard returns stats matching database counts exactly', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      directOpdIntake,
      directDispenses,
      directTotalBeds,
      directOccupiedBeds,
      directActiveAdmissions,
    ] = await Promise.all([
      prisma.encounter.count({ where: { tenantId, type: 'OPD', createdAt: { gte: today } } }),
      prisma.pharmacyDispensing.count({ where: { tenantId, createdAt: { gte: today } } }),
      prisma.bed.count(),
      prisma.bed.count({ where: { status: 'OCCUPIED' } }),
      prisma.admission.count({ where: { tenantId, status: 'ADMITTED' } }),
    ]);

    const res = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stats = res.body.data.stats;
    expect(stats.opdIntakeToday).toBe(directOpdIntake);
    expect(stats.pharmacyDispensesToday).toBe(directDispenses);
    expect(stats.activeAdmissions).toBe(directActiveAdmissions);

    const expectedOccupancy = directTotalBeds > 0 ? Number(((directOccupiedBeds / directTotalBeds) * 100).toFixed(1)) : 0;
    expect(stats.bedOccupancyRate).toBe(expectedOccupancy);
  });

  it('3. Dynamic database update instantly increments KPI endpoint response', async () => {
    // Read initial billed amount
    const initialRes = await request(app)
      .get('/api/v1/analytics/kpis')
      .set('Authorization', `Bearer ${authToken}`);

    const initialBilled = initialRes.body.data.financial.totalBilled;
    const initialCollected = initialRes.body.data.financial.totalCollected;

    // Create a new patient and finalized bill in the database
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        hospitalId,
        mrn: `MRN-KPI-TEST-${Date.now()}`,
        firstName: 'TestKpi',
        lastName: 'Patient',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'OTHER',
        mobile: '+91-9999900001',
      },
    });

    const testBill = await prisma.bill.create({
      data: {
        tenantId,
        hospitalId,
        branchId,
        patientId: patient.id,
        billNumber: `BL-TEST-${Date.now()}`,
        billType: 'OPD',
        status: 'FINALIZED',
        subTotal: 850,
        grossTotal: 850,
        patientPayable: 850,
        paidAmount: 850,
        outstandingAmount: 0,
        createdById: doctorUser.id,
      },
    });

    // Query KPI endpoint again
    const updatedRes = await request(app)
      .get('/api/v1/analytics/kpis')
      .set('Authorization', `Bearer ${authToken}`);

    expect(updatedRes.status).toBe(200);
    const updatedBilled = updatedRes.body.data.financial.totalBilled;
    const updatedCollected = updatedRes.body.data.financial.totalCollected;

    // Must reflect the exact +850 increment from real database query
    expect(updatedBilled).toBe(initialBilled + 850);
    expect(updatedCollected).toBe(initialCollected + 850);

    // Clean up test bill and patient
    await prisma.bill.delete({ where: { id: testBill.id } });
    await prisma.patient.delete({ where: { id: patient.id } });
  });
});
