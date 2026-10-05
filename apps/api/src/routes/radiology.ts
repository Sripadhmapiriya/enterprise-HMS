import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { chargeCaptureService } from '../services/chargeCaptureService';

const router = Router();

// Authentication and Module Enforcement
router.use(authenticateToken);
router.use(requireModule('radiology'));

// Validation Schemas
const CreateRadiologyOrderSchema = z.object({
  patientId: z.string(),
  encounterId: z.string().optional(),
  doctorId: z.string().optional(),
  modality: z.string().optional().default('X-RAY'),
  bodyPart: z.string().optional().default('Chest'),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).default('ROUTINE'),
  clinicalIndication: z.string().optional(),
  clinicalNotes: z.string().optional(),
  price: z.number().default(120),
  items: z.array(
    z.object({
      testName: z.string(),
      testCode: z.string().optional(),
      modality: z.string().optional().default('X-RAY'),
      price: z.number().optional().default(120),
    })
  ).optional(),
});

const ScheduleStudySchema = z.object({
  scheduledTime: z.string().or(z.date()).optional(),
  notes: z.string().optional(),
});

const EnterReportSchema = z.object({
  indication: z.string().optional(),
  clinicalIndication: z.string().optional(),
  technique: z.string().optional(),
  findings: z.string().min(1),
  impression: z.string().min(1),
  recommendations: z.string().optional(),
});

function generateStudyNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RAD-${dateStr}-${rand}`;
}

function generatePacsUrl(uid: string): string {
  return `https://pacs.hospital.internal/ohif/viewer?studyInstanceUIDs=${uid}`;
}

// =========================================================================
// 1. WORKLIST & ORDERS
// =========================================================================

