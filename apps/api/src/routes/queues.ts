import { Router } from 'express';
import { prisma } from '@enterprise-hms/database';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const queues = await prisma.queue.findMany({
      include: { patient: true, doctor: { include: { user: true } } },
      orderBy: { queueNumber: 'asc' }
    });
    res.json({ success: true, data: queues });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch queues' });
  }
});

router.post('/', async (req, res) => {
  try {
    const queue = await prisma.queue.create({
      data: req.body
    });
    res.json({ success: true, data: queue });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create queue entry' });
  }
});

export default router;
