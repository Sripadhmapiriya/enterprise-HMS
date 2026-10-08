import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { chargeCaptureService } from '../services/chargeCaptureService';

const router = Router();

// Authentication and Module Enforcement
router.use(authenticateToken);
router.use(requireModule('pharmacy'));

// Zod Schemas
const DispenseItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  batchId: z.string().optional(), // If omitted, FEFO automatically picks oldest unexpired
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  unitPrice: z.number().min(0).optional(),
  instructions: z.string().optional(),
});

const DispenseSchema = z.object({
  prescriptionId: z.string().optional(),
  patientId: z.string().optional(),
  locationId: z.string().min(1, 'Pharmacy location ID is required'),
  items: z.array(DispenseItemSchema).min(1, 'At least one item must be dispensed'),
  isNarcotic: z.boolean().default(false),
  doctorLicense: z.string().optional(),
  notes: z.string().optional(),
});

const WalkInPosSchema = z.object({
  customerName: z.string().default('Walk-in Customer'),
  customerPhone: z.string().optional(),
  patientId: z.string().optional(),
  locationId: z.string().min(1, 'Location ID is required'),
  items: z.array(DispenseItemSchema).min(1, 'At least one item must be dispensed'),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI']).default('CASH'),
});

const ReturnMedicationSchema = z.object({
  dispensingId: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      batchId: z.string().min(1),
      quantity: z.number().int().positive(),
      reason: z.string().min(1),
    })
  ),
});

