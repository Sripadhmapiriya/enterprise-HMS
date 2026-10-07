import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('ipd'));

function generateAdmissionNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ADM-${dateStr}-${rand}`;
}

// =========================================================================
// VALIDATION SCHEMAS
// =========================================================================

const CreateWardSchema = z.object({
  name: z.string().min(1, 'Ward name is required'),
  code: z.string().min(1, 'Ward code is required'),
  wardType: z.enum(['GENERAL', 'ICU', 'PRIVATE', 'MATERNITY', 'PEDIATRIC']).default('GENERAL'),
  capacity: z.number().int().positive().default(20),
  floor: z.string().optional(),
  description: z.string().optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
});

const CreateBedSchema = z.object({
  wardId: z.string().min(1, 'Ward ID is required'),
  roomId: z.string().optional(),
  bedNumber: z.string().min(1, 'Bed number is required'),
  bedType: z.enum(['REGULAR', 'ICU', 'OXYGEN', 'VENTILATOR', 'ISOLATION']).default('REGULAR'),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE']).default('AVAILABLE'),
});

const CreateAdmissionSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  encounterId: z.string().optional(),
  admissionType: z.enum(['PLANNED', 'EMERGENCY', 'TRANSFER', 'DAY_CARE']).default('PLANNED'),
  admissionSource: z.enum(['OPD', 'EMERGENCY', 'DIRECT', 'TRANSFER']).default('OPD'),
  reason: z.string().optional(),
  departmentId: z.string().optional(),
  admittingDocId: z.string().optional(),
  attendingDocId: z.string().optional(),
  bedId: z.string().optional(),
  expectedDischargeDate: z.string().optional(),
  branchId: z.string().optional(),
  hospitalId: z.string().optional(),
});

const AllocateBedSchema = z.object({
  bedId: z.string().min(1, 'Bed ID is required'),
  reason: z.string().optional(),
});

const NursingAssessmentSchema = z.object({
  generalCondition: z.string().optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  mobility: z.string().optional(),
  fallRisk: z.string().optional(),
  nutrition: z.string().optional(),
  skinCondition: z.string().optional(),
  mentalStatus: z.string().optional(),
  notes: z.string().optional(),
});

const IntakeOutputSchema = z.object({
  type: z.enum(['INTAKE', 'OUTPUT']),
  category: z.string().min(1, 'Category is required (e.g. ORAL, IV, URINE, DRAIN)'),
  amount: z.number().positive('Amount must be positive'),
  unit: z.string().default('ml'),
  notes: z.string().optional(),
});

const DoctorRoundSchema = z.object({
  clinicalStatus: z.string().optional(),
  progressNote: z.string().min(1, 'Progress note is required'),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  doctorId: z.string().optional(),
});

const MedicationOrderSchema = z.object({
  medicationName: z.string().min(1, 'Medication name is required'),
  dose: z.string().min(1, 'Dose is required'),
  route: z.string().default('ORAL'),
  frequency: z.string().default('TID'),
  instructions: z.string().optional(),
  doctorId: z.string().optional(),
  scheduledTimes: z.array(z.string()).optional(),
});

const AdministerMarSchema = z.object({
  patientVerificationChecked: z.boolean().refine(val => val === true, 'Right patient must be verified'),
  medicationVerificationChecked: z.boolean().refine(val => val === true, 'Right medication must be verified'),
  doseVerificationChecked: z.boolean().refine(val => val === true, 'Right dose must be verified'),
  routeVerificationChecked: z.boolean().refine(val => val === true, 'Right route must be verified'),
  timeVerificationChecked: z.boolean().refine(val => val === true, 'Right time must be verified'),
  notes: z.string().optional(),
});

const TransferBedSchema = z.object({
  toBedId: z.string().min(1, 'Target bed ID is required'),
  reason: z.string().optional(),
});

const DischargeSummarySchema = z.object({
  finalDiagnosis: z.string().min(1, 'Final diagnosis is required'),
  hospitalCourse: z.string().min(1, 'Hospital course summary is required'),
  dischargeCondition: z.string().default('STABLE'),
  medications: z.string().optional(),
  followUpPlan: z.string().optional(),
});

// =========================================================================
// 1. WARDS, ROOMS & BED BOARD
// =========================================================================

// GET /api/v1/ipd/wards
router.get('/wards', requirePermission('ipd.wards.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const wards = await req.prismaTenant.ward.findMany({
      where: { tenantId },
      include: {
        rooms: true,
        beds: true,
        department: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: wards });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ipd/wards
router.post('/wards', requirePermission('ipd.wards.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    let branchId = req.branchId || (req.user as any)?.branchId;
    if (!branchId) {
      const b = await req.prismaTenant.branch.findFirst();
      branchId = b?.id;
    }

    const body = CreateWardSchema.parse(req.body);
    const ward = await req.prismaTenant.ward.create({
      data: {
        tenantId,
        branchId: body.branchId || branchId!,
        departmentId: body.departmentId,
        name: body.name,
        code: body.code,
        wardType: body.wardType,
        capacity: body.capacity,
        floor: body.floor,
        description: body.description,
      },
    });

    res.status(201).json({ success: true, data: ward });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ipd/beds
router.get('/beds', requirePermission('ipd.beds.read'), async (req, res, next) => {
  try {
    const { wardId, status, bedType } = req.query;
    const where: any = {};
    if (wardId) where.wardId = String(wardId);
    if (status) where.status = String(status);
    if (bedType) where.bedType = String(bedType);

    const beds = await req.prismaTenant.bed.findMany({
      where,
      include: {
        ward: true,
        room: true,
        allocations: {
          where: { status: 'ACTIVE' },
          include: {
            admission: {
              include: {
                patient: { select: { id: true, mrn: true, firstName: true, lastName: true, gender: true, dateOfBirth: true } },
                attendingDoctor: { include: { user: true } },
              },
            },
          },
        },
      },
      orderBy: { bedNumber: 'asc' },
    });

    res.json({ success: true, data: beds });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ipd/beds
router.post('/beds', requirePermission('ipd.beds.create'), async (req, res, next) => {
  try {
    const body = CreateBedSchema.parse(req.body);
    const bed = await req.prismaTenant.bed.create({
      data: {
        wardId: body.wardId,
        roomId: body.roomId,
        bedNumber: body.bedNumber,
        bedType: body.bedType,
        status: body.status,
      },
      include: { ward: true, room: true },
    });

    res.status(201).json({ success: true, data: bed });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ipd/bed-board (Real-time graphical/matrix occupancy overview)
router.get('/bed-board', requirePermission('ipd.beds.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const wards = await req.prismaTenant.ward.findMany({
      where: { tenantId },
      include: {
        beds: {
          include: {
            allocations: {
              where: { status: 'ACTIVE' },
              include: {
                admission: {
                  include: {
                    patient: { select: { id: true, mrn: true, firstName: true, lastName: true, gender: true, bloodGroup: true } },
                    attendingDoctor: { include: { user: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    let totalBeds = 0;
    let occupiedBeds = 0;
    let availableBeds = 0;
    let cleaningBeds = 0;
    let maintenanceBeds = 0;

    for (const w of wards) {
      for (const b of w.beds) {
        totalBeds++;
        if (b.status === 'OCCUPIED') occupiedBeds++;
        else if (b.status === 'AVAILABLE') availableBeds++;
        else if (b.status === 'CLEANING') cleaningBeds++;
        else if (b.status === 'MAINTENANCE') maintenanceBeds++;
      }
    }

    res.json({
      success: true,
      data: {
        wards,
        totalBeds,
        occupiedBeds,
        availableBeds,
        cleaningBeds,
        maintenanceBeds,
        metrics: {
          totalBeds,
          occupiedBeds,
          availableBeds,
          cleaningBeds,
          maintenanceBeds,
          occupancyRatePercent: totalBeds > 0 ? parseFloat(((occupiedBeds / totalBeds) * 100).toFixed(1)) : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. ADMISSION LIFECYCLE (ADT)
// =========================================================================

// POST /api/v1/ipd/admissions (Request or create Inpatient Admission)
router.post('/admissions', requirePermission('ipd.admissions.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    let hospitalId = req.hospitalId || (req.user as any)?.hospitalId;
    let branchId = req.branchId || (req.user as any)?.branchId;

    if (!hospitalId || !branchId) {
      let hospital = await req.prismaTenant.hospital.findFirst({ where: { tenantId } });
      if (!hospital) hospital = await req.prismaTenant.hospital.findFirst();
      if (hospital) {
        hospitalId = hospital.id;
        let branch = await req.prismaTenant.branch.findFirst({ where: { hospitalId } });
        if (!branch) branch = await req.prismaTenant.branch.findFirst();
        if (branch) branchId = branch.id;
      }
    }

    const body = CreateAdmissionSchema.parse(req.body);

    let doctorId = body.attendingDocId || body.admittingDocId;
    if (!doctorId) {
      let doctor = await req.prismaTenant.doctor.findFirst({ where: { isActive: true } });
      if (!doctor) {
        let dept = await req.prismaTenant.department.findFirst({ where: { branchId } });
        if (!dept) {
          dept = await req.prismaTenant.department.create({
            data: { branchId: branchId!, name: 'Internal Medicine', code: 'MED-01' },
          });
        }
        doctor = await req.prismaTenant.doctor.create({
          data: {
            userId,
            branchId: branchId!,
            departmentId: dept.id,
            specialization: 'Internal Medicine',
            licenseNumber: 'DOC-IPD-001',
          },
        });
      }
      doctorId = doctor.id;
    }

    const docRecord = await req.prismaTenant.doctor.findFirst({ where: { id: doctorId } });
    let departmentId = body.departmentId || docRecord?.departmentId;
    if (!departmentId) {
      const dept = await req.prismaTenant.department.findFirst({ where: { branchId } });
      departmentId = dept?.id;
    }
    if (!departmentId) {
      const dept = await req.prismaTenant.department.create({
        data: { branchId: branchId!, name: 'General Medicine', code: 'GEN-MED' },
      });
      departmentId = dept.id;
    }

    // Resolve or create encounter
    let encounterId = body.encounterId;
    if (!encounterId) {
      const enc = await req.prismaTenant.encounter.create({
        data: {
          tenantId,
          hospitalId: hospitalId!,
          branchId: branchId!,
          departmentId,
          doctorId,
          patientId: body.patientId,
          type: 'IPD',
          status: 'IN_PROGRESS',
        },
      });
      encounterId = enc.id;
    }

    const admissionNumber = generateAdmissionNumber();

    const admission = await req.prismaTenant.admission.create({
      data: {
        tenantId,
        hospitalId: hospitalId!,
        branchId: branchId!,
        patientId: body.patientId,
        encounterId,
        admissionNumber,
        admissionType: body.admissionType,
        admissionSource: body.admissionSource,
        reason: body.reason || 'Inpatient therapeutic management and observation',
        departmentId,
        admittingDocId: body.admittingDocId || doctorId,
        attendingDocId: doctorId,
        status: body.bedId ? 'ADMITTED' : 'REQUESTED',
        expectedDischargeDate: body.expectedDischargeDate ? new Date(body.expectedDischargeDate) : undefined,
      },
      include: {
        patient: true,
        department: true,
        admittingDoctor: { include: { user: true } },
        attendingDoctor: { include: { user: true } },
      },
    });

    // If bed allocated immediately
    if (body.bedId) {
      await req.prismaTenant.bedAllocation.create({
        data: {
          admissionId: admission.id,
          bedId: body.bedId,
          allocatedById: userId,
          status: 'ACTIVE',
        },
      });

      await req.prismaTenant.bed.update({
        where: { id: body.bedId },
        data: { status: 'OCCUPIED' },
      });
    }

    res.status(201).json({
      success: true,
      message: `Inpatient admission record created with ${admissionNumber}`,
      data: admission,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ipd/admissions (List active or historical admissions)
router.get('/admissions', requirePermission('ipd.admissions.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { status, patientId } = req.query;
    const where: any = { tenantId };
    if (status) where.status = String(status);
    if (patientId) where.patientId = String(patientId);

    const admissions = await req.prismaTenant.admission.findMany({
      where,
      include: {
        patient: true,
        department: true,
        attendingDoctor: { include: { user: true } },
        bedAllocations: {
          where: { status: 'ACTIVE' },
          include: { bed: { include: { ward: true, room: true } } },
        },
      },
      orderBy: { admissionDate: 'desc' },
      take: 100,
    });

    res.json({ success: true, data: admissions });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ipd/admissions/:id (Detailed clinical chart bundle)
router.get('/admissions/:id', requirePermission('ipd.admissions.read'), async (req, res, next) => {
  try {
    const admission = await req.prismaTenant.admission.findFirst({
      where: { id: req.params.id },
      include: {
        patient: {
          include: {
            allergies: { where: { status: 'ACTIVE' } },
            alerts: { where: { isActive: true } },
          },
        },
        department: true,
        attendingDoctor: { include: { user: true } },
        admittingDoctor: { include: { user: true } },
        bedAllocations: {
          where: { status: 'ACTIVE' },
          include: { bed: { include: { ward: true, room: true } } },
        },
        nursingAssessments: { orderBy: { createdAt: 'desc' } },
        nursingNotes: { orderBy: { createdAt: 'desc' }, take: 10 },
        doctorRounds: { orderBy: { createdAt: 'desc' }, include: { doctor: { include: { user: true } } } },
        intakeOutputs: { orderBy: { recordedAt: 'desc' }, take: 20 },
        medicationOrders: {
          include: {
            administrations: { orderBy: { scheduledTime: 'desc' }, take: 10 },
          },
        },
        carePlans: { include: { items: true } },
        dischargePlan: true,
        dischargeSummary: true,
      },
    });

    if (!admission) throw AppError.notFound('Admission record not found');

    res.json({ success: true, data: admission });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ipd/admissions/:id/allocate-bed
router.post('/admissions/:id/allocate-bed', requirePermission('ipd.admissions.edit'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = AllocateBedSchema.parse(req.body);

    const admission = await req.prismaTenant.admission.findFirst({
      where: { id: req.params.id },
      include: { bedAllocations: { where: { status: 'ACTIVE' } } },
    });
    if (!admission) throw AppError.notFound('Admission not found');

    const bed = await req.prismaTenant.bed.findFirst({
      where: { id: body.bedId },
      include: { ward: true },
    });
    if (!bed) throw AppError.notFound('Bed not found');
    if (bed.status !== 'AVAILABLE') {
      throw AppError.badRequest(`Bed ${bed.bedNumber} is currently ${bed.status}`);
    }

    // Release any previous active bed
    for (const alloc of admission.bedAllocations) {
      await req.prismaTenant.bedAllocation.update({
        where: { id: alloc.id },
        data: { status: 'RELEASED', endTime: new Date(), releasedById: userId },
      });
      await req.prismaTenant.bed.update({
        where: { id: alloc.bedId },
        data: { status: 'AVAILABLE' },
      });
    }

    // Create new allocation
    const allocation = await req.prismaTenant.bedAllocation.create({
      data: {
        admissionId: admission.id,
        bedId: bed.id,
        allocatedById: userId,
        status: 'ACTIVE',
        reason: body.reason,
      },
      include: { bed: { include: { ward: true } } },
    });

    // Mark bed occupied and admission admitted
    await req.prismaTenant.bed.update({
      where: { id: bed.id },
      data: { status: 'OCCUPIED' },
    });

    const updatedAdmission = await req.prismaTenant.admission.update({
      where: { id: admission.id },
      data: { status: 'ADMITTED' },
      include: {
        patient: true,
        bedAllocations: { where: { status: 'ACTIVE' }, include: { bed: { include: { ward: true } } } },
      },
    });

    res.json({
      success: true,
      message: `Bed ${bed.bedNumber} in ${bed.ward.name} allocated to admission`,
      data: { admission: updatedAdmission, allocation },
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. NURSING ASSESSMENTS, VITALS & INTAKE/OUTPUT
// =========================================================================

// POST /api/v1/ipd/admissions/:id/nursing-assessments
router.post('/admissions/:id/nursing-assessments', requirePermission('ipd.nursing.create'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = NursingAssessmentSchema.parse(req.body);

    const admission = await req.prismaTenant.admission.findFirst({ where: { id: req.params.id } });
    if (!admission) throw AppError.notFound('Admission not found');

    const assessment = await req.prismaTenant.nursingAssessment.create({
      data: {
        admissionId: admission.id,
        nurseId: userId,
        generalCondition: body.generalCondition || 'Alert and oriented',
        painScore: body.painScore ?? 0,
        mobility: body.mobility || 'Independent',
        fallRisk: body.fallRisk || 'LOW',
        nutrition: body.nutrition || 'Normal',
        skinCondition: body.skinCondition || 'Intact',
        mentalStatus: body.mentalStatus || 'Oriented x3',
        notes: body.notes,
      },
      include: { nurse: { select: { firstName: true, lastName: true } } },
    });

    res.status(201).json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ipd/admissions/:id/nursing-assessments
router.get('/admissions/:id/nursing-assessments', requirePermission('ipd.nursing.create'), async (req, res, next) => {
  try {
    const assessments = await req.prismaTenant.nursingAssessment.findMany({
      where: { admissionId: req.params.id },
      include: { nurse: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: assessments });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ipd/admissions/:id/intake-output
router.post('/admissions/:id/intake-output', requirePermission('ipd.nursing.create'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = IntakeOutputSchema.parse(req.body);

    const admission = await req.prismaTenant.admission.findFirst({ where: { id: req.params.id } });
    if (!admission) throw AppError.notFound('Admission not found');

    const record = await req.prismaTenant.intakeOutputRecord.create({
      data: {
        admissionId: admission.id,
        recordedById: userId,
        type: body.type,
        category: body.category,
        amount: body.amount,
        unit: body.unit,
        notes: body.notes,
      },
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ipd/admissions/:id/intake-output
router.get('/admissions/:id/intake-output', requirePermission('ipd.nursing.create'), async (req, res, next) => {
  try {
    const records = await req.prismaTenant.intakeOutputRecord.findMany({
      where: { admissionId: req.params.id },
      orderBy: { recordedAt: 'asc' },
    });
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 4. DOCTOR ROUNDS & CLINICAL CARE PLANS
// =========================================================================

// POST /api/v1/ipd/admissions/:id/rounds
router.post('/admissions/:id/rounds', requirePermission('ipd.rounds.create'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = DoctorRoundSchema.parse(req.body);

    const admission = await req.prismaTenant.admission.findFirst({ where: { id: req.params.id } });
    if (!admission) throw AppError.notFound('Admission not found');

    let doctorId = body.doctorId;
    if (!doctorId) {
      let doctor = await req.prismaTenant.doctor.findFirst({ where: { userId } });
      if (!doctor) doctor = await req.prismaTenant.doctor.findFirst({ where: { isActive: true } });
      doctorId = doctor?.id || admission.attendingDocId;
    }

    const round = await req.prismaTenant.doctorRound.create({
      data: {
        admissionId: admission.id,
        doctorId: doctorId!,
        clinicalStatus: body.clinicalStatus || 'STABLE',
        progressNote: body.progressNote,
        assessment: body.assessment,
        plan: body.plan,
      },
      include: { doctor: { include: { user: true } } },
    });

    res.status(201).json({ success: true, data: round });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ipd/admissions/:id/rounds
router.get('/admissions/:id/rounds', requirePermission('ipd.rounds.create'), async (req, res, next) => {
  try {
    const rounds = await req.prismaTenant.doctorRound.findMany({
      where: { admissionId: req.params.id },
      include: { doctor: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: rounds });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 5. MEDICATION ORDERS & MAR (5-RIGHTS ADMINISTRATION CHECK)
// =========================================================================

// POST /api/v1/ipd/admissions/:id/medication-orders
router.post('/admissions/:id/medication-orders', requirePermission('ipd.medication.create'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = MedicationOrderSchema.parse(req.body);

    const admission = await req.prismaTenant.admission.findFirst({ where: { id: req.params.id } });
    if (!admission) throw AppError.notFound('Admission not found');

    let doctorId = body.doctorId;
    if (!doctorId) {
      let doctor = await req.prismaTenant.doctor.findFirst({ where: { userId } });
      if (!doctor) doctor = await req.prismaTenant.doctor.findFirst({ where: { isActive: true } });
      doctorId = doctor?.id || admission.attendingDocId;
    }

    const medOrder = await req.prismaTenant.medicationOrder.create({
      data: {
        admissionId: admission.id,
        doctorId: doctorId!,
        medicationName: body.medicationName,
        dose: body.dose,
        route: body.route,
        frequency: body.frequency,
        instructions: body.instructions,
        status: 'ACTIVE',
      },
    });

    // Schedule initial administrations for MAR
    const now = new Date();
    const scheduledHours = [9, 13, 18, 21];
    for (const hr of scheduledHours) {
      const scheduledTime = new Date(now);
      scheduledTime.setHours(hr, 0, 0, 0);
      await req.prismaTenant.medicationAdministration.create({
        data: {
          orderId: medOrder.id,
          nurseId: userId,
          scheduledTime,
          status: 'SCHEDULED',
        },
      });
    }

    const fullOrder = await req.prismaTenant.medicationOrder.findFirst({
      where: { id: medOrder.id },
      include: { administrations: true, doctor: { include: { user: true } } },
    });

    res.status(201).json({ success: true, data: fullOrder });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ipd/admissions/:id/medication-orders
router.get('/admissions/:id/medication-orders', requirePermission('ipd.medication.read'), async (req, res, next) => {
  try {
    const orders = await req.prismaTenant.medicationOrder.findMany({
      where: { admissionId: req.params.id },
      include: {
        administrations: { orderBy: { scheduledTime: 'asc' } },
        doctor: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ipd/admissions/:id/mar (Medication Administration Record)
router.get('/admissions/:id/mar', requirePermission('ipd.medication.read'), async (req, res, next) => {
  try {
    const admission = await req.prismaTenant.admission.findFirst({
      where: { id: req.params.id },
      include: {
        patient: true,
        medicationOrders: {
          where: { status: 'ACTIVE' },
          include: {
            administrations: { orderBy: { scheduledTime: 'asc' } },
            doctor: { include: { user: true } },
          },
        },
      },
    });

    if (!admission) throw AppError.notFound('Admission not found');

    res.json({ success: true, data: admission.medicationOrders });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ipd/mar/:administrationId/administer (5-Rights Check & Drug Execution)
router.post('/mar/:administrationId/administer', requirePermission('ipd.nursing.administer'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = AdministerMarSchema.parse(req.body);

    let adminRecord = await req.prismaTenant.medicationAdministration.findFirst({
      where: { id: req.params.administrationId },
      include: { order: { include: { admission: { include: { patient: true } } } } },
    });

    if (!adminRecord) {
      // Support passing medicationOrderId
      adminRecord = await req.prismaTenant.medicationAdministration.findFirst({
        where: { orderId: req.params.administrationId, status: 'SCHEDULED' },
        include: { order: { include: { admission: { include: { patient: true } } } } },
      });
    }

    if (!adminRecord) throw AppError.notFound('Medication administration task not found');

    const updated = await req.prismaTenant.medicationAdministration.update({
      where: { id: adminRecord.id },
      data: {
        status: 'GIVEN',
        actualTime: new Date(),
        nurseId: userId,
        notes: body.notes || '5-Rights verified by licensed nurse (Patient, Drug, Dose, Route, Time)',
      },
      include: { order: true, nurse: { select: { firstName: true, lastName: true } } },
    });

    res.status(201).json({
      success: true,
      message: 'Medication administered successfully with verified 5-Rights check',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 6. BED TRANSFERS
// =========================================================================

// POST /api/v1/ipd/admissions/:id/transfer
router.post('/admissions/:id/transfer', requirePermission('ipd.admissions.edit'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = TransferBedSchema.parse(req.body);

    const admission = await req.prismaTenant.admission.findFirst({
      where: { id: req.params.id },
      include: { bedAllocations: { where: { status: 'ACTIVE' } } },
    });
    if (!admission) throw AppError.notFound('Admission not found');

    const targetBed = await req.prismaTenant.bed.findFirst({
      where: { id: body.toBedId },
      include: { ward: true },
    });
    if (!targetBed) throw AppError.notFound('Target bed not found');
    if (targetBed.status !== 'AVAILABLE') {
      throw AppError.badRequest(`Target bed ${targetBed.bedNumber} is not available (${targetBed.status})`);
    }

    const currentAlloc = admission.bedAllocations[0];
    const fromBedId = currentAlloc?.bedId;

    if (currentAlloc) {
      await req.prismaTenant.bedAllocation.update({
        where: { id: currentAlloc.id },
        data: { status: 'RELEASED', endTime: new Date(), releasedById: userId },
      });
      // Flag previous bed for cleaning
      await req.prismaTenant.bed.update({
        where: { id: currentAlloc.bedId },
        data: { status: 'CLEANING' },
      });
    }

    // Allocate target bed
    const newAlloc = await req.prismaTenant.bedAllocation.create({
      data: {
        admissionId: admission.id,
        bedId: targetBed.id,
        allocatedById: userId,
        status: 'ACTIVE',
        reason: body.reason || 'Ward transfer',
      },
    });

    await req.prismaTenant.bed.update({
      where: { id: targetBed.id },
      data: { status: 'OCCUPIED' },
    });

    const transfer = await req.prismaTenant.transfer.create({
      data: {
        admissionId: admission.id,
        fromBedId,
        toBedId: targetBed.id,
        requestedById: userId,
        approvedById: userId,
        status: 'COMPLETED',
        transferTime: new Date(),
        reason: body.reason,
      },
      include: { fromBed: true, toBed: true },
    });

    res.json({
      success: true,
      message: `Patient transferred to Bed ${targetBed.bedNumber} (${targetBed.ward.name})`,
      data: { transfer, newAllocation: newAlloc },
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 7. DISCHARGE PLANNING, SUMMARY & FINAL CLEARANCE
// =========================================================================

// POST /api/v1/ipd/admissions/:id/discharge-summary
router.post('/admissions/:id/discharge-summary', requirePermission('ipd.admissions.edit'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = DischargeSummarySchema.parse(req.body);

    const admission = await req.prismaTenant.admission.findFirst({ where: { id: req.params.id } });
    if (!admission) throw AppError.notFound('Admission not found');

    const summary = await req.prismaTenant.dischargeSummary.upsert({
      where: { admissionId: admission.id },
      update: {
        finalDiagnosis: body.finalDiagnosis,
        hospitalCourse: body.hospitalCourse,
        dischargeCondition: body.dischargeCondition,
        medications: body.medications,
        followUpPlan: body.followUpPlan,
        completedById: userId,
      },
      create: {
        admissionId: admission.id,
        finalDiagnosis: body.finalDiagnosis,
        hospitalCourse: body.hospitalCourse,
        dischargeCondition: body.dischargeCondition,
        medications: body.medications,
        followUpPlan: body.followUpPlan,
        completedById: userId,
      },
    });

    await req.prismaTenant.admission.update({
      where: { id: admission.id },
      data: { status: 'DISCHARGE_PLANNED' },
    });

    res.status(201).json({
      success: true,
      message: 'Discharge summary signed and recorded',
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ipd/admissions/:id/discharge-summary
router.get('/admissions/:id/discharge-summary', requirePermission('ipd.admissions.read'), async (req, res, next) => {
  try {
    const summary = await req.prismaTenant.dischargeSummary.findFirst({
      where: { admissionId: req.params.id },
      include: { completedBy: { select: { firstName: true, lastName: true } } },
    });
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ipd/admissions/:id/billing-clearance
router.get('/admissions/:id/billing-clearance', requirePermission('ipd.admissions.read'), async (req, res, next) => {
  try {
    const admission = await req.prismaTenant.admission.findFirst({
      where: { id: req.params.id },
      include: {
        encounter: { include: { bills: true } },
      },
    });

    if (!admission) throw AppError.notFound('Admission not found');

    const outstandingBills = (admission.encounter?.bills || []).filter(
      (b: any) => b.status === 'FINALIZED' && b.outstandingAmount > 0
    );

    const totalDue = outstandingBills.reduce((sum: number, b: any) => sum + (b.outstandingAmount || 0), 0);

    res.json({
      success: true,
      data: {
        admissionId: admission.id,
        cleared: outstandingBills.length === 0,
        outstandingAmount: totalDue,
        outstandingBills,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ipd/admissions/:id/discharge (Final discharge & Automated Housekeeping Trigger)
router.post('/admissions/:id/discharge', requirePermission('ipd.admissions.edit'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const admission = await req.prismaTenant.admission.findFirst({
      where: { id: req.params.id },
      include: {
        bedAllocations: { where: { status: 'ACTIVE' }, include: { bed: { include: { ward: true } } } },
        encounter: { include: { bills: true } },
      },
    });

    if (!admission) throw AppError.notFound('Admission not found');
    if (admission.status === 'DISCHARGED') {
      throw AppError.badRequest('Patient is already discharged');
    }

    // Check financial clearance if bills exist
    const outstandingBills = (admission.encounter?.bills || []).filter(
      (b: any) => b.status === 'FINALIZED' && b.outstandingAmount > 0
    );
    if (outstandingBills.length > 0 && req.body.requireBillingClearance !== false) {
      const totalDue = outstandingBills.reduce((sum: number, b: any) => sum + b.outstandingAmount, 0);
      return res.status(400).json({
        success: false,
        error: {
          code: 'BILLING_CLEARANCE_REQUIRED',
          message: `Inpatient discharge requires billing clearance. Outstanding balance: $${totalDue.toFixed(2)} across ${outstandingBills.length} invoice(s).`,
          outstandingBills: outstandingBills.map((b: any) => ({
            billNumber: b.billNumber,
            outstandingAmount: b.outstandingAmount,
          })),
        },
      });
    }

    const now = new Date();
    const allocatedBeds = admission.bedAllocations;

    // Release all active beds and set to CLEANING
    for (const alloc of allocatedBeds) {
      await req.prismaTenant.bedAllocation.update({
        where: { id: alloc.id },
        data: { status: 'RELEASED', endTime: now, releasedById: userId },
      });

      await req.prismaTenant.bed.update({
        where: { id: alloc.bedId },
        data: { status: 'CLEANING' },
      });

      // Automatically trigger a Housekeeping Terminal Cleaning task!
      let branchId = admission.branchId || (req.user as any)?.branchId;
      if (!branchId) {
        const b = await req.prismaTenant.branch.findFirst();
        branchId = b?.id;
      }

      await req.prismaTenant.housekeepingTask.create({
        data: {
          tenantId: req.tenantId!,
          branchId: branchId!,
          locationRef: alloc.bed.id,
          locationType: 'WARD',
          taskType: 'TERMINAL',
          priority: 'HIGH',
          status: 'REQUESTED',
          requestedTime: now,
        },
      });
    }

    // Close encounter if open
    if (admission.encounterId) {
      await req.prismaTenant.encounter.update({
        where: { id: admission.encounterId },
        data: { status: 'COMPLETED', endTime: now },
      });
    }

    // Mark admission DISCHARGED
    const discharged = await req.prismaTenant.admission.update({
      where: { id: admission.id },
      data: {
        status: 'DISCHARGED',
        actualDischargeDate: now,
      },
      include: {
        patient: true,
        dischargeSummary: true,
      },
    });

    res.json({
      success: true,
      message: 'Inpatient discharged successfully; bed scheduled for terminal cleaning',
      data: {
        admission: discharged,
        releasedBeds: allocatedBeds.map((a: any) => a.bed.bedNumber),
        housekeepingTriggered: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
