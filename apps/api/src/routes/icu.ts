import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('icu'));

// Calculate SOFA Score (Sequential Organ Failure Assessment)
function calculateSofaScore(data: {
  spo2?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  platelets?: number;
  bilirubin?: number;
  creatinine?: number;
  gcs?: number;
}): { score: number; riskCategory: string } {
  let score = 0;
  
  // Respiration: based on SpO2
  if (data.spo2 !== undefined) {
    if (data.spo2 < 85) score += 4;
    else if (data.spo2 < 90) score += 3;
    else if (data.spo2 < 94) score += 2;
    else if (data.spo2 < 97) score += 1;
  }

  // Cardiovascular: MAP = DBP + (SBP - DBP) / 3
  if (data.bpSystolic && data.bpDiastolic) {
    const map = data.bpDiastolic + (data.bpSystolic - data.bpDiastolic) / 3;
    if (map < 65) score += 2;
    else if (map < 70) score += 1;
  }

  // Coagulation: platelets
  if (data.platelets !== undefined) {
    if (data.platelets < 20) score += 4;
    else if (data.platelets < 50) score += 3;
    else if (data.platelets < 100) score += 2;
    else if (data.platelets < 150) score += 1;
  }

  // Liver: bilirubin (mg/dL)
  if (data.bilirubin !== undefined) {
    if (data.bilirubin >= 12.0) score += 4;
    else if (data.bilirubin >= 6.0) score += 3;
    else if (data.bilirubin >= 2.0) score += 2;
    else if (data.bilirubin >= 1.2) score += 1;
  }

  // Renal: creatinine (mg/dL)
  if (data.creatinine !== undefined) {
    if (data.creatinine >= 5.0) score += 4;
    else if (data.creatinine >= 3.5) score += 3;
    else if (data.creatinine >= 2.0) score += 2;
    else if (data.creatinine >= 1.2) score += 1;
  }

  // Neurological: Glasgow Coma Scale (3-15)
  if (data.gcs !== undefined) {
    if (data.gcs < 6) score += 4;
    else if (data.gcs <= 9) score += 3;
    else if (data.gcs <= 12) score += 2;
    else if (data.gcs <= 14) score += 1;
  }

  let riskCategory = 'Low';
  if (score >= 12) riskCategory = 'Critical (Mortality > 80%)';
  else if (score >= 8) riskCategory = 'High (Mortality 40-50%)';
  else if (score >= 4) riskCategory = 'Moderate (Mortality 15-20%)';

  return { score, riskCategory };
}

// Critical Range Alarm Evaluation
function evaluateCriticalAlarms(vitalSigns: any, ventilatorParams: any): string[] {
  const alarms: string[] = [];

  if (vitalSigns) {
    if (vitalSigns.spo2 !== undefined && vitalSigns.spo2 < 90) {
      alarms.push(`CRITICAL HYPOXEMIA: SpO2 ${vitalSigns.spo2}% (<90%)`);
    }
    if (vitalSigns.bpSystolic !== undefined && vitalSigns.bpDiastolic !== undefined) {
      const map = Math.round(vitalSigns.bpDiastolic + (vitalSigns.bpSystolic - vitalSigns.bpDiastolic) / 3);
      if (map < 65) {
        alarms.push(`CRITICAL HYPOTENSION: MAP ${map} mmHg (<65 mmHg)`);
      }
    }
    if (vitalSigns.heartRate !== undefined) {
      if (vitalSigns.heartRate > 130) alarms.push(`CRITICAL TACHYCARDIA: HR ${vitalSigns.heartRate} bpm (>130)`);
      if (vitalSigns.heartRate < 45) alarms.push(`CRITICAL BRADYCARDIA: HR ${vitalSigns.heartRate} bpm (<45)`);
    }
    if (vitalSigns.respRate !== undefined) {
      if (vitalSigns.respRate > 35) alarms.push(`CRITICAL TACHYPNEA: RR ${vitalSigns.respRate} /min (>35)`);
      if (vitalSigns.respRate < 8) alarms.push(`CRITICAL BRADYPNEA: RR ${vitalSigns.respRate} /min (<8)`);
    }
    if (vitalSigns.temperature !== undefined) {
      if (vitalSigns.temperature > 39.5) alarms.push(`HYPERPYREXIA: Temp ${vitalSigns.temperature} °C (>39.5)`);
      if (vitalSigns.temperature < 35.0) alarms.push(`HYPOTHERMIA: Temp ${vitalSigns.temperature} °C (<35.0)`);
    }
  }

  if (ventilatorParams) {
    if (ventilatorParams.peakPressure !== undefined && ventilatorParams.peakPressure > 35) {
      alarms.push(`HIGH PEAK AIRWAY PRESSURE: ${ventilatorParams.peakPressure} cmH2O (>35)`);
    }
    if (ventilatorParams.fio2 !== undefined && ventilatorParams.fio2 > 0.8) {
      alarms.push(`HIGH FiO2 REQUIREMENT: ${(ventilatorParams.fio2 * 100).toFixed(0)}% (>80%)`);
    }
  }

  return alarms;
}

