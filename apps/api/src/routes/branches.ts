import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET /api/v1/branches - Return all branches of the current tenant/hospital
router.get('/', async (req, res, next) => {
  try {
    const branches = await req.prismaTenant.branch.findMany({
      where: { isActive: true },
      include: {
        hospital: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: branches.map((b: any) => ({
        id: b.id,
        hospitalId: b.hospitalId,
        hospitalName: b.hospital?.name,
        name: b.name,
        code: b.code,
        address: b.address,
        contact: b.contact,
        isActive: b.isActive,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/branches/allowed - Return branches allowed for current user
router.get('/allowed', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const isSystemAdmin =
      req.user!.roles.includes('System Administrator') ||
      req.user!.roles.includes('Super Admin') ||
      req.user!.roles.includes('Hospital Admin') ||
      req.user!.permissions.includes('*');

    let branches: any[] = [];
    if (isSystemAdmin) {
      branches = await req.prismaTenant.branch.findMany({
        where: { isActive: true },
        include: { hospital: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      });
    } else {
      const staffRecords = await req.prismaTenant.staff.findMany({
        where: { userId, isActive: true },
        include: {
          branch: {
            include: { hospital: { select: { id: true, name: true } } },
          },
        },
      });

      const doctorRecords = await req.prismaTenant.doctor.findMany({
        where: { userId, isActive: true },
        include: {
          branch: {
            include: { hospital: { select: { id: true, name: true } } },
          },
        },
      });

      const branchMap = new Map<string, any>();
      for (const s of staffRecords) {
        if (s.branch && s.branch.isActive) {
          branchMap.set(s.branch.id, s.branch);
        }
      }
      for (const d of doctorRecords) {
        if (d.branch && d.branch.isActive) {
          branchMap.set(d.branch.id, d.branch);
        }
      }
      branches = Array.from(branchMap.values());
    }

    res.json({
      success: true,
      data: branches.map((b: any) => ({
        id: b.id,
        hospitalId: b.hospitalId,
        hospitalName: b.hospital?.name,
        name: b.name,
        code: b.code,
        displayName: `${b.hospital?.name ? b.hospital.name + ' - ' : ''}${b.name}`,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
