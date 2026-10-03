import { Router } from 'express';
import { prisma } from '@enterprise-hms/database';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: { patient: true, doctor: { include: { user: true } } },
      orderBy: { appointmentDate: 'desc' }
    });
    res.json({ success: true, data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch appointments' });
  }
});

router.post('/', async (req, res) => {
  try {
    const appointment = await prisma.appointment.create({
      data: req.body
    });
    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create appointment' });
  }
});

export default router;