// Schemas
const CreateFlowsheetSchema = z.object({
  encounterId: z.string().min(1, 'Encounter ID is required'),
  vitalSigns: z.object({
    heartRate: z.number().optional(),
    bpSystolic: z.number().optional(),
    bpDiastolic: z.number().optional(),
    spo2: z.number().optional(),
    respRate: z.number().optional(),
    temperature: z.number().optional(),
    platelets: z.number().optional(),
    bilirubin: z.number().optional(),
    creatinine: z.number().optional(),
    gcs: z.number().min(3).max(15).optional(),
  }).optional(),
  ventilatorParams: z.object({
    mode: z.string().optional(), // AC, SIMV, PSV, CPAP, BIPAP
    fio2: z.number().min(0.21).max(1.0).optional(),
    peep: z.number().min(0).max(25).optional(),
    tidalVolume: z.number().optional(),
    peakPressure: z.number().optional(),
    respiratoryRateSet: z.number().optional(),
  }).optional(),
  fluidBalance: z.object({
    intakeTotal: z.number().optional(),
    outputTotal: z.number().optional(),
    netBalance: z.number().optional(),
    enteralIntake: z.number().optional(),
    ivIntake: z.number().optional(),
    urineOutput: z.number().optional(),
    drainOutput: z.number().optional(),
  }).optional(),
  notes: z.string().optional(),
});

