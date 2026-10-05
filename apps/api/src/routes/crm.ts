import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('crm'));

// =========================================================================
// VALIDATION SCHEMAS
// =========================================================================

const CreateFeedbackSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  encounterId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  category: z.enum(['CLINICAL', 'NURSING', 'FOOD', 'CLEANLINESS', 'BILLING', 'FACILITY']).default('CLINICAL'),
  comments: z.string().optional(),
});

const UpdateFeedbackStatusSchema = z.object({
  status: z.enum(['NEW', 'REVIEWED', 'RESOLVED']),
  resolutionNote: z.string().optional(),
});

// =========================================================================
// 1. PATIENT FEEDBACK & COMPLAINTS
// =========================================================================

// GET /api/v1/crm/feedback
router.get('/feedback', requirePermission('crm.feedback.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { category, status, rating, patientId } = req.query as Record<string, string>;
    const where: any = { tenantId };

    if (category) where.category = category;
    if (status) where.status = status;
    if (rating) where.rating = parseInt(rating, 10);
    if (patientId) where.patientId = patientId;

    const feedbacks = await req.prismaTenant.patientFeedback.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true, mobile: true } },
        encounter: { select: { id: true, type: true, startTime: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ success: true, data: feedbacks });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/crm/feedback
router.post('/feedback', requirePermission('crm.feedback.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = CreateFeedbackSchema.parse(req.body);

    const patient = await req.prismaTenant.patient.findFirst({ where: { id: body.patientId } });
    if (!patient) throw AppError.notFound('Patient not found');

    const feedback = await req.prismaTenant.patientFeedback.create({
      data: {
        tenantId,
        patientId: body.patientId,
        encounterId: body.encounterId,
        rating: body.rating,
        category: body.category,
        comments: body.comments,
        status: 'NEW',
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Patient feedback recorded',
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/crm/feedback/:id/status
router.patch('/feedback/:id/status', requirePermission('crm.feedback.view'), async (req, res, next) => {
  try {
    const body = UpdateFeedbackStatusSchema.parse(req.body);

    const existing = await req.prismaTenant.patientFeedback.findFirst({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('Feedback entry not found');

    const updatedComments = body.resolutionNote
      ? `${existing.comments || ''}\n[RESOLUTION]: ${body.resolutionNote}`
      : existing.comments;

    const feedback = await req.prismaTenant.patientFeedback.update({
      where: { id: existing.id },
      data: {
        status: body.status,
        comments: updatedComments,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      },
    });

    res.json({
      success: true,
      message: `Feedback status updated to ${body.status}`,
      data: { ...feedback, resolutionNote: body.resolutionNote },
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. SLA ESCALATIONS & OVERDUE COMPLAINTS
// =========================================================================

// GET /api/v1/crm/escalations or /api/v1/crm/feedback/escalations
router.get(['/escalations', '/feedback/escalations'], requirePermission('crm.feedback.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const now = new Date();
    const threshold48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const criticalComplaints = await req.prismaTenant.patientFeedback.findMany({
      where: {
        tenantId,
        status: { in: ['NEW', 'REVIEWED'] },
        OR: [
          { rating: { lte: 2 } }, // Negative rating
          { createdAt: { lte: threshold48h } }, // Breached 48h SLA
        ],
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true, mobile: true } },
      },
      orderBy: [{ rating: 'asc' }, { createdAt: 'asc' }],
    });

    const mapped = criticalComplaints.map((c: any) => ({
      id: c.id,
      patientName: `${c.patient.firstName} ${c.patient.lastName}`,
      patientMrn: c.patient.mrn,
      patientMobile: c.patient.mobile,
      category: c.category,
      rating: c.rating,
      comments: c.comments,
      createdAt: c.createdAt,
      isSlaBreached: new Date(c.createdAt).getTime() <= threshold48h.getTime(),
      severity: c.rating === 1 ? 'CRITICAL' : 'HIGH',
    }));

    res.json({ success: true, data: mapped });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. PATIENT SENTIMENT & NPS ANALYTICS
// =========================================================================

// GET /api/v1/crm/analytics
router.get('/analytics', requirePermission('crm.feedback.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const feedbacks = await req.prismaTenant.patientFeedback.findMany({
      where: { tenantId },
    });

    const total = feedbacks.length;
    if (total === 0) {
      return res.json({
        success: true,
        data: {
          totalFeedback: 0,
          averageRating: 0,
          npsScore: 0,
          categoryAverages: {},
          resolutionRate: 0,
        },
      });
    }

    const averageRating = parseFloat(
      (feedbacks.reduce((s: number, f: any) => s + f.rating, 0) / total).toFixed(2)
    );

    // NPS Calculation: Promoters (4-5), Passives (3), Detractors (1-2)
    const promoters = feedbacks.filter((f: any) => f.rating >= 4).length;
    const detractors = feedbacks.filter((f: any) => f.rating <= 2).length;
    const npsScore = Math.round(((promoters - detractors) / total) * 100);

    // Category breakdown
    const catMap: Record<string, { count: number; sum: number }> = {};
    for (const f of feedbacks) {
      if (!catMap[f.category]) catMap[f.category] = { count: 0, sum: 0 };
      catMap[f.category].count++;
      catMap[f.category].sum += f.rating;
    }

    const categoryAverages: Record<string, number> = {};
    for (const [k, v] of Object.entries(catMap)) {
      categoryAverages[k] = parseFloat((v.sum / v.count).toFixed(2));
    }

    const resolved = feedbacks.filter((f: any) => f.status === 'RESOLVED').length;
    const resolutionRate = Math.round((resolved / total) * 100);

    res.json({
      success: true,
      data: {
        totalFeedback: total,
        averageRating,
        npsScore,
        promoters,
        detractors,
        passives: total - (promoters + detractors),
        byCategory: Object.fromEntries(Object.entries(catMap).map(([k, v]) => [k, v.count])),
        categoryAverages,
        resolutionRate,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
