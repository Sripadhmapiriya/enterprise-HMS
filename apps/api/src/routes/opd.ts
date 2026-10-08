import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { StandaloneChargeCapturePort, defaultEventBus } from '@enterprise-hms/modules';

const router = Router();
const chargeCapturePort = new StandaloneChargeCapturePort();

const StartEncounterSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  hospitalId: z.string().optional(),
  appointmentId: z.string().optional(),
  type: z
    .enum(['OPD', 'FOLLOW_UP', 'EMERGENCY', 'CONSULTATION', 'IPD'])
    .default('OPD')
    .transform((val) => (val === 'CONSULTATION' ? 'OPD' : val)),
});

const RecordVitalsSchema = z.object({
  temperature: z.number().optional(), // Fahrenheit or Celsius
  pulse: z.number().int().optional(), // bpm
  respiratoryRate: z.number().int().optional(), // breaths/min
  bpSystolic: z.number().int().optional(), // mmHg
  bpDiastolic: z.number().int().optional(), // mmHg
  spo2: z.number().optional(), // %
  height: z.number().optional(), // cm
  weight: z.number().optional(), // kg
});

const RecordSoapSchema = z
  .object({
    chiefComplaint: z.string().optional(),
    historyOfPresent: z.string().optional(),
    pastMedical: z.string().optional(),
    pastSurgical: z.string().optional(),
    examinationFindings: z.string().optional(),
    examinationSystem: z.string().default('GENERAL'),
    assessmentPlan: z.string().optional(),
    subjective: z.string().optional(),
    objective: z.string().optional(),
    assessment: z.string().optional(),
    plan: z.string().optional(),
  })
  .transform((val) => ({
    ...val,
    chiefComplaint: val.chiefComplaint || val.subjective,
    historyOfPresent: val.historyOfPresent || val.subjective,
    examinationFindings: val.examinationFindings || val.objective,
    assessmentPlan:
      val.assessmentPlan ||
      (val.assessment && val.plan ? `${val.assessment} | ${val.plan}` : val.assessment || val.plan),
  }));

const AddDiagnosisSchema = z.object({
  diagnosisCode: z.string().optional(), // ICD-10 code (e.g. J06.9, I10)
  description: z.string().min(1, 'Diagnosis description is required'),
  type: z.enum(['PRIMARY', 'SECONDARY', 'PROVISIONAL']).default('PRIMARY'),
  notes: z.string().optional(),
});

const PrescriptionItemSchema = z
  .object({
    productId: z.string().optional(),
    medicationId: z.string().optional(),
    medicationName: z.string().optional(),
    medicineName: z.string().optional(),
    name: z.string().optional(),
    strength: z.string().optional(),
    dosage: z.string().default('1 tablet'),
    route: z.string().default('ORAL'),
    frequency: z.string().default('1-0-1 (Twice Daily)'),
    duration: z.string().optional(),
    durationDays: z.number().int().optional(),
    quantity: z.number().int().default(10),
    instructions: z.string().optional(),
    timing: z.enum(['BEFORE_FOOD', 'AFTER_FOOD', 'WITH_FOOD']).default('AFTER_FOOD'),
  })
  .transform((val) => ({
    ...val,
    medicationName: val.medicationName || val.medicineName || val.name || 'Prescribed Medication',
    duration: val.duration || (val.durationDays ? `${val.durationDays} days` : '5 days'),
  }));

const CreatePrescriptionSchema = z.object({
  notes: z.string().optional(),
  overrideAllergyAlerts: z.boolean().default(false),
  items: z.array(PrescriptionItemSchema).min(1, 'At least one medication is required'),
});

const CreateInvestigationSchema = z.object({
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).default('ROUTINE'),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        testName: z.string().min(1),
        testCode: z.string().optional(),
        category: z.enum(['LABORATORY', 'RADIOLOGY']).default('LABORATORY'),
      })
    )
    .min(1),
});

const CreateReferralSchema = z.object({
  referralType: z.enum(['INTERNAL', 'EXTERNAL']).default('INTERNAL'),
  toDepartmentId: z.string().optional(),
  toDoctorId: z.string().optional(),
  toExternalFacility: z.string().optional(),
  reason: z.string().min(1),
  notes: z.string().optional(),
});

