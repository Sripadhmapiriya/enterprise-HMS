import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

const CreatePatientSchema = z.object({
  hospitalId: z.string().min(1),
  mrn: z.string().optional(),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).default('1990-01-01'),
  gender: z.string().min(1, 'Gender is required'),
  bloodGroup: z.string().optional(),
  maritalStatus: z.string().optional(),
  mobile: z.string().min(1).default('+15551234567'),
  alternatePhone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  preferredLanguage: z.string().optional(),
  registrationSource: z.string().optional(),
  photoUrl: z.string().optional(),
  abhaNumber: z.string().optional(),
  abhaAddress: z.string().optional(),
  emergencyContact: z
    .object({
      name: z.string().min(1),
      relationship: z.string().min(1),
      phone: z.string().min(1),
    })
    .optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyRelationship: z.string().optional(),
  nationalId: z
    .object({
      type: z.string().min(1),
      value: z.string().min(1),
      issuedBy: z.string().optional(),
    })
    .optional(),
});

const UpdatePatientSchema = CreatePatientSchema.partial();

const CreateAllergySchema = z.object({
  allergen: z.string().min(1, 'Allergen name is required'),
  reaction: z.string().optional(),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE']).default('MODERATE'),
  notes: z.string().optional(),
});

const CreateAlertSchema = z.object({
  alertType: z.enum(['CLINICAL', 'ADMINISTRATIVE']).default('CLINICAL'),
  description: z.string().min(1, 'Description is required'),
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
});

const CreateDocumentSchema = z.object({
  title: z.string().min(1, 'Document title is required'),
  documentType: z.string().default('MEDICAL_RECORD'),
  fileUrl: z.string().min(1, 'File URL is required'),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
});

