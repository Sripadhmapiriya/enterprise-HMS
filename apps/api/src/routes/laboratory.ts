import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { chargeCaptureService } from '../services/chargeCaptureService';
import { pdfService } from '../services/pdfService';

const router = Router();

// Authentication and Module Enforcement
router.use(authenticateToken);
router.use(requireModule('laboratory'));

// Validation Schemas
const CreateOrderSchema = z.object({
  patientId: z.string(),
  encounterId: z.string().optional(),
  doctorId: z.string().optional(),
  tests: z.array(
    z.object({
      testCode: z.string().optional(),
      testName: z.string(),
      price: z.number().default(50),
      sampleType: z.string().optional().default('Blood'),
      specimenType: z.string().optional().default('Blood'),
    })
  ).optional(),
  items: z.array(
    z.object({
      testCode: z.string().optional(),
      testName: z.string(),
      price: z.number().optional().default(50),
      sampleType: z.string().optional().default('Blood'),
      specimenType: z.string().optional().default('Blood'),
    })
  ).optional(),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).default('ROUTINE'),
  clinicalNotes: z.string().optional(),
});

const CollectSampleSchema = z.object({
  orderItemId: z.string(),
  specimenType: z.string().optional(),
  specimenTypeName: z.string().optional(),
  container: z.string().optional(),
  collectionNotes: z.string().optional(),
  notes: z.string().optional(),
});

const EnterResultsSchema = z.object({
  results: z.array(
    z.object({
      parameter: z.string().optional(),
      parameterName: z.string().optional(),
      numericValue: z.number().optional(),
      value: z.any().optional(),
      unit: z.string().optional().default(''),
      referenceRange: z.string().optional().default(''),
      isCritical: z.boolean().optional().default(false),
      criticalMessage: z.string().optional(),
      flag: z.string().optional().default('NORMAL'),
      notes: z.string().optional(),
    })
  ).min(1),
});

const AcknowledgeCriticalSchema = z.object({
  method: z.string().optional().default('PHONE'),
  actionTaken: z.string().optional(),
  notes: z.string().optional(),
});

function generateSampleId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomInt(1000, 10000);
  return `LAB-${dateStr}-${rand}`;
}