// GET /api/v1/icu/flowsheets
router.get('/flowsheets', requirePermission('icu.flowsheets.read'), async (req, res, next) => {
  try {
    const { encounterId, patientId } = req.query;
    const where: any = {};
    if (encounterId) where.encounterId = String(encounterId);
    if (patientId) {
      where.encounter = { patientId: String(patientId) };
    }

    const flowsheets = await req.prismaTenant.iCUFlowsheet.findMany({
      where,
      include: {
        encounter: {
          include: {
            patient: true,
          },
        },
        recordedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { recordTime: 'desc' },
      take: 100,
    });

    const enriched = flowsheets.map((f: any) => {
      const vs = f.vitalSigns as any;
      const vp = f.ventilatorParams as any;
      const alarms = evaluateCriticalAlarms(vs, vp);
      const sofa = vs ? calculateSofaScore(vs) : null;
      return {
        ...f,
        criticalAlarms: alarms,
        sofaScore: sofa,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/icu/flowsheets/:id
router.get('/flowsheets/:id', requirePermission('icu.flowsheets.read'), async (req, res, next) => {
  try {
    const flowsheet = await req.prismaTenant.iCUFlowsheet.findUnique({
      where: { id: req.params.id },
      include: {
        encounter: {
          include: {
            patient: true,
          },
        },
        recordedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!flowsheet) {
      throw AppError.notFound('ICU flowsheet record not found');
    }

    const vs = flowsheet.vitalSigns as any;
    const vp = flowsheet.ventilatorParams as any;
    const alarms = evaluateCriticalAlarms(vs, vp);
    const sofa = vs ? calculateSofaScore(vs) : null;

    res.json({
      success: true,
      data: {
        ...flowsheet,
        criticalAlarms: alarms,
        sofaScore: sofa,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/icu/flowsheets
router.post('/flowsheets', requirePermission('icu.flowsheets.create'), async (req, res, next) => {
  try {
    const data = CreateFlowsheetSchema.parse(req.body);
    const recordedById = req.user!.userId;

    // Verify encounter exists
    const encounter = await req.prismaTenant.encounter.findUnique({
      where: { id: data.encounterId },
      include: { patient: true },
    });
    if (!encounter) {
      throw AppError.notFound('Encounter not found');
    }

    // Evaluate critical alarms & sofa
    const alarms = evaluateCriticalAlarms(data.vitalSigns, data.ventilatorParams);
    const sofa = data.vitalSigns ? calculateSofaScore(data.vitalSigns) : null;

    // Auto-calculate fluid balance if components provided
    let fluidBalance = data.fluidBalance;
    if (fluidBalance) {
      const intake = (fluidBalance.enteralIntake || 0) + (fluidBalance.ivIntake || 0);
      const output = (fluidBalance.urineOutput || 0) + (fluidBalance.drainOutput || 0);
      fluidBalance = {
        ...fluidBalance,
        intakeTotal: fluidBalance.intakeTotal ?? intake,
        outputTotal: fluidBalance.outputTotal ?? output,
        netBalance: fluidBalance.netBalance ?? (intake - output),
      };
    }

    const flowsheet = await req.prismaTenant.iCUFlowsheet.create({
      data: {
        encounterId: data.encounterId,
        recordedById,
        vitalSigns: data.vitalSigns || {},
        ventilatorParams: data.ventilatorParams || {},
        fluidBalance: fluidBalance || {},
        notes: data.notes || '',
      },
      include: {
        encounter: {
          include: { patient: true },
        },
        recordedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...flowsheet,
        criticalAlarms: alarms,
        sofaScore: sofa,
      },
      message: alarms.length > 0 ? `Flowsheet recorded with ${alarms.length} critical alarm(s)` : 'Flowsheet recorded successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/icu/active-patients
router.get('/active-patients', requirePermission('icu.flowsheets.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    // Find active admissions in ICU wards or with ICU beds
    const icuAdmissions = await req.prismaTenant.admission.findMany({
      where: {
        tenantId,
        status: 'ADMITTED',
        OR: [
          { bed: { bedType: 'ICU' } },
          { ward: { wardType: 'ICU' } },
        ],
      },
      include: {
        patient: true,
        bed: {
          include: { ward: true, room: true },
        },
        encounter: {
          include: {
            icuFlowsheets: {
              orderBy: { recordTime: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { admissionDate: 'desc' },
    });

    const list = icuAdmissions.map((adm: any) => {
      const latestFlowsheet = adm.encounter?.icuFlowsheets?.[0];
      const vs = latestFlowsheet?.vitalSigns as any;
      const vp = latestFlowsheet?.ventilatorParams as any;
      const alarms = latestFlowsheet ? evaluateCriticalAlarms(vs, vp) : [];
      const sofa = vs ? calculateSofaScore(vs) : null;

      return {
        admissionId: adm.id,
        admissionNumber: adm.admissionNumber,
        admissionDate: adm.admissionDate,
        patient: adm.patient,
        bed: adm.bed,
        ward: adm.ward,
        encounterId: adm.encounterId,
        latestVitals: vs,
        latestVentilator: vp,
        criticalAlarms: alarms,
        sofaScore: sofa,
      };
    });

    res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
});

export default router;
