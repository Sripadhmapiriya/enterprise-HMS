import { Router } from 'express';
import { prisma } from '@enterprise-hms/database';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany();
    res.json({ success: true, data: tenants });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

export default router;