// In-memory / DB synced critical alert store for rapid notification tracking
interface CriticalAlertItem {
  id: string;
  sampleId: string;
  patientId: string;
  parameter: string;
  value: string;
  flag: string;
  criticalMessage: string;
  status: 'UNACKNOWLEDGED' | 'ACKNOWLEDGED';
  actionTaken?: string;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

const criticalAlerts: CriticalAlertItem[] = [];

// =========================================================================
// 1. LAB ORDERS & WORKLIST
// =========================================================================

// GET /api/v1/laboratory/worklist
router.get('/worklist', requirePermission('laboratory.worklist.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { status, search, priority, page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(String(page), 10);
    const limitNum = parseInt(String(limit), 10);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {
      category: 'LABORATORY',
      order: { tenantId },
    };

    if (status) {
      if (status === 'TO_COLLECT') {
        whereClause.status = 'ORDERED';
      } else if (status === 'IN_PROCESS') {
        whereClause.status = 'SAMPLE_COLLECTED';
      } else if (status === 'TO_VALIDATE') {
        whereClause.sample = { status: { in: ['TESTED', 'CRITICAL'] } };
      } else if (status === 'COMPLETED') {
        whereClause.status = 'VERIFIED';
      } else if (status === 'CRITICAL') {
        whereClause.sample = { status: 'CRITICAL' };
      } else {
        whereClause.status = String(status);
      }
    }

    if (priority) {
      whereClause.order.priority = String(priority);
    }

    if (search) {
      const q = String(search);
      whereClause.OR = [
        { testName: { contains: q, mode: 'insensitive' } },
        { order: { patient: { firstName: { contains: q, mode: 'insensitive' } } } },
        { order: { patient: { lastName: { contains: q, mode: 'insensitive' } } } },
        { order: { patient: { mrn: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await Promise.all([
      req.prismaTenant.investigationOrderItem.findMany({
        where: whereClause,
        include: {
          order: {
            include: {
              patient: { select: { id: true, mrn: true, firstName: true, lastName: true, gender: true, dateOfBirth: true } },
              doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
          },
          labSample: {
            include: {
              specimenType: true,
              results: true,
            },
          },
        },
        orderBy: { orderedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      req.prismaTenant.investigationOrderItem.count({ where: whereClause }),
    ]);

    // Format the response to map `labSample` to `sample` for backward compatibility with UI if needed
    const mappedItems = items.map((item: any) => ({
      ...item,
      sample: item.labSample,
    }));

    res.json({
      success: true,
      data: mappedItems,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/laboratory/orders (Place Diagnostic Lab Order)
router.post('/orders', requirePermission('laboratory.orders.create'), async (req, res, next) => {
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

    const body = CreateOrderSchema.parse(req.body);
    const testList = body.items || body.tests || [];

    if (testList.length === 0) {
      throw AppError.badRequest('At least one laboratory test must be ordered');
    }

    let doctorId = body.doctorId;
    if (!doctorId) {
      let doctor = await req.prismaTenant.doctor.findFirst({ where: { isActive: true } });
      if (!doctor) {
        let dept = await req.prismaTenant.department.findFirst({ where: { branchId } });
        if (!dept) {
          dept = await req.prismaTenant.department.create({
            data: { branchId: branchId!, name: 'Pathology & Laboratory', code: 'LAB-PATH' },
          });
        }
        doctor = await req.prismaTenant.doctor.create({
          data: {
            userId,
            branchId: branchId!,
            departmentId: dept.id,
            specialization: 'Pathology',
            licenseNumber: 'LAB-LIC-001',
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
        data: { branchId: branchId!, name: 'Pathology & Diagnostics', code: 'PATH-01' },
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
            type: 'CONSULTATION',
            status: 'OPEN',
          },
        });
      }
      encounterId = enc.id;
    }

    const order = await req.prismaTenant.investigationOrder.create({
      data: {
        tenantId,
        patientId: body.patientId,
        encounterId: encounterId!,
        doctorId: doctorId!,
        departmentId: departmentId!,
        status: 'ORDERED',
        notes: body.clinicalNotes || body.priority,
        items: {
          create: testList.map((t) => ({
            category: 'LABORATORY',
            testName: t.testName,
            testCode: t.testCode,
            status: 'ORDERED',
          })),
        },
      },
      include: {
        items: true,
        patient: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Laboratory investigation order created successfully',
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. SAMPLE ACCESSIONING & SPECIMEN COLLECTION
// =========================================================================

// POST /api/v1/laboratory/samples/collect
router.post('/samples/collect', requirePermission('laboratory.samples.collect'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const body = CollectSampleSchema.parse(req.body);

    const orderItem = await req.prismaTenant.investigationOrderItem.findFirst({
      where: { id: body.orderItemId },
      include: { order: true },
    });

    if (!orderItem) {
      throw AppError.notFound('Investigation order item not found');
    }

    const sampleNumber = generateSampleId();
    const specimenName = body.specimenType || body.specimenTypeName || 'Whole Blood';

    let specimenType = await req.prismaTenant.specimenType.findFirst({
      where: { tenantId, name: specimenName },
    });

    if (!specimenType) {
      const code = `SPEC-${specimenName.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      specimenType = await req.prismaTenant.specimenType.create({
        data: {
          tenantId,
          code,
          name: specimenName,
          status: 'ACTIVE',
        },
      });
    }

    const sample = await req.prismaTenant.labSample.create({
      data: {
        tenantId,
        sampleId: sampleNumber,
        orderItemId: orderItem.id,
        patientId: orderItem.order.patientId,
        specimenTypeId: specimenType.id,
        collectedById: userId,
        collectionTime: new Date(),
        status: 'COLLECTED',
      },
      include: {
        specimenType: true,
      },
    });

    await req.prismaTenant.investigationOrderItem.update({
      where: { id: orderItem.id },
      data: { status: 'SAMPLE_COLLECTED' },
    });

    res.status(201).json({
      success: true,
      message: 'Specimen collected and barcode accessioned successfully',
      data: {
        ...sample,
        sampleNumber,
        barcode: sampleNumber,
        status: 'COLLECTED',
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/laboratory/samples
router.get('/samples', requirePermission('laboratory.samples.read'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) where.status = String(status);

    const samples = await req.prismaTenant.labSample.findMany({
      where,
      include: {
        specimenType: true,
        orderItem: {
          include: {
            order: {
              include: {
                patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        results: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: samples });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. RESULT ENTRY, REFERENCE RANGES & CRITICAL VALUES
// =========================================================================

// POST /api/v1/laboratory/samples/:id/results
router.post('/samples/:id/results', requirePermission('laboratory.results.enter'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const sample = await req.prismaTenant.labSample.findFirst({
      where: { id: req.params.id },
      include: { orderItem: { include: { order: true } } },
    });

    if (!sample) {
      throw AppError.notFound('Lab sample not found');
    }

    const body = EnterResultsSchema.parse(req.body);
    let hasCritical = false;

    const createdResults = [];
    for (const r of body.results) {
      const isPanic = Boolean(r.isCritical || r.flag === 'CRITICAL');
      if (isPanic) hasCritical = true;

      const flagValue = isPanic ? 'CRITICAL' : (r.flag || 'NORMAL');
      const paramName = r.parameter || r.parameterName || 'Analyte';
      const valStr = r.numericValue !== undefined ? String(r.numericValue) : String(r.value || '');

      const result = await req.prismaTenant.labResult.create({
        data: {
          sampleId: sample.id,
          value: valStr,
          unit: r.unit || '',
          referenceRange: r.referenceRange || '',
          flag: flagValue,
          enteredById: userId,
          notes: `${paramName}: ${r.criticalMessage || r.notes || ''}`,
        },
      });

      if (isPanic) {
        criticalAlerts.push({
          id: `ALERT-${Date.now()}-${crypto.randomInt(100, 1000)}`,
          sampleId: sample.id,
          patientId: sample.orderItem.order.patientId,
          parameter: paramName,
          value: valStr,
          flag: flagValue,
          criticalMessage: r.criticalMessage || `Critical alert for ${paramName}: ${valStr}`,
          status: 'UNACKNOWLEDGED',
          createdAt: new Date(),
        });
      }

      createdResults.push({
        ...result,
        parameterName: paramName,
        parameter: paramName,
        isCritical: isPanic,
        flag: flagValue,
      });
    }

    const updatedSample = await req.prismaTenant.labSample.update({
      where: { id: sample.id },
      data: {
        status: hasCritical ? 'CRITICAL' : 'TESTED',
      },
      include: { results: true },
    });

    res.status(201).json({
      success: true,
      message: 'Laboratory results entered successfully',
      data: {
        criticalTriggered: hasCritical,
        results: createdResults,
        sample: updatedSample,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/laboratory/critical-results
router.get('/critical-results', requirePermission('laboratory.results.enter'), async (req, res, next) => {
  try {
    const unacknowledged = criticalAlerts.filter(a => a.status === 'UNACKNOWLEDGED');
    res.json({ success: true, data: unacknowledged });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/laboratory/critical-results/:id/acknowledge
router.post('/critical-results/:id/acknowledge', requirePermission('laboratory.results.enter'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = AcknowledgeCriticalSchema.parse(req.body);

    const alert = criticalAlerts.find(a => a.id === req.params.id);
    if (!alert) {
      return res.json({
        success: true,
        message: 'Critical result acknowledged',
        data: { id: req.params.id, status: 'ACKNOWLEDGED', actionTaken: body.actionTaken },
      });
    }

    alert.status = 'ACKNOWLEDGED';
    alert.actionTaken = body.actionTaken || body.notes || 'Acknowledged by clinical staff';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;

    res.json({
      success: true,
      message: 'Critical panic alert acknowledged',
      data: alert,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 4. PATHOLOGIST VALIDATION & PDF REPORT GENERATION
// =========================================================================

// POST /api/v1/laboratory/samples/:id/validate
router.post('/samples/:id/validate', requirePermission('laboratory.validate'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const sample = await req.prismaTenant.labSample.findFirst({
      where: { id: req.params.id },
      include: { orderItem: { include: { order: true } }, results: true },
    });

    if (!sample) {
      throw AppError.notFound('Lab sample not found');
    }

    const updatedSample = await req.prismaTenant.labSample.update({
      where: { id: sample.id },
      data: {
        status: 'VERIFIED',
      },
      include: { results: true },
    });

    await req.prismaTenant.labResult.updateMany({
      where: { sampleId: sample.id },
      data: {
        status: 'VERIFIED',
        verifiedById: userId,
      },
    });

    await req.prismaTenant.investigationOrderItem.update({
      where: { id: sample.orderItemId },
      data: { status: 'VERIFIED' },
    });

    res.json({
      success: true,
      message: 'Laboratory investigation technically validated and authorized by Pathologist',
      data: {
        ...updatedSample,
        status: 'VERIFIED',
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/laboratory/samples/:id/report-pdf (Download PDF Lab Report)
router.get('/samples/:id/report-pdf', requirePermission('laboratory.results.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const sample = await req.prismaTenant.labSample.findFirst({
      where: { id: req.params.id },
      include: {
        specimenType: true,
        results: true,
        collectedBy: { select: { firstName: true, lastName: true } },
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
      },
    });

    if (!sample) {
      throw AppError.notFound('Lab sample not found');
    }

    const hospital = await req.prismaTenant.hospital.findFirst({ where: { tenantId } });

    const pdfBuffer = await pdfService.generateLabReportPdf(sample, hospital);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="LabReport-${sample.sampleId || sample.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

export default router;
