import { Router } from 'express';
import { prisma } from '@enterprise-hms/database';

const router = Router();

router.get('/', async (req, res) => {
  res.json({ success: true, data: [] });
});

export default router;
