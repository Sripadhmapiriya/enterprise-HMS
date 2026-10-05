import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('bloodbank'));

function generateCode(prefix: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${dateStr}-${rand}`;
}

// ABO / Rh compatibility rules for Red Blood Cells (PRBC / Whole Blood)
function isRbcCompatible(donorBloodGroup: string, patientBloodGroup: string): boolean {
  const d = donorBloodGroup.trim().toUpperCase();
  const p = patientBloodGroup.trim().toUpperCase();

  // Exact match is always compatible
  if (d === p) return true;

  // Universal donor
  if (d === 'O-') return true;

  // O+ can give to any positive
  if (d === 'O+' && p.endsWith('+')) return true;

  // A- can give to A and AB
  if (d === 'A-' && (p.startsWith('A') || p.startsWith('AB'))) return true;

  // A+ can give to A+ and AB+
  if (d === 'A+' && (p === 'A+' || p === 'AB+')) return true;

  // B- can give to B and AB
  if (d === 'B-' && (p.startsWith('B') || p.startsWith('AB'))) return true;

  // B+ can give to B+ and AB+
  if (d === 'B+' && (p === 'B+' || p === 'AB+')) return true;

  // AB- can give to AB- and AB+
  if (d === 'AB-' && p.startsWith('AB')) return true;

  // Universal recipient is AB+
  if (p === 'AB+') return true;

  return false;
}

// Schemas
const CreateDonorSchema = z.object({
  donorId: z.string().optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  mobile: z.string().min(1, 'Mobile phone is required'),
  eligibilityStatus: z.enum(['ELIGIBLE', 'TEMPORARY_DEFERRAL', 'PERMANENT_DEFERRAL']).default('ELIGIBLE'),
});

const RecordDonationSchema = z.object({
  donorId: z.string().min(1, 'Donor ID is required'),
  bagId: z.string().optional(),
  volume: z.number().int().min(200).max(600).default(450),
  collectedById: z.string().optional(),
});

const ProcessDonationSchema = z.object({
  components: z.array(
    z.enum(['WHOLE_BLOOD', 'PRBC', 'FFP', 'PLATELETS'])
  ).min(1, 'At least one component must be selected'),
});

const CrossmatchCheckSchema = z.object({
  patientBloodGroup: z.string().min(1),
  componentId: z.string().min(1),
});

const IssueBloodSchema = z.object({
  componentId: z.string().min(1, 'Component ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  encounterId: z.string().min(1, 'Encounter ID is required'),
  transfusionStatus: z.enum(['PENDING', 'COMPLETED', 'REACTION', 'RETURNED']).default('PENDING'),
});

// =========================================================================
// 1. DONORS
// =========================================================================

// GET /api/v1/bloodbank/donors
router.get('/donors', requirePermission('bloodbank.donors.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { bloodGroup, eligibility, search } = req.query;
    const where: any = { tenantId };
    if (bloodGroup) where.bloodGroup = String(bloodGroup);
    if (eligibility) where.eligibilityStatus = String(eligibility);
    if (search) {
      where.OR = [
        { firstName: { contains: String(search), mode: 'insensitive' } },
        { lastName: { contains: String(search), mode: 'insensitive' } },
        { donorId: { contains: String(search), mode: 'insensitive' } },
        { mobile: { contains: String(search) } },
      ];
    }

    const donors = await req.prismaTenant.donor.findMany({
      where,
      include: {
        donations: {
          orderBy: { donationDate: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: donors });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/bloodbank/donors
router.post('/donors', requirePermission('bloodbank.donors.create'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const data = CreateDonorSchema.parse(req.body);

    const donor = await req.prismaTenant.donor.create({
      data: {
        tenantId,
        donorId: data.donorId || generateCode('DNR'),
        firstName: data.firstName,
        lastName: data.lastName,
        bloodGroup: data.bloodGroup,
        gender: data.gender,
        dateOfBirth: new Date(data.dateOfBirth),
        mobile: data.mobile,
        eligibilityStatus: data.eligibilityStatus,
      },
    });

    res.status(201).json({ success: true, data: donor });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. DONATIONS & COMPONENT PROCESSING
// =========================================================================

// GET /api/v1/bloodbank/donations
router.get('/donations', requirePermission('bloodbank.donations.read'), async (req, res, next) => {
  try {
    const { donorId, status } = req.query;
    const where: any = {};
    if (donorId) where.donorId = String(donorId);
    if (status) where.status = String(status);

    const donations = await req.prismaTenant.bloodDonation.findMany({
      where,
      include: {
        donor: true,
        collectedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        components: true,
      },
      orderBy: { donationDate: 'desc' },
    });

    res.json({ success: true, data: donations });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/bloodbank/donations
router.post('/donations', requirePermission('bloodbank.donations.create'), async (req, res, next) => {
  try {
    const data = RecordDonationSchema.parse(req.body);
    const donor = await req.prismaTenant.donor.findUnique({
      where: { id: data.donorId },
    });

    if (!donor) {
      throw AppError.notFound('Donor record not found');
    }
    if (donor.eligibilityStatus !== 'ELIGIBLE') {
      throw AppError.badRequest(`Donor is currently deferred (${donor.eligibilityStatus}) and cannot donate`);
    }

    let collectedById = data.collectedById || req.user!.userId;

    const donation = await req.prismaTenant.bloodDonation.create({
      data: {
        donorId: data.donorId,
        bagId: data.bagId || generateCode('BAG'),
        volume: data.volume,
        status: 'COLLECTED',
        collectedById,
      },
      include: {
        donor: true,
        collectedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({ success: true, data: donation });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/bloodbank/donations/:id/process
router.post('/donations/:id/process', requirePermission('bloodbank.donations.update'), async (req, res, next) => {
  try {
    const data = ProcessDonationSchema.parse(req.body);
    const donation = await req.prismaTenant.bloodDonation.findUnique({
      where: { id: req.params.id },
      include: { donor: true, components: true },
    });

    if (!donation) {
      throw AppError.notFound('Donation record not found');
    }
    if (donation.status === 'PROCESSED') {
      throw AppError.badRequest('This donation has already been processed into components');
    }

    const createdComponents = [];
    const now = new Date();

    for (const compType of data.components) {
      // Expiry rules:
      // PLATELETS: 5 days
      // PRBC: 42 days
      // WHOLE_BLOOD: 35 days
      // FFP: 365 days
      const expiry = new Date(now);
      if (compType === 'PLATELETS') expiry.setDate(expiry.getDate() + 5);
      else if (compType === 'PRBC') expiry.setDate(expiry.getDate() + 42);
      else if (compType === 'WHOLE_BLOOD') expiry.setDate(expiry.getDate() + 35);
      else if (compType === 'FFP') expiry.setDate(expiry.getDate() + 365);

      const component = await req.prismaTenant.bloodComponent.create({
        data: {
          donationId: donation.id,
          unitId: generateCode(`UNT-${compType.slice(0, 3)}`),
          componentType: compType,
          bloodGroup: donation.donor.bloodGroup,
          expiryDate: expiry,
          status: 'AVAILABLE',
        },
      });
      createdComponents.push(component);
    }

    // Update donation status
    await req.prismaTenant.bloodDonation.update({
      where: { id: donation.id },
      data: { status: 'PROCESSED' },
    });

    res.json({
      success: true,
      data: createdComponents,
      message: `Successfully processed donation into ${createdComponents.length} component unit(s)`,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. INVENTORY & CROSSMATCH
// =========================================================================

// GET /api/v1/bloodbank/components
router.get('/components', requirePermission('bloodbank.inventory.read'), async (req, res, next) => {
  try {
    const { bloodGroup, componentType, status } = req.query;
    const where: any = {};
    if (bloodGroup) where.bloodGroup = String(bloodGroup);
    if (componentType) where.componentType = String(componentType);
    if (status) where.status = String(status);

    const components = await req.prismaTenant.bloodComponent.findMany({
      where,
      include: {
        donation: {
          include: { donor: true },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    res.json({ success: true, data: components });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/bloodbank/inventory-summary
router.get('/inventory-summary', requirePermission('bloodbank.inventory.read'), async (req, res, next) => {
  try {
    const components = await req.prismaTenant.bloodComponent.findMany({
      where: { status: 'AVAILABLE', expiryDate: { gt: new Date() } },
    });

    const summary: Record<string, Record<string, number>> = {
      'A+': { PRBC: 0, FFP: 0, PLATELETS: 0, WHOLE_BLOOD: 0 },
      'A-': { PRBC: 0, FFP: 0, PLATELETS: 0, WHOLE_BLOOD: 0 },
      'B+': { PRBC: 0, FFP: 0, PLATELETS: 0, WHOLE_BLOOD: 0 },
      'B-': { PRBC: 0, FFP: 0, PLATELETS: 0, WHOLE_BLOOD: 0 },
      'AB+': { PRBC: 0, FFP: 0, PLATELETS: 0, WHOLE_BLOOD: 0 },
      'AB-': { PRBC: 0, FFP: 0, PLATELETS: 0, WHOLE_BLOOD: 0 },
      'O+': { PRBC: 0, FFP: 0, PLATELETS: 0, WHOLE_BLOOD: 0 },
      'O-': { PRBC: 0, FFP: 0, PLATELETS: 0, WHOLE_BLOOD: 0 },
    };

    let totalUnits = 0;
    for (const c of components) {
      if (summary[c.bloodGroup]) {
        summary[c.bloodGroup][c.componentType] = (summary[c.bloodGroup][c.componentType] || 0) + 1;
        totalUnits++;
      }
    }

    res.json({ success: true, data: { summary, totalAvailableUnits: totalUnits } });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/bloodbank/crossmatch-check
router.post('/crossmatch-check', requirePermission('bloodbank.inventory.read'), async (req, res, next) => {
  try {
    const data = CrossmatchCheckSchema.parse(req.body);
    const component = await req.prismaTenant.bloodComponent.findUnique({
      where: { id: data.componentId },
    });

    if (!component) {
      throw AppError.notFound('Blood component unit not found');
    }

    const compatible = isRbcCompatible(component.bloodGroup, data.patientBloodGroup);

    res.json({
      success: true,
      data: {
        componentId: component.id,
        unitId: component.unitId,
        donorBloodGroup: component.bloodGroup,
        patientBloodGroup: data.patientBloodGroup,
        componentType: component.componentType,
        isCompatible: compatible,
        status: component.status,
        expiryDate: component.expiryDate,
        isExpired: new Date(component.expiryDate) < new Date(),
      },
      message: compatible
        ? 'Crossmatch compatibility check: COMPATIBLE'
        : 'Crossmatch compatibility check: INCOMPATIBLE (High risk of acute hemolytic reaction)',
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 4. ISSUE & TRANSFUSION
// =========================================================================

// POST /api/v1/bloodbank/issues
router.post('/issues', requirePermission('bloodbank.issue.create'), async (req, res, next) => {
  try {
    const data = IssueBloodSchema.parse(req.body);
    const component = await req.prismaTenant.bloodComponent.findUnique({
      where: { id: data.componentId },
    });

    if (!component) {
      throw AppError.notFound('Component not found');
    }
    if (component.status !== 'AVAILABLE') {
      throw AppError.badRequest(`Component cannot be issued (Current status: ${component.status})`);
    }
    if (new Date(component.expiryDate) < new Date()) {
      throw AppError.badRequest('Component unit has expired and cannot be issued');
    }

    const patient = await req.prismaTenant.patient.findUnique({
      where: { id: data.patientId },
    });
    if (!patient) {
      throw AppError.notFound('Patient not found');
    }

    // Verify compatibility if patient has blood group recorded
    if (patient.bloodGroup && !isRbcCompatible(component.bloodGroup, patient.bloodGroup)) {
      throw AppError.badRequest(
        `Safety Block: Donor unit (${component.bloodGroup}) is incompatible with Patient (${patient.bloodGroup})`
      );
    }

    // Update component to ISSUED
    await req.prismaTenant.bloodComponent.update({
      where: { id: component.id },
      data: { status: 'ISSUED' },
    });

    // Create BloodIssue
    const issue = await req.prismaTenant.bloodIssue.create({
      data: {
        componentId: component.id,
        patientId: data.patientId,
        encounterId: data.encounterId,
        issuedById: req.user!.userId,
        transfusionStatus: data.transfusionStatus,
      },
      include: {
        component: true,
        patient: true,
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({ success: true, data: issue });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/bloodbank/issues/:id/transfusion
router.patch('/issues/:id/transfusion', requirePermission('bloodbank.issue.update'), async (req, res, next) => {
  try {
    const { transfusionStatus } = req.body;
    if (!['PENDING', 'COMPLETED', 'REACTION', 'RETURNED'].includes(transfusionStatus)) {
      throw AppError.badRequest('Invalid transfusion status. Must be PENDING, COMPLETED, REACTION, or RETURNED');
    }

    const issue = await req.prismaTenant.bloodIssue.update({
      where: { id: req.params.id },
      data: { transfusionStatus },
      include: { component: true, patient: true },
    });

    // If RETURNED, restore component to AVAILABLE
    if (transfusionStatus === 'RETURNED') {
      await req.prismaTenant.bloodComponent.update({
        where: { id: issue.componentId },
        data: { status: 'AVAILABLE' },
      });
    } else if (transfusionStatus === 'COMPLETED') {
      await req.prismaTenant.bloodComponent.update({
        where: { id: issue.componentId },
        data: { status: 'TRANSFUSED' },
      });
    }

    res.json({ success: true, data: issue });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/bloodbank/issues
router.get('/issues', requirePermission('bloodbank.issue.read'), async (req, res, next) => {
  try {
    const { patientId, encounterId } = req.query;
    const where: any = {};
    if (patientId) where.patientId = String(patientId);
    if (encounterId) where.encounterId = String(encounterId);

    const issues = await req.prismaTenant.bloodIssue.findMany({
      where,
      include: {
        component: true,
        patient: true,
        encounter: true,
        issuedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { issueDate: 'desc' },
    });

    res.json({ success: true, data: issues });
  } catch (error) {
    next(error);
  }
});

export default router;
