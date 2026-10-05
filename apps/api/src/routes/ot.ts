import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('ot'));

// Schemas
const CreateTheatreSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  type: z.enum(['MAJOR', 'MINOR', 'ENDOSCOPY', 'CARDIAC']).default('MAJOR'),
  branchId: z.string().optional(),
});

const CreateSurgeryRequestSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  encounterId: z.string().min(1, 'Encounter ID is required'),
  procedureName: z.string().min(1, 'Procedure name is required'),
  diagnosis: z.string().optional(),
  priority: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']).default('ROUTINE'),
  preferredDate: z.string().optional(),
  requestedById: z.string().optional(),
});

const CreateSurgeryScheduleSchema = z.object({
  requestId: z.string().min(1, 'Surgery request ID is required'),
  otId: z.string().min(1, 'Operating theatre ID is required'),
  scheduledStart: z.string().min(1, 'Scheduled start time is required'),
  scheduledEnd: z.string().min(1, 'Scheduled end time is required'),
});

const AddTeamMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['SURGEON', 'ASST_SURGEON', 'ANESTHETIST', 'SCRUB_NURSE', 'CIRCULATING_NURSE']),
});

const WhoSafetyChecklistSchema = z.object({
  // Sign In (Before induction of anaesthesia)
  patientIdentityConfirmed: z.boolean(),
  surgicalSiteMarked: z.boolean(),
  anaesthesiaMachineCheckComplete: z.boolean(),
  pulseOximeterFunctioning: z.boolean(),
  knownAllergiesReviewed: z.boolean(),
  difficultAirwayAssessed: z.boolean(),
  bloodLossRiskAssessed: z.boolean(), // > 500ml anticipated

  // Time Out (Before skin incision)
  teamIntroduced: z.boolean(),
  verbalConfirmationPatientSiteProcedure: z.boolean(),
  anticipatedCriticalEventsReviewed: z.boolean(),
  antibioticProphylaxisGiven: z.boolean(), // within 60 minutes
  essentialImagingDisplayed: z.boolean(),

  // Sign Out (Before patient leaves operating room)
  procedureNameRecorded: z.boolean(),
  instrumentNeedleSpongeCountComplete: z.boolean(),
  specimenLabeledCorrectly: z.boolean(),
  equipmentIssuesIdentified: z.boolean(),
  keyConcernsForRecoveryReviewed: z.boolean(),

  notes: z.string().optional(),
});

const CreateProcedureNoteSchema = z.object({
  authorId: z.string().optional(),
  preOpDiagnosis: z.string().min(1, 'Pre-op diagnosis is required'),
  postOpDiagnosis: z.string().min(1, 'Post-op diagnosis is required'),
  findings: z.string().min(1, 'Findings are required'),
  procedureDetails: z.string().min(1, 'Procedure details are required'),
  complications: z.string().optional(),
  bloodLoss: z.number().int().min(0).optional(),
});

const CreateImplantRecordSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  implantName: z.string().min(1, 'Implant name is required'),
  manufacturer: z.string().optional(),
  serialNumber: z.string().optional(),
  lotNumber: z.string().optional(),
});

// =========================================================================
// 1. OPERATING THEATRES
// =========================================================================

