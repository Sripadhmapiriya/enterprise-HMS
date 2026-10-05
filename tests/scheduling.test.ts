import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './apps/api/src/index';
import { prisma } from './packages/database/src/index';
import { authService } from './apps/api/src/services/authService';

describe('Workstream D: Scheduling, Slot Generator, OPD Queue & Token Display', () => {
  let token: string;
  let tenantId: string;
  let hospitalId: string;
  let branchId: string;
  let departmentId: string;
  let doctorId: string;
  let patientId: string;
  let appointmentId: string;
  let queueItemId: string;
  let queueToken: string;

  beforeAll(async () => {
    // 1. Setup Tenant
    const tenant = await prisma.tenant.upsert({
      where: { code: 'TEST-TENANT-SCHED' },
      update: {},
      create: { name: 'Hospital Scheduling Test', code: 'TEST-TENANT-SCHED' },
    });
    tenantId = tenant.id;

    // Enable scheduling & patients modules
    await Promise.all([
      prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: 'patients' } },
        update: { enabled: true },
        create: { tenantId, moduleId: 'patients', enabled: true },
      }),
      prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: 'scheduling' } },
        update: { enabled: true },
        create: { tenantId, moduleId: 'scheduling', enabled: true },
      }),
    ]);

    // 2. Setup Hospital & Branch
    const hospital =
      (await prisma.hospital.findFirst({ where: { tenantId } })) ||
      (await prisma.hospital.create({
        data: { tenantId, name: 'Scheduling Hospital' },
      }));
    hospitalId = hospital.id;

    const branch =
      (await prisma.branch.findFirst({ where: { hospitalId } })) ||
      (await prisma.branch.create({
        data: {
          hospitalId,
          name: 'Main Ambulatory Care Branch',
          code: 'BR-SCHED-01',
        },
      }));
    branchId = branch.id;

    // 3. Setup Department
    const dept =
      (await prisma.department.findFirst({ where: { branchId } })) ||
      (await prisma.department.create({
        data: {
          branchId,
          name: 'General Outpatient Department',
          code: 'OPD-GEN',
        },
      }));
    departmentId = dept.id;

    // 4. Setup Doctor
    const docEmail = `dr.marcus.${Date.now()}@hospital-sched.com`;
    const docUser = await prisma.user.create({
      data: {
        tenantId,
        email: docEmail,
        passwordHash: await authService.hashPassword('Password123!'),
        firstName: 'Marcus',
        lastName: 'Welby',
      },
    });

    const doctor = await prisma.doctor.create({
      data: {
        userId: docUser.id,
        branchId,
        departmentId,
        specialization: 'Internal Medicine',
        licenseNumber: `DOC-SCHED-${Date.now()}`,
      },
    });
    doctorId = doctor.id;

    // 5. Setup Patient
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        hospitalId,
        mrn: `MRN-${Date.now()}-SCHED`,
        firstName: 'Arthur',
        lastName: 'Dent',
        dateOfBirth: new Date('1978-03-11'),
        gender: 'MALE',
        mobile: '+1-555-4242',
      },
    });
    patientId = patient.id;

    // 6. Generate auth token
    token = authService.generateAccessToken({
      userId: docUser.id,
      tenantId,
      email: docUser.email,
      roles: ['HospitalAdmin', 'Doctor'],
      permissions: ['scheduling.*', 'patients.*'],
      hospitalId,
    });
  });

  it('1. Create Doctor Schedule: configures consultation shifts and slot duration', async () => {
    const res = await request(app)
      .post('/api/v1/scheduling/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        doctorId,
        departmentId,
        branchId,
        dayOfWeek: 1, // Monday
        startTime: '09:00',
        endTime: '12:00',
        slotDurationMinutes: 15,
        maxPatientsPerSlot: 1,
        overbookingLimit: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.doctorId).toBe(doctorId);
    expect(res.body.data.slotDurationMinutes).toBe(15);
    expect(res.body.data.overbookingLimit).toBe(2);
  });

  it('2. Slot Generator: produces bookable consultation slots with capacity status', async () => {
    const targetDate = '2026-10-12'; // A Monday
    const res = await request(app)
      .get('/api/v1/scheduling/slots')
      .set('Authorization', `Bearer ${token}`)
      .query({
        doctorId,
        date: targetDate,
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThan(0);
    const firstSlot = res.body.data[0];
    expect(firstSlot).toHaveProperty('startTime');
    expect(firstSlot).toHaveProperty('isAvailable', true);
  });

  it('3. Book Appointment: books patient into a scheduled OPD visit', async () => {
    const aptDate = '2026-10-12';
    const res = await request(app)
      .post('/api/v1/scheduling/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId,
        doctorId,
        departmentId,
        branchId,
        appointmentDate: aptDate,
        startTime: `${aptDate}T09:00:00Z`,
        endTime: `${aptDate}T09:15:00Z`,
        type: 'NEW',
        reason: 'Initial consultation for persistent migraine',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('SCHEDULED');
    expect(res.body.data.patientId).toBe(patientId);

    appointmentId = res.body.data.id;
  });

  it('4. Reschedule Appointment: updates appointment timestamp for clinical follow-up', async () => {
    const newDate = '2026-10-12';
    const res = await request(app)
      .post(`/api/v1/scheduling/appointments/${appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        newDate,
        newStartTime: `${newDate}T10:00:00Z`,
        newEndTime: `${newDate}T10:15:00Z`,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(appointmentId);
    expect(new Date(res.body.data.startTime).toISOString()).toBe(`${newDate}T10:00:00.000Z`);
  });

  it('5. OPD Queue Check-In: checks patient in on arrival and generates queue token', async () => {
    const res = await request(app)
      .post(`/api/v1/scheduling/appointments/${appointmentId}/check-in`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.queueNumber).toMatch(/^T-/);
    expect(res.body.data.status).toBe('WAITING');

    queueItemId = res.body.data.id;
    queueToken = res.body.data.queueNumber;

    // Verify appointment status updated to ARRIVED
    const apt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    expect(apt?.status).toBe('ARRIVED');
  });

  it('6. Queue Operator Transitions: moves token from WAITING -> CALLED -> IN_CONSULTATION -> COMPLETED', async () => {
    // 6a. Call token
    const callRes = await request(app)
      .put(`/api/v1/scheduling/queue/${queueItemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CALLED' });

    expect(callRes.status).toBe(200);
    expect(callRes.body.data.status).toBe('CALLED');

    // 6b. Start consultation
    const consultRes = await request(app)
      .put(`/api/v1/scheduling/queue/${queueItemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_CONSULTATION' });

    expect(consultRes.status).toBe(200);
    expect(consultRes.body.data.status).toBe('IN_CONSULTATION');

    // 6c. Complete consultation
    const completeRes = await request(app)
      .put(`/api/v1/scheduling/queue/${queueItemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'COMPLETED' });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe('COMPLETED');
  });

  it('7. Waiting Room Display Board Feed: returns active calling and recent tokens', async () => {
    const res = await request(app)
      .get('/api/v1/scheduling/queue/display')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('displayBoard');
    expect(res.body.data.displayBoard).toHaveProperty('nowCalling');
    expect(res.body.data.displayBoard).toHaveProperty('nextTokens');
    expect(res.body.data.displayBoard).toHaveProperty('recentlyCompleted');
    expect(res.body.data.displayBoard.recentlyCompleted).toContain(queueToken);
  });
});
