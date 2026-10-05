import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

const CreateScheduleSchema = z.object({
  branchId: z.string().min(1),
  doctorId: z.string().min(1),
  departmentId: z.string().optional(),
  dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format must be HH:MM'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format must be HH:MM'),
  slotDuration: z.number().int().min(5).max(120).optional(),
  slotDurationMinutes: z.number().int().min(5).max(120).optional(),
  maxOverbooking: z.number().int().min(0).max(10).optional(),
  overbookingLimit: z.number().int().min(0).max(10).optional(),
  maxPatientsPerSlot: z.number().int().optional(),
  isActive: z.boolean().default(true),
}).transform(val => ({
  ...val,
  slotDuration: val.slotDuration || val.slotDurationMinutes || 15,
  slotDurationMinutes: val.slotDurationMinutes || val.slotDuration || 15,
  maxOverbooking: val.maxOverbooking !== undefined ? val.maxOverbooking : (val.overbookingLimit !== undefined ? val.overbookingLimit : 2),
  overbookingLimit: val.overbookingLimit !== undefined ? val.overbookingLimit : (val.maxOverbooking !== undefined ? val.maxOverbooking : 2),
}));

const BookAppointmentSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  branchId: z.string().min(1),
  departmentId: z.string().min(1),
  appointmentDate: z.string().optional(),
  scheduledDate: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  type: z.string().optional().default('NEW'),
  reason: z.string().optional(),
  notes: z.string().optional(),
}).transform((val) => {
  const dateStr = val.appointmentDate || val.scheduledDate || new Date().toISOString().slice(0, 10);
  let start = val.startTime;
  let end = val.endTime;
  if (!start.includes('T') && !start.includes('Z')) {
    start = `${dateStr.slice(0, 10)}T${start.length === 5 ? start + ':00.000Z' : '09:00:00.000Z'}`;
  }
  if (!end.includes('T') && !end.includes('Z')) {
    end = `${dateStr.slice(0, 10)}T${end.length === 5 ? end + ':00.000Z' : '09:30:00.000Z'}`;
  }
  let apptType: any = val.type;
  if (!['NEW', 'FOLLOW_UP', 'PROCEDURE', 'WALK_IN'].includes(apptType)) {
    apptType = 'NEW';
  }
  return {
    ...val,
    appointmentDate: dateStr,
    startTime: start,
    endTime: end,
    type: apptType as 'NEW' | 'FOLLOW_UP' | 'PROCEDURE' | 'WALK_IN',
  };
});

const RescheduleSchema = z.object({
  newDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  newStartTime: z.string().datetime(),
  newEndTime: z.string().datetime(),
  reason: z.string().optional(),
});

const CancelSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

