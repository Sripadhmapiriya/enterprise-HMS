import { Router } from 'express';
import { prisma } from '@enterprise-hms/database';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const encounters = await prisma.encounter.findMany({
      include: { patient: true, doctor: { include: { user: true } } },
      orderBy: { startTime: 'desc' }
    });
    res.json({ success: true, data: encounters });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch encounters' });
  }
});

router.post('/', async (req, res) => {
  try {
    const encounter = await prisma.encounter.create({
      data: req.body
    });
    res.json({ success: true, data: encounter });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create encounter' });
  }
});

export default router;
