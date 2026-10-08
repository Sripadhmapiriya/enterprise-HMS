import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { pdfService } from '../services/pdfService';

const router = Router();

// Authentication and Module Enforcement
router.use(authenticateToken);
router.use(requireModule('billing'));

// Validation Schemas
const CreateBillSchema = z.object({
  patientId: z.string().min(1),
  encounterId: z.string().optional(),
  billType: z.enum(['OPD', 'IPD', 'EMERGENCY', 'PHARMACY']).default('OPD'),
  tariffId: z.string().optional(),
  items: z.array(
    z.object({
      chargeMasterId: z.string().optional(),
      serviceName: z.string().optional(),
      description: z.string().optional(),
      serviceCode: z.string().optional(),
      category: z.string().optional(),
      quantity: z.number().int().positive().default(1),
      unitPrice: z.number().nonnegative().optional(),
      rate: z.number().nonnegative().optional(),
      discountAmount: z.number().nonnegative().default(0),
      taxAmount: z.number().nonnegative().default(0),
      sourceModule: z.string().optional(),
      sourceRefId: z.string().optional(),
    })
  ).optional(),
});

const AddBillItemSchema = z.object({
  chargeMasterId: z.string().optional(),
  serviceName: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative().optional(),
  rate: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().default(0),
  taxAmount: z.number().nonnegative().default(0),
  sourceModule: z.string().optional(),
  sourceRefId: z.string().optional(),
});

const ProcessPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.string().optional(),
  paymentMode: z.string().optional(),
  transactionRef: z.string().optional(),
  referenceNumber: z.string().optional(),
});

function generateBillNumber(prefix: string = 'BL'): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomInt(1000, 10000);
  return `${prefix}-${dateStr}-${rand}`;
}

function generateReceiptNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomInt(1000, 10000);
  return `RCPT-${dateStr}-${rand}`;
}

// =========================================================================
// 1. TARIFFS & CHARGE MASTER
// =========================================================================

