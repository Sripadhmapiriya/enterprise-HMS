import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { abdmAdapter } from '../services/integrations/abdm';
import { fhirService } from '../services/integrations/fhir';
import { hl7Service } from '../services/integrations/hl7';
import { analyzerService } from '../services/integrations/analyzers';
import { paymentGateway } from '../services/integrations/payments';
import { biometricService } from '../services/integrations/biometric';

const router = Router();

// Gated behind authentication and requireModule('integrations')
router.use(authenticateToken);
router.use(requireModule('integrations'));

// GET /api/v1/integrations/status (Overview of all connected & simulated adapters)
router.get('/status', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const abdmStatus = await abdmAdapter.getStatus();

    res.json({
      success: true,
      data: {
        adapters: [
          {
            id: 'abdm',
            name: 'Ayushman Bharat Digital Mission (ABDM)',
            type: 'NATIONAL_HEALTH_GATEWAY',
            version: 'M1/M2/M3',
            status: abdmStatus.status,
            isSimulator: abdmAdapter.isSimulator(),
            capabilities: ['ABHA Generation', 'OTP Verification', 'Care Context Linking', 'HIU/HIP Data Flow'],
          },
          {
            id: 'fhir',
            name: 'HL7 FHIR R4 REST API',
            type: 'CLINICAL_INTEROPERABILITY',
            version: 'R4 v4.0.1',
            status: 'ACTIVE',
            isSimulator: false,
            capabilities: ['Patient', 'Encounter', 'Observation', 'DiagnosticReport', 'Bundle Transaction'],
          },
          {
            id: 'hl7v2',
            name: 'HL7 v2.5 MLLP Interface',
            type: 'LEGACY_INTEROPERABILITY',
            version: 'v2.5',
            status: 'ACTIVE',
            isSimulator: false,
            capabilities: ['ADT^A01 Admission', 'ORU^R01 Lab Results', 'ORM^O01 Orders'],
          },
          {
            id: 'analyzers',
            name: 'Automated Laboratory Instrument Interface (ASTM / HL7)',
            type: 'DIAGNOSTIC_HARDWARE',
            version: 'ASTM E1394',
            status: 'SIMULATOR_READY',
            isSimulator: true,
            capabilities: ['Auto-result matching', 'Sample barcode validation', 'Critical value alerts'],
          },
          {
            id: 'payments',
            name: 'Digital Payment Gateway (Razorpay / Stripe)',
            type: 'FINANCIAL_CHECKOUT',
            version: 'v2',
            status: 'SIMULATOR_READY',
            isSimulator: paymentGateway.isSimulator(),
            capabilities: ['Order Creation', 'Signature Verification', 'Webhook Processing'],
          },
          {
            id: 'biometric',
            name: 'Biometric Attendance Clock Interface',
            type: 'IOT_HARDWARE',
            version: 'v1.0',
            status: 'ACTIVE',
            isSimulator: false,
            capabilities: ['RFID card check-in', 'Fingerprint validation', 'Facial recognition logs'],
          },
        ],
      },
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 1. ABDM GATEWAY ENDPOINTS
// ==========================================

const AbhaGenerateSchema = z.object({
  aadhaarOrMobile: z.string().min(10),
  name: z.string().min(2),
  gender: z.string(),
  yearOfBirth: z.string(),
});

router.post('/abdm/generate-abha', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const input = AbhaGenerateSchema.parse(req.body);
    const result = await abdmAdapter.generateAbha(input as any);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

const AbhaVerifySchema = z.object({
  txnId: z.string().min(1),
  otp: z.string().min(4),
});

router.post('/abdm/verify-otp', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const input = AbhaVerifySchema.parse(req.body);
    const result = await abdmAdapter.verifyOtp(input as any);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

const CareContextSchema = z.object({
  abhaAddress: z.string().min(3),
  patientId: z.string().min(1),
  encounterId: z.string().min(1),
  careContextReference: z.string().min(1),
  display: z.string().min(1),
});

router.post('/abdm/link-care-context', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const input = CareContextSchema.parse(req.body);
    const result = await abdmAdapter.linkCareContext(input as any);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. HL7 FHIR R4 ENDPOINTS
// ==========================================

router.get('/fhir/r4/Patient/:id', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const patient = await req.prismaTenant.patient.findUnique({
      where: { id: req.params.id },
      include: { identifiers: true },
    });

    if (!patient) throw AppError.notFound('FHIR Patient not found');

    const fhirResource = fhirService.toPatientResource(patient);
    res.setHeader('Content-Type', 'application/fhir+json');
    res.json(fhirResource);
  } catch (err) {
    next(err);
  }
});

router.get('/fhir/r4/Encounter/:id', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const encounter = await req.prismaTenant.encounter.findUnique({
      where: { id: req.params.id },
      include: { patient: true },
    });

    if (!encounter) throw AppError.notFound('FHIR Encounter not found');

    const fhirResource = fhirService.toEncounterResource(encounter);
    res.setHeader('Content-Type', 'application/fhir+json');
    res.json(fhirResource);
  } catch (err) {
    next(err);
  }
});

router.post('/fhir/r4/Bundle', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const result = fhirService.parseBundle(req.body);
    res.status(200).json({
      resourceType: 'Bundle',
      type: 'transaction-response',
      entry: result.entries.map((_, i) => ({
        response: { status: '201 Created', location: `Resource/${i + 1}` },
      })),
      meta: {
        processedResources: result.resourceCounts,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. HL7 v2 ENDPOINTS
// ==========================================

router.post('/hl7/v2/parse', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const hl7Raw = req.body.message as string;
    if (!hl7Raw) throw AppError.badRequest('HL7 raw message string is required');

    const parsed = hl7Service.parseMessage(hl7Raw);
    res.json({ success: true, data: parsed });
  } catch (err) {
    next(err);
  }
});

router.post('/hl7/v2/generate-adt', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const hl7String = hl7Service.generateAdtA01(req.body);
    res.json({ success: true, data: { hl7Message: hl7String } });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. LABORATORY ANALYZER FEED
// ==========================================

const AnalyzerFeedSchema = z.object({
  analyzerId: z.string().min(1),
  analyzerModel: z.string().min(1),
  sampleBarcode: z.string().min(1),
  timestamp: z.string().optional().default(() => new Date().toISOString()),
  results: z.array(
    z.object({
      parameterCode: z.string(),
      parameterName: z.string(),
      value: z.number(),
      unit: z.string(),
      referenceRange: z.string(),
      criticalLow: z.number().optional(),
      criticalHigh: z.number().optional(),
    })
  ),
});

router.post('/analyzers/feed', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const payload = AnalyzerFeedSchema.parse(req.body);
    const result = await analyzerService.processAnalyzerFeed(payload as any);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 5. PAYMENT GATEWAY ENDPOINTS
// ==========================================

const CreateOrderSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().optional().default('USD'),
  patientEmail: z.string().optional(),
  patientPhone: z.string().optional(),
});

router.post('/payments/create-order', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const input = CreateOrderSchema.parse(req.body);
    const tenantId = req.tenantId!;

    const order = await paymentGateway.createOrder({
      tenantId,
      ...input,
    } as any);

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

const VerifyPaymentSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

router.post('/payments/verify', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const input = VerifyPaymentSchema.parse(req.body);
    const verification = await paymentGateway.verifyPayment(input as any);
    res.json({ success: true, data: verification });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 6. BIOMETRIC ATTENDANCE PUNCH
// ==========================================

const BiometricPunchSchema = z.object({
  deviceId: z.string().min(1),
  employeeCode: z.string().min(1),
  punchTime: z.string().optional().default(() => new Date().toISOString()),
  punchType: z.enum(['CHECK_IN', 'CHECK_OUT']),
  verificationMode: z.enum(['FINGERPRINT', 'FACE', 'RFID_CARD']),
});

router.post('/biometric/punch', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const punch = BiometricPunchSchema.parse(req.body);
    const tenantId = req.tenantId!;

    const result = await biometricService.processPunch(req.prismaTenant, tenantId, punch as any);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