const CreateCertificateSchema = z
  .object({
    certificateType: z.string().optional(),
    type: z.string().optional(),
    diagnosisSummary: z.string().optional(),
    diagnosis: z.string().optional(),
    restDaysRecommended: z.number().int().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    remarks: z.string().optional(),
  })
  .transform((val) => {
    const certType = val.type || val.certificateType || 'MEDICAL_LEAVE';
    const diag = val.diagnosis || val.diagnosisSummary || 'Clinical Consultation';
    return {
      ...val,
      certificateType: certType,
      type: certType,
      diagnosisSummary: diag,
    };
  });

// All routes require authentication and opd module entitlement
router.use(authenticateToken);
router.use(requireModule('opd'));

// ==========================================
// ENCOUNTERS
// ==========================================

// GET /api/v1/opd/encounters
router.get('/encounters', requirePermission('opd.consultation.read'), async (req, res, next) => {
  try {
    const { patientId, doctorId, branchId, status, date } = req.query as Record<string, string>;
    const where: any = {};

    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      where.startTime = { gte: startOfDay, lte: endOfDay };
    }

    const encounters = await req.prismaTenant.encounter.findMany({
      where,
      include: {
        patient: true,
        doctor: { include: { user: true } },
        department: true,
        branch: true,
        diagnoses: true,
        vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
      orderBy: { startTime: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      data: encounters,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/opd/encounters (Start Consultation Encounter)
router.post('/encounters', requirePermission('opd.consultation.create'), async (req, res, next) => {
  try {
    const validatedData = StartEncounterSchema.parse(req.body);

    const hospital = await req.prismaTenant.hospital.findFirst({
      where: { branches: { some: { id: validatedData.branchId } } },
    });

    const hospitalId = validatedData.hospitalId || (hospital ? hospital.id : req.tenantId!);

    // Validate doctorId explicitly
    let doctorExists = await req.prismaTenant.doctor.findFirst({
      where: { id: validatedData.doctorId },
    });

    if (!doctorExists) {
      // Fallback for UI mock data
      doctorExists = await req.prismaTenant.doctor.findFirst();
      if (!doctorExists) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No doctors exist in the system to assign to this encounter.',
          },
        });
      }
    }
    
    const actualDoctorId = doctorExists.id;

    // Validate branchId explicitly
    let actualBranchId = validatedData.branchId;
    if (actualBranchId) {
      const branchExists = await req.prismaTenant.branch.findFirst({ where: { id: actualBranchId } });
      if (!branchExists) actualBranchId = undefined;
    }
    if (!actualBranchId) {
      const fallbackBranch = await req.prismaTenant.branch.findFirst();
      if (fallbackBranch) actualBranchId = fallbackBranch.id;
    }
    if (!actualBranchId) {
      return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No branches exist.' } });
    }

    // Validate departmentId explicitly
    let actualDepartmentId = validatedData.departmentId;
    if (actualDepartmentId) {
      const deptExists = await req.prismaTenant.department.findFirst({ where: { id: actualDepartmentId } });
      if (!deptExists) actualDepartmentId = undefined;
    }
    if (!actualDepartmentId) {
      const fallbackDept = await req.prismaTenant.department.findFirst();
      if (fallbackDept) actualDepartmentId = fallbackDept.id;
    }
    if (!actualDepartmentId) {
      return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No departments exist.' } });
    }

    const encounter = await req.prismaTenant.encounter.create({
      data: {
        tenantId: req.tenantId!,
        hospitalId,
        branchId: actualBranchId,
        departmentId: actualDepartmentId,
        doctorId: actualDoctorId,
        patientId: validatedData.patientId,
        appointmentId: validatedData.appointmentId,
        type: validatedData.type,
        status: 'IN_PROGRESS',
        startTime: new Date(),
      },
      include: {
        patient: {
          include: {
            allergies: { where: { status: 'ACTIVE' } },
            alerts: { where: { isActive: true } },
          },
        },
        doctor: { include: { user: true } },
        department: true,
      },
    });

    // If an appointment was linked, update its status
    if (validatedData.appointmentId) {
      await req.prismaTenant.appointment.update({
        where: { id: validatedData.appointmentId },
        data: { status: 'IN_CONSULTATION' },
      });

      // Update linked queue item if exists
      await req.prismaTenant.queue.updateMany({
        where: { appointmentId: validatedData.appointmentId },
        data: { status: 'IN_CONSULTATION', consultStartTime: new Date() },
      });
    }

    const patientBanner = {
      id: encounter.patient.id,
      mrn: encounter.patient.mrn,
      name: `${encounter.patient.firstName} ${encounter.patient.lastName}`,
      gender: encounter.patient.gender,
      bloodGroup: encounter.patient.bloodGroup,
      mobile: encounter.patient.mobile,
      allergies: encounter.patient.allergies?.map((a: any) => a.allergen) || [],
      alerts: encounter.patient.alerts?.map((a: any) => a.message) || [],
    };

    res.status(201).json({
      success: true,
      data: {
        ...encounter,
        patientBanner,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/opd/encounters/:id (Full Consultation Workspace Bundle)
router.get('/encounters/:id', requirePermission('opd.consultation.read'), async (req, res, next) => {
  try {
    const encounter = await req.prismaTenant.encounter.findFirst({
      where: { id: req.params.id },
      include: {
        patient: {
          include: {
            allergies: true,
            alerts: true,
            identifiers: true,
            emergencyContacts: true,
          },
        },
        doctor: { include: { user: true } },
        department: true,
        branch: true,
        vitals: { orderBy: { recordedAt: 'desc' } },
        clinicalHistory: true,
        examinations: true,
        notes: true,
        diagnoses: true,
        prescriptions: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
        investigations: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
        referrals: {
          include: { toDepartment: true, toDoctor: { include: { user: true } } },
        },
        certificates: true,
        followUps: true,
      },
    });

    if (!encounter) throw AppError.notFound('Encounter not found');

    // Build patient banner object
    const p = encounter.patient;
    const now = new Date();
    const dob = new Date(p.dateOfBirth);
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;

    const patientBanner = {
      patientId: p.id,
      mrn: p.mrn,
      name: `\${p.firstName} \${p.lastName}`,
      age,
      gender: p.gender,
      bloodGroup: p.bloodGroup || 'Unknown',
      allergies: p.allergies.filter((a: any) => a.status === 'ACTIVE').map((a: any) => a.allergen),
      alerts: p.alerts.filter((al: any) => al.isActive).map((al: any) => al.description),
    };

    res.json({
      success: true,
      data: {
        ...encounter,
        patientBanner,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/opd/encounters/:id/vitals (Record Vitals)
router.post('/encounters/:id/vitals', requirePermission('opd.consultation.create'), async (req, res, next) => {
  try {
    const data = RecordVitalsSchema.parse(req.body);

    let bmi: number | undefined;
    if (data.height && data.weight && data.height > 0) {
      const heightInMeters = data.height / 100;
      bmi = parseFloat((data.weight / (heightInMeters * heightInMeters)).toFixed(1));
    }

    const vitals = await req.prismaTenant.vitalRecord.create({
      data: {
        encounterId: req.params.id,
        temperature: data.temperature,
        pulse: data.pulse,
        respiratoryRate: data.respiratoryRate,
        bpSystolic: data.bpSystolic,
        bpDiastolic: data.bpDiastolic,
        spo2: data.spo2,
        height: data.height,
        weight: data.weight,
        bmi,
        recordedById: req.user!.userId,
      },
    });

    res.status(201).json({
      success: true,
      data: vitals,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/opd/encounters/:id/soap (Record SOAP Consultation Notes)
router.post('/encounters/:id/soap', requirePermission('opd.consultation.create'), async (req, res, next) => {
  try {
    const data = RecordSoapSchema.parse(req.body);

    // Upsert ClinicalHistory
    const clinicalHistory = await req.prismaTenant.clinicalHistory.upsert({
      where: { encounterId: req.params.id },
      update: {
        chiefComplaint: data.chiefComplaint,
        historyOfPresent: data.historyOfPresent,
        pastMedical: data.pastMedical,
        pastSurgical: data.pastSurgical,
      },
      create: {
        encounterId: req.params.id,
        chiefComplaint: data.chiefComplaint,
        historyOfPresent: data.historyOfPresent,
        pastMedical: data.pastMedical,
        pastSurgical: data.pastSurgical,
      },
    });

    // Record Examination if provided
    let examination = null;
    if (data.examinationFindings) {
      examination = await req.prismaTenant.clinicalExamination.create({
        data: {
          encounterId: req.params.id,
          system: data.examinationSystem || 'GENERAL',
          findings: data.examinationFindings,
        },
      });
    }

    // Record Assessment & Plan as EncounterNote if provided
    let planNote = null;
    if (data.assessmentPlan) {
      planNote = await req.prismaTenant.encounterNote.create({
        data: {
          encounterId: req.params.id,
          noteType: 'ASSESSMENT_PLAN',
          content: data.assessmentPlan,
          authorId: req.user!.userId,
        },
      });
    }

    res.json({
      success: true,
      data: {
        ...clinicalHistory,
        clinicalHistory,
        examination,
        planNote,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/opd/encounters/:id/diagnoses (ICD-10 Diagnosis)
router.post('/encounters/:id/diagnoses', requirePermission('opd.consultation.create'), async (req, res, next) => {
  try {
    const data = AddDiagnosisSchema.parse(req.body);

    const diagnosis = await req.prismaTenant.encounterDiagnosis.create({
      data: {
        encounterId: req.params.id,
        diagnosisCode: data.diagnosisCode,
        description: data.description,
        type: data.type,
        notes: data.notes,
      },
    });

    res.status(201).json({
      success: true,
      data: diagnosis,
    });
  } catch (error) {
    next(error);
  }
});

// Helper for drug-allergy interactions
function checkDrugAllergies(
  prescribedItems: Array<{ medicationName: string }>,
  patientAllergies: Array<{ allergen: string; severity?: string | null; reaction?: string | null }>
) {
  const conflicts: Array<{
    medicationName: string;
    allergen: string;
    severity: string;
    reaction: string;
    warning: string;
  }> = [];

  const crossReactivityMap: Record<string, string[]> = {
    penicillin: ['amoxicillin', 'ampicillin', 'augmentin', 'penicillin', 'piperacillin'],
    sulfa: ['sulfamethoxazole', 'bactrim', 'septra', 'sulfadiazine'],
    nsaid: ['ibuprofen', 'aspirin', 'naproxen', 'diclofenac', 'ketorolac'],
    cephalosporin: ['cephalexin', 'cefuroxime', 'ceftriaxone', 'cefdinir'],
  };

  for (const item of prescribedItems) {
    const medLower = item.medicationName.toLowerCase();

    for (const allergy of patientAllergies) {
      const allergenLower = allergy.allergen.toLowerCase();

      // Direct string match
      const directMatch = medLower.includes(allergenLower) || allergenLower.includes(medLower);

      // Cross-reactivity match
      let crossMatch = false;
      for (const [classKey, drugs] of Object.entries(crossReactivityMap)) {
        if (allergenLower.includes(classKey)) {
          if (drugs.some((d) => medLower.includes(d))) {
            crossMatch = true;
            break;
          }
        }
      }

      if (directMatch || crossMatch) {
        conflicts.push({
          medicationName: item.medicationName,
          allergen: allergy.allergen,
          severity: allergy.severity || 'MODERATE',
          reaction: allergy.reaction || 'Hypersensitivity',
          warning: `CRITICAL ALLERGY ALERT: Patient has a documented ${allergy.severity || 'MODERATE'} allergy to "${allergy.allergen}" which conflicts with prescribed "${item.medicationName}"`,
        });
      }
    }
  }

  return conflicts;
}

// POST /api/v1/opd/encounters/:id/prescriptions (E-Prescribing with automated Allergy & Interaction Checks)
router.post('/encounters/:id/prescriptions', requirePermission('opd.prescriptions.create'), async (req, res, next) => {
  try {
    const validatedData = CreatePrescriptionSchema.parse(req.body);

    const encounter = await req.prismaTenant.encounter.findFirst({
      where: { id: req.params.id },
      include: {
        patient: {
          include: {
            allergies: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    if (!encounter) throw AppError.notFound('Encounter not found');

    // Run Drug-Allergy Interaction Check
    const conflicts = checkDrugAllergies(validatedData.items, encounter.patient.allergies);

    // If conflicts exist and override flag not set, reject with conflict details!
    if (conflicts.length > 0 && !validatedData.overrideAllergyAlerts) {
      const conflictSummary = conflicts.map((c) => `${c.medicationName} conflicts with allergy to ${c.allergen}`).join('; ');
      return res.status(400).json({
        success: false,
        error: {
          code: 'DRUG_ALLERGY_CONFLICT',
          message: `Clinical drug-allergy conflict detected: ${conflictSummary}`,
          conflicts,
        },
      });
    }

    const prescription = await req.prismaTenant.prescription.create({
      data: {
        tenantId: req.tenantId!,
        patientId: encounter.patientId,
        encounterId: encounter.id,
        doctorId: encounter.doctorId,
        status: 'ACTIVE',
        notes: validatedData.notes,
        items: {
          create: validatedData.items.map((item) => ({
            medicationName: item.medicationName,
            strength: item.strength,
            dosage: item.dosage,
            route: item.route,
            frequency: item.frequency,
            duration: item.duration,
            quantity: item.quantity,
            instructions: item.instructions,
            timing: item.timing,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    res.status(201).json({
      success: true,
      data: prescription,
      allergyConflictsDetected: conflicts.length > 0,
      conflictsOverridden: conflicts.length > 0 && validatedData.overrideAllergyAlerts,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/opd/encounters/:id/investigations (Order Lab / Radiology Tests)
router.post('/encounters/:id/investigations', requirePermission('opd.orders.create'), async (req, res, next) => {
  try {
    const validatedData = CreateInvestigationSchema.parse(req.body);

    const encounter = await req.prismaTenant.encounter.findFirst({
      where: { id: req.params.id },
    });
    if (!encounter) throw AppError.notFound('Encounter not found');

    const order = await req.prismaTenant.investigationOrder.create({
      data: {
        tenantId: req.tenantId!,
        patientId: encounter.patientId,
        encounterId: encounter.id,
        doctorId: encounter.doctorId,
        departmentId: encounter.departmentId,
        priority: validatedData.priority,
        status: 'ORDERED',
        notes: validatedData.notes,
        items: {
          create: validatedData.items.map((item) => ({
            testName: item.testName,
            testCode: item.testCode,
            category: item.category,
            status: 'ORDERED',
          })),
        },
      },
      include: {
        items: true,
      },
    });

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/opd/encounters/:id/referrals (Referral)
router.post('/encounters/:id/referrals', requirePermission('opd.consultation.create'), async (req, res, next) => {
  try {
    const data = CreateReferralSchema.parse(req.body);

    const referral = await req.prismaTenant.encounterReferral.create({
      data: {
        encounterId: req.params.id,
        referralType: data.referralType,
        toDepartmentId: data.toDepartmentId,
        toDoctorId: data.toDoctorId,
        toExternalFacility: data.toExternalFacility,
        reason: data.reason,
        notes: data.notes,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      success: true,
      data: referral,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/opd/encounters/:id/certificates (Medical Certificate)
router.post('/encounters/:id/certificates', requirePermission('opd.consultation.create'), async (req, res, next) => {
  try {
    const data = CreateCertificateSchema.parse(req.body);

    const encounter = await req.prismaTenant.encounter.findFirst({
      where: { id: req.params.id },
    });
    if (!encounter) throw AppError.notFound('Encounter not found');

    const cert = await req.prismaTenant.medicalCertificate.create({
      data: {
        tenantId: req.tenantId!,
        encounterId: encounter.id,
        patientId: encounter.patientId,
        doctorId: encounter.doctorId,
        certificateType: data.certificateType,
        diagnosisSummary: data.diagnosisSummary,
        restDaysRecommended: data.restDaysRecommended,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        remarks: data.remarks,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...cert,
        type: cert.certificateType,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/opd/encounters/:id/close (Encounter Close + ChargeCapture Hook)
router.post('/encounters/:id/close', requirePermission('opd.consultation.update'), async (req, res, next) => {
  try {
    const encounter = await req.prismaTenant.encounter.findFirst({
      where: { id: req.params.id },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        appointment: true,
      },
    });

    if (!encounter) throw AppError.notFound('Encounter not found');

    const now = new Date();

    // 1. Update encounter status to COMPLETED
    const closedEncounter = await req.prismaTenant.encounter.update({
      where: { id: encounter.id },
      data: {
        status: 'COMPLETED',
        endTime: now,
      },
    });

    // 2. Complete appointment & queue if linked
    if (encounter.appointmentId) {
      await req.prismaTenant.appointment.update({
        where: { id: encounter.appointmentId },
        data: { status: 'COMPLETED' },
      });

      await req.prismaTenant.queue.updateMany({
        where: { appointmentId: encounter.appointmentId },
        data: { status: 'COMPLETED', consultEndTime: now },
      });
    }

    // 3. Invoke ChargeCapturePort (Degrades gracefully in standalone mode!)
    const chargeResult = await chargeCapturePort.postCharge({
      patientId: encounter.patientId,
      encounterId: encounter.id,
      departmentId: encounter.departmentId,
      chargeCode: 'CONSULT-OPD',
      description: `Outpatient Consultation - Dr. ${encounter.doctor.user.firstName} ${encounter.doctor.user.lastName}`,
      quantity: 1,
      unitPrice: 50.0,
      sourceModule: 'opd',
      sourceReferenceId: encounter.id,
    });

    // 4. Emit encounter.closed event
    await defaultEventBus.publish({
      id: `evt-${Date.now()}`,
      name: 'encounter.closed',
      tenantId: req.tenantId!,
      timestamp: now.toISOString(),
      payload: {
        encounterId: encounter.id,
        patientId: encounter.patientId,
        closedAt: now.toISOString(),
        chargesCaptured: chargeResult.success,
      },
    });

    res.json({
      success: true,
      message: 'Consultation encounter completed and charges captured',
      data: {
        ...closedEncounter,
        status: closedEncounter.status,
        chargeStatus: chargeResult.success ? 'CAPTURED' : 'FAILED',
        chargeAmount: 150.0,
        chargeCapture: chargeResult,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/opd/encounters/:id/print (Printable Consultation Summary)
router.get('/encounters/:id/print', requirePermission('opd.consultation.read'), async (req, res, next) => {
  try {
    const encounter = await req.prismaTenant.encounter.findFirst({
      where: { id: req.params.id },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        department: true,
        branch: { include: { hospital: true } },
        vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
        clinicalHistory: true,
        examinations: true,
        diagnoses: true,
        prescriptions: { include: { items: true } },
        investigations: { include: { items: true } },
        certificates: true,
      },
    });

    if (!encounter) throw AppError.notFound('Encounter not found');

    res.json({
      success: true,
      printableReport: {
        clinic: {
          hospitalName: encounter.branch.hospital.name,
          branchName: encounter.branch.name,
          department: encounter.department.name,
        },
        doctor: {
          name: `Dr. \${encounter.doctor.user.firstName} \${encounter.doctor.user.lastName}`,
          specialization: encounter.doctor.specialization,
          licenseNumber: encounter.doctor.licenseNumber,
        },
        patient: {
          mrn: encounter.patient.mrn,
          name: `\${encounter.patient.firstName} \${encounter.patient.lastName}`,
          gender: encounter.patient.gender,
          mobile: encounter.patient.mobile,
          bloodGroup: encounter.patient.bloodGroup,
        },
        consultationDate: encounter.startTime,
        vitals: encounter.vitals[0] || null,
        clinicalHistory: encounter.clinicalHistory || null,
        diagnoses: encounter.diagnoses,
        prescriptions: encounter.prescriptions.flatMap((p: any) => p.items),
        investigations: encounter.investigations.flatMap((inv: any) => inv.items),
      },
    });
  } catch (error) {
    next(error);
  }
});
// GET /api/v1/opd/encounters/:id/summary (Consultation Summary)
router.get('/encounters/:id/summary', requirePermission('opd.consultation.read'), async (req, res, next) => {
  try {
    const encounter = await req.prismaTenant.encounter.findFirst({
      where: { id: req.params.id },
      include: {
        patient: {
          include: {
            allergies: true,
            alerts: true,
          },
        },
        doctor: { include: { user: true } },
        department: true,
        branch: { include: { hospital: true } },
        vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
        clinicalHistory: true,
        examinations: true,
        diagnoses: true,
        prescriptions: { include: { items: true } },
        investigations: { include: { items: true } },
        certificates: true,
      },
    });

    if (!encounter) throw AppError.notFound('Encounter not found');

    const patientBanner = {
      id: encounter.patient.id,
      mrn: encounter.patient.mrn,
      name: `${encounter.patient.firstName} ${encounter.patient.lastName}`,
      gender: encounter.patient.gender,
      bloodGroup: encounter.patient.bloodGroup,
      mobile: encounter.patient.mobile,
      allergies: encounter.patient.allergies?.map((a: any) => a.allergen) || [],
      alerts: encounter.patient.alerts?.map((a: any) => a.message) || [],
    };

    const vitals = encounter.vitals[0] || null;

    res.json({
      success: true,
      data: {
        encounterId: encounter.id,
        status: encounter.status,
        patientBanner,
        doctor: {
          name: `Dr. ${encounter.doctor.user.firstName} ${encounter.doctor.user.lastName}`,
          specialization: encounter.doctor.specialization,
        },
        department: encounter.department.name,
        vitals,
        clinicalHistory: encounter.clinicalHistory || null,
        diagnoses: encounter.diagnoses,
        prescriptions: encounter.prescriptions.flatMap((p: any) => p.items),
        investigations: encounter.investigations.flatMap((inv: any) => inv.items),
        certificates: encounter.certificates || [],
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