const UpdateQueueStatusSchema = z.object({
  status: z.enum(['WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'SKIPPED', 'NO_SHOW']),
});

// All routes require authentication and scheduling module entitlement
router.use(authenticateToken);
router.use(requireModule('scheduling'));

// ==========================================
// DOCTOR SCHEDULES & SLOTS
// ==========================================

// GET /api/v1/scheduling/schedules
router.get('/schedules', requirePermission('scheduling.schedules.read'), async (req, res, next) => {
  try {
    const { branchId, doctorId } = req.query as Record<string, string>;
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (doctorId) where.doctorId = doctorId;

    const schedules = await req.prismaTenant.doctorSchedule.findMany({
      where,
      include: {
        doctor: { include: { user: true } },
        branch: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    res.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/scheduling/schedules
router.post('/schedules', requirePermission('scheduling.schedules.manage'), async (req, res, next) => {
  try {
    const validatedData = CreateScheduleSchema.parse(req.body);
    const { branchId, doctorId, dayOfWeek, startTime, endTime, slotDuration, maxOverbooking, isActive } = validatedData;

    const schedule = await req.prismaTenant.doctorSchedule.create({
      data: {
        tenantId: req.tenantId!,
        branchId,
        doctorId,
        dayOfWeek,
        startTime,
        endTime,
        slotDuration,
        maxOverbooking,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        doctor: { include: { user: true } },
        branch: true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...schedule,
        slotDurationMinutes: schedule.slotDuration,
        overbookingLimit: schedule.maxOverbooking,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/scheduling/slots (Slot generator)
router.get('/slots', requirePermission('scheduling.appointments.read'), async (req, res, next) => {
  try {
    const { doctorId, branchId, date } = req.query as Record<string, string>;
    if (!doctorId || !date) {
      throw AppError.badRequest('doctorId and date (YYYY-MM-DD) are required');
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getUTCDay();

    // Find schedule for doctor on this day of week
    const schedule = await req.prismaTenant.doctorSchedule.findFirst({
      where: {
        doctorId,
        branchId: branchId || undefined,
        dayOfWeek,
        isActive: true,
      },
    });

    if (!schedule) {
      return res.json({
        success: true,
        data: [],
        message: 'No active schedule configured for this doctor on this day of week',
      });
    }

    // Parse start and end time (HH:MM)
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    const slotDurationMs = schedule.slotDuration * 60 * 1000;

    const baseStart = new Date(targetDate);
    baseStart.setUTCHours(startH, startM, 0, 0);

    const baseEnd = new Date(targetDate);
    baseEnd.setUTCHours(endH, endM, 0, 0);

    // Fetch existing appointments on that date
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existingAppointments = await req.prismaTenant.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
      },
    });

    const slots: Array<{
      startTime: string;
      endTime: string;
      status: 'AVAILABLE' | 'BOOKED' | 'OVERBOOKING_AVAILABLE';
      bookedCount: number;
      isAvailable?: boolean;
    }> = [];

    let current = baseStart.getTime();
    while (current + slotDurationMs <= baseEnd.getTime()) {
      const slotStart = new Date(current);
      const slotEnd = new Date(current + slotDurationMs);

      // Count appointments overlapping this slot
      const overlapping = existingAppointments.filter((a: any) => {
        const aStart = new Date(a.startTime).getTime();
        const aEnd = new Date(a.endTime).getTime();
        return Math.max(current, aStart) < Math.min(current + slotDurationMs, aEnd);
      });

      const bookedCount = overlapping.length;
      let status: 'AVAILABLE' | 'BOOKED' | 'OVERBOOKING_AVAILABLE' = 'AVAILABLE';

      if (bookedCount === 0) {
        status = 'AVAILABLE';
      } else if (bookedCount < 1 + schedule.maxOverbooking) {
        status = 'OVERBOOKING_AVAILABLE';
      } else {
        status = 'BOOKED';
      }

      slots.push({
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        status,
        bookedCount,
        isAvailable: status === 'AVAILABLE' || status === 'OVERBOOKING_AVAILABLE',
      });

      current += slotDurationMs;
    }

    res.json({
      success: true,
      data: slots,
      schedule: {
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        slotDuration: schedule.slotDuration,
        maxOverbooking: schedule.maxOverbooking,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// APPOINTMENTS
// ==========================================

// GET /api/v1/scheduling/appointments
router.get('/appointments', requirePermission('scheduling.appointments.read'), async (req, res, next) => {
  try {
    const { doctorId, patientId, branchId, date, status } = req.query as Record<string, string>;
    const where: any = {};

    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      where.appointmentDate = { gte: startOfDay, lte: endOfDay };
    }

    const appointments = await req.prismaTenant.appointment.findMany({
      where,
      include: {
        patient: true,
        doctor: { include: { user: true } },
        department: true,
        branch: true,
        queues: true,
      },
      orderBy: { appointmentDate: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/scheduling/appointments (Book appointment with overbooking rule check)
router.post('/appointments', requirePermission('scheduling.appointments.create'), async (req, res, next) => {
  try {
    const validatedData = BookAppointmentSchema.parse(req.body);

    const slotStart = new Date(validatedData.startTime);
    const slotEnd = new Date(validatedData.endTime);

    // Check doctor schedule and overbooking limits
    const dayOfWeek = new Date(validatedData.appointmentDate).getUTCDay();
    const schedule = await req.prismaTenant.doctorSchedule.findFirst({
      where: {
        doctorId: validatedData.doctorId,
        branchId: validatedData.branchId,
        dayOfWeek,
        isActive: true,
      },
    });

    const maxOverbooking = schedule ? schedule.maxOverbooking : 2;

    const overlappingCount = await req.prismaTenant.appointment.count({
      where: {
        doctorId: validatedData.doctorId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        OR: [
          {
            startTime: { lt: slotEnd },
            endTime: { gt: slotStart },
          },
        ],
      },
    });

    if (overlappingCount >= 1 + maxOverbooking) {
      throw AppError.badRequest(
        `Time slot is completely full (maximum overbooking limit of \${maxOverbooking} exceeded)`
      );
    }

    const appointment = await req.prismaTenant.appointment.create({
      data: {
        tenantId: req.tenantId!,
        patientId: validatedData.patientId,
        doctorId: validatedData.doctorId,
        branchId: validatedData.branchId,
        departmentId: validatedData.departmentId,
        appointmentDate: new Date(validatedData.appointmentDate),
        startTime: slotStart,
        endTime: slotEnd,
        type: validatedData.type,
        status: 'SCHEDULED',
        reason: validatedData.reason,
        notes: validatedData.notes,
      },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        department: true,
        branch: true,
      },
    });

    res.status(201).json({
      success: true,
      data: appointment,
      isOverbooked: overlappingCount > 0,
    });
  } catch (error) {
    next(error);
  }
});

// PUT & POST /api/v1/scheduling/appointments/:id/reschedule
const handleReschedule = async (req: any, res: any, next: any) => {
  try {
    const { newDate, newStartTime, newEndTime, reason } = RescheduleSchema.parse(req.body);

    const existing = await req.prismaTenant.appointment.findFirst({
      where: { id: req.params.id },
    });
    if (!existing) throw AppError.notFound('Appointment not found');

    const updated = await req.prismaTenant.appointment.update({
      where: { id: req.params.id },
      data: {
        appointmentDate: new Date(newDate),
        startTime: new Date(newStartTime),
        endTime: new Date(newEndTime),
        status: 'SCHEDULED',
        notes: reason ? `Rescheduled: ${reason}. ${existing.notes || ''}` : existing.notes,
      },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        department: true,
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
router.put('/appointments/:id/reschedule', requirePermission('scheduling.appointments.update'), handleReschedule);
router.post('/appointments/:id/reschedule', requirePermission('scheduling.appointments.update'), handleReschedule);

// PUT & POST /api/v1/scheduling/appointments/:id/cancel
const handleCancel = async (req: any, res: any, next: any) => {
  try {
    const { reason } = CancelSchema.parse(req.body);

    const existing = await req.prismaTenant.appointment.findFirst({
      where: { id: req.params.id },
    });
    if (!existing) throw AppError.notFound('Appointment not found');

    const updated = await req.prismaTenant.appointment.update({
      where: { id: req.params.id },
      data: {
        status: 'CANCELLED',
        notes: `Cancelled: ${reason}. ${existing.notes || ''}`,
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
router.put('/appointments/:id/cancel', requirePermission('scheduling.appointments.update'), handleCancel);
router.post('/appointments/:id/cancel', requirePermission('scheduling.appointments.update'), handleCancel);

// POST /api/v1/scheduling/appointments/:id/check-in (Check-in patient to OPD Queue)
router.post('/appointments/:id/check-in', requirePermission('scheduling.queue.manage'), async (req, res, next) => {
  try {
    const appointment = await req.prismaTenant.appointment.findFirst({
      where: { id: req.params.id },
      include: { patient: true, doctor: true, branch: true, department: true },
    });

    if (!appointment) throw AppError.notFound('Appointment not found');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Compute next token number for this doctor and branch today
    const existingQueue = await req.prismaTenant.queue.findMany({
      where: {
        branchId: appointment.branchId,
        doctorId: appointment.doctorId,
        queueDate: today,
      },
      select: { queueNumber: true },
    });

    const existingTokens = new Set(existingQueue.map((q: any) => q.queueNumber));
    let nextNum = 1;
    let tokenNumber = `T-${String(nextNum).padStart(3, '0')}`;
    while (existingTokens.has(tokenNumber)) {
      nextNum++;
      tokenNumber = `T-${String(nextNum).padStart(3, '0')}`;
    }

    // Create Queue entry
    const queueEntry = await req.prismaTenant.queue.create({
      data: {
        tenantId: req.tenantId!,
        branchId: appointment.branchId,
        departmentId: appointment.departmentId,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        queueNumber: tokenNumber,
        queueDate: today,
        priority: 'REGULAR',
        status: 'WAITING',
        checkInTime: new Date(),
      },
      include: {
        patient: true,
        doctor: { include: { user: true } },
      },
    });

    // Update appointment status to ARRIVED
    await req.prismaTenant.appointment.update({
      where: { id: appointment.id },
      data: { status: 'ARRIVED' },
    });

    res.status(200).json({
      success: true,
      message: `Patient checked in with token ${tokenNumber}`,
      data: queueEntry,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// OPD QUEUE & DISPLAY BOARD
// ==========================================

// POST /api/v1/scheduling/queue (Check-in / token issuance)
router.post('/queue', requirePermission('scheduling.queue.manage'), async (req, res, next) => {
  try {
    const { patientId, branchId, departmentId, doctorId, appointmentId, priority } = req.body;

    if (!patientId || !branchId || !departmentId || !doctorId) {
      throw AppError.badRequest('patientId, branchId, departmentId, and doctorId are required');
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const existingQueue = await req.prismaTenant.queue.findMany({
      where: {
        branchId,
        doctorId,
        queueDate: today,
      },
      select: { queueNumber: true },
    });

    const existingTokens = new Set(existingQueue.map((q: any) => q.queueNumber));
    let nextNum = 1;
    let tokenNumber = `T-${String(nextNum).padStart(3, '0')}`;
    while (existingTokens.has(tokenNumber)) {
      nextNum++;
      tokenNumber = `T-${String(nextNum).padStart(3, '0')}`;
    }

    const queueEntry = await req.prismaTenant.queue.create({
      data: {
        tenantId: req.tenantId!,
        branchId,
        departmentId,
        doctorId,
        patientId,
        appointmentId: appointmentId || undefined,
        queueNumber: tokenNumber,
        queueDate: today,
        priority: priority || 'REGULAR',
        status: 'WAITING',
        checkInTime: new Date(),
      },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        department: true,
      },
    });

    if (appointmentId) {
      await req.prismaTenant.appointment.update({
        where: { id: appointmentId },
        data: { status: 'ARRIVED' },
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: `Patient checked in with token ${tokenNumber}`,
      data: {
        ...queueEntry,
        tokenNumber,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/scheduling/queue
router.get('/queue', requirePermission('scheduling.queue.read'), async (req, res, next) => {
  try {
    const { branchId, doctorId, status, date } = req.query as Record<string, string>;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    const where: any = {
      queueDate: targetDate,
    };
    if (branchId) where.branchId = branchId;
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;

    const queueItems = await req.prismaTenant.queue.findMany({
      where,
      include: {
        patient: true,
        doctor: { include: { user: true } },
        department: true,
      },
      orderBy: [{ priority: 'desc' }, { checkInTime: 'asc' }],
    });

    res.json({
      success: true,
      data: queueItems,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/scheduling/queue/:id/status
router.put('/queue/:id/status', requirePermission('scheduling.queue.manage'), async (req, res, next) => {
  try {
    const { status } = UpdateQueueStatusSchema.parse(req.body);

    const updateData: any = { status };
    const now = new Date();

    if (status === 'CALLED') {
      updateData.calledTime = now;
    } else if (status === 'IN_CONSULTATION') {
      updateData.consultStartTime = now;
    } else if (status === 'COMPLETED') {
      updateData.consultEndTime = now;
    }

    const updated = await req.prismaTenant.queue.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        patient: true,
        doctor: { include: { user: true } },
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/scheduling/queue/display (Live waiting room display board feed)
router.get('/queue/display', async (req, res, next) => {
  try {
    const { branchId } = req.query as Record<string, string>;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const where: any = { queueDate: today };
    if (branchId) where.branchId = branchId;

    const [calling, waiting, completed] = await Promise.all([
      req.prismaTenant.queue.findMany({
        where: { ...where, status: { in: ['CALLED', 'IN_CONSULTATION'] } },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          department: { select: { name: true } },
        },
        orderBy: { calledTime: 'desc' },
        take: 5,
      }),
      req.prismaTenant.queue.findMany({
        where: { ...where, status: 'WAITING' },
        select: {
          id: true,
          queueNumber: true,
          priority: true,
          checkInTime: true,
        },
        orderBy: [{ priority: 'desc' }, { checkInTime: 'asc' }],
        take: 10,
      }),
      req.prismaTenant.queue.findMany({
        where: { ...where, status: 'COMPLETED' },
        select: {
          id: true,
          queueNumber: true,
          consultEndTime: true,
        },
        orderBy: { consultEndTime: 'desc' },
        take: 5,
      }),
    ]);

    const boardData = {
      nowCalling: calling.map((c: any) => ({
        token: c.queueNumber,
        patientName: `${c.patient.firstName} ${c.patient.lastName.slice(0, 1)}.`,
        doctorName: `Dr. ${c.doctor.user.firstName} ${c.doctor.user.lastName}`,
        room: c.department.name,
        status: c.status,
        calledAt: c.calledTime,
      })),
      nextTokens: waiting.map((w: any) => ({
        token: w.queueNumber,
        priority: w.priority,
      })),
      recentlyCompleted: completed.map((cmp: any) => cmp.queueNumber),
    };

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: { displayBoard: boardData },
      displayBoard: boardData,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