// GET /api/v1/pharmacy/queue (Prescription Queue)
router.get('/queue', requirePermission('pharmacy.dispense'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;

    const prescriptions = await req.prismaTenant.prescription.findMany({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'PENDING', 'PRESCRIBED'] },
      },
      include: {
        patient: {
          select: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
            gender: true,
            dateOfBirth: true,
            allergies: { where: { status: 'ACTIVE' }, select: { allergen: true } },
            alerts: { where: { isActive: true }, select: { description: true, severity: true } },
          },
        },
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: prescriptions.map((rx: any) => ({
        id: rx.id,
        prescriptionNumber: rx.prescriptionNumber || rx.id.slice(0, 8).toUpperCase(),
        encounterId: rx.encounterId,
        patient: rx.patient,
        prescriber: rx.doctor?.user ? `Dr. ${rx.doctor.user.firstName} ${rx.doctor.user.lastName}` : 'Physician',
        createdAt: rx.createdAt,
        status: rx.status,
        itemCount: rx.items.length,
        items: rx.items,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pharmacy/prescriptions/:id (Prescription Detail & FEFO Batch Options)
router.get('/prescriptions/:id', requirePermission('pharmacy.dispense'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const rx = await req.prismaTenant.prescription.findFirst({
      where: { tenantId, id: req.params.id },
      include: {
        patient: {
          include: {
            allergies: { where: { status: 'ACTIVE' } },
            alerts: { where: { isActive: true } },
          },
        },
        doctor: { include: { user: true } },
        items: true,
      },
    });

    if (!rx) {
      throw AppError.notFound('Prescription not found');
    }

    // For each item, look up available batches using FEFO
    const now = new Date();
    const itemsWithBatches = await Promise.all(
      rx.items.map(async (item: any) => {
        // Find matching product by name or code
        const product = await req.prismaTenant.product.findFirst({
          where: {
            tenantId,
            OR: [
              { name: { contains: item.drugName, mode: 'insensitive' } },
              { code: item.drugName },
            ],
          },
          include: {
            batches: {
              where: {
                availableQty: { gt: 0 },
                expiryDate: { gt: now },
              },
              orderBy: { expiryDate: 'asc' }, // FEFO!
            },
          },
        });

        return {
          ...item,
          productId: product?.id || null,
          availableStock: product?.batches.reduce((sum: number, b: any) => sum + b.availableQty, 0) || 0,
          fefoBatches: product?.batches || [],
          recommendedBatch: product?.batches[0] || null, // Oldest unexpired batch
        };
      })
    );

    res.json({
      success: true,
      data: {
        ...rx,
        items: itemsWithBatches,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/pharmacy/dispense (FEFO Batch Picking & Charge Capture)
router.post('/dispense', requirePermission('pharmacy.dispense'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const hospitalId = req.hospitalId || (req.user as any)?.hospitalId || '';
    const branchId = req.branchId || (req.user as any)?.branchId || '';

    const body = DispenseSchema.parse(req.body);
    const now = new Date();

    let patientId = body.patientId;
    if (!patientId && body.prescriptionId) {
      const rx = await req.prismaTenant.prescription.findFirst({
        where: { id: body.prescriptionId },
      });
      patientId = rx?.patientId;
    }
    if (!patientId) {
      throw AppError.badRequest('Patient ID is required or must be linked via prescriptionId');
    }

    // Verify patient
    const patient = await req.prismaTenant.patient.findFirst({
      where: { tenantId, id: patientId },
    });
    if (!patient) throw AppError.notFound('Patient not found');

    let totalAmount = 0;
    const dispensedItemDetails: Array<{
      productId: string;
      batchId: string;
      batchNumber: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    // Process each item using FEFO
    for (const item of body.items) {
      const product = await req.prismaTenant.product.findFirst({
        where: { tenantId, id: item.productId },
      });
      if (!product) throw AppError.notFound(`Product with ID ${item.productId} not found`);

      let targetBatch: any = null;

      if (item.batchId) {
        // Specific batch requested
        targetBatch = await req.prismaTenant.inventoryBatch.findFirst({
          where: { tenantId, id: item.batchId, locationId: body.locationId },
        });
      } else {
        // FEFO: Pick the oldest unexpired active batch with stock
        targetBatch = await req.prismaTenant.inventoryBatch.findFirst({
          where: {
            tenantId,
            productId: item.productId,
            locationId: body.locationId,
            availableQty: { gte: item.quantity },
            expiryDate: { gt: now },
            status: 'ACTIVE',
          },
          orderBy: { expiryDate: 'asc' }, // FEFO
        });
      }

      if (!targetBatch) {
        throw AppError.badRequest(
          `Insufficient unexpired stock for "${product.name}" in location. Required: ${item.quantity}`
        );
      }

      if (targetBatch.availableQty < item.quantity) {
        throw AppError.badRequest(
          `Batch ${targetBatch.batchNumber} has only ${targetBatch.availableQty} units available; requested ${item.quantity}`
        );
      }

      if (new Date(targetBatch.expiryDate).getTime() <= now.getTime()) {
        throw AppError.badRequest(
          `Batch ${targetBatch.batchNumber} expired on ${new Date(targetBatch.expiryDate).toLocaleDateString()}`
        );
      }

      const unitPrice = item.unitPrice ?? targetBatch.sellingRate ?? 0;
      const lineTotal = item.quantity * unitPrice;
      totalAmount += lineTotal;

      // Decrement Batch Stock
      await req.prismaTenant.inventoryBatch.update({
        where: { id: targetBatch.id },
        data: { availableQty: { decrement: item.quantity } },
      });

      // Record in Inventory Ledger
      await req.prismaTenant.inventoryLedger.create({
        data: {
          tenantId,
          productId: product.id,
          batchId: targetBatch.id,
          locationId: body.locationId,
          transactionType: 'DISPENSE',
          quantity: -item.quantity,
          userId,
          notes: body.prescriptionId ? `Dispensed for Rx ${body.prescriptionId}` : 'OTC Dispense',
        },
      });

      dispensedItemDetails.push({
        productId: product.id,
        batchId: targetBatch.id,
        batchNumber: targetBatch.batchNumber,
        quantity: item.quantity,
        unitPrice,
        totalPrice: lineTotal,
      });
    }

    // Create PharmacyDispensing record
    const dispensing = await req.prismaTenant.pharmacyDispensing.create({
      data: {
        tenantId,
        locationId: body.locationId,
        prescriptionId: body.prescriptionId || null,
        patientId,
        dispensedById: userId,
        status: 'COMPLETED',
        totalAmount,
        items: {
          create: dispensedItemDetails.map((d) => ({
            productId: d.productId,
            batchId: d.batchId,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
            totalPrice: d.totalPrice,
          })),
        },
      },
      include: { items: true },
    });

    // Update prescription status if applicable
    if (body.prescriptionId) {
      await req.prismaTenant.prescription.update({
        where: { id: body.prescriptionId },
        data: { status: 'DISPENSED' },
      });
    }

    // Trigger Charge Capture Port (Loose coupling with billing)
    const chargeResult = await chargeCaptureService.postCharge({
      tenantId,
      hospitalId,
      branchId,
      patientId,
      chargeCode: 'PHARM-MED-DISPENSE',
      description: `Pharmacy Dispensing #${dispensing.id.slice(0, 8).toUpperCase()}`,
      quantity: 1,
      unitPrice: totalAmount,
      sourceModule: 'PHARMACY',
      sourceReferenceId: dispensing.id,
      createdById: userId,
    });

    res.status(201).json({
      success: true,
      message: 'Medications dispensed successfully',
      data: {
        dispensingId: dispensing.id,
        patientId,
        totalAmount,
        status: dispensing.status,
        items: dispensedItemDetails,
        charge: chargeResult,
        receiptMode: chargeResult.receiptMode,
        isBilled: chargeResult.isBilled,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/pharmacy/pos (Walk-in OTC Sale)
router.post('/pos', requirePermission('pharmacy.pos'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const hospitalId = req.hospitalId || (req.user as any)?.hospitalId;
    const branchId = req.branchId || (req.user as any)?.branchId;
    
    if (!hospitalId || !branchId) {
      throw AppError.badRequest('Context error: hospitalId and branchId are required for POS sales.');
    }

    const body = WalkInPosSchema.parse(req.body);

    const result = await req.prismaTenant.$transaction(async (tx: any) => {
      let patientId: string = body.patientId || '';
      if (!patientId) {
        const walkInPatient = await tx.patient.create({
          data: {
            tenantId,
            hospitalId,
            mrn: `POS-${Date.now()}-${crypto.randomInt(100, 1000)}`,
            firstName: body.customerName || 'Walk-in',
            lastName: 'Customer',
            gender: 'UNKNOWN',
            dateOfBirth: new Date('1990-01-01'),
            mobile: body.customerPhone || '0000000000',
            status: 'ACTIVE',
          },
        });
        patientId = walkInPatient.id;
      }

      const now = new Date();
      let totalAmount = 0;
      const itemsProcessed: any[] = [];
      const lineItemsForDb: any[] = [];

      for (const item of body.items) {
        const product = await tx.product.findFirst({
          where: { tenantId, id: item.productId },
        });
        if (!product) throw AppError.notFound(`Product not found: ${item.productId}`);

        const batch = await tx.inventoryBatch.findFirst({
          where: {
            tenantId,
            productId: item.productId,
            locationId: body.locationId,
            availableQty: { gte: item.quantity },
            expiryDate: { gt: now },
            status: 'ACTIVE',
          },
          orderBy: { expiryDate: 'asc' },
        });

        if (!batch) {
          throw AppError.badRequest(`Insufficient unexpired stock for "${product.name}"`);
        }

        const unitPrice = item.unitPrice ?? batch.sellingRate;
        const lineTotal = item.quantity * unitPrice;
        totalAmount += lineTotal;

        await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: { availableQty: { decrement: item.quantity } },
        });

        await tx.inventoryLedger.create({
          data: {
            tenantId,
            productId: product.id,
            batchId: batch.id,
            locationId: body.locationId,
            transactionType: 'DISPENSE',
            quantity: -item.quantity,
            userId,
            notes: `Walk-in POS Sale (${body.paymentMethod})`,
          },
        });

        lineItemsForDb.push({
          productId: product.id,
          batchId: batch.id,
          quantity: item.quantity,
          unitPrice,
          totalPrice: lineTotal,
        });

        itemsProcessed.push({
          productId: product.id,
          productName: product.name,
          batchNumber: batch.batchNumber,
          quantity: item.quantity,
          unitPrice,
          totalPrice: lineTotal,
        });
      }

      const dispensing = await tx.pharmacyDispensing.create({
        data: {
          tenantId,
          locationId: body.locationId,
          patientId,
          dispensedById: userId,
          status: 'COMPLETED',
          totalAmount,
          items: {
            create: lineItemsForDb,
          },
        },
        include: { items: true },
      });

      const charge = await chargeCaptureService.postCharge({
        tenantId,
        hospitalId,
        branchId,
        patientId,
        chargeCode: 'PHARM-OTC-SALE',
        description: `OTC Pharmacy Sale #${dispensing.id.slice(0, 8).toUpperCase()}`,
        quantity: 1,
        unitPrice: totalAmount,
        sourceModule: 'PHARMACY',
        sourceReferenceId: dispensing.id,
        createdById: userId,
      });

      return { dispensing, itemsProcessed, totalAmount, charge, patientId };
    });

    res.status(201).json({
      success: true,
      data: {
        receiptNumber: `POS-${Date.now().toString().slice(-6)}`,
        dispensingId: result.dispensing.id,
        customerName: body.customerName,
        paymentMethod: body.paymentMethod,
        totalAmount: result.totalAmount,
        receiptMode: result.charge.receiptMode,
        isBilled: result.charge.isBilled,
        items: result.itemsProcessed,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pharmacy/dispensings (History)
router.get('/dispensings', requirePermission('pharmacy.dispense'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;

    const dispensings = await req.prismaTenant.pharmacyDispensing.findMany({
      where: { tenantId },
      include: {
        patient: { select: { mrn: true, firstName: true, lastName: true } },
        dispensedBy: { select: { firstName: true, lastName: true } },
        items: {
          include: {
            product: { select: { name: true, code: true } },
            batch: { select: { batchNumber: true, expiryDate: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: dispensings,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pharmacy/controlled-register (Narcotics & Controlled Substances)
router.get('/controlled-register', requirePermission('pharmacy.dispense'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;

    const dispensings = await req.prismaTenant.pharmacyDispensing.findMany({
      where: {
        tenantId,
        items: {
          some: {
            product: { requiresPrescription: true },
          },
        },
      },
      include: {
        patient: { select: { mrn: true, firstName: true, lastName: true } },
        dispensedBy: { select: { firstName: true, lastName: true } },
        prescription: {
          include: {
            doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
        items: {
          where: { product: { requiresPrescription: true } },
          include: {
            product: { select: { name: true, code: true, strength: true } },
            batch: { select: { batchNumber: true, expiryDate: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      data: dispensings,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/pharmacy/returns (Return medications and restore stock)
router.post('/returns', requirePermission('pharmacy.dispense'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const body = ReturnMedicationSchema.parse(req.body);

    const dispensing = await req.prismaTenant.pharmacyDispensing.findFirst({
      where: { tenantId, id: body.dispensingId },
    });
    if (!dispensing) throw AppError.notFound('Dispensing record not found');

    for (const item of body.items) {
      // Re-increment inventory batch
      await req.prismaTenant.inventoryBatch.update({
        where: { id: item.batchId },
        data: { availableQty: { increment: item.quantity } },
      });

      // Record in ledger
      await req.prismaTenant.inventoryLedger.create({
        data: {
          tenantId,
          productId: item.productId,
          batchId: item.batchId,
          locationId: dispensing.locationId,
          transactionType: 'RETURN',
          quantity: item.quantity,
          userId,
          notes: `Return from Dispensing #${dispensing.id.slice(0, 8)}: ${item.reason}`,
        },
      });
    }

    res.json({
      success: true,
      message: 'Medications returned and stock restored',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
