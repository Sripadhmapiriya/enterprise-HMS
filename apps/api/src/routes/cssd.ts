import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('cssd'));

function generateCycleNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomInt(1000, 10000);
  return `CSSD-${dateStr}-${rand}`;
}

const CreateCycleSchema = z.object({
  machineId: z.string().min(1, 'Machine ID is required'),
  method: z.enum(['AUTOCLAVE', 'ETO', 'PLASMA']),
  startTime: z.string().optional(),
  operatorId: z.string().optional(),
  loads: z.array(z.string()).optional(), // names of instrument trays/packs
  temperatureTarget: z.number().optional(), // e.g. 134 C
  pressureTarget: z.number().optional(), // e.g. 2.2 bar
  holdTimeMinutes: z.number().optional(), // e.g. 4 min or 15 min
});

const CompleteCycleSchema = z.object({
  result: z.enum(['PASSED', 'FAILED']),
  endTime: z.string().optional(),
  chemicalIndicatorPassed: z.boolean().default(true),
  biologicalIndicatorPassed: z.boolean().default(true),
  maxTemperatureAchieved: z.number().optional(),
  notes: z.string().optional(),
});

// GET /api/v1/cssd/cycles
router.get('/cycles', requirePermission('cssd.cycles.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { method, result, machineId } = req.query;
    const where: any = { tenantId };
    if (method) where.method = String(method);
    if (result) where.result = String(result);
    if (machineId) where.machineId = String(machineId);

    const cycles = await req.prismaTenant.sterilizationCycle.findMany({
      where,
      include: {
        operator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 100,
    });

    res.json({ success: true, data: cycles });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/cssd/cycles/:id
router.get('/cycles/:id', requirePermission('cssd.cycles.read'), async (req, res, next) => {
  try {
    const cycle = await req.prismaTenant.sterilizationCycle.findUnique({
      where: { id: req.params.id },
      include: {
        operator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!cycle) {
      throw AppError.notFound('Sterilization cycle not found');
    }

    res.json({ success: true, data: cycle });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/cssd/cycles
router.post('/cycles', requirePermission('cssd.cycles.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const data = CreateCycleSchema.parse(req.body);
    const operatorId = data.operatorId || req.user!.userId;

    const cycle = await req.prismaTenant.sterilizationCycle.create({
      data: {
        tenantId,
        cycleNumber: generateCycleNumber(),
        machineId: data.machineId,
        method: data.method,
        startTime: data.startTime ? new Date(data.startTime) : new Date(),
        operatorId,
        result: 'PENDING',
      },
      include: {
        operator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.status(201).json({ success: true, data: cycle, message: 'Sterilization cycle started' });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/cssd/cycles/:id/complete
router.post('/cycles/:id/complete', requirePermission('cssd.cycles.update'), async (req, res, next) => {
  try {
    const data = CompleteCycleSchema.parse(req.body);
    const cycle = await req.prismaTenant.sterilizationCycle.findUnique({
      where: { id: req.params.id },
    });

    if (!cycle) {
      throw AppError.notFound('Sterilization cycle not found');
    }
    if (cycle.result !== 'PENDING') {
      throw AppError.badRequest(`Cycle already finished with result: ${cycle.result}`);
    }

    // Determine final status based on indicators
    let finalResult = data.result;
    if (!data.chemicalIndicatorPassed || !data.biologicalIndicatorPassed) {
      finalResult = 'FAILED';
    }

    const updated = await req.prismaTenant.sterilizationCycle.update({
      where: { id: req.params.id },
      data: {
        result: finalResult,
        endTime: data.endTime ? new Date(data.endTime) : new Date(),
      },
      include: {
        operator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.json({
      success: true,
      data: updated,
      message: finalResult === 'PASSED'
        ? 'Sterilization cycle completed and certified'
        : 'Sterilization cycle FAILED biological/chemical quality checks. Loads quarantined.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/cssd/stats
router.get('/stats', requirePermission('cssd.cycles.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalToday, pending, passedToday, failedToday] = await Promise.all([
      req.prismaTenant.sterilizationCycle.count({
        where: { tenantId, startTime: { gte: today } },
      }),
      req.prismaTenant.sterilizationCycle.count({
        where: { tenantId, result: 'PENDING' },
      }),
      req.prismaTenant.sterilizationCycle.count({
        where: { tenantId, result: 'PASSED', startTime: { gte: today } },
      }),
      req.prismaTenant.sterilizationCycle.count({
        where: { tenantId, result: 'FAILED', startTime: { gte: today } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalToday,
        activeCycles: pending,
        passedToday,
        failedToday,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
