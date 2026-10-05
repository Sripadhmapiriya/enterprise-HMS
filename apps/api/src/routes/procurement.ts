import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('procurement'));

function generatePrNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PR-${dateStr}-${rand}`;
}

function generatePoNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PO-${dateStr}-${rand}`;
}

function generateGrnNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `GRN-${dateStr}-${rand}`;
}

// =========================================================================
// VALIDATION SCHEMAS
// =========================================================================

const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  code: z.string().min(1, 'Supplier code is required'),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  taxInfo: z.string().optional(),
});

const CreatePurchaseRequestSchema = z.object({
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  reason: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        quantity: z.number().int().positive('Quantity must be positive'),
      })
    )
    .min(1, 'At least one item is required in requisition'),
});

const ApprovePurchaseRequestSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string(),
        approvedQuantity: z.number().int().min(0),
      })
    )
    .optional(),
});

const CreatePurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  requestId: z.string().optional(),
  expectedDelivery: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
        taxAmount: z.number().min(0).default(0),
        discount: z.number().min(0).default(0),
      })
    )
    .min(1, 'At least one PO item is required'),
});

const CreateGoodsReceiptSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  purchaseOrderId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  destinationLocationId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        batchNumber: z.string().min(1, 'Batch number is required'),
        expiryDate: z.string().min(1, 'Expiry date is required'),
        quantity: z.number().int().positive(),
        purchaseRate: z.number().positive(),
        mrp: z.number().positive().optional(),
        sellingRate: z.number().positive().optional(),
        taxAmount: z.number().min(0).default(0),
      })
    )
    .min(1, 'At least one received item is required'),
});

// =========================================================================
// 1. SUPPLIERS
// =========================================================================