// GET /api/v1/billing/tariffs
router.get('/tariffs', requirePermission('billing.tariffs.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { category } = req.query;

    const tariffs = await req.prismaTenant.tariff.findMany({
      where: { tenantId, isActive: true },
      include: {
        items: {
          include: { chargeMaster: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let result = tariffs;
    if (category) {
      result = tariffs.filter((t: any) =>
        t.items.some((i: any) => i.chargeMaster?.category === String(category))
      );
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/billing/tariffs (Create Tariff)
router.post('/tariffs', requirePermission('billing.tariffs.manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    let hospitalId = req.hospitalId || (req.user as any)?.hospitalId;
    if (!hospitalId) {
      const h = await req.prismaTenant.hospital.findFirst({ where: { tenantId } });
      if (h) hospitalId = h.id;
    }
    if (!hospitalId) {
      throw AppError.badRequest('Hospital context is required. You do not have a hospital assigned. Please contact the system administrator to assign a hospital to your account.');
    }

    const { name, code, category = 'CONSULTATION', rate = 100, taxPercent = 0, tariffType = 'GENERAL' } = req.body;

    const chargeCode = `CHG-${code || Date.now()}`;
    const charge = await req.prismaTenant.chargeMaster.upsert({
      where: { code: chargeCode },
      update: { name, category, taxRate: Number(taxPercent) },
      create: {
        tenantId,
        code: chargeCode,
        name,
        category,
        taxRate: Number(taxPercent),
      },
    });

    const tariffCode = code || `TAR-${Date.now()}`;
    const tariff = await req.prismaTenant.tariff.create({
      data: {
        tenantId,
        hospitalId,
        name,
        code: tariffCode,
        tariffType,
        validFrom: new Date(),
        items: {
          create: [
            {
              chargeMasterId: charge.id,
              price: Number(rate),
              discount: 0,
            },
          ],
        },
      },
      include: {
        items: {
          include: { chargeMaster: true },
        },
      },
    });

    res.status(201).json({ success: true, data: tariff });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/billing/charges
router.get('/charges', requirePermission('billing.tariffs.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const charges = await req.prismaTenant.chargeMaster.findMany({
      where: { tenantId, isActive: true },
      orderBy: { category: 'asc' },
    });

    res.json({ success: true, data: charges });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. INVOICES & BILLS
// =========================================================================

// GET /api/v1/billing/bills (List Bills)
router.get('/bills', requirePermission('billing.bills.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { patientId, status, billType, page = '1', limit = '50' } = req.query;

    const where: any = { tenantId };
    if (patientId) where.patientId = String(patientId);
    if (status) where.status = String(status);
    if (billType) where.billType = String(billType);

    const take = parseInt(String(limit), 10);
    const skip = (parseInt(String(page), 10) - 1) * take;

    const [bills, total] = await Promise.all([
      req.prismaTenant.bill.findMany({
        where,
        include: {
          patient: {
            select: { id: true, mrn: true, firstName: true, lastName: true, gender: true, mobile: true },
          },
          items: true,
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      req.prismaTenant.bill.count({ where }),
    ]);

    res.json({
      success: true,
      data: bills,
      pagination: { total, page: parseInt(String(page), 10), limit: take },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/billing/bills/:id (Bill Detail)
router.get('/bills/:id', requirePermission('billing.bills.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const bill = await req.prismaTenant.bill.findFirst({
      where: { tenantId, id: req.params.id },
      include: {
        patient: true,
        items: {
          include: { chargeMaster: true },
        },
        payments: {
          include: { receivedBy: { select: { firstName: true, lastName: true, email: true } } },
        },
        claims: {
          include: { provider: true, tpa: true },
        },
        hospital: { select: { name: true } },
      },
    });

    if (!bill) {
      throw AppError.notFound('Bill invoice not found');
    }

    res.json({ success: true, data: bill });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/billing/bills (Create Bill)
router.post('/bills', requirePermission('billing.bills.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    let hospitalId = req.hospitalId || (req.user as any)?.hospitalId;
    let branchId = req.branchId || (req.user as any)?.branchId;

    if (!hospitalId || !branchId) {
      const hospital = await req.prismaTenant.hospital.findFirst({ where: { tenantId } });
      if (hospital) {
        hospitalId = hospital.id;
        const branch = await req.prismaTenant.branch.findFirst({ where: { hospitalId } });
        if (branch) branchId = branch.id;
      }
    }

    const body = CreateBillSchema.parse(req.body);
    const billNumber = generateBillNumber('BL');

    let defaultCharge = await req.prismaTenant.chargeMaster.findFirst({ where: { tenantId } });
    if (!defaultCharge) {
      defaultCharge = await req.prismaTenant.chargeMaster.create({
        data: {
          tenantId,
          code: 'GEN-CONSULT',
          name: 'General Consultation',
          category: 'CONSULTATION',
          taxRate: 0,
        },
      });
    }

    const itemsToCreate = (body.items || []).map((i) => {
      const price = i.unitPrice ?? i.rate ?? 0;
      const name = i.serviceName || i.description || 'Medical Service';
      const lineTotal = i.quantity * price - i.discountAmount + i.taxAmount;
      return {
        chargeMasterId: i.chargeMasterId || defaultCharge!.id,
        serviceName: name,
        quantity: i.quantity,
        unitPrice: price,
        discountAmount: i.discountAmount,
        taxAmount: i.taxAmount,
        lineTotal,
        sourceModule: i.sourceModule || i.category || 'OPD',
        sourceRefId: i.sourceRefId,
      };
    });

    const subTotal = itemsToCreate.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const totalDiscount = itemsToCreate.reduce((sum, item) => sum + item.discountAmount, 0);
    const totalTax = itemsToCreate.reduce((sum, item) => sum + item.taxAmount, 0);
    const grossTotal = subTotal - totalDiscount + totalTax;

    let creatorId = req.user?.userId;
    if (!creatorId) {
      const u = await req.prismaTenant.user.findFirst({ where: { tenantId } });
      creatorId = u?.id;
    }

    const bill = await req.prismaTenant.bill.create({
      data: {
        tenantId,
        billNumber,
        billType: body.billType,
        status: 'DRAFT',
        subTotal,
        totalDiscount,
        totalTax,
        grossTotal,
        paidAmount: 0,
        patientPayable: grossTotal,
        patient: { connect: { id: body.patientId } },
        hospital: { connect: { id: hospitalId! } },
        branch: { connect: { id: branchId! } },
        createdBy: { connect: { id: creatorId! } },
        ...(body.encounterId ? { encounter: { connect: { id: body.encounterId } } } : {}),
        ...(body.tariffId ? { tariff: { connect: { id: body.tariffId } } } : {}),
        items: {
          create: itemsToCreate,
        },
      },
      include: {
        items: true,
        patient: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Bill invoice created successfully',
      data: {
        ...bill,
        totalAmount: bill.grossTotal,
        balanceAmount: bill.grossTotal - bill.paidAmount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/billing/bills/:id/items (Add Item to Bill)
router.post('/bills/:id/items', requirePermission('billing.bills.edit'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const bill = await req.prismaTenant.bill.findFirst({
      where: { tenantId, id: req.params.id },
      include: { items: true },
    });

    if (!bill) {
      throw AppError.notFound('Bill invoice not found');
    }

    if (bill.status === 'PAID' || bill.status === 'CANCELLED') {
      throw AppError.badRequest(`Cannot modify bill with status ${bill.status}`);
    }

    const body = AddBillItemSchema.parse(req.body);

    let chargeMasterId = body.chargeMasterId;
    if (!chargeMasterId) {
      let defaultCharge = await req.prismaTenant.chargeMaster.findFirst({ where: { tenantId } });
      if (!defaultCharge) {
        defaultCharge = await req.prismaTenant.chargeMaster.create({
          data: {
            tenantId,
            code: 'MISC-001',
            name: 'Miscellaneous Clinical Service',
            category: 'MISC',
            taxRate: 0,
          },
        });
      }
      chargeMasterId = defaultCharge.id;
    }

    const price = body.unitPrice ?? body.rate ?? 0;
    const name = body.serviceName || body.description || 'Clinical Service';
    const lineTotal = body.quantity * price - body.discountAmount + body.taxAmount;

    const newItem = await req.prismaTenant.billItem.create({
      data: {
        billId: bill.id,
        chargeMasterId,
        serviceName: name,
        quantity: body.quantity,
        unitPrice: price,
        discountAmount: body.discountAmount,
        taxAmount: body.taxAmount,
        lineTotal,
        sourceModule: body.sourceModule || 'OPD',
        sourceRefId: body.sourceRefId,
      },
    });

    const allItems = [...bill.items, newItem];
    const subTotal = allItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const totalDiscount = allItems.reduce((sum, item) => sum + item.discountAmount, 0);
    const totalTax = allItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const grossTotal = subTotal - totalDiscount + totalTax;

    const updatedBill = await req.prismaTenant.bill.update({
      where: { id: bill.id },
      data: {
        subTotal,
        totalDiscount,
        totalTax,
        grossTotal,
        patientPayable: Math.max(0, grossTotal - bill.paidAmount - bill.payerExpected),
      },
      include: { items: true, patient: true },
    });

    res.json({
      success: true,
      message: 'Item added to bill',
      data: {
        ...updatedBill,
        totalAmount: updatedBill.grossTotal,
        balanceAmount: updatedBill.grossTotal - updatedBill.paidAmount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/billing/bills/:id/finalize
router.post('/bills/:id/finalize', requirePermission('billing.bills.finalize'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const bill = await req.prismaTenant.bill.findFirst({
      where: { tenantId, id: req.params.id },
      include: { items: true },
    });

    if (!bill) {
      throw AppError.notFound('Bill invoice not found');
    }

    if (bill.items.length === 0) {
      throw AppError.badRequest('Cannot finalize a bill with 0 items');
    }

    const invoiceNumber = bill.billNumber.startsWith('INV-')
      ? bill.billNumber
      : generateBillNumber('INV');

    const updatedBill = await req.prismaTenant.bill.update({
      where: { id: bill.id },
      data: {
        billNumber: invoiceNumber,
        status: bill.paidAmount >= bill.grossTotal ? 'PAID' : 'INVOICED',
      },
      include: { items: true, patient: true },
    });

    res.json({
      success: true,
      message: 'Bill finalized successfully',
      data: {
        ...updatedBill,
        totalAmount: updatedBill.grossTotal,
        balanceAmount: updatedBill.grossTotal - updatedBill.paidAmount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. PAYMENTS & COLLECTIONS
// =========================================================================

// POST /api/v1/billing/bills/:id/payments (Process Payment)
router.post('/bills/:id/payments', requirePermission('billing.payments.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;

    const bill = await req.prismaTenant.bill.findFirst({
      where: { tenantId, id: req.params.id },
      include: { patient: true },
    });

    if (!bill) {
      throw AppError.notFound('Bill invoice not found');
    }

    const body = ProcessPaymentSchema.parse(req.body);
    const receiptNumber = generateReceiptNumber();
    const mode = (body.paymentMode || body.paymentMethod || 'CASH').toUpperCase();
    const ref = body.referenceNumber || body.transactionRef || '';

    const payment = await req.prismaTenant.payment.create({
      data: {
        tenantId,
        billId: bill.id,
        patientId: bill.patientId,
        receiptNumber,
        paymentMethod: mode,
        amount: body.amount,
        transactionRef: ref,
        status: 'SUCCESS',
        paymentType: 'BILL_PAYMENT',
        receivedById: userId,
      },
      include: {
        receivedBy: { select: { firstName: true, lastName: true } },
      },
    });

    const newPaidAmount = bill.paidAmount + body.amount;
    const newBalance = Math.max(0, bill.grossTotal - newPaidAmount);
    const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    const updatedBill = await req.prismaTenant.bill.update({
      where: { id: bill.id },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
        patientPayable: Math.max(0, bill.patientPayable - body.amount),
      },
      include: { items: true, patient: true },
    });

    const billResponse = {
      ...updatedBill,
      totalAmount: updatedBill.grossTotal,
      balanceAmount: newBalance,
    };

    res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        payment,
        bill: billResponse,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/billing/payments (List Payments)
router.get('/payments', requirePermission('billing.payments.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const payments = await req.prismaTenant.payment.findMany({
      where: { tenantId },
      include: {
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
        bill: { select: { id: true, billNumber: true, grossTotal: true } },
        receivedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { paymentDate: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 4. CASHIER SHIFTS
// =========================================================================

// POST /api/v1/billing/cashier/shifts/open
router.post('/cashier/shifts/open', requirePermission('billing.cashier'), async (req, res, next) => {
  try {
    const { openingBalance = 0 } = req.body;
    const shift = {
      id: `SHIFT-${Date.now()}`,
      status: 'OPEN',
      openedAt: new Date(),
      openingBalance: Number(openingBalance),
      totalCollections: 0,
    };
    res.json({ success: true, message: 'Cashier shift opened', data: shift });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/billing/cashier/shifts/close
router.post('/cashier/shifts/close', requirePermission('billing.cashier'), async (req, res, next) => {
  try {
    const { closingBalance = 0, notes } = req.body;
    const shift = {
      id: `SHIFT-${Date.now()}`,
      status: 'CLOSED',
      closedAt: new Date(),
      closingBalance: Number(closingBalance),
      notes: notes || 'Cashier shift closed successfully',
    };
    res.json({ success: true, message: 'Cashier shift closed', data: shift });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 5. PDF DOCUMENTS GENERATION (TAX INVOICE & RECEIPT)
// =========================================================================

// GET /api/v1/billing/bills/:id/invoice-pdf (Generate PDF Tax Invoice)
router.get('/bills/:id/invoice-pdf', requirePermission('billing.bills.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const bill = await req.prismaTenant.bill.findFirst({
      where: { tenantId, id: req.params.id },
      include: {
        patient: true,
        items: true,
        hospital: true,
        payments: true,
      },
    });

    if (!bill) {
      throw AppError.notFound('Bill invoice not found');
    }

    const pdfBuffer = await pdfService.generateInvoicePdf(bill);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${bill.billNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/billing/payments/:id/receipt-pdf (Generate PDF Payment Receipt)
router.get('/payments/:id/receipt-pdf', requirePermission('billing.payments.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const payment = await req.prismaTenant.payment.findFirst({
      where: { tenantId, id: req.params.id },
      include: {
        patient: true,
        bill: { include: { hospital: true } },
        receivedBy: true,
      },
    });

    if (!payment) {
      throw AppError.notFound('Payment record not found');
    }

    const pdfBuffer = await pdfService.generateReceiptPdf(payment);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Receipt-${payment.receiptNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

export default router;
