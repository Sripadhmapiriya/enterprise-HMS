import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

// Authentication and Module Enforcement
router.use(authenticateToken);
router.use(requireModule('inventory'));

// Zod Schemas
const CreateProductSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  code: z.string().min(1, 'Item code is required'),
  categoryName: z.string().default('General Supplies'),
  unitName: z.string().default('Unit'),
  genericName: z.string().optional(),
  dosageForm: z.string().optional(),
  strength: z.string().optional(),
  manufacturer: z.string().optional(),
  requiresPrescription: z.boolean().default(false),
  reorderLevel: z.number().int().min(0).default(10),
  taxRate: z.number().min(0).default(0),
});

const CreateBatchSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  locationId: z.string().min(1, 'Location ID is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  manufactureDate: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  purchaseRate: z.number().min(0),
  mrp: z.number().min(0),
  sellingRate: z.number().min(0),
  supplierName: z.string().optional(),
});

const CreateAdjustmentSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  batchId: z.string().min(1, 'Batch ID is required'),
  locationId: z.string().min(1, 'Location ID is required'),
  quantity: z.number().int(), // positive to add, negative to write off
  reason: z.string().min(1, 'Adjustment reason is required'),
});

const CreateLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  type: z.enum(['PHARMACY', 'MAIN_STORE', 'WARD_STORE']).default('MAIN_STORE'),
  departmentId: z.string().optional(),
});

