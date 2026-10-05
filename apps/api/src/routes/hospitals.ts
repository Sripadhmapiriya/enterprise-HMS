import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const hospitals = await req.prismaTenant.hospital.findMany({
      include: {
        branches: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: hospitals.map((h: any) => ({
        id: h.id,
        name: h.name,
        legalName: h.legalName,
        code: h.code,
        city: h.city,
        state: h.state,
        isActive: h.isActive,
        branchCount: h.branches ? h.branches.length : 0,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: 'HOSPITAL_FETCH_FAILED',
        message: error.message || 'Failed to retrieve hospitals',
      },
    });
  }
});

export default router;
