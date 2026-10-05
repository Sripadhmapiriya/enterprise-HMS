import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('dietary'));

const DEFAULT_DIET_TYPES = [
  { code: 'REGULAR', name: 'Regular Hospital Diet', description: 'Standard balanced nutritious diet without clinical restrictions.' },
  { code: 'DIABETIC', name: 'Diabetic / Low Glycemic', description: 'Controlled carbohydrate and sugar intake for glycemic management.' },
  { code: 'LOW_SODIUM', name: 'Low Sodium / Cardiac', description: 'Restricted salt intake (< 2g/day) for hypertension and heart failure.' },
  { code: 'RENAL', name: 'Renal Diet', description: 'Restricted protein, potassium, and phosphorus for kidney disease.' },
  { code: 'LIQUID', name: 'Clear / Full Liquid', description: 'Fluids and smooth liquids for post-op or GI recovery.' },
  { code: 'SOFT', name: 'Soft / Pureed', description: 'Easily masticated and digested foods for dysphagia or post-procedure.' },
  { code: 'NPO', name: 'NPO (Nil Per Os)', description: 'Strictly nothing by mouth in anticipation of surgery or procedure.' },
];

const CreateDietTypeSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

const CreateDietOrderSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  encounterId: z.string().min(1, 'Encounter ID is required'),
  dietTypeId: z.string().min(1, 'Diet Type ID is required'),
  doctorId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  restrictions: z.string().optional(),
});

// GET /api/v1/dietary/diet-types
router.get('/diet-types', requirePermission('dietary.orders.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    let types = await req.prismaTenant.dietType.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    // Auto-seed defaults for this tenant if empty
    if (types.length === 0) {
      for (const d of DEFAULT_DIET_TYPES) {
        await req.prismaTenant.dietType.upsert({
          where: { code: d.code },
          update: {},
          create: {
            tenantId,
            code: d.code,
            name: d.name,
            description: d.description,
            isActive: true,
          },
        });
      }
      types = await req.prismaTenant.dietType.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      });
    }

    res.json({ success: true, data: types });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/dietary/diet-types
router.post('/diet-types', requirePermission('dietary.orders.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const data = CreateDietTypeSchema.parse(req.body);

    const type = await req.prismaTenant.dietType.create({
      data: {
        tenantId,
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description,
        isActive: true,
      },
    });

    res.status(201).json({ success: true, data: type });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/dietary/orders
router.get('/orders', requirePermission('dietary.orders.read'), async (req, res, next) => {
  try {
    const { patientId, encounterId, status, dietTypeId } = req.query;
    const where: any = {};
    if (patientId) where.patientId = String(patientId);
    if (encounterId) where.encounterId = String(encounterId);
    if (status) where.status = String(status);
    if (dietTypeId) where.dietTypeId = String(dietTypeId);

    const orders = await req.prismaTenant.dietOrder.findMany({
      where,
      include: {
        patient: true,
        dietType: true,
        doctor: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/dietary/orders
router.post('/orders', requirePermission('dietary.orders.create'), async (req, res, next) => {
  try {
    const data = CreateDietOrderSchema.parse(req.body);
    let doctorId = data.doctorId;

    if (!doctorId) {
      const doc = await req.prismaTenant.doctor.findFirst({
        where: { userId: req.user!.userId },
      });
      if (doc) doctorId = doc.id;
      else {
        const anyDoc = await req.prismaTenant.doctor.findFirst();
        doctorId = anyDoc?.id;
      }
    }
    if (!doctorId) {
      throw AppError.badRequest('Doctor identity required for clinical diet order');
    }

    // Discontinue any prior ACTIVE diet order for this encounter
    await req.prismaTenant.dietOrder.updateMany({
      where: { encounterId: data.encounterId, status: 'ACTIVE' },
      data: { status: 'DISCONTINUED', endDate: new Date() },
    });

    const order = await req.prismaTenant.dietOrder.create({
      data: {
        patientId: data.patientId,
        encounterId: data.encounterId,
        dietTypeId: data.dietTypeId,
        doctorId,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : null,
        restrictions: data.restrictions,
        status: 'ACTIVE',
      },
      include: {
        patient: true,
        dietType: true,
        doctor: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    res.status(201).json({ success: true, data: order, message: 'Diet order placed successfully' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/dietary/orders/:id/status
router.patch('/orders/:id/status', requirePermission('dietary.orders.update'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'DISCONTINUED'].includes(status)) {
      throw AppError.badRequest('Status must be ACTIVE or DISCONTINUED');
    }

    const order = await req.prismaTenant.dietOrder.update({
      where: { id: req.params.id },
      data: {
        status,
        endDate: status === 'DISCONTINUED' ? new Date() : undefined,
      },
      include: {
        patient: true,
        dietType: true,
      },
    });

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/dietary/kitchen-worklist
router.get('/kitchen-worklist', requirePermission('dietary.orders.read'), async (req, res, next) => {
  try {
    // Find all active admissions with their bed info and active diet order
    const tenantId = req.tenantId!;
    const admissions = await req.prismaTenant.admission.findMany({
      where: { tenantId, status: 'ADMITTED' },
      include: {
        patient: true,
        bedAllocations: {
          where: { status: 'ACTIVE' },
          include: { bed: { include: { ward: true, room: true } } },
        },
        encounter: {
          include: {
            dietOrders: {
              where: { status: 'ACTIVE' },
              include: { dietType: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const worklist = admissions.map((adm: any) => {
      const activeOrder = adm.encounter?.dietOrders?.[0];
      const activeBed = adm.bedAllocations?.[0]?.bed;
      return {
        admissionId: adm.id,
        admissionNumber: adm.admissionNumber,
        patientId: adm.patient.id,
        patientName: `${adm.patient.firstName} ${adm.patient.lastName}`,
        gender: adm.patient.gender,
        bedNumber: activeBed?.bedNumber || 'Unallocated',
        wardName: activeBed?.ward?.name || 'General',
        dietType: activeOrder?.dietType?.name || 'Regular Hospital Diet (Default)',
        dietCode: activeOrder?.dietType?.code || 'REGULAR',
        isNpo: activeOrder?.dietType?.code === 'NPO',
        restrictions: activeOrder?.restrictions || 'None',
        orderedDate: activeOrder?.startDate || adm.admissionDate,
      };
    });

    // Summary counts by diet
    const summary: Record<string, number> = {};
    for (const item of worklist) {
      summary[item.dietType] = (summary[item.dietType] || 0) + 1;
    }

    res.json({
      success: true,
      data: {
        worklist,
        totalMeals: worklist.length,
        summary,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
