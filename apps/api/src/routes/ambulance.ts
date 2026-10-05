import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('ambulance'));

const CreateAmbulanceSchema = z.object({
  vehicleNumber: z.string().min(1, 'Vehicle number is required'),
  vehicleType: z.enum(['BLS', 'ALS', 'PTS']).default('BLS'),
});

const DispatchTripSchema = z.object({
  ambulanceId: z.string().min(1, 'Ambulance ID is required'),
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  driverId: z.string().optional(),
  pickupLocation: z.string().min(1, 'Pickup location is required'),
  destination: z.string().min(1, 'Destination is required'),
  dispatchTime: z.string().optional(),
});

// GET /api/v1/ambulance/ambulances
router.get('/ambulances', requirePermission('ambulance.trips.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { status, vehicleType } = req.query;
    const where: any = { tenantId, isActive: true };
    if (status) where.status = String(status);
    if (vehicleType) where.vehicleType = String(vehicleType);

    const ambulances = await req.prismaTenant.ambulance.findMany({
      where,
      include: {
        trips: {
          where: { status: { in: ['DISPATCHED', 'EN_ROUTE', 'ARRIVED'] } },
          include: {
            driver: { select: { id: true, firstName: true, lastName: true } },
            patient: { select: { id: true, firstName: true, lastName: true } },
          },
          take: 1,
        },
      },
      orderBy: { vehicleNumber: 'asc' },
    });

    res.json({ success: true, data: ambulances });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ambulance/ambulances
router.post('/ambulances', requirePermission('ambulance.trips.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const data = CreateAmbulanceSchema.parse(req.body);

    const ambulance = await req.prismaTenant.ambulance.create({
      data: {
        tenantId,
        vehicleNumber: data.vehicleNumber.toUpperCase(),
        vehicleType: data.vehicleType,
        status: 'AVAILABLE',
        isActive: true,
      },
    });

    res.status(201).json({ success: true, data: ambulance });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/ambulance/ambulances/:id/status
router.patch('/ambulances/:id/status', requirePermission('ambulance.trips.update'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['AVAILABLE', 'DISPATCHED', 'MAINTENANCE'].includes(status)) {
      throw AppError.badRequest('Status must be AVAILABLE, DISPATCHED, or MAINTENANCE');
    }

    const ambulance = await req.prismaTenant.ambulance.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json({ success: true, data: ambulance });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ambulance/trips
router.get('/trips', requirePermission('ambulance.trips.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { status, ambulanceId, patientId } = req.query;
    const where: any = { tenantId };
    if (status) where.status = String(status);
    if (ambulanceId) where.ambulanceId = String(ambulanceId);
    if (patientId) where.patientId = String(patientId);

    const trips = await req.prismaTenant.ambulanceTrip.findMany({
      where,
      include: {
        ambulance: true,
        patient: true,
        encounter: true,
        driver: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { dispatchTime: 'desc' },
      take: 100,
    });

    res.json({ success: true, data: trips });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ambulance/trips
router.post('/trips', requirePermission('ambulance.trips.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const data = DispatchTripSchema.parse(req.body);

    const ambulance = await req.prismaTenant.ambulance.findUnique({
      where: { id: data.ambulanceId },
    });
    if (!ambulance) {
      throw AppError.notFound('Ambulance vehicle not found');
    }
    if (ambulance.status !== 'AVAILABLE') {
      throw AppError.badRequest(`Ambulance is not available (Current status: ${ambulance.status})`);
    }

    const driverId = data.driverId || req.user!.userId;

    // Create trip
    const trip = await req.prismaTenant.ambulanceTrip.create({
      data: {
        tenantId,
        ambulanceId: data.ambulanceId,
        patientId: data.patientId,
        encounterId: data.encounterId,
        driverId,
        pickupLocation: data.pickupLocation,
        destination: data.destination,
        dispatchTime: data.dispatchTime ? new Date(data.dispatchTime) : new Date(),
        status: 'DISPATCHED',
      },
      include: {
        ambulance: true,
        patient: true,
        driver: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Update vehicle to DISPATCHED
    await req.prismaTenant.ambulance.update({
      where: { id: data.ambulanceId },
      data: { status: 'DISPATCHED' },
    });

    res.status(201).json({ success: true, data: trip, message: 'Ambulance dispatched successfully' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/ambulance/trips/:id/status
router.patch('/trips/:id/status', requirePermission('ambulance.trips.update'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw AppError.badRequest(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    const trip = await req.prismaTenant.ambulanceTrip.findUnique({
      where: { id: req.params.id },
    });
    if (!trip) {
      throw AppError.notFound('Ambulance trip not found');
    }

    const isFinished = status === 'COMPLETED' || status === 'CANCELLED';
    const updatedTrip = await req.prismaTenant.ambulanceTrip.update({
      where: { id: req.params.id },
      data: {
        status,
        completionTime: isFinished ? new Date() : undefined,
      },
      include: {
        ambulance: true,
        patient: true,
        driver: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // If finished, restore vehicle to AVAILABLE
    if (isFinished) {
      await req.prismaTenant.ambulance.update({
        where: { id: trip.ambulanceId },
        data: { status: 'AVAILABLE' },
      });
    }

    res.json({
      success: true,
      data: updatedTrip,
      message: isFinished ? 'Trip closed and ambulance returned to AVAILABLE' : `Trip status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ambulance/stats
router.get('/stats', requirePermission('ambulance.trips.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const [totalVehicles, availableVehicles, dispatchedVehicles, maintenanceVehicles, activeTrips] = await Promise.all([
      req.prismaTenant.ambulance.count({ where: { tenantId, isActive: true } }),
      req.prismaTenant.ambulance.count({ where: { tenantId, isActive: true, status: 'AVAILABLE' } }),
      req.prismaTenant.ambulance.count({ where: { tenantId, isActive: true, status: 'DISPATCHED' } }),
      req.prismaTenant.ambulance.count({ where: { tenantId, isActive: true, status: 'MAINTENANCE' } }),
      req.prismaTenant.ambulanceTrip.count({ where: { tenantId, status: { in: ['DISPATCHED', 'EN_ROUTE', 'ARRIVED'] } } }),
    ]);

    res.json({
      success: true,
      data: {
        totalVehicles,
        availableVehicles,
        dispatchedVehicles,
        maintenanceVehicles,
        activeTrips,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
