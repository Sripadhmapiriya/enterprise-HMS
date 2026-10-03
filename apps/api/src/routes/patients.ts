import { Router } from 'express';
import { prisma } from '@enterprise-hms/database';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: patients });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch patients' });
  }
});

router.post('/', async (req, res) => {
  try {
    const patient = await prisma.patient.create({
      data: req.body
    });
    res.json({ success: true, data: patient });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create patient' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        encounters: { orderBy: { startTime: 'desc' } },
        appointments: { orderBy: { appointmentDate: 'desc' } }
      }
    });
    res.json({ success: true, data: patient });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch patient' });
  }
});

export default router;
