import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await req.prismaTenant.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: users.map((u: any) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        mobile: u.mobile,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        roles: u.roles ? u.roles.map((r: any) => r.role?.name || 'STAFF') : [],
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: 'USER_FETCH_FAILED',
        message: error.message || 'Failed to retrieve tenant users',
      },
    });
  }
});

export default router;
