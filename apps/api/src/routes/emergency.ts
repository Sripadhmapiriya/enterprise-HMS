import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { chargeCaptureService } from '../services/chargeCaptureService';

const router = Router();

// Authentication and Module Enforcement
router.use(authenticateToken);
router.use(requireModule('emergency'));

// Zod Schemas
const FastRegisterSchema = z.object({
  firstName: z.string().default('Unknown'),
  lastName: z.string().default('(Trauma)'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).default('UNKNOWN'),
  estimatedAge: z.number().int().min(0).max(120).optional(),
  arrivalMode: z.enum(['AMBULANCE', 'WALK_IN', 'WHEELCHAIR']).default('AMBULANCE'),
  broughtBy: z.string().optional(),
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  isMlc: z.boolean().default(false),
  policeStation: z.string().optional(),
  branchId: z.string().optional(),
});

const TriageSchema = z.object({
  encounterId: z.string().optional(),
  patientId: z.string().optional(),
  arrivalMode: z.enum(['AMBULANCE', 'WALK_IN', 'WHEELCHAIR']).default('WALK_IN'),
  priority: z.enum(['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE']), // ESI Levels 1 to 5
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  consciousness: z.enum(['ALERT', 'VERBAL', 'PAIN', 'UNRESPONSIVE']).default('ALERT'),
  painScore: z.number().int().min(0).max(10).optional(),
  vitals: z
    .object({
      systolic: z.number().optional(),
      diastolic: z.number().optional(),
      heartRate: z.number().optional(),
      temperature: z.number().optional(),
      oxygenSaturation: z.number().optional(),
      respiratoryRate: z.number().optional(),
    })
    .optional(),
  isMlc: z.boolean().default(false),
  policeStation: z.string().optional(),
  officerName: z.string().optional(),
  notes: z.string().optional(),
});

const ResuscitationSchema = z.object({
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  eventDescription: z.string().min(1, 'Event description is required'),
  interventions: z.string().min(1, 'Interventions performed is required'), // e.g., CPR, Epinephrine, Defibrillation
  outcome: z.enum(['ROSC_ACHIEVED', 'STABILIZED', 'ADMITTED_ICU', 'DECEASED', 'OTHER']).default('STABILIZED'),
});

const DispositionSchema = z.object({
  disposition: z.enum(['ADMIT', 'DISCHARGE', 'TRANSFER', 'LAMA', 'DECEASED']),
  notes: z.string().optional(),
  transferHospital: z.string().optional(),
  admissionWard: z.string().optional(),
  timeOfDeath: z.string().optional(),
});

