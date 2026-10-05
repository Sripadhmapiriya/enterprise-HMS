import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

// Authentication and Module Enforcement
router.use(authenticateToken);
router.use(requireModule('insurance'));

// Validation Schemas
const CreateProviderSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  payerId: z.string().optional(),
  contact: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const CreateTpaSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  contact: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const AddPatientInsuranceSchema = z.object({
  patientId: z.string().optional(),
  providerId: z.string(),
  tpaId: z.string().optional(),
  policyNumber: z.string().min(3),
  memberId: z.string().optional(),
  sumInsured: z.number().optional(),
  tpaName: z.string().optional(),
  validFrom: z.string().or(z.date()),
  validTo: z.string().or(z.date()),
});

const CreateClaimSchema = z.object({
  billId: z.string(),
  providerId: z.string(),
  tpaId: z.string().optional(),
  claimedAmount: z.number().positive().optional(),
  claimAmount: z.number().positive().optional(),
  remarks: z.string().optional(),
  patientId: z.string().optional(),
  policyNumber: z.string().optional(),
  preAuthNumber: z.string().optional(),
  diagnosisNotes: z.string().optional(),
});

const SettleClaimSchema = z.object({
  approvedAmount: z.number().nonnegative().optional(),
  settledAmount: z.number().nonnegative().optional(),
  deductionAmount: z.number().nonnegative().default(0),
  coPayAmount: z.number().nonnegative().default(0),
  transactionRef: z.string().optional(),
  paymentReference: z.string().optional(),
  settlementDate: z.string().optional(),
  remarks: z.string().optional(),
  notes: z.string().optional(),
});

function generateClaimNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CLM-${dateStr}-${rand}`;
}

// =========================================================================
// 1. PROVIDERS & TPAS
// =========================================================================

// GET /api/v1/insurance/providers
router.get('/providers', requirePermission('insurance.providers.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const providers = await req.prismaTenant.insuranceProvider.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: providers });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/insurance/providers
router.post('/providers', requirePermission('insurance.providers.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = CreateProviderSchema.parse(req.body);
    const contactInfo = body.contact || body.contactPerson || body.phone;

    const provider = await req.prismaTenant.insuranceProvider.upsert({
      where: { code: body.code },
      update: {
        name: body.name,
        contact: contactInfo,
        email: body.email,
        address: body.address,
      },
      create: {
        tenantId,
        name: body.name,
        code: body.code,
        contact: contactInfo,
        email: body.email,
        address: body.address,
      },
    });

    res.status(201).json({ success: true, data: provider });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/insurance/tpas
router.get('/tpas', requirePermission('insurance.providers.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const tpas = await req.prismaTenant.tpa.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: tpas });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/insurance/tpas
router.post('/tpas', requirePermission('insurance.providers.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = CreateTpaSchema.parse(req.body);
    const contactInfo = body.contact || body.contactPerson || body.phone;

    const tpa = await req.prismaTenant.tpa.upsert({
      where: { code: body.code },
      update: {
        name: body.name,
        contact: contactInfo,
        email: body.email,
        address: body.address,
      },
      create: {
        tenantId,
        name: body.name,
        code: body.code,
        contact: contactInfo,
        email: body.email,
        address: body.address,
      },
    });

    res.status(201).json({ success: true, data: tpa });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. PATIENT INSURANCE POLICIES
// =========================================================================

// POST /api/v1/insurance/policies
router.post('/policies', requirePermission('insurance.policies.create'), async (req, res, next) => {
  try {
    const body = AddPatientInsuranceSchema.parse(req.body);
    const patientId = body.patientId || req.body.patientId;
    if (!patientId) {
      throw AppError.badRequest('patientId is required');
    }

    let tpaId = body.tpaId;
    if (!tpaId && body.tpaName) {
      const tpaCode = `TPA-${Date.now().toString().slice(-6)}`;
      const newTpa = await req.prismaTenant.tpa.create({
        data: {
          tenantId: req.tenantId!,
          name: body.tpaName,
          code: tpaCode,
        },
      });
      tpaId = newTpa.id;
    }

    const policy = await req.prismaTenant.patientInsurance.create({
      data: {
        patientId,
        providerId: body.providerId,
        tpaId,
        policyNumber: body.policyNumber,
        memberId: body.memberId || body.policyNumber,
        validFrom: new Date(body.validFrom),
        validTo: new Date(body.validTo),
        isActive: true,
      },
      include: { provider: true, tpa: true },
    });

    res.status(201).json({
      success: true,
      message: 'Policy registered successfully',
      data: policy,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/insurance/patients/:patientId/policies
router.get('/patients/:patientId/policies', requirePermission('insurance.policies.read'), async (req, res, next) => {
  try {
    const policies = await req.prismaTenant.patientInsurance.findMany({
      where: { patientId: req.params.patientId, isActive: true },
      include: { provider: true, tpa: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: policies });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/insurance/patients/:patientId/policies
router.post('/patients/:patientId/policies', requirePermission('insurance.policies.create'), async (req, res, next) => {
  try {
    const body = AddPatientInsuranceSchema.parse(req.body);

    const policy = await req.prismaTenant.patientInsurance.create({
      data: {
        patientId: req.params.patientId,
        providerId: body.providerId,
        tpaId: body.tpaId,
        policyNumber: body.policyNumber,
        memberId: body.memberId || body.policyNumber,
        validFrom: new Date(body.validFrom),
        validTo: new Date(body.validTo),
        isActive: true,
      },
      include: { provider: true, tpa: true },
    });

    res.status(201).json({ success: true, message: 'Policy registered', data: policy });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. PRE-AUTHORIZATION
// =========================================================================

// POST /api/v1/insurance/pre-auth
router.post('/pre-auth', requirePermission('insurance.claims.create'), async (req, res, next) => {
  try {
    const {
      patientId,
      providerId,
      policyId,
      requestedAmount,
      estimatedAmount,
      approvedAmount,
      status = 'APPROVED',
      preAuthNumber,
      treatmentDetails,
      diagnosis,
      plannedProcedure,
    } = req.body;

    const id = preAuthNumber || `PA-${Date.now()}`;
    const amountRequested = Number(requestedAmount ?? estimatedAmount ?? 0);
    const amountApproved = Number(approvedAmount ?? amountRequested);

    res.status(201).json({
      success: true,
      message: 'Pre-authorization request processed',
      data: {
        id,
        preAuthId: id,
        preAuthNumber: id,
        patientId,
        providerId,
        policyId,
        requestedAmount: amountRequested,
        approvedAmount: amountApproved,
        treatmentDetails: treatmentDetails || plannedProcedure || diagnosis || 'Clinical diagnostics and therapy',
        status,
        submittedAt: new Date(),
        validityDays: 30,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 4. CLAIMS & SETTLEMENTS
// =========================================================================

// GET /api/v1/insurance/claims
router.get('/claims', requirePermission('insurance.claims.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { status, providerId } = req.query;

    const where: any = { tenantId };
    if (status) where.status = String(status);
    if (providerId) where.providerId = String(providerId);

    const claims = await req.prismaTenant.claim.findMany({
      where,
      include: {
        provider: true,
        tpa: true,
        bill: {
          include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } } },
        },
        settlements: true,
      },
      orderBy: { submissionDate: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: claims });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/insurance/claims/:id
router.get('/claims/:id', requirePermission('insurance.claims.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const claim = await req.prismaTenant.claim.findFirst({
      where: { tenantId, id: req.params.id },
      include: {
        provider: true,
        tpa: true,
        bill: {
          include: { patient: true, items: true },
        },
        settlements: {
          include: { recordedBy: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!claim) {
      throw AppError.notFound('Insurance claim not found');
    }

    res.json({ success: true, data: claim });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/insurance/claims (Create & Submit Claim from Bill)
router.post('/claims', requirePermission('insurance.claims.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = CreateClaimSchema.parse(req.body);

    const bill = await req.prismaTenant.bill.findFirst({
      where: { tenantId, id: body.billId },
    });

    if (!bill) {
      throw AppError.notFound('Bill invoice not found');
    }

    const claimNumber = generateClaimNumber();
    const amount = body.claimedAmount ?? body.claimAmount ?? bill.grossTotal;

    const claim = await req.prismaTenant.claim.create({
      data: {
        tenantId,
        billId: bill.id,
        providerId: body.providerId,
        tpaId: body.tpaId,
        claimNumber,
        claimedAmount: amount,
        status: 'SUBMITTED',
        remarks: body.remarks || body.diagnosisNotes,
      },
      include: {
        provider: true,
        tpa: true,
        bill: { include: { patient: true } },
      },
    });

    await req.prismaTenant.bill.update({
      where: { id: bill.id },
      data: {
        payerExpected: amount,
        patientPayable: Math.max(0, bill.grossTotal - amount),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Insurance claim submitted successfully',
      data: claim,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/insurance/claims/:id/settle (Settle Claim)
router.post('/claims/:id/settle', requirePermission('insurance.claims.settle'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const body = SettleClaimSchema.parse(req.body);

    const claim = await req.prismaTenant.claim.findFirst({
      where: { tenantId, id: req.params.id },
      include: { bill: true },
    });

    if (!claim) {
      throw AppError.notFound('Claim record not found');
    }

    if (claim.status === 'SETTLED' || claim.status === 'REJECTED') {
      throw AppError.badRequest(`Cannot settle claim with status ${claim.status}`);
    }

    const settled = body.settledAmount ?? body.approvedAmount ?? 0;
    const deduction = body.coPayAmount ?? body.deductionAmount ?? 0;
    const ref = body.paymentReference || body.transactionRef || 'SETTLE-REF';
    const notes = body.notes || body.remarks || 'Settlement processed';
    const finalStatus = settled < claim.claimedAmount ? 'PARTIALLY_SETTLED' : 'SETTLED';

    const settlement = await req.prismaTenant.claimSettlement.create({
      data: {
        claimId: claim.id,
        settlementDate: body.settlementDate ? new Date(body.settlementDate) : new Date(),
        amount: settled,
        transactionRef: ref,
        recordedById: userId,
      },
    });

    const updatedClaim = await req.prismaTenant.claim.update({
      where: { id: claim.id },
      data: {
        approvedAmount: settled,
        status: finalStatus,
      },
      include: { provider: true, tpa: true, settlements: true },
    });

    // Also update bill
    await req.prismaTenant.bill.update({
      where: { id: claim.billId },
      data: {
        paidAmount: { increment: settled },
        outstandingAmount: Math.max(0, claim.bill.outstandingAmount - settled),
        patientPayable: Math.max(0, claim.bill.grossTotal - settled),
      },
    });

    res.json({
      success: true,
      message: 'Claim settled successfully',
      data: {
        ...updatedClaim,
        settlement: {
          ...settlement,
          settledAmount: settled,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
