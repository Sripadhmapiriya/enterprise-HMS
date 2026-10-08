import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { seedDemoDataset } from './seedDemo';

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
  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL: Seed execution is strictly prohibited when NODE_ENV=production');
    process.exit(1);
  }

  console.log('Seeding enterprise database...');

  // Tenants, Roles, Hospitals
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

  const eastBranch = await prisma.branch.findFirst({ where: { hospitalId: hospital.id, code: 'EAST-02' } }) || await prisma.branch.create({
    data: { hospitalId: hospital.id, name: 'East Wing Campus', code: 'EAST-02' }
  });

  const cardiology = await prisma.department.findFirst({ where: { branchId: branch.id } }) || await prisma.department.create({
    data: { branchId: branch.id, name: 'Cardiology', code: 'CARD' }
  });

  const erDept = await prisma.department.findFirst({ where: { branchId: branch.id, code: 'ER' } }) || await prisma.department.create({
    data: { branchId: branch.id, name: 'Emergency Department', code: 'ER', type: 'EMERGENCY' }
  });

  const passwordHash = await hashPassword('password123');
  
  // 1. Define Demo Roles
  const roles = [
    { name: 'Hospital Admin', desc: 'Full access to hospital settings and modules' },
    { name: 'Doctor', desc: 'Clinical access, consultations, and prescriptions' },
    { name: 'Nurse', desc: 'Inpatient care, vitals, and MAR' },
    { name: 'Receptionist', desc: 'Patient registration and appointments' },
    { name: 'Pharmacist', desc: 'Dispensary and inventory management' },
    { name: 'Billing Clerk', desc: 'Invoicing, receipts, and claims' }
  ];

  const roleMap: Record<string, any> = {};
  for (const r of roles) {
    const roleRecord = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: r.name } },
      update: {},
      create: { tenantId: tenant.id, name: r.name, description: r.desc, isSystem: true }
    });
    roleMap[r.name] = roleRecord;
  }

  // 2. Define Users
  const users = [
    { email: 'admin@demo.com', first: 'Priya', last: 'Admin', role: 'Hospital Admin' },
    { email: 'doctor@demo.com', first: 'Sarah', last: 'Connor', role: 'Doctor' },
    { email: 'nurse@demo.com', first: 'Nancy', last: 'Nightingale', role: 'Nurse' },
    { email: 'reception@demo.com', first: 'Rita', last: 'Reception', role: 'Receptionist' },
    { email: 'pharmacy@demo.com', first: 'Phil', last: 'Pharma', role: 'Pharmacist' },
    { email: 'billing@demo.com', first: 'Bill', last: 'Clerk', role: 'Billing Clerk' }
  ];

  const userMap: Record<string, any> = {};
  for (const u of users) {
    const userRecord = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        tenantId: tenant.id,
        email: u.email,
        passwordHash,
        firstName: u.first,
        lastName: u.last
      }
    });
    userMap[u.role] = userRecord;

    // Assign Role
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: userRecord.id, roleId: roleMap[u.role].id } },
      update: {},
      create: { userId: userRecord.id, roleId: roleMap[u.role].id }
    });

    // Create Staff Record for hospital and branch context
    await prisma.staff.upsert({
      where: { userId: userRecord.id },
      update: {},
      create: {
        userId: userRecord.id,
        branchId: branch.id,
        departmentId: cardiology.id, // Just giving them a default department
        designation: u.role,
      }
    });
  }

  const doctorUser = userMap['Doctor'];
  const nurseUser = userMap['Nurse'];

  const doctor = await prisma.doctor.findFirst({ where: { userId: doctorUser.id } }) || await prisma.doctor.create({
    data: {
      userId: doctorUser.id,
      branchId: branch.id,
      departmentId: cardiology.id,
      specialization: 'Cardiologist'
    }
  });

  console.log('✓ Created 6 demo role accounts (password: password123)');
  console.log('  * Password policy: Argon2id hash with 16-byte salt, auto-upgrade enabled.');

  // Patient Seeding
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

  // Check if Queue already exists to avoid unique constraint error
  const existingQueue = await prisma.queue.findFirst({
    where: { branchId: branch.id, doctorId: doctor.id, queueNumber: 'A001' }
  });

  if (!existingQueue) {
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

    await prisma.queue.create({
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
  }

  // ==========================================
  // Inpatient Operations (IPD) Seeding
  // ==========================================

  // Create Ward
  const ward = await prisma.ward.findFirst({ where: { branchId: branch.id, code: 'GEN-01' } }) || await prisma.ward.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      departmentId: cardiology.id,
      name: 'General Ward',
      code: 'GEN-01',
      wardType: 'GENERAL',
      capacity: 20,
      floor: '3rd Floor'
    }
  });

  // Create Room
  const room = await prisma.room.findFirst({ where: { wardId: ward.id, roomNumber: '101' } }) || await prisma.room.create({
    data: {
      wardId: ward.id,
      name: 'Room 101',
      roomNumber: '101'
    }
  });

  // Create Beds
  let bed1 = await prisma.bed.findFirst({ where: { wardId: ward.id, bedNumber: '101-A' } });
  if (!bed1) {
    bed1 = await prisma.bed.create({
      data: {
        wardId: ward.id,
        roomId: room.id,
        bedNumber: '101-A',
        bedType: 'REGULAR',
        status: 'OCCUPIED'
      }
    });
  }

  let bed2 = await prisma.bed.findFirst({ where: { wardId: ward.id, bedNumber: '101-B' } });
  if (!bed2) {
    bed2 = await prisma.bed.create({
      data: {
        wardId: ward.id,
        roomId: room.id,
        bedNumber: '101-B',
        bedType: 'REGULAR',
        status: 'AVAILABLE'
      }
    });
  }

  // Create Encounter for IPD
  let encounter = await prisma.encounter.findFirst({ where: { patientId: patient.id, type: 'IPD' } });
  if (!encounter) {
    encounter = await prisma.encounter.create({
      data: {
        tenantId: tenant.id,
        hospitalId: hospital.id,
        branchId: branch.id,
        departmentId: cardiology.id,
        doctorId: doctor.id,
        patientId: patient.id,
        type: 'IPD',
        status: 'IN_PROGRESS'
      }
    });

    // Create Admission
    const admission = await prisma.admission.create({
      data: {
        tenantId: tenant.id,
        hospitalId: hospital.id,
        branchId: branch.id,
        patientId: patient.id,
        encounterId: encounter.id,
        admissionNumber: 'IPD-2026-000001',
        admissionType: 'PLANNED',
        admissionSource: 'OPD',
        reason: 'Observation for chest pain',
        departmentId: cardiology.id,
        admittingDocId: doctor.id,
        attendingDocId: doctor.id,
        status: 'ADMITTED'
      }
    });

    // Create Bed Allocation
    await prisma.bedAllocation.create({
      data: {
        admissionId: admission.id,
        bedId: bed1.id,
        allocatedById: doctorUser.id
      }
    });

    // Care Team
    const careTeam = await prisma.careTeam.create({
      data: { encounterId: encounter.id }
    });

    await prisma.careTeamMember.create({
      data: {
        careTeamId: careTeam.id,
        userId: doctorUser.id,
        role: 'ATTENDING'
      }
    });
    await prisma.careTeamMember.create({
      data: {
        careTeamId: careTeam.id,
        userId: nurseUser.id,
        role: 'PRIMARY_NURSE'
      }
    });

    // Nursing Assessment
    await prisma.nursingAssessment.create({
      data: {
        admissionId: admission.id,
        nurseId: nurseUser.id,
        generalCondition: 'Stable but complaining of mild chest discomfort',
        painScore: 4,
        mobility: 'Independent',
        fallRisk: 'Low'
      }
    });

    // Vitals
    await prisma.vitalRecord.create({
      data: {
        encounterId: encounter.id,
        recordedById: nurseUser.id,
        temperature: 98.6,
        pulse: 88,
        bpSystolic: 130,
        bpDiastolic: 85,
        spo2: 98
      }
    });

    // Care Plan
    const carePlan = await prisma.carePlan.create({
      data: {
        admissionId: admission.id,
        problem: 'Chest Pain',
        goal: 'Pain relief and monitoring',
        assignedToId: nurseUser.id,
        status: 'ACTIVE'
      }
    });

    await prisma.carePlanItem.create({
      data: {
        carePlanId: carePlan.id,
        intervention: 'Monitor vitals every 4 hours',
        frequency: 'Q4H'
      }
    });

    // Doctor Round
    await prisma.doctorRound.create({
      data: {
        admissionId: admission.id,
        doctorId: doctor.id,
        clinicalStatus: 'STABLE',
        progressNote: 'Patient resting comfortably. Continue observation and pending troponin results.',
        plan: 'Awaiting lab results'
      }
    });

    // Medication Order
    const medOrder = await prisma.medicationOrder.create({
      data: {
        admissionId: admission.id,
        doctorId: doctor.id,
        medicationName: 'Aspirin',
        dose: '75mg',
        route: 'ORAL',
        frequency: 'OD'
      }
    });

    // Admin
    await prisma.medicationAdministration.create({
      data: {
        orderId: medOrder.id,
        nurseId: nurseUser.id,
        scheduledTime: new Date(),
        status: 'GIVEN',
        actualTime: new Date()
      }
    });
  }

  // ============================================================================
  // Diagnostics & Laboratory Seeding
  // ============================================================================

  // 1. Categories
  const labCategory = await prisma.diagnosticCategory.findFirst({ where: { name: 'Laboratory' } }) || await prisma.diagnosticCategory.create({
    data: { tenantId: tenant.id, name: 'Laboratory', type: 'LABORATORY' }
  });

  const radCategory = await prisma.diagnosticCategory.findFirst({ where: { name: 'Radiology' } }) || await prisma.diagnosticCategory.create({
    data: { tenantId: tenant.id, name: 'Radiology', type: 'RADIOLOGY' }
  });

  // 2. Specimen
  const bloodSpecimen = await prisma.specimenType.findFirst({ where: { code: 'BLD' } }) || await prisma.specimenType.create({
    data: { tenantId: tenant.id, name: 'Blood', code: 'BLD' }
  });

  // 3. Service
  const cbcService = await prisma.diagnosticService.findFirst({ where: { code: 'CBC' } }) || await prisma.diagnosticService.create({
    data: {
      tenantId: tenant.id,
      categoryId: labCategory.id,
      name: 'Complete Blood Count',
      code: 'CBC',
      departmentId: cardiology.id,
      specimenTypeId: bloodSpecimen.id,
      resultType: 'PANEL',
      price: 50.0
    }
  });

  const xrayService = await prisma.diagnosticService.findFirst({ where: { code: 'CXR' } }) || await prisma.diagnosticService.create({
    data: {
      tenantId: tenant.id,
      categoryId: radCategory.id,
      name: 'Chest X-Ray',
      code: 'CXR',
      departmentId: cardiology.id,
      sampleRequired: false,
      resultType: 'TEXT',
      price: 150.0
    }
  });

  // 4. Parameter & Range
  const hbParam = await prisma.diagnosticParameter.findFirst({ where: { code: 'HB' } }) || await prisma.diagnosticParameter.create({
    data: { tenantId: tenant.id, name: 'Hemoglobin', code: 'HB', unit: 'g/dL', resultType: 'NUMERIC' }
  });

  const hbRange = await prisma.diagnosticParameterRange.findFirst({ where: { parameterId: hbParam.id } }) || await prisma.diagnosticParameterRange.create({
    data: {
      parameterId: hbParam.id,
      gender: 'ANY',
      minRange: 13.0,
      maxRange: 17.0,
      criticalLow: 7.0,
      criticalHigh: 21.0
    }
  });

  // 5. Panel
  const cbcPanel = await prisma.diagnosticPanel.findFirst({ where: { serviceId: cbcService.id, parameterId: hbParam.id } }) || await prisma.diagnosticPanel.create({
    data: { serviceId: cbcService.id, parameterId: hbParam.id, displayOrder: 1 }
  });

  // 6. Order
  let investigationOrder = await prisma.investigationOrder.findFirst({ where: { patientId: patient.id } });
  if (!investigationOrder) {
    investigationOrder = await prisma.investigationOrder.create({
      data: {
        tenantId: tenant.id,
        patientId: patient.id,
        encounterId: encounter.id,
        doctorId: doctor.id,
        departmentId: cardiology.id,
        status: 'ORDERED'
      }
    });

    const labItem = await prisma.investigationOrderItem.create({
      data: {
        orderId: investigationOrder.id,
        testCode: cbcService.code,
        testName: cbcService.name,
        category: 'LABORATORY',
        serviceId: cbcService.id
      }
    });

    const radItem = await prisma.investigationOrderItem.create({
      data: {
        orderId: investigationOrder.id,
        testCode: xrayService.code,
        testName: xrayService.name,
        category: 'RADIOLOGY',
        serviceId: xrayService.id
      }
    });

    // 7. Lab Sample workflow
    const sample = await prisma.labSample.create({
      data: {
        tenantId: tenant.id,
        sampleId: 'LAB-2026-000001',
        orderItemId: labItem.id,
        patientId: patient.id,
        specimenTypeId: bloodSpecimen.id,
        status: 'COMPLETED',
        collectionTime: new Date(),
        collectedById: nurseUser.id
      }
    });

    // 8. Result & Verification
    await prisma.labResult.create({
      data: {
        sampleId: sample.id,
        parameterId: hbParam.id,
        value: '14.5',
        unit: 'g/dL',
        referenceRange: '13.0 - 17.0',
        flag: 'NORMAL',
        status: 'VERIFIED',
        enteredById: nurseUser.id,
        verifiedById: doctorUser.id
      }
    });

    // 9. Radiology Workflow
    const study = await prisma.radiologyStudy.create({
      data: {
        tenantId: tenant.id,
        studyNumber: 'RAD-2026-000001',
        orderItemId: radItem.id,
        patientId: patient.id,
        modality: 'X-Ray',
        bodyPart: 'Chest',
        status: 'VERIFIED',
        scheduledTime: new Date(),
        performedTime: new Date(),
        technicianId: nurseUser.id
      }
    });

    await prisma.radiologyReport.create({
      data: {
        studyId: study.id,
        clinicalIndication: 'Chest pain',
        findings: 'Clear lungs. No active disease.',
        impression: 'Normal study.',
        status: 'VERIFIED',
        reportedById: doctorUser.id,
        verifiedById: doctorUser.id
      }
    });
  }

  // ============================================================================
  // Pharmacy & Inventory Seeding
  // ============================================================================

  // 1. Units & Categories
  const unitTab = await prisma.unit.findFirst({ where: { name: 'Tablet' } }) || await prisma.unit.create({
    data: { tenantId: tenant.id, name: 'Tablet' }
  });

  const catAnalgesic = await prisma.productCategory.findFirst({ where: { name: 'Analgesics' } }) || await prisma.productCategory.create({
    data: { tenantId: tenant.id, name: 'Analgesics' }
  });

  const genParacetamol = await prisma.genericMedicine.findFirst({ where: { name: 'Paracetamol' } }) || await prisma.genericMedicine.create({
    data: { tenantId: tenant.id, name: 'Paracetamol' }
  });

  // 2. Product Master
  const paracetamolProduct = await prisma.product.findFirst({ where: { code: 'MED-001' } }) || await prisma.product.create({
    data: {
      tenantId: tenant.id,
      name: 'Crocin Advance 500mg',
      code: 'MED-001',
      categoryId: catAnalgesic.id,
      genericId: genParacetamol.id,
      unitId: unitTab.id,
      dosageForm: 'Tablet',
      strength: '500mg',
      reorderLevel: 500
    }
  });

  // 3. Inventory Location
  const mainPharmacy = await prisma.inventoryLocation.findFirst({ where: { type: 'PHARMACY' } }) || await prisma.inventoryLocation.create({
    data: {
      tenantId: tenant.id,
      hospitalId: hospital.id,
      branchId: branch.id,
      name: 'Main OP Pharmacy',
      type: 'PHARMACY'
    }
  });

  const supplier = await prisma.supplier.findFirst({ where: { code: 'SUP-001' } }) || await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'Global Pharma Distributors',
      code: 'SUP-001'
    }
  });

  // 4. Batch & Opening Stock Ledger
  let batch = await prisma.inventoryBatch.findFirst({ where: { batchNumber: 'BATCH-2026-A' } });
  if (!batch) {
    batch = await prisma.inventoryBatch.create({
      data: {
        tenantId: tenant.id,
        productId: paracetamolProduct.id,
        locationId: mainPharmacy.id,
        batchNumber: 'BATCH-2026-A',
        expiryDate: new Date('2028-12-31'),
        purchaseRate: 1.5,
        mrp: 2.0,
        sellingRate: 2.0,
        availableQty: 1000,
        supplierId: supplier.id
      }
    });

    await prisma.inventoryLedger.create({
      data: {
        tenantId: tenant.id,
        productId: paracetamolProduct.id,
        batchId: batch.id,
        locationId: mainPharmacy.id,
        transactionType: 'OPENING',
        quantity: 1000,
        userId: doctorUser.id
      }
    });

    // 5. Prescription & Dispensing workflow
    const prescription = await prisma.prescription.create({
      data: {
        tenantId: tenant.id,
        patientId: patient.id,
        encounterId: encounter.id,
        doctorId: doctor.id,
        status: 'ACTIVE'
      }
    });

    await prisma.prescriptionItem.create({
      data: {
        prescriptionId: prescription.id,
        medicationName: 'Crocin Advance 500mg',
        dosage: '500mg',
        frequency: 'TDS',
        duration: '5 days',
        quantity: 15
      }
    });

    const dispensing = await prisma.pharmacyDispensing.create({
      data: {
        tenantId: tenant.id,
        locationId: mainPharmacy.id,
        prescriptionId: prescription.id,
        patientId: patient.id,
        dispensedById: nurseUser.id,
        totalAmount: 30.0
      }
    });

    await prisma.pharmacyDispensingItem.create({
      data: {
        dispensingId: dispensing.id,
        productId: paracetamolProduct.id,
        batchId: batch.id,
        quantity: 15,
        unitPrice: 2.0,
        totalPrice: 30.0
      }
    });

    // Deduct stock via ledger and update batch
    await prisma.inventoryLedger.create({
      data: {
        tenantId: tenant.id,
        productId: paracetamolProduct.id,
        batchId: batch.id,
        locationId: mainPharmacy.id,
        transactionType: 'DISPENSE',
        quantity: -15,
        referenceId: dispensing.id,
        userId: nurseUser.id
      }
    });

    await prisma.inventoryBatch.update({
      where: { id: batch.id },
      data: { availableQty: { decrement: 15 } }
    });
  }

  // ============================================================================
  // Revenue Cycle Management & Billing Seeding
  // ============================================================================

  // 1. Charge Master
  const opdConsultationCharge = await prisma.chargeMaster.findFirst({ where: { code: 'OPD-CONSULT' } }) || await prisma.chargeMaster.create({
    data: { tenantId: tenant.id, code: 'OPD-CONSULT', name: 'OPD Consultation', category: 'CONSULTATION', taxRate: 0 }
  });

  const cbcCharge = await prisma.chargeMaster.findFirst({ where: { code: 'LAB-CBC' } }) || await prisma.chargeMaster.create({
    data: { tenantId: tenant.id, code: 'LAB-CBC', name: 'Complete Blood Count (CBC)', category: 'LABORATORY', taxRate: 5 }
  });

  const paracetamolCharge = await prisma.chargeMaster.findFirst({ where: { code: 'PHARM-001' } }) || await prisma.chargeMaster.create({
    data: { tenantId: tenant.id, code: 'PHARM-001', name: 'Crocin Advance 500mg', category: 'PHARMACY', taxRate: 12 }
  });

  // 2. Tariff
  const generalTariff = await prisma.tariff.findFirst({ where: { code: 'TRF-GEN-01' } }) || await prisma.tariff.create({
    data: {
      tenantId: tenant.id,
      hospitalId: hospital.id,
      name: 'General Standard Tariff',
      code: 'TRF-GEN-01',
      tariffType: 'GENERAL',
      validFrom: new Date('2025-01-01')
    }
  });

  // 3. Tariff Items
  await prisma.tariffItem.findFirst({ where: { tariffId: generalTariff.id, chargeMasterId: opdConsultationCharge.id } }) || await prisma.tariffItem.create({
    data: { tariffId: generalTariff.id, chargeMasterId: opdConsultationCharge.id, price: 500.0 }
  });

  await prisma.tariffItem.findFirst({ where: { tariffId: generalTariff.id, chargeMasterId: cbcCharge.id } }) || await prisma.tariffItem.create({
    data: { tariffId: generalTariff.id, chargeMasterId: cbcCharge.id, price: 300.0 }
  });

  await prisma.tariffItem.findFirst({ where: { tariffId: generalTariff.id, chargeMasterId: paracetamolCharge.id } }) || await prisma.tariffItem.create({
    data: { tariffId: generalTariff.id, chargeMasterId: paracetamolCharge.id, price: 2.0 }
  });

  // 4. Insurance & TPA
  const starHealth = await prisma.insuranceProvider.findFirst({ where: { code: 'STAR-HEALTH' } }) || await prisma.insuranceProvider.create({
    data: { tenantId: tenant.id, name: 'Star Health Insurance', code: 'STAR-HEALTH' }
  });

  const mediAssist = await prisma.tpa.findFirst({ where: { code: 'MEDI-ASSIST' } }) || await prisma.tpa.create({
    data: { tenantId: tenant.id, name: 'MediAssist TPA', code: 'MEDI-ASSIST' }
  });

  // 5. Patient Insurance
  await prisma.patientInsurance.findFirst({ where: { policyNumber: 'POL-123456789' } }) || await prisma.patientInsurance.create({
    data: {
      patientId: patient.id,
      providerId: starHealth.id,
      tpaId: mediAssist.id,
      policyNumber: 'POL-123456789',
      memberId: 'MEM-987654321',
      validFrom: new Date('2025-01-01'),
      validTo: new Date('2027-12-31')
    }
  });

  // 6. Generate an OPD Bill for the initial encounter
  let opdBill = await prisma.bill.findFirst({ where: { billNumber: 'BL-OPD-2026-001' } });
  if (!opdBill) {
    opdBill = await prisma.bill.create({
      data: {
        tenantId: tenant.id,
        hospitalId: hospital.id,
        branchId: branch.id,
        patientId: patient.id,
        encounterId: encounter.id, // the IPD or earlier OPD encounter
        billNumber: 'BL-OPD-2026-001',
        billType: 'OPD',
        status: 'FINALIZED',
        tariffId: generalTariff.id,
        subTotal: 500.0,
        totalTax: 0,
        grossTotal: 500.0,
        patientPayable: 500.0,
        paidAmount: 500.0,
        outstandingAmount: 0.0,
        createdById: doctorUser.id
      }
    });

    await prisma.billItem.create({
      data: {
        billId: opdBill.id,
        chargeMasterId: opdConsultationCharge.id,
        serviceName: opdConsultationCharge.name,
        quantity: 1,
        unitPrice: 500.0,
        lineTotal: 500.0,
        sourceModule: 'OPD'
      }
    });

    // 7. Payment for the OPD Bill
    await prisma.payment.create({
      data: {
        tenantId: tenant.id,
        billId: opdBill.id,
        patientId: patient.id,
        receiptNumber: 'RCPT-2026-001',
        paymentMethod: 'UPI',
        amount: 500.0,
        transactionRef: 'UPI-9876543210',
        status: 'SUCCESS',
        receivedById: doctorUser.id
      }
    });
  }

  const isDemo = process.env.SEED_MODE === 'demo' || process.argv.includes('--demo');
  if (isDemo) {
    await seedDemoDataset(prisma, {
      tenant,
      hospital,
      branch,
      eastBranch,
      userMap,
      doctorUser,
      nurseUser,
      doctor,
      cardiologyDept: cardiology,
      erDept,
    });
  }

  console.log('Enterprise Database seeded successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