// GET /api/v1/ot/theatres
router.get('/theatres', requirePermission('ot.theatres.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const theatres = await req.prismaTenant.operatingTheatre.findMany({
      where: { tenantId },
      include: {
        branch: { select: { id: true, name: true } },
        schedules: {
          where: {
            status: { in: ['SCHEDULED', 'PREPARING', 'IN_PROGRESS'] },
          },
          include: {
            request: {
              include: { patient: true },
            },
            team: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
          orderBy: { scheduledStart: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: theatres });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ot/theatres
router.post('/theatres', requirePermission('ot.theatres.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const data = CreateTheatreSchema.parse(req.body);

    let branchId = data.branchId;
    if (!branchId) {
      const b = await req.prismaTenant.branch.findFirst();
      branchId = b?.id;
    }
    if (!branchId) {
      throw AppError.badRequest('Hospital branch is required to create an operating theatre');
    }

    const theatre = await req.prismaTenant.operatingTheatre.create({
      data: {
        tenantId,
        branchId,
        name: data.name,
        code: data.code.toUpperCase(),
        type: data.type,
        status: 'AVAILABLE',
      },
    });

    res.status(201).json({ success: true, data: theatre });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/ot/theatres/:id/status
router.patch('/theatres/:id/status', requirePermission('ot.theatres.update'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['AVAILABLE', 'IN_USE', 'MAINTENANCE'].includes(status)) {
      throw AppError.badRequest('Invalid status. Must be AVAILABLE, IN_USE, or MAINTENANCE');
    }

    const theatre = await req.prismaTenant.operatingTheatre.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json({ success: true, data: theatre });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. SURGERY REQUESTS
// =========================================================================

// GET /api/v1/ot/requests
router.get('/requests', requirePermission('ot.requests.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { status, priority, patientId } = req.query;
    const where: any = { tenantId };
    if (status) where.status = String(status);
    if (priority) where.priority = String(priority);
    if (patientId) where.patientId = String(patientId);

    const requests = await req.prismaTenant.surgeryRequest.findMany({
      where,
      include: {
        patient: true,
        encounter: true,
        requestedBy: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        schedules: {
          include: {
            ot: true,
            team: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ot/requests
router.post('/requests', requirePermission('ot.requests.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const data = CreateSurgeryRequestSchema.parse(req.body);

    let requestedById = data.requestedById;
    if (!requestedById) {
      const doc = await req.prismaTenant.doctor.findFirst({
        where: { userId: req.user!.userId },
      });
      if (doc) requestedById = doc.id;
      else {
        const anyDoc = await req.prismaTenant.doctor.findFirst();
        requestedById = anyDoc?.id;
      }
    }
    if (!requestedById) {
      throw AppError.badRequest('A registered doctor is required to place a surgery request');
    }

    const request = await req.prismaTenant.surgeryRequest.create({
      data: {
        tenantId,
        patientId: data.patientId,
        encounterId: data.encounterId,
        requestedById,
        procedureName: data.procedureName,
        diagnosis: data.diagnosis,
        priority: data.priority,
        preferredDate: data.preferredDate ? new Date(data.preferredDate) : null,
        status: 'REQUESTED',
      },
      include: {
        patient: true,
        requestedBy: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. SURGERY SCHEDULING (WITH CONFLICT DETECTION)
// =========================================================================

// GET /api/v1/ot/schedules
router.get('/schedules', requirePermission('ot.schedules.read'), async (req, res, next) => {
  try {
    const { otId, date, status } = req.query;
    const where: any = {};
    if (otId) where.otId = String(otId);
    if (status) where.status = String(status);
    if (date) {
      const dayStart = new Date(String(date));
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      where.scheduledStart = { gte: dayStart, lte: dayEnd };
    }

    const schedules = await req.prismaTenant.surgerySchedule.findMany({
      where,
      include: {
        ot: true,
        request: {
          include: {
            patient: true,
            requestedBy: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
        team: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        notes: {
          include: { author: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
        },
        implants: true,
      },
      orderBy: { scheduledStart: 'asc' },
    });

    res.json({ success: true, data: schedules });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ot/schedules
router.post('/schedules', requirePermission('ot.schedules.create'), async (req, res, next) => {
  try {
    const data = CreateSurgeryScheduleSchema.parse(req.body);
    const start = new Date(data.scheduledStart);
    const end = new Date(data.scheduledEnd);

    if (end <= start) {
      throw AppError.badRequest('Scheduled end time must be after start time');
    }

    // CONFLICT DETECTION: Check if OT is already booked for this overlapping timeframe
    const conflict = await req.prismaTenant.surgerySchedule.findFirst({
      where: {
        otId: data.otId,
        status: { in: ['SCHEDULED', 'PREPARING', 'IN_PROGRESS'] },
        AND: [
          { scheduledStart: { lt: end } },
          { scheduledEnd: { gt: start } },
        ],
      },
      include: {
        request: true,
        ot: true,
      },
    });

    if (conflict) {
      throw AppError.conflict(
        `OT Conflict Detected: ${conflict.ot.name} is already booked for "${conflict.request.procedureName}" from ${conflict.scheduledStart.toISOString()} to ${conflict.scheduledEnd.toISOString()}`
      );
    }

    // Create schedule & transition request to SCHEDULED
    const schedule = await req.prismaTenant.surgerySchedule.create({
      data: {
        requestId: data.requestId,
        otId: data.otId,
        scheduledStart: start,
        scheduledEnd: end,
        status: 'SCHEDULED',
      },
      include: {
        ot: true,
        request: {
          include: { patient: true },
        },
      },
    });

    await req.prismaTenant.surgeryRequest.update({
      where: { id: data.requestId },
      data: { status: 'SCHEDULED' },
    });

    res.status(201).json({ success: true, data: schedule, message: 'Surgery scheduled successfully' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/ot/schedules/:id/status
router.patch('/schedules/:id/status', requirePermission('ot.schedules.update'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['SCHEDULED', 'PREPARING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw AppError.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const current = await req.prismaTenant.surgerySchedule.findUnique({
      where: { id: req.params.id },
      include: { ot: true },
    });
    if (!current) {
      throw AppError.notFound('Surgery schedule not found');
    }

    const updateData: any = { status };
    if (status === 'IN_PROGRESS' && !current.actualStart) {
      updateData.actualStart = new Date();
      // Update theatre to IN_USE
      await req.prismaTenant.operatingTheatre.update({
        where: { id: current.otId },
        data: { status: 'IN_USE' },
      });
    } else if (status === 'COMPLETED') {
      updateData.actualEnd = new Date();
      // Release theatre to AVAILABLE
      await req.prismaTenant.operatingTheatre.update({
        where: { id: current.otId },
        data: { status: 'AVAILABLE' },
      });

      // Generate Housekeeping Terminal Cleaning Task for the OT
      const tenantId = req.tenantId!;
      const branchId = current.ot.branchId;
      await req.prismaTenant.housekeepingTask.create({
        data: {
          tenantId,
          branchId,
          locationRef: current.ot.id,
          locationType: 'OT',
          taskType: 'TERMINAL',
          priority: 'HIGH',
          status: 'REQUESTED',
        },
      });
    } else if (status === 'CANCELLED') {
      // Release theatre if it was reserved/in use
      await req.prismaTenant.operatingTheatre.update({
        where: { id: current.otId },
        data: { status: 'AVAILABLE' },
      });
    }

    const updated = await req.prismaTenant.surgerySchedule.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        ot: true,
        request: { include: { patient: true } },
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 4. SURGICAL TEAM
// =========================================================================

// POST /api/v1/ot/schedules/:id/team
router.post('/schedules/:id/team', requirePermission('ot.schedules.update'), async (req, res, next) => {
  try {
    const data = AddTeamMemberSchema.parse(req.body);
    const member = await req.prismaTenant.surgicalTeam.create({
      data: {
        scheduleId: req.params.id,
        userId: data.userId,
        role: data.role,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.status(201).json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/ot/schedules/:id/team/:memberId
router.delete('/schedules/:id/team/:memberId', requirePermission('ot.schedules.update'), async (req, res, next) => {
  try {
    await req.prismaTenant.surgicalTeam.delete({
      where: { id: req.params.memberId },
    });
    res.json({ success: true, message: 'Team member removed' });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 5. WHO SURGICAL SAFETY CHECKLIST
// =========================================================================

// POST /api/v1/ot/schedules/:id/who-checklist
router.post('/schedules/:id/who-checklist', requirePermission('ot.schedules.update'), async (req, res, next) => {
  try {
    const checklist = WhoSafetyChecklistSchema.parse(req.body);
    const allPassed = Object.entries(checklist)
      .filter(([k]) => k !== 'notes')
      .every(([k, v]) => (k === 'equipmentIssuesIdentified' ? v === false : v === true));

    res.json({
      success: true,
      data: {
        scheduleId: req.params.id,
        checklist,
        allPassed,
        verifiedAt: new Date().toISOString(),
        verifiedBy: req.user!.email || req.user!.userId,
      },
      message: allPassed
        ? 'WHO Surgical Safety Checklist complete and verified'
        : 'WHO Surgical Safety Checklist recorded with items pending',
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 6. PROCEDURE NOTE & IMPLANTS
// =========================================================================

// POST /api/v1/ot/schedules/:id/notes
router.post('/schedules/:id/notes', requirePermission('ot.notes.create'), async (req, res, next) => {
  try {
    const data = CreateProcedureNoteSchema.parse(req.body);
    let authorId = data.authorId;
    if (!authorId) {
      const doc = await req.prismaTenant.doctor.findFirst({
        where: { userId: req.user!.userId },
      });
      if (doc) authorId = doc.id;
      else {
        const anyDoc = await req.prismaTenant.doctor.findFirst();
        authorId = anyDoc?.id;
      }
    }
    if (!authorId) {
      throw AppError.badRequest('Doctor identity required for procedure note');
    }

    const note = await req.prismaTenant.oTProcedureNote.create({
      data: {
        scheduleId: req.params.id,
        authorId,
        preOpDiagnosis: data.preOpDiagnosis,
        postOpDiagnosis: data.postOpDiagnosis,
        findings: data.findings,
        procedureDetails: data.procedureDetails,
        complications: data.complications,
        bloodLoss: data.bloodLoss || 0,
      },
      include: {
        author: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    res.status(201).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ot/schedules/:id/implants
router.post('/schedules/:id/implants', requirePermission('ot.implants.create'), async (req, res, next) => {
  try {
    const data = CreateImplantRecordSchema.parse(req.body);
    const implant = await req.prismaTenant.implantRecord.create({
      data: {
        scheduleId: req.params.id,
        patientId: data.patientId,
        implantName: data.implantName,
        manufacturer: data.manufacturer,
        serialNumber: data.serialNumber,
        lotNumber: data.lotNumber,
      },
      include: {
        patient: true,
      },
    });

    res.status(201).json({ success: true, data: implant });
  } catch (error) {
    next(error);
  }
});

export default router;