// GET /api/v1/inventory/locations (List locations)
router.get('/locations', requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const hospitalId = req.hospitalId || (req.user as any)?.hospitalId;

    const locations = await req.prismaTenant.inventoryLocation.findMany({
      where: { tenantId, ...(hospitalId ? { hospitalId } : {}) },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: locations,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/inventory/locations (Create location)
router.post('/locations', requirePermission('inventory.adjust'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const hospitalId = req.hospitalId || (req.user as any)?.hospitalId;
    const branchId = req.branchId || (req.user as any)?.branchId;

    if (!hospitalId || !branchId) {
      throw AppError.badRequest('Hospital context required to create inventory location');
    }

    const { name, type, departmentId } = CreateLocationSchema.parse(req.body);

    const location = await req.prismaTenant.inventoryLocation.create({
      data: {
        tenantId,
        hospitalId,
        branchId,
        name,
        type,
        departmentId: departmentId || null,
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      data: location,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/inventory/items (List Item Master)
router.get('/items', requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const search = req.query.q as string | undefined;

    const where: any = { tenantId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await req.prismaTenant.product.findMany({
      where,
      include: {
        category: true,
        unit: true,
        generic: true,
        batches: {
          where: { availableQty: { gt: 0 } },
          select: { availableQty: true, expiryDate: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const items = products.map((p: any) => {
      const totalStock = p.batches.reduce((sum: number, b: any) => sum + b.availableQty, 0);
      const isLowStock = totalStock <= p.reorderLevel;

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        category: p.category.name,
        unit: p.unit.name,
        genericName: p.generic?.name || null,
        dosageForm: p.dosageForm,
        strength: p.strength,
        reorderLevel: p.reorderLevel,
        totalStock,
        isLowStock,
        requiresPrescription: p.requiresPrescription,
        activeBatchesCount: p.batches.length,
      };
    });

    res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/inventory/items (Create Item Master entry)
router.post('/items', requirePermission('inventory.adjust'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = CreateProductSchema.parse(req.body);

    // Upsert Category
    let category = await req.prismaTenant.productCategory.findFirst({
      where: { tenantId, name: body.categoryName },
    });
    if (!category) {
      category = await req.prismaTenant.productCategory.create({
        data: { tenantId, name: body.categoryName },
      });
    }

    // Upsert Unit
    let unit = await req.prismaTenant.unit.findFirst({
      where: { tenantId, name: body.unitName },
    });
    if (!unit) {
      unit = await req.prismaTenant.unit.create({
        data: { tenantId, name: body.unitName },
      });
    }

    // Optional Generic
    let genericId: string | null = null;
    if (body.genericName) {
      let generic = await req.prismaTenant.genericMedicine.findFirst({
        where: { tenantId, name: body.genericName },
      });
      if (!generic) {
        generic = await req.prismaTenant.genericMedicine.create({
          data: { tenantId, name: body.genericName },
        });
      }
      genericId = generic.id;
    }

    // Create Product
    const product = await req.prismaTenant.product.create({
      data: {
        tenantId,
        name: body.name,
        code: body.code,
        categoryId: category.id,
        unitId: unit.id,
        genericId,
        dosageForm: body.dosageForm || null,
        strength: body.strength || null,
        manufacturer: body.manufacturer || null,
        requiresPrescription: body.requiresPrescription,
        reorderLevel: body.reorderLevel,
        taxRate: body.taxRate,
      },
      include: {
        category: true,
        unit: true,
        generic: true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        code: product.code,
        category: product.category.name,
        unit: product.unit.name,
        genericName: product.generic?.name || null,
        dosageForm: product.dosageForm,
        strength: product.strength,
        reorderLevel: product.reorderLevel,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/inventory/items/:id (Product Details & Batches)
router.get('/items/:id', requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const product = await req.prismaTenant.product.findFirst({
      where: { tenantId, id: req.params.id },
      include: {
        category: true,
        unit: true,
        generic: true,
        batches: {
          orderBy: { expiryDate: 'asc' }, // FEFO ordering
          include: { location: true },
        },
      },
    });

    if (!product) {
      throw AppError.notFound('Product not found in inventory');
    }

    const totalStock = product.batches.reduce((sum: number, b: any) => sum + b.availableQty, 0);

    res.json({
      success: true,
      data: {
        ...product,
        totalStock,
        isLowStock: totalStock <= product.reorderLevel,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/inventory/batches (Receive new stock batch)
router.post('/batches', requirePermission('inventory.adjust'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const body = CreateBatchSchema.parse(req.body);

    const product = await req.prismaTenant.product.findFirst({
      where: { tenantId, id: body.productId },
    });
    if (!product) throw AppError.notFound('Product not found');

    const location = await req.prismaTenant.inventoryLocation.findFirst({
      where: { tenantId, id: body.locationId },
    });
    if (!location) throw AppError.notFound('Location not found');

    let supplierId: string | null = null;
    if (body.supplierName) {
      let supplier = await req.prismaTenant.supplier.findFirst({
        where: { tenantId, name: body.supplierName },
      });
      if (!supplier) {
        supplier = await req.prismaTenant.supplier.create({
          data: {
            tenantId,
            name: body.supplierName,
            code: 'SUP-' + Math.floor(1000 + Math.random() * 9000),
          },
        });
      }
      supplierId = supplier.id;
    }

    const expiryDate = new Date(body.expiryDate);
    const manufactureDate = body.manufactureDate ? new Date(body.manufactureDate) : null;

    // Upsert Batch
    const batch = await req.prismaTenant.inventoryBatch.upsert({
      where: {
        productId_locationId_batchNumber: {
          productId: body.productId,
          locationId: body.locationId,
          batchNumber: body.batchNumber,
        },
      },
      update: {
        availableQty: { increment: body.quantity },
        purchaseRate: body.purchaseRate,
        mrp: body.mrp,
        sellingRate: body.sellingRate,
        expiryDate,
      },
      create: {
        tenantId,
        productId: body.productId,
        locationId: body.locationId,
        batchNumber: body.batchNumber,
        expiryDate,
        manufactureDate,
        purchaseRate: body.purchaseRate,
        mrp: body.mrp,
        sellingRate: body.sellingRate,
        availableQty: body.quantity,
        supplierId,
        status: 'ACTIVE',
      },
    });

    // Record Inward Movement in Inventory Ledger
    const ledger = await req.prismaTenant.inventoryLedger.create({
      data: {
        tenantId,
        productId: body.productId,
        batchId: batch.id,
        locationId: body.locationId,
        transactionType: 'PURCHASE',
        quantity: body.quantity,
        userId,
        notes: `Received batch ${body.batchNumber}`,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        batch,
        ledgerId: ledger.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/inventory/batches (List batches with FEFO ordering)
router.get('/batches', requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const productId = req.query.productId as string | undefined;
    const locationId = req.query.locationId as string | undefined;

    const where: any = { tenantId, availableQty: { gt: 0 } };
    if (productId) where.productId = productId;
    if (locationId) where.locationId = locationId;

    // FEFO: Sort by expiryDate ASCENDING so soonest-to-expire is first
    const batches = await req.prismaTenant.inventoryBatch.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true, type: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });

    res.json({
      success: true,
      data: batches,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/inventory/adjustments (Stock adjustment/write-off)
router.post('/adjustments', requirePermission('inventory.adjust'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const body = CreateAdjustmentSchema.parse(req.body);

    const batch = await req.prismaTenant.inventoryBatch.findFirst({
      where: { tenantId, id: body.batchId },
    });
    if (!batch) throw AppError.notFound('Batch not found');

    const newQty = batch.availableQty + body.quantity;
    if (newQty < 0) {
      throw AppError.badRequest(`Cannot reduce stock by ${Math.abs(body.quantity)}; current available is ${batch.availableQty}`);
    }

    const updatedBatch = await req.prismaTenant.inventoryBatch.update({
      where: { id: batch.id },
      data: { availableQty: newQty },
    });

    const ledger = await req.prismaTenant.inventoryLedger.create({
      data: {
        tenantId,
        productId: body.productId,
        batchId: body.batchId,
        locationId: body.locationId,
        transactionType: 'ADJUSTMENT',
        quantity: body.quantity,
        userId,
        notes: body.reason,
      },
    });

    res.json({
      success: true,
      data: {
        batchId: updatedBatch.id,
        availableQty: updatedBatch.availableQty,
        ledgerId: ledger.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/inventory/alerts (Low stock & near-expiry alerts)
router.get('/alerts', requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const now = new Date();
    const ninetyDaysFuture = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // 1. Low stock products
    const products = await req.prismaTenant.product.findMany({
      where: { tenantId, isActive: true },
      include: {
        batches: {
          where: { availableQty: { gt: 0 } },
          select: { availableQty: true },
        },
      },
    });

    const lowStockAlerts = products
      .map((p: any) => {
        const totalStock = p.batches.reduce((sum: number, b: any) => sum + b.availableQty, 0);
        return {
          productId: p.id,
          name: p.name,
          code: p.code,
          currentStock: totalStock,
          reorderLevel: p.reorderLevel,
          deficit: Math.max(0, p.reorderLevel - totalStock),
        };
      })
      .filter((p: any) => p.currentStock <= p.reorderLevel);

    // 2. Near-expiry batches (expiring within 90 days)
    const expiringBatches = await req.prismaTenant.inventoryBatch.findMany({
      where: {
        tenantId,
        availableQty: { gt: 0 },
        expiryDate: { lte: ninetyDaysFuture },
      },
      include: {
        product: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const expiryAlerts = expiringBatches.map((b: any) => {
      const daysUntilExpiry = Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        batchId: b.id,
        batchNumber: b.batchNumber,
        productName: b.product.name,
        productCode: b.product.code,
        locationName: b.location.name,
        availableQty: b.availableQty,
        expiryDate: b.expiryDate,
        daysUntilExpiry,
        isExpired: daysUntilExpiry <= 0,
      };
    });

    res.json({
      success: true,
      data: {
        lowStock: lowStockAlerts,
        expiringBatches: expiryAlerts,
        totalAlerts: lowStockAlerts.length + expiryAlerts.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/inventory/ledger (Movement history)
router.get('/ledger', requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const productId = req.query.productId as string | undefined;

    const where: any = { tenantId };
    if (productId) where.productId = productId;

    const ledgers = await req.prismaTenant.inventoryLedger.findMany({
      where,
      include: {
        product: { select: { name: true, code: true } },
        batch: { select: { batchNumber: true, expiryDate: true } },
        location: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: ledgers,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