// GET /api/v1/radiology/worklist
router.get('/worklist', requirePermission('radiology.worklist.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { modality, status } = req.query;

    const where: any = { tenantId };
    if (modality && modality !== 'ALL') where.modality = String(modality);
    if (status) where.status = String(status);

    const studies = await req.prismaTenant.radiologyStudy.findMany({
      where,
      include: {
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true, gender: true, dateOfBirth: true } },
        orderItem: {
          include: {
            order: {
              include: {
                patient: true,
                doctor: { include: { user: true } },
              },
            },
          },
        },
        report: true,
        technician: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const enriched = studies.map((s: any) => ({
      ...s,
      pacsUrl: generatePacsUrl(s.studyInstanceUid || s.id),
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/radiology/orders (Place Imaging Order)
router.post('/orders', requirePermission('radiology.orders.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    let hospitalId = req.hospitalId || (req.user as any)?.hospitalId;
    let branchId = req.branchId || (req.user as any)?.branchId;

    if (!hospitalId || !branchId) {
      let hospital = await req.prismaTenant.hospital.findFirst({ where: { tenantId } });
      if (!hospital) {
        hospital = await req.prismaTenant.hospital.findFirst();
      }
      if (hospital) {
        hospitalId = hospital.id;
        let branch = await req.prismaTenant.branch.findFirst({ where: { hospitalId } });
        if (!branch) {
          branch = await req.prismaTenant.branch.findFirst();
        }
        if (branch) branchId = branch.id;
      }
    }

    const body = CreateRadiologyOrderSchema.parse(req.body);
    const itemList = body.items || [
      {
        testName: `${body.modality} ${body.bodyPart}`,
        testCode: `RAD-${Date.now()}`,
        modality: body.modality,
        price: body.price,
      },
    ];

    let doctorId = body.doctorId;
    if (!doctorId) {
      let doctor = await req.prismaTenant.doctor.findFirst({ where: { isActive: true } });
      if (!doctor) {
        let dept = await req.prismaTenant.department.findFirst({ where: { branchId } });
        if (!dept) {
          dept = await req.prismaTenant.department.create({
            data: { branchId: branchId!, name: 'Radiology & Imaging', code: 'RAD-DEPT' },
          });
        }
        doctor = await req.prismaTenant.doctor.create({
          data: {
            userId,
            branchId: branchId!,
            departmentId: dept.id,
            specialization: 'Radiologist',
            licenseNumber: 'RAD-LIC-001',
          },
        });
      }
      doctorId = doctor.id;
    }

    const docRecord = await req.prismaTenant.doctor.findFirst({ where: { id: doctorId } });
    let departmentId = docRecord?.departmentId;
    if (!departmentId) {
      const dept = await req.prismaTenant.department.findFirst({ where: { branchId } });
      departmentId = dept?.id;
    }
    if (!departmentId) {
      const dept = await req.prismaTenant.department.create({
        data: { branchId: branchId!, name: 'Radiology & Imaging', code: 'RAD-01' },
      });
      departmentId = dept.id;
    }

    let encounterId = body.encounterId;
    if (!encounterId) {
      let enc = await req.prismaTenant.encounter.findFirst({
        where: { patientId: body.patientId },
        orderBy: { createdAt: 'desc' },
      });
      if (!enc) {
        enc = await req.prismaTenant.encounter.create({
          data: {
            hospitalId: hospitalId!,
            branchId: branchId!,
            departmentId: departmentId!,
            doctorId: doctorId!,
            patientId: body.patientId,
            type: 'OPD',
            status: 'IN_PROGRESS',
            startTime: new Date(),
          },
        });
      }
      encounterId = enc.id;
    }

    const order = await req.prismaTenant.investigationOrder.create({
      data: {
        tenantId,
        patientId: body.patientId,
        encounterId,
        doctorId: doctorId!,
        departmentId,
        status: 'ORDERED',
        notes: body.clinicalNotes || body.clinicalIndication || 'Radiology diagnostic evaluation',
        items: {
          create: itemList.map((item) => ({
            category: 'RADIOLOGY',
            testName: item.testName,
            testCode: item.testCode,
            status: 'SCHEDULED',
          })),
        },
      },
      include: {
        items: true,
        patient: true,
      },
    });

    // Create study records for the imaging worklist
    for (let i = 0; i < order.items.length; i++) {
      const orderItem = order.items[i];
      const itemConfig = itemList[i];
      const studyNumber = generateStudyNumber();

      await req.prismaTenant.radiologyStudy.create({
        data: {
          tenantId,
          orderItemId: orderItem.id,
          patientId: body.patientId,
          studyNumber,
          modality: itemConfig?.modality || body.modality || 'X-RAY',
          bodyPart: body.bodyPart || 'Diagnostic Field',
          status: 'SCHEDULED',
          pacsReference: `1.2.840.10008.${Date.now()}.${Math.floor(Math.random() * 100000)}`,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Radiology imaging order placed and study scheduled',
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. STUDY ACQUISITION & EXECUTION
// =========================================================================

// POST /api/v1/radiology/studies/:id/perform
router.post('/studies/:id/perform', requirePermission('radiology.perform'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const study = await req.prismaTenant.radiologyStudy.findFirst({
      where: { id: req.params.id },
    });

    if (!study) {
      throw AppError.notFound('Radiology study not found');
    }

    const updatedStudy = await req.prismaTenant.radiologyStudy.update({
      where: { id: study.id },
      data: {
        status: 'IN_PROGRESS',
        technicianId: userId,
        performedTime: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Study acquisition in progress / completed by radiographer',
      data: {
        ...updatedStudy,
        pacsUrl: generatePacsUrl(updatedStudy.pacsReference || updatedStudy.id),
      },
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. RADIOLOGIST DIAGNOSTIC REPORTING & VERIFICATION
// =========================================================================

// POST /api/v1/radiology/studies/:id/report
router.post('/studies/:id/report', requirePermission('radiology.report.create'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const study = await req.prismaTenant.radiologyStudy.findFirst({
      where: { id: req.params.id },
      include: { report: true },
    });

    if (!study) {
      throw AppError.notFound('Radiology study not found');
    }

    const body = EnterReportSchema.parse(req.body);
    const indication = body.indication || body.clinicalIndication || 'Clinical indication provided';

    let report;
    if (study.report) {
      report = await req.prismaTenant.radiologyReport.update({
        where: { id: study.report.id },
        data: {
          clinicalIndication: indication,
          technique: body.technique,
          findings: body.findings,
          impression: body.impression,
          recommendations: body.recommendations,
          reportedById: userId,
        },
      });
    } else {
      report = await req.prismaTenant.radiologyReport.create({
        data: {
          studyId: study.id,
          reportedById: userId,
          clinicalIndication: indication,
          technique: body.technique,
          findings: body.findings,
          impression: body.impression,
          recommendations: body.recommendations,
        },
      });
    }

    const updatedStudy = await req.prismaTenant.radiologyStudy.update({
      where: { id: study.id },
      data: { status: 'REPORTED' },
      include: { report: true, orderItem: { include: { order: true } } },
    });

    res.json({
      success: true,
      message: 'Radiologist diagnostic report submitted successfully',
      data: {
        ...updatedStudy,
        report,
        pacsUrl: generatePacsUrl(updatedStudy.pacsReference || updatedStudy.id),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/radiology/studies/:id/verify
router.post('/studies/:id/verify', requirePermission('radiology.report.verify'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const study = await req.prismaTenant.radiologyStudy.findFirst({
      where: { id: req.params.id },
      include: { report: true },
    });

    if (!study) {
      throw AppError.notFound('Radiology study not found');
    }

    const updatedStudy = await req.prismaTenant.radiologyStudy.update({
      where: { id: study.id },
      data: {
        status: 'VERIFIED',
      },
      include: { report: true },
    });

    if (study.report) {
      await req.prismaTenant.radiologyReport.update({
        where: { id: study.report.id },
        data: {
          verifiedById: userId,
          status: 'VERIFIED',
        },
      });
    }

    await req.prismaTenant.investigationOrderItem.update({
      where: { id: study.orderItemId },
      data: { status: 'VERIFIED' },
    });

    res.json({
      success: true,
      message: 'Radiology diagnostic report verified and signed off',
      data: {
        ...updatedStudy,
        status: 'VERIFIED',
        pacsUrl: generatePacsUrl(updatedStudy.pacsReference || updatedStudy.id),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/radiology/studies/:id/pacs-url
router.get('/studies/:id/pacs-url', requirePermission('radiology.worklist.read'), async (req, res, next) => {
  try {
    const study = await req.prismaTenant.radiologyStudy.findFirst({
      where: { id: req.params.id },
    });

    if (!study) {
      throw AppError.notFound('Radiology study not found');
    }

    const pacsUrl = generatePacsUrl(study.pacsReference || study.id);
    res.json({
      success: true,
      data: {
        studyId: study.id,
        pacsReference: study.pacsReference,
        pacsUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
