import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

const CreatePatientSchema = z.object({
  hospitalId: z.string().min(1),
  mrn: z.string().min(1, 'MRN is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).default('1990-01-01'),
  gender: z.string().min(1, 'Gender is required'),
  mobile: z.string().min(1).default('+15551234567'),
  bloodGroup: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
});

// All routes require authentication and patients module entitlement
router.use(authenticateToken);
router.use(requireModule('patients'));

// GET /api/v1/patients
router.get('/', requirePermission('patients.read'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const [patients, total] = await Promise.all([
      req.prismaTenant.patient.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      req.prismaTenant.patient.count(),
    ]);

    res.json({
      success: true,
      data: patients,
      meta: {
        page,
        limit,
        total,
        requestId: req.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/patients
router.post('/', requirePermission('patients.create'), async (req, res, next) => {
  try {
    const validatedData = CreatePatientSchema.parse(req.body);

    const patient = await req.prismaTenant.patient.create({
      data: {
        ...validatedData,
        dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : null,
      },
    });

    res.status(201).json({
      success: true,
      data: patient,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/patients/:id
router.get('/:id', requirePermission('patients.read'), async (req, res, next) => {
  try {
    const patient = await req.prismaTenant.patient.findFirst({
      where: { id: req.params.id },
      include: {
        encounters: { orderBy: { startTime: 'desc' }, take: 10 },
        appointments: { orderBy: { appointmentDate: 'desc' }, take: 10 },
        allergies: true,
        alerts: true,
      },
    });

    if (!patient) {
      throw AppError.notFound(`Patient "\${req.params.id}" not found`);
    }

    res.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
