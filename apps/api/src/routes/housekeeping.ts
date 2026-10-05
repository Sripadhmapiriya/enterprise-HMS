import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('housekeeping'));

const CreateTaskSchema = z.object({
  locationRef: z.string().min(1, 'Location reference is required'),
  locationType: z.enum(['WARD', 'ROOM', 'OT', 'ICU', 'AREA', 'BED']).default('BED'),
  taskType: z.enum(['ROUTINE', 'TERMINAL', 'SPILL']).default('TERMINAL'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  assignedToId: z.string().optional(),
  branchId: z.string().optional(),
});

const AssignTaskSchema = z.object({
  assignedToId: z.string().min(1, 'Assigned user ID is required'),
});

// GET /api/v1/housekeeping/tasks
router.get('/tasks', requirePermission('housekeeping.tasks.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { status, taskType, priority, locationType } = req.query;
    const where: any = { tenantId };
    if (status) where.status = String(status);
    if (taskType) where.taskType = String(taskType);
    if (priority) where.priority = String(priority);
    if (locationType) where.locationType = String(locationType);

    const tasks = await req.prismaTenant.housekeepingTask.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { requestedTime: 'desc' },
      ],
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/housekeeping/tasks
router.post('/tasks', requirePermission('housekeeping.tasks.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const data = CreateTaskSchema.parse(req.body);

    let branchId = data.branchId;
    if (!branchId) {
      const b = await req.prismaTenant.branch.findFirst();
      branchId = b?.id;
    }
    if (!branchId) {
      throw AppError.badRequest('Branch is required');
    }

    const task = await req.prismaTenant.housekeepingTask.create({
      data: {
        tenantId,
        branchId,
        locationRef: data.locationRef,
        locationType: data.locationType,
        taskType: data.taskType,
        priority: data.priority,
        assignedToId: data.assignedToId,
        status: data.assignedToId ? 'ASSIGNED' : 'REQUESTED',
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/housekeeping/tasks/:id/assign
router.patch('/tasks/:id/assign', requirePermission('housekeeping.tasks.update'), async (req, res, next) => {
  try {
    const data = AssignTaskSchema.parse(req.body);

    const task = await req.prismaTenant.housekeepingTask.update({
      where: { id: req.params.id },
      data: {
        assignedToId: data.assignedToId,
        status: 'ASSIGNED',
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/housekeeping/tasks/:id/start
router.patch('/tasks/:id/start', requirePermission('housekeeping.tasks.update'), async (req, res, next) => {
  try {
    const task = await req.prismaTenant.housekeepingTask.update({
      where: { id: req.params.id },
      data: { status: 'IN_PROGRESS' },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/housekeeping/tasks/:id/complete
router.patch('/tasks/:id/complete', requirePermission('housekeeping.tasks.update'), async (req, res, next) => {
  try {
    const task = await req.prismaTenant.housekeepingTask.findUnique({
      where: { id: req.params.id },
    });

    if (!task) {
      throw AppError.notFound('Housekeeping task not found');
    }

    const updatedTask = await req.prismaTenant.housekeepingTask.update({
      where: { id: req.params.id },
      data: {
        status: 'COMPLETED',
        completedTime: new Date(),
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Automatic Bed Status Update:
    // If the task was for a bed or room cleaning, check if a bed exists with id matching locationRef
    // and if status is 'CLEANING', update to 'AVAILABLE'!
    let bedUpdated = false;
    if (task.locationRef) {
      const bed = await req.prismaTenant.bed.findUnique({
        where: { id: task.locationRef },
      });
      if (bed && bed.status === 'CLEANING') {
        await req.prismaTenant.bed.update({
          where: { id: bed.id },
          data: { status: 'AVAILABLE' },
        });
        bedUpdated = true;
      }
    }

    res.json({
      success: true,
      data: updatedTask,
      bedStatusUpdated: bedUpdated,
      message: bedUpdated
        ? 'Housekeeping task completed and Bed marked AVAILABLE'
        : 'Housekeeping task completed successfully',
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/housekeeping/tasks/:id/verify
router.patch('/tasks/:id/verify', requirePermission('housekeeping.tasks.update'), async (req, res, next) => {
  try {
    const task = await req.prismaTenant.housekeepingTask.update({
      where: { id: req.params.id },
      data: { status: 'VERIFIED' },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/housekeeping/stats
router.get('/stats', requirePermission('housekeeping.tasks.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const [total, requested, assigned, inProgress, completed, verified] = await Promise.all([
      req.prismaTenant.housekeepingTask.count({ where: { tenantId } }),
      req.prismaTenant.housekeepingTask.count({ where: { tenantId, status: 'REQUESTED' } }),
      req.prismaTenant.housekeepingTask.count({ where: { tenantId, status: 'ASSIGNED' } }),
      req.prismaTenant.housekeepingTask.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
      req.prismaTenant.housekeepingTask.count({ where: { tenantId, status: 'COMPLETED' } }),
      req.prismaTenant.housekeepingTask.count({ where: { tenantId, status: 'VERIFIED' } }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        requested,
        assigned,
        inProgress,
        completed,
        verified,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