const CreateConsentSchema = z.object({
  consentType: z.string().default('GENERAL_TREATMENT'),
  notes: z.string().optional(),
  witnessName: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const MergePatientSchema = z.object({
  sourcePatientId: z.string().min(1),
  targetPatientId: z.string().min(1),
  reason: z.string().min(1),
});

// All routes require authentication and patients module entitlement
router.use(authenticateToken);
router.use(requireModule('patients'));

// GET /api/v1/patients/duplicates (duplicate detection by name + DOB + mobile)
router.get('/duplicates', requirePermission('patients.read'), async (req, res, next) => {
  try {
    const { firstName, lastName, mobile, dateOfBirth } = req.query as Record<string, string>;

    if (!firstName && !lastName && !mobile) {
      return res.json({ success: true, data: [], hasDuplicates: false });
    }

    const conditions: any[] = [];
    if (mobile) {
      conditions.push({ mobile });
    }
    if (firstName && lastName) {
      const nameMatch: any = {
        firstName: { contains: firstName, mode: 'insensitive' },
        lastName: { contains: lastName, mode: 'insensitive' },
      };
      if (dateOfBirth) {
        nameMatch.dateOfBirth = new Date(dateOfBirth);
      }
      conditions.push(nameMatch);
    }

    const duplicates = await req.prismaTenant.patient.findMany({
      where: {
        OR: conditions,
        mergedIntoPatientId: null,
      },
      select: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        mobile: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      hasDuplicates: duplicates.length > 0,
      data: duplicates,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/patients (Master Patient Index with search, filter, pagination)
router.get('/', requirePermission('patients.read'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;
    const q = (req.query.q as string)?.trim();
    const gender = req.query.gender as string;
    const status = req.query.status as string;

    const where: any = {
      mergedIntoPatientId: null,
    };

    if (q) {
      where.OR = [
        { mrn: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { mobile: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
        { abhaNumber: { contains: q } },
      ];
    }

    if (gender) {
      where.gender = gender;
    }
    if (status) {
      where.status = status;
    }

    const [patients, total] = await Promise.all([
      req.prismaTenant.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          allergies: { where: { status: 'ACTIVE' } },
          alerts: { where: { isActive: true } },
        },
      }),
      req.prismaTenant.patient.count({ where }),
    ]);

    res.json({
      success: true,
      data: patients,
      meta: {
        page,
        limit,
        total,
        requestId: req.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/patients (Registration - Quick or Full)
router.post('/', requirePermission('patients.create'), async (req, res, next) => {
  try {
    const validatedData = CreatePatientSchema.parse(req.body);

    // Auto-generate MRN if not provided
    const mrn =
      validatedData.mrn ||
      `MRN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const {
      emergencyContact: inputContact,
      emergencyContactName,
      emergencyContactPhone,
      emergencyRelationship,
      nationalId,
      ...patientFields
    } = validatedData;

    const emergencyContact =
      inputContact ||
      (emergencyContactName && emergencyContactPhone
        ? {
            name: emergencyContactName,
            phone: emergencyContactPhone,
            relationship: emergencyRelationship || 'SPOUSE',
          }
        : undefined);

    const patient = await req.prismaTenant.patient.create({
      data: {
        ...patientFields,
        mrn,
        dateOfBirth: new Date(validatedData.dateOfBirth),
        emergencyContacts: emergencyContact
          ? {
              create: [emergencyContact],
            }
          : undefined,
        identifiers: nationalId
          ? {
              create: [nationalId],
            }
          : undefined,
      },
      include: {
        emergencyContacts: true,
        identifiers: true,
        allergies: true,
        alerts: true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...patient,
        emergencyContactName: patient.emergencyContacts?.[0]?.name,
        emergencyContactPhone: patient.emergencyContacts?.[0]?.phone,
        emergencyRelationship: patient.emergencyContacts?.[0]?.relationship,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/patients/merge (Merge duplicate patients)
router.post('/merge', requirePermission('patients.merge'), async (req, res, next) => {
  try {
    const { sourcePatientId, targetPatientId, reason } = MergePatientSchema.parse(req.body);

    if (sourcePatientId === targetPatientId) {
      throw AppError.badRequest('Source and target patient cannot be the same');
    }

    const [source, target] = await Promise.all([
      req.prismaTenant.patient.findFirst({ where: { id: sourcePatientId } }),
      req.prismaTenant.patient.findFirst({ where: { id: targetPatientId } }),
    ]);

    if (!source) throw AppError.notFound(`Source patient "\${sourcePatientId}" not found`);
    if (!target) throw AppError.notFound(`Target patient "\${targetPatientId}" not found`);
    if (source.mergedIntoPatientId) throw AppError.badRequest('Source patient is already merged');

    // Move clinical records to target
    await req.prismaTenant.encounter.updateMany({
      where: { patientId: source.id },
      data: { patientId: target.id },
    });

    await req.prismaTenant.appointment.updateMany({
      where: { patientId: source.id },
      data: { patientId: target.id },
    });

    await req.prismaTenant.patientAllergy.updateMany({
      where: { patientId: source.id },
      data: { patientId: target.id },
    });

    await req.prismaTenant.patientAlert.updateMany({
      where: { patientId: source.id },
      data: { patientId: target.id },
    });

    // Mark source patient merged
    const updatedSource = await req.prismaTenant.patient.update({
      where: { id: source.id },
      data: {
        mergedIntoPatientId: target.id,
        mergedAt: new Date(),
        status: 'MERGED',
      },
    });

    // Create Audit Log
    await req.prismaTenant.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'PATIENT_MERGE',
        entity: 'Patient',
        entityId: target.id,
        after: {
          sourcePatientId: source.id,
          sourceMrn: source.mrn,
          targetPatientId: target.id,
          targetMrn: target.mrn,
          reason,
        },
      },
    });

    res.json({
      success: true,
      message: `Patient ${source.mrn} successfully merged into ${target.mrn}`,
      data: {
        sourcePatientId: source.id,
        targetPatientId: target.id,
        source: updatedSource,
        target,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/patients/:id
router.get('/:id', requirePermission('patients.read'), async (req, res, next) => {
  try {
    const patient = await req.prismaTenant.patient.findFirst({
      where: { id: req.params.id },
      include: {
        encounters: {
          orderBy: { startTime: 'desc' },
          take: 20,
          include: {
            doctor: { include: { user: true } },
            diagnoses: true,
            prescriptions: true,
          },
        },
        appointments: {
          orderBy: { appointmentDate: 'desc' },
          take: 20,
          include: {
            doctor: { include: { user: true } },
          },
        },
        allergies: true,
        alerts: true,
        emergencyContacts: true,
        identifiers: true,
        documents: true,
        consents: true,
      },
    });

    if (!patient) {
      throw AppError.notFound(`Patient "\${req.params.id}" not found`);
    }

    res.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/patients/:id
router.put('/:id', requirePermission('patients.update'), async (req, res, next) => {
  try {
    const validatedData = UpdatePatientSchema.parse(req.body);

    const existing = await req.prismaTenant.patient.findFirst({
      where: { id: req.params.id },
    });
    if (!existing) throw AppError.notFound(`Patient "\${req.params.id}" not found`);

    const { emergencyContact, nationalId, ...fields } = validatedData;

    const updated = await req.prismaTenant.patient.update({
      where: { id: req.params.id },
      data: {
        ...fields,
        dateOfBirth: fields.dateOfBirth ? new Date(fields.dateOfBirth) : undefined,
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

// POST /api/v1/patients/:id/allergies
router.post('/:id/allergies', requirePermission('patients.update'), async (req, res, next) => {
  try {
    const { allergen, reaction, severity, notes } = CreateAllergySchema.parse(req.body);

    const allergy = await req.prismaTenant.patientAllergy.create({
      data: {
        patientId: req.params.id,
        allergen,
        reaction,
        severity,
        notes,
        status: 'ACTIVE',
        recordedById: req.user!.userId,
      },
    });

    res.status(201).json({
      success: true,
      data: allergy,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/patients/:id/alerts
router.post('/:id/alerts', requirePermission('patients.update'), async (req, res, next) => {
  try {
    const { alertType, description, severity } = CreateAlertSchema.parse(req.body);

    const alert = await req.prismaTenant.patientAlert.create({
      data: {
        patientId: req.params.id,
        alertType,
        description,
        severity,
        isActive: true,
        recordedById: req.user!.userId,
      },
    });

    res.status(201).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/patients/:id/documents
router.post('/:id/documents', requirePermission('patients.update'), async (req, res, next) => {
  try {
    const { title, documentType, fileUrl, fileSize, mimeType } = CreateDocumentSchema.parse(req.body);

    const doc = await req.prismaTenant.patientDocument.create({
      data: {
        tenantId: req.tenantId!,
        patientId: req.params.id,
        title,
        documentType,
        fileUrl,
        fileSize,
        mimeType,
        uploadedById: req.user!.userId,
      },
    });

    res.status(201).json({
      success: true,
      data: doc,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/patients/:id/consents
router.post('/:id/consents', requirePermission('patients.update'), async (req, res, next) => {
  try {
    const { consentType, notes, witnessName, expiresAt } = CreateConsentSchema.parse(req.body);

    const consent = await req.prismaTenant.patientConsent.create({
      data: {
        tenantId: req.tenantId!,
        patientId: req.params.id,
        consentType,
        notes,
        witnessName,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
    });

    res.status(201).json({
      success: true,
      data: consent,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/patients/:id/timeline
router.get('/:id/timeline', requirePermission('patients.read'), async (req, res, next) => {
  try {
    const patientId = req.params.id;

    const [encounters, appointments] = await Promise.all([
      req.prismaTenant.encounter.findMany({
        where: { patientId },
        orderBy: { startTime: 'desc' },
        include: {
          doctor: { include: { user: true } },
          diagnoses: true,
          prescriptions: { include: { items: true } },
          investigations: { include: { items: true } },
          vitals: true,
        },
      }),
      req.prismaTenant.appointment.findMany({
        where: { patientId },
        orderBy: { appointmentDate: 'desc' },
        include: {
          doctor: { include: { user: true } },
          department: true,
        },
      }),
    ]);

    const events = [
      ...encounters.map((e: any) => ({
        type: 'ENCOUNTER',
        id: e.id,
        date: e.startTime,
        title: `\${e.type} Consultation with Dr. \${e.doctor.user.firstName} \${e.doctor.user.lastName}`,
        status: e.status,
        details: {
          diagnoses: e.diagnoses.map((d: any) => d.description),
          prescriptionsCount: e.prescriptions.length,
          vitals: e.vitals[0] || null,
        },
      })),
      ...appointments.map((a: any) => ({
        type: 'APPOINTMENT',
        id: a.id,
        date: a.appointmentDate,
        title: `Appointment with Dr. \${a.doctor.user.firstName} \${a.doctor.user.lastName} (\${a.department.name})`,
        status: a.status,
        details: {
          reason: a.reason,
          type: a.type,
        },
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
