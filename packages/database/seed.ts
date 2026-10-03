import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(salt + ":" + derivedKey.toString('hex'));
    });
  });
}

async function main() {
  console.log('Seeding Phase 2 database...');

  // Tenants, Roles, Hospitals (from Phase 1)
  const tenant = await prisma.tenant.upsert({
    where: { code: 'DEMO-TENANT' },
    update: {},
    create: { name: 'Demo Healthcare Organization', code: 'DEMO-TENANT' }
  });

  const hospital = await prisma.hospital.findFirst({ where: { tenantId: tenant.id } }) || await prisma.hospital.create({
    data: { tenantId: tenant.id, name: 'City General Hospital' }
  });

  const branch = await prisma.branch.findFirst({ where: { hospitalId: hospital.id } }) || await prisma.branch.create({
    data: { hospitalId: hospital.id, name: 'Main Branch', code: 'MAIN-01' }
  });

  const cardiology = await prisma.department.findFirst({ where: { branchId: branch.id } }) || await prisma.department.create({
    data: { branchId: branch.id, name: 'Cardiology', code: 'CARD' }
  });

  const passwordHash = await hashPassword('password123');
  
  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor@demo.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'doctor@demo.com',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Connor'
    }
  });

  const doctor = await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: {
      userId: doctorUser.id,
      branchId: branch.id,
      departmentId: cardiology.id,
      specialization: 'Cardiologist'
    }
  });

  // Phase 2: Patient Seeding
  const patient = await prisma.patient.upsert({
    where: { mrn: 'MRN-000001' },
    update: {},
    create: {
      tenantId: tenant.id,
      hospitalId: hospital.id,
      mrn: 'MRN-000001',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'Male',
      bloodGroup: 'O+',
      mobile: '+1234567890',
      city: 'Metropolis',
      status: 'ACTIVE'
    }
  });

  // Appointment Seeding
  const appointment = await prisma.appointment.create({
    data: {
      tenantId: tenant.id,
      patientId: patient.id,
      doctorId: doctor.id,
      departmentId: cardiology.id,
      branchId: branch.id,
      appointmentDate: new Date(),
      startTime: new Date(),
      endTime: new Date(new Date().getTime() + 30*60000), // +30 mins
      type: 'NEW',
      status: 'CHECKED_IN'
    }
  });

  // Queue Seeding
  const queue = await prisma.queue.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      departmentId: cardiology.id,
      doctorId: doctor.id,
      patientId: patient.id,
      appointmentId: appointment.id,
      queueNumber: 'A001',
      queueDate: new Date(),
      priority: 'REGULAR',
      status: 'WAITING'
    }
  });

  console.log('Phase 2 Database seeded successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