// GET /api/v1/procurement/suppliers
router.get('/suppliers', requirePermission('procurement.create_po'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const suppliers = await req.prismaTenant.supplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: suppliers });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/procurement/suppliers
router.post('/suppliers', requirePermission('procurement.create_po'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = CreateSupplierSchema.parse(req.body);

    const supplier = await req.prismaTenant.supplier.create({
      data: {
        tenantId,
        name: body.name,
        code: body.code,
        contactName: body.contactName,
        phone: body.phone,
        email: body.email,
        address: body.address,
        taxInfo: body.taxInfo,
      },
    });

    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. PURCHASE REQUESTS / REQUISITIONS (PR)
// =========================================================================

// GET /api/v1/procurement/requests
router.get('/requests', requirePermission('procurement.create_po'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const requests = await req.prismaTenant.purchaseRequest.findMany({
      where: { tenantId },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: true,
        branch: true,
        items: { include: { product: true } },
        purchaseOrders: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/procurement/requests
router.post('/requests', requirePermission('procurement.create_po'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const body = CreatePurchaseRequestSchema.parse(req.body);

    let branchId = body.branchId || req.branchId || (req.user as any)?.branchId;
    if (!branchId) {
      const b = await req.prismaTenant.branch.findFirst();
      branchId = b?.id;
    }
    if (!branchId) throw AppError.badRequest('Branch context required for purchase request');

    const prNumber = generatePrNumber();

    const request = await req.prismaTenant.purchaseRequest.create({
      data: {
        tenantId,
        branchId,
        departmentId: body.departmentId,
        requestedById: userId,
        prNumber,
        priority: body.priority,
        reason: body.reason || 'Restock inventory requisition',
        status: 'PENDING_APPROVAL',
        items: {
          create: body.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            approvedQuantity: i.quantity,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: `Purchase Requisition ${prNumber} created`,
      data: request,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/procurement/requests/:id/approve
router.patch('/requests/:id/approve', requirePermission('procurement.create_po'), async (req, res, next) => {
  try {
    const body = ApprovePurchaseRequestSchema.parse(req.body);
    const pr = await req.prismaTenant.purchaseRequest.findFirst({
      where: { id: req.params.id },
      include: { items: true },
    });

    if (!pr) throw AppError.notFound('Purchase request not found');

    if (body.items && body.items.length > 0) {
      for (const it of body.items) {
        await req.prismaTenant.purchaseRequestItem.update({
          where: { id: it.itemId },
          data: { approvedQuantity: it.approvedQuantity },
        });
      }
    }

    const updated = await req.prismaTenant.purchaseRequest.update({
      where: { id: pr.id },
      data: {
        status: body.approved ? 'APPROVED' : 'REJECTED',
        reason: body.rejectionReason || pr.reason,
      },
      include: { items: { include: { product: true } } },
    });

    res.json({
      success: true,
      message: body.approved ? 'Purchase requisition approved' : 'Purchase requisition rejected',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. PURCHASE ORDERS (PO)
// =========================================================================

// GET /api/v1/procurement/orders
router.get('/orders', requirePermission('procurement.create_po'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const orders = await req.prismaTenant.purchaseOrder.findMany({
      where: { tenantId },
      include: {
        supplier: true,
        request: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/procurement/orders
router.post('/orders', requirePermission('procurement.create_po'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const body = CreatePurchaseOrderSchema.parse(req.body);

    const poNumber = generatePoNumber();

    let totalAmount = 0;
    const itemsData = body.items.map((i) => {
      const lineTotal = i.quantity * i.unitPrice + i.taxAmount - i.discount;
      totalAmount += lineTotal;
      return {
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxAmount: i.taxAmount,
        discount: i.discount,
        lineTotal,
      };
    });

    const po = await req.prismaTenant.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: body.supplierId,
        requestId: body.requestId,
        poNumber,
        status: 'SENT',
        expectedDelivery: body.expectedDelivery ? new Date(body.expectedDelivery) : undefined,
        totalAmount,
        createdById: userId,
        items: {
          create: itemsData,
        },
      },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    });

    // If linked to PR, update PR status to PO_CREATED
    if (body.requestId) {
      await req.prismaTenant.purchaseRequest.update({
        where: { id: body.requestId },
        data: { status: 'PO_CREATED' },
      });
    }

    res.status(201).json({
      success: true,
      message: `Purchase Order ${poNumber} issued to supplier`,
      data: po,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 4. GOODS RECEIVED NOTE (GRN) & PHARMACY BATCH RESTOCKING
// =========================================================================

// GET /api/v1/procurement/goods-receipts
router.get('/goods-receipts', requirePermission('procurement.receive_grn'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const receipts = await req.prismaTenant.goodsReceipt.findMany({
      where: { tenantId },
      include: {
        supplier: true,
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: receipts });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/procurement/goods-receipts
// Completes receipt, creates GRN record, and AUTOMATICALLY creates or increments InventoryBatch in destination location!
router.post('/goods-receipts', requirePermission('procurement.receive_grn'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const body = CreateGoodsReceiptSchema.parse(req.body);

    const invoiceNumber = body.invoiceNumber || generateGrnNumber();
    const invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : new Date();

    // Determine target location (e.g. Pharmacy location or Main Store)
    let locationId = body.destinationLocationId;
    if (!locationId) {
      // Find a pharmacy location, or any inventory location
      const loc =
        (await req.prismaTenant.inventoryLocation.findFirst({
          where: { tenantId, type: 'PHARMACY' },
        })) || (await req.prismaTenant.inventoryLocation.findFirst({ where: { tenantId } }));
      locationId = loc?.id;
    }

    if (!locationId) {
      // Create a default Pharmacy location if none exists
      let branch = await req.prismaTenant.branch.findFirst({ where: { tenantId } });
      if (!branch) branch = await req.prismaTenant.branch.findFirst();
      const hospitalId = branch?.hospitalId || req.hospitalId || tenantId;

      const newLoc = await req.prismaTenant.inventoryLocation.create({
        data: {
          tenantId,
          hospitalId: hospitalId!,
          branchId: branch!.id,
          name: 'Central Inpatient & Outpatient Pharmacy',
          type: 'PHARMACY',
          isActive: true,
        },
      });
      locationId = newLoc.id;
    }

    let totalAmount = 0;
    const receiptItemsData = body.items.map((i) => {
      const lineTotal = i.quantity * i.purchaseRate + i.taxAmount;
      totalAmount += lineTotal;
      return {
        productId: i.productId,
        batchNumber: i.batchNumber,
        expiryDate: new Date(i.expiryDate),
        quantity: i.quantity,
        purchaseRate: i.purchaseRate,
        mrp: i.mrp || i.sellingRate || i.purchaseRate * 1.25,
        sellingRate: i.sellingRate || i.mrp || i.purchaseRate * 1.25,
        taxAmount: i.taxAmount,
        totalAmount: lineTotal,
      };
    });

    const receipt = await req.prismaTenant.goodsReceipt.create({
      data: {
        tenantId,
        supplierId: body.supplierId,
        invoiceNumber,
        invoiceDate,
        totalAmount,
        status: 'COMPLETED',
        receivedById: userId,
        items: {
          create: receiptItemsData,
        },
      },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    });

    // Restock Inventory Batches for each item
    const createdBatches = [];
    for (const item of receiptItemsData) {
      const batch = await req.prismaTenant.inventoryBatch.upsert({
        where: {
          productId_locationId_batchNumber: {
            productId: item.productId,
            locationId: locationId!,
            batchNumber: item.batchNumber,
          },
        },
        update: {
          availableQty: { increment: item.quantity },
          purchaseRate: item.purchaseRate,
          mrp: item.mrp,
          sellingRate: item.sellingRate,
          expiryDate: item.expiryDate,
          status: 'ACTIVE',
        },
        create: {
          tenantId,
          productId: item.productId,
          locationId: locationId!,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          purchaseRate: item.purchaseRate,
          mrp: item.mrp,
          sellingRate: item.sellingRate,
          availableQty: item.quantity,
          supplierId: body.supplierId,
          status: 'ACTIVE',
        },
        include: { product: true, location: true },
      });

      // Write Inventory Ledger Entry
      await req.prismaTenant.inventoryLedger.create({
        data: {
          tenantId,
          productId: item.productId,
          batchId: batch.id,
          locationId: locationId!,
          transactionType: 'PURCHASE',
          quantity: item.quantity,
          referenceId: receipt.id,
          userId,
          notes: `GRN ${invoiceNumber} received from ${receipt.supplier.name}`,
        },
      });

      createdBatches.push(batch);
    }

    // If linked to PO, mark PO as COMPLETED
    if (body.purchaseOrderId) {
      await req.prismaTenant.purchaseOrder.update({
        where: { id: body.purchaseOrderId },
        data: { status: 'COMPLETED' },
      });
    }

    res.status(201).json({
      success: true,
      message: `Goods Received Note ${invoiceNumber} completed; ${createdBatches.length} batch(es) restocked to ${createdBatches[0]?.location?.name || 'Inventory'}`,
      data: {
        ...receipt,
        receipt,
        destinationLocationId: locationId,
        batches: createdBatches,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 5. 3-WAY MATCH & SUMMARY
// =========================================================================

// GET /api/v1/procurement/match-summary/:poId
router.get('/match-summary/:poId', requirePermission('procurement.create_po'), async (req, res, next) => {
  try {
    const po = await req.prismaTenant.purchaseOrder.findFirst({
      where: { id: req.params.poId },
      include: {
        supplier: true,
        request: { include: { items: true } },
        items: { include: { product: true } },
      },
    });

    if (!po) throw AppError.notFound('Purchase Order not found');

    const grns = await req.prismaTenant.goodsReceipt.findMany({
      where: { supplierId: po.supplierId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    res.json({
      success: true,
      data: {
        purchaseOrder: po,
        purchaseRequest: po.request,
        goodsReceipts: grns,
        threeWayMatchVerified: po.status === 'COMPLETED',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
