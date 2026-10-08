import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('assets'));

import crypto from 'crypto';

function generateAssetCode(category: string): string {
  const prefix = (category.slice(0, 3) || 'AST').toUpperCase();
  const rand = crypto.randomInt(1000, 10000);
  return `${prefix}-${Date.now().toString().slice(-4)}-${rand}`;
}

// =========================================================================
// VALIDATION SCHEMAS
// =========================================================================

const CreateAssetSchema = z.object({
  name: z.string().min(1, 'Asset name is required'),
  category: z.enum([
    'BIOMEDICAL_LIFE_SUPPORT',
    'DIAGNOSTIC_IMAGING',
    'SURGICAL_PERIOPERATIVE',
    'LABORATORY_ANALYZER',
    'FACILITY_INFRASTRUCTURE',
    'IT_HARDWARE',
  ]).default('BIOMEDICAL_LIFE_SUPPORT'),
  assetCode: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.number().min(0).optional(),
  locationId: z.string().optional(),
  assignedToId: z.string().optional(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'DISPOSED']).default('ACTIVE'),
});

const CreateMaintenanceTaskSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  description: z.string().min(1, 'Issue description or maintenance scope is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
  assignedToId: z.string().optional(),
});

const CompleteMaintenanceTaskSchema = z.object({
  resolutionNotes: z.string().min(1, 'Resolution notes are required'),
  calibrationPassed: z.boolean().default(true),
});

// =========================================================================
// 1. ASSET REGISTER
// =========================================================================

// GET /api/v1/assets or /api/v1/assets/assets
router.get(['/', '/assets'], requirePermission('assets.manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { category, status, search } = req.query as Record<string, string>;
    const where: any = { tenantId };

    if (category) where.category = category;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { assetCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const assets = await req.prismaTenant.asset.findMany({
      where,
      include: {
        assignedTo: { include: { user: { select: { firstName: true, lastName: true } } } },
        maintenanceTasks: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: assets });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/assets or /api/v1/assets/assets
router.post(['/', '/assets'], requirePermission('assets.manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = CreateAssetSchema.parse(req.body);

    const assetCode = body.assetCode || generateAssetCode(body.category);
    const purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : new Date();

    const asset = await req.prismaTenant.asset.create({
      data: {
        tenantId,
        assetCode,
        name: body.name,
        category: body.category,
        purchaseDate,
        purchaseCost: body.purchaseCost,
        locationId: body.locationId,
        assignedToId: body.assignedToId,
        status: body.status,
      },
      include: {
        assignedTo: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    res.status(201).json({
      success: true,
      message: `Asset ${asset.name} registered with code ${asset.assetCode}`,
      data: asset,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/assets/assets/:id
router.get('/assets/:id', requirePermission('assets.manage'), async (req, res, next) => {
  try {
    const asset = await req.prismaTenant.asset.findFirst({
      where: { id: req.params.id },
      include: {
        assignedTo: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        maintenanceTasks: {
          include: { assignedTo: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!asset) throw AppError.notFound('Asset not found');
    res.json({ success: true, data: asset });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. CMMS MAINTENANCE WORK ORDERS & BREAKDOWN REPORTING
// =========================================================================

// GET /api/v1/assets/tasks
router.get('/tasks', requirePermission('assets.manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { status, priority, assetId } = req.query as Record<string, string>;
    const where: any = { tenantId };

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assetId) where.assetId = assetId;

    const tasks = await req.prismaTenant.maintenanceTask.findMany({
      where,
      include: {
        asset: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/assets/tasks or /breakdown or /maintenance
router.post(['/tasks', '/breakdown', '/maintenance'], requirePermission('assets.manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = CreateMaintenanceTaskSchema.parse(req.body);

    const asset = await req.prismaTenant.asset.findFirst({ where: { id: body.assetId } });
    if (!asset) throw AppError.notFound('Asset not found');

    const task = await req.prismaTenant.maintenanceTask.create({
      data: {
        tenantId,
        assetId: asset.id,
        description: body.description,
        priority: body.priority,
        status: body.assignedToId ? 'ASSIGNED' : 'SCHEDULED',
        assignedToId: body.assignedToId,
      },
      include: {
        asset: true,
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });

    // Mark asset as under maintenance if priority is HIGH or CRITICAL
    if (body.priority === 'HIGH' || body.priority === 'CRITICAL') {
      await req.prismaTenant.asset.update({
        where: { id: asset.id },
        data: { status: 'MAINTENANCE' },
      });
    }

    res.status(201).json({
      success: true,
      message: `Maintenance task created for ${asset.name} (${body.priority} priority)`,
      data: { ...task, task },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/assets/tasks/:id/assign
router.patch('/tasks/:id/assign', requirePermission('assets.manage'), async (req, res, next) => {
  try {
    const { assignedToId } = z.object({ assignedToId: z.string().min(1) }).parse(req.body);

    const task = await req.prismaTenant.maintenanceTask.update({
      where: { id: req.params.id },
      data: {
        assignedToId,
        status: 'ASSIGNED',
      },
      include: {
        asset: true,
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });

    res.json({ success: true, message: 'Maintenance task assigned', data: task });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/assets/tasks/:id/complete or /maintenance/:id/complete
router.patch(['/tasks/:id/complete', '/maintenance/:id/complete'], requirePermission('assets.manage'), async (req, res, next) => {
  try {
    const body = CompleteMaintenanceTaskSchema.parse(req.body);

    const task = await req.prismaTenant.maintenanceTask.findFirst({
      where: { id: req.params.id },
      include: { asset: true },
    });
    if (!task) throw AppError.notFound('Maintenance task not found');

    const updatedTask = await req.prismaTenant.maintenanceTask.update({
      where: { id: task.id },
      data: {
        status: 'COMPLETED',
        description: `${task.description}\n[RESOLVED]: ${body.resolutionNotes} (Calibration: ${body.calibrationPassed ? 'PASSED' : 'FAILED'})`,
      },
      include: { asset: true },
    });

    // Restore asset status to ACTIVE if calibration passed
    if (task.assetId && body.calibrationPassed) {
      await req.prismaTenant.asset.update({
        where: { id: task.assetId },
        data: { status: 'ACTIVE' },
      });
    }

    res.json({
      success: true,
      message: 'Maintenance task completed and asset status restored to ACTIVE',
      data: updatedTask,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