// Helper to generate emergency MRN
function generateEmergencyMrn(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ER-${dateStr}-${rand}`;
}

// POST /api/v1/emergency/fast-register (Fast trauma walk-in intake)
router.post('/fast-register', requirePermission('emergency.triage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const hospitalId = req.hospitalId || (req.user as any)?.hospitalId;
    let branchId = req.branchId || (req.user as any)?.branchId;

    if (!hospitalId) {
      throw AppError.badRequest('Hospital context is required. You do not have a hospital assigned. Please contact the system administrator to assign a hospital to your account.');
    }

    if (!branchId) {
      const branch = await req.prismaTenant.branch.findFirst({
        where: { hospitalId, isActive: true },
      });
      if (branch) branchId = branch.id;
    }

    const body = FastRegisterSchema.parse(req.body);
    const mrn = generateEmergencyMrn();

    // 1. Create Patient
    const birthYear = body.estimatedAge ? new Date().getFullYear() - body.estimatedAge : 1990;
    const approxDob = new Date(birthYear, 0, 1);

    const patient = await req.prismaTenant.patient.create({
      data: {
        tenantId,
        hospitalId,
        mrn,
        firstName: body.firstName,
        lastName: body.lastName,
        gender: body.gender,
        dateOfBirth: approxDob,
        mobile: '0000000000',
        registrationSource: 'EMERGENCY_FAST_TRACK',
        status: 'ACTIVE',
      },
    });

    // 2. Find or create ER Department
    let erDept = await req.prismaTenant.department.findFirst({
      where: { branchId, code: 'ER' },
    });
    if (!erDept) {
      erDept = await req.prismaTenant.department.create({
        data: {
          branchId,
          name: 'Emergency Department',
          code: 'ER',
          type: 'EMERGENCY',
          isActive: true,
        },
      });
    }

    // 3. Find Doctor
    let doctor = await req.prismaTenant.doctor.findFirst({
      where: { isActive: true },
    });
    if (!doctor) {
      doctor = await req.prismaTenant.doctor.create({
        data: {
          userId,
          branchId,
          departmentId: erDept.id,
          licenseNumber: 'ER-DOC-' + Math.floor(1000 + Math.random() * 9000),
          specialization: 'Emergency Medicine',
          isActive: true,
        },
      });
    }

    // 4. Create Emergency Encounter
    const encounter = await req.prismaTenant.encounter.create({
      data: {
        tenantId,
        hospitalId,
        branchId,
        departmentId: erDept.id,
        doctorId: doctor.id,
        patientId: patient.id,
        type: 'EMERGENCY',
        status: 'OPEN',
      },
    });

    // If MLC, create clinical alert
    if (body.isMlc) {
      await req.prismaTenant.patientAlert.create({
        data: {
          patientId: patient.id,
          alertType: 'ADMINISTRATIVE',
          description: `MEDICO-LEGAL CASE (MLC) - Police Station: ${body.policeStation || 'Pending notification'}`,
          severity: 'HIGH',
          recordedById: userId,
          isActive: true,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Emergency fast-track registration complete',
      data: {
        patient: {
          id: patient.id,
          mrn: patient.mrn,
          firstName: patient.firstName,
          lastName: patient.lastName,
          gender: patient.gender,
        },
        encounter: {
          id: encounter.id,
          status: encounter.status,
          type: encounter.type,
          startTime: encounter.startTime,
        },
        isMlc: body.isMlc,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/emergency/triage (Perform ESI Triage Assessment)
router.post('/triage', requirePermission('emergency.triage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const hospitalId = req.hospitalId || (req.user as any)?.hospitalId || '';
    const branchId = req.branchId || (req.user as any)?.branchId || '';

    const body = TriageSchema.parse(req.body);

    let encounterId = body.encounterId;

    if (!encounterId) {
      if (!body.patientId) {
        throw AppError.badRequest('Either encounterId or patientId is required to record triage');
      }

      // Find active ER encounter or create one
      let encounter = await req.prismaTenant.encounter.findFirst({
        where: {
          tenantId,
          patientId: body.patientId,
          type: 'EMERGENCY',
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      });

      if (!encounter) {
        let erDept = await req.prismaTenant.department.findFirst({
          where: { branchId, code: 'ER' },
        });
        if (!erDept) {
          erDept = await req.prismaTenant.department.create({
            data: {
              branchId,
              name: 'Emergency Department',
              code: 'ER',
              type: 'EMERGENCY',
            },
          });
        }

        let doctor = await req.prismaTenant.doctor.findFirst({
          where: { isActive: true },
        });
        if (!doctor) {
          doctor = await req.prismaTenant.doctor.create({
            data: {
              userId,
              branchId,
              departmentId: erDept.id,
              licenseNumber: 'ER-DOC-' + Math.floor(1000 + Math.random() * 9000),
              specialization: 'Emergency Medicine',
            },
          });
        }

        encounter = await req.prismaTenant.encounter.create({
          data: {
            tenantId,
            hospitalId,
            branchId,
            departmentId: erDept.id,
            doctorId: doctor.id,
            patientId: body.patientId,
            type: 'EMERGENCY',
            status: 'IN_PROGRESS',
          },
        });
      }
      encounterId = encounter.id;
    }

    const currentEncounter = await req.prismaTenant.encounter.findFirst({
      where: { tenantId, id: encounterId },
      include: {
        patient: {
          include: {
            allergies: { where: { status: 'ACTIVE' } },
            alerts: { where: { isActive: true } },
          },
        },
      },
    });

    if (!currentEncounter) {
      throw AppError.notFound('Encounter not found');
    }

    // Upsert Triage Assessment
    const triage = await req.prismaTenant.triageAssessment.upsert({
      where: { encounterId },
      update: {
        arrivalMode: body.arrivalMode,
        priority: body.priority,
        chiefComplaint: body.chiefComplaint,
        consciousness: body.consciousness,
        painScore: body.painScore ?? null,
        triageNurseId: userId,
      },
      create: {
        encounterId,
        arrivalMode: body.arrivalMode,
        priority: body.priority,
        chiefComplaint: body.chiefComplaint,
        consciousness: body.consciousness,
        painScore: body.painScore ?? null,
        triageNurseId: userId,
      },
    });

    // Record Vitals if provided
    let vitalsRecord: any = null;
    if (body.vitals) {
      const created = await req.prismaTenant.vitalRecord.create({
        data: {
          encounterId,
          bpSystolic: body.vitals.systolic ? Math.round(body.vitals.systolic) : undefined,
          bpDiastolic: body.vitals.diastolic ? Math.round(body.vitals.diastolic) : undefined,
          pulse: body.vitals.heartRate ? Math.round(body.vitals.heartRate) : undefined,
          temperature: body.vitals.temperature,
          respiratoryRate: body.vitals.respiratoryRate ? Math.round(body.vitals.respiratoryRate) : undefined,
          spo2: body.vitals.oxygenSaturation,
          recordedById: userId,
        },
      });

      vitalsRecord = {
        ...created,
        bloodPressure: created.bpSystolic && created.bpDiastolic ? `${created.bpSystolic}/${created.bpDiastolic}` : null,
        pulseRate: created.pulse,
        oxygenSaturation: created.spo2,
      };
    }

    // MLC Alert
    if (body.isMlc) {
      await req.prismaTenant.patientAlert.create({
        data: {
          patientId: currentEncounter.patientId,
          alertType: 'ADMINISTRATIVE',
          description: `MEDICO-LEGAL CASE (MLC) - ${body.policeStation || 'Police Notification Pending'}`,
          severity: 'HIGH',
          recordedById: userId,
        },
      });
    }

    // Trigger Charge Capture Port (Loose coupling with billing)
    const charge = await chargeCaptureService.postCharge({
      tenantId,
      hospitalId,
      branchId,
      patientId: currentEncounter.patientId,
      encounterId,
      chargeCode: 'ER-TRIAGE-LEVEL-' + body.priority,
      description: `Emergency Triage Level ${body.priority} Assessment`,
      quantity: 1,
      unitPrice: body.priority === 'RED' ? 250 : body.priority === 'ORANGE' ? 175 : 100,
      sourceModule: 'EMERGENCY',
      sourceReferenceId: triage.id,
      createdById: userId,
    });

    res.status(201).json({
      success: true,
      message: 'Emergency triage documented successfully',
      data: {
        encounterId,
        triageAssessment: triage,
        vitals: vitalsRecord,
        patientBanner: {
          mrn: currentEncounter.patient.mrn,
          name: `${currentEncounter.patient.firstName} ${currentEncounter.patient.lastName}`,
          gender: currentEncounter.patient.gender,
          allergies: currentEncounter.patient.allergies.map((a: any) => a.allergen),
          alerts: currentEncounter.patient.alerts.map((a: any) => a.description),
        },
        charge,
        receiptMode: charge.receiptMode,
        isBilled: charge.isBilled,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/emergency/board (Emergency Tracking Board)
router.get('/board', requirePermission('emergency.board.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const now = new Date();

    const encounters = await req.prismaTenant.encounter.findMany({
      where: {
        tenantId,
        type: 'EMERGENCY',
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      include: {
        patient: {
          select: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
            gender: true,
            dateOfBirth: true,
            allergies: { where: { status: 'ACTIVE' }, select: { allergen: true } },
            alerts: { where: { isActive: true }, select: { description: true, severity: true } },
          },
        },
        triageAssessment: true,
        vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { startTime: 'asc' },
    });

    // Priority rank mapping: RED is highest urgency
    const priorityWeight: Record<string, number> = {
      RED: 1,
      ORANGE: 2,
      YELLOW: 3,
      GREEN: 4,
      BLUE: 5,
    };

    const board = encounters
      .map((enc: any) => {
        const triage = enc.triageAssessment;
        const priority = triage?.priority || 'YELLOW';
        const waitMinutes = Math.floor((now.getTime() - new Date(enc.startTime).getTime()) / (1000 * 60));
        const latestVitals = enc.vitals[0] || null;

        return {
          encounterId: enc.id,
          patient: enc.patient,
          priority,
          priorityRank: priorityWeight[priority] || 99,
          chiefComplaint: triage?.chiefComplaint || 'Pending assessment',
          consciousness: triage?.consciousness || 'ALERT',
          painScore: triage?.painScore ?? null,
          arrivalMode: triage?.arrivalMode || 'WALK_IN',
          arrivalTime: enc.startTime,
          elapsedMinutes: waitMinutes,
          attendingDoctor: enc.doctor?.user ? `Dr. ${enc.doctor.user.firstName} ${enc.doctor.user.lastName}` : null,
          latestVitals,
          status: enc.status,
        };
      })
      .sort((a: any, b: any) => a.priorityRank - b.priorityRank || b.elapsedMinutes - a.elapsedMinutes);

    res.json({
      success: true,
      data: {
        patients: board,
        counts: {
          total: board.length,
          red: board.filter((p: any) => p.priority === 'RED').length,
          orange: board.filter((p: any) => p.priority === 'ORANGE').length,
          yellow: board.filter((p: any) => p.priority === 'YELLOW').length,
          green: board.filter((p: any) => p.priority === 'GREEN').length,
          blue: board.filter((p: any) => p.priority === 'BLUE').length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/emergency/encounters/:id/resuscitation (Document Resuscitation Event)
router.post('/encounters/:id/resuscitation', requirePermission('emergency.triage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const encounterId = req.params.id;

    const body = ResuscitationSchema.parse(req.body);

    const encounter = await req.prismaTenant.encounter.findFirst({
      where: { tenantId, id: encounterId },
    });
    if (!encounter) throw AppError.notFound('Encounter not found');

    const event = await req.prismaTenant.emergencyResuscitationEvent.create({
      data: {
        encounterId,
        startTime: new Date(body.startTime),
        endTime: body.endTime ? new Date(body.endTime) : null,
        eventDescription: body.eventDescription,
        interventions: body.interventions,
        outcome: body.outcome,
        recordedById: userId,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Resuscitation event logged',
      data: event,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/emergency/encounters/:id/disposition (Record ER Patient Disposition)
router.post('/encounters/:id/disposition', requirePermission('emergency.triage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const encounterId = req.params.id;

    const body = DispositionSchema.parse(req.body);

    const encounter = await req.prismaTenant.encounter.findFirst({
      where: { tenantId, id: encounterId },
    });
    if (!encounter) throw AppError.notFound('Encounter not found');

    const updated = await req.prismaTenant.encounter.update({
      where: { id: encounterId },
      data: {
        status: body.disposition === 'ADMIT' ? 'IN_PROGRESS' : 'COMPLETED',
        endTime: new Date(),
      },
    });

    res.json({
      success: true,
      message: `Emergency disposition recorded: ${body.disposition}`,
      data: {
        encounterId: updated.id,
        disposition: body.disposition,
        status: updated.status,
        endTime: updated.endTime,
        notes: body.notes || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
