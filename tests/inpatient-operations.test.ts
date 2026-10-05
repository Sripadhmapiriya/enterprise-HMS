import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './apps/api/src/index';
import { prisma } from './packages/database/src/index';
import { authService } from './apps/api/src/services/authService';
import { clearEntitlementsCache } from './apps/api/src/middleware/auth';

describe('Workstream G: Inpatient (IPD), ICU, OT, Blood Bank, CSSD, Dietary, Housekeeping, Ambulance & Section 9 Journeys', () => {
  let token: string;
  let tenantId: string;
  let hospitalId: string;
  let branchId: string;
  let departmentId: string;
  let doctorId: string;
  let doctorUserId: string;
  let nurseUserId: string;
  let patientId: string;

  beforeAll(async () => {
    // 1. Setup Tenant
    const tenant = await prisma.tenant.upsert({
      where: { code: 'TEST-INPATIENT-OPS' },
      update: {},
      create: { name: 'Metro Inpatient & Surgical Pavilion', code: 'TEST-INPATIENT-OPS' },
    });
    tenantId = tenant.id;

    // Enable all required modules for Workstream G
    const modulesToEnable = [
      'patients',
      'scheduling',
      'opd',
      'emergency',
      'billing',
      'ipd',
      'icu',
      'ot',
      'bloodbank',
      'cssd',
      'dietary',
      'housekeeping',
      'ambulance',
    ];

    for (const mod of modulesToEnable) {
      await prisma.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: mod } },
        update: { enabled: true },
        create: { tenantId, moduleId: mod, enabled: true },
      });
    }

    // 2. Setup Hospital & Branch
    const hospital =
      (await prisma.hospital.findFirst({ where: { tenantId } })) ||
      (await prisma.hospital.create({
        data: { tenantId, name: 'Metro Tertiary Inpatient Hospital' },
      }));
    hospitalId = hospital.id;

    const branch =
      (await prisma.branch.findFirst({ where: { hospitalId } })) ||
      (await prisma.branch.create({
        data: { hospitalId, name: 'Surgical & Critical Care Tower', code: 'SURG-TOWER-01' },
      }));
    branchId = branch.id;

    // 3. Setup Department
    const dept =
      (await prisma.department.findFirst({ where: { branchId } })) ||
      (await prisma.department.create({
        data: { branchId, name: 'Inpatient Medicine & Surgery', code: 'INPAT-MED-SURG' },
      }));
    departmentId = dept.id;

    // 4. Setup Doctor User & Doctor Profile
    const docUser = await prisma.user.create({
      data: {
        tenantId,
        email: `dr.surgeon.${Date.now()}@metromedical.org`,
        passwordHash: await authService.hashPassword('Password123!'),
        firstName: 'Marcus',
        lastName: 'Welby',
      },
    });
    doctorUserId = docUser.id;

    const doctor = await prisma.doctor.create({
      data: {
        user: { connect: { id: docUser.id } },
        branch: { connect: { id: branchId } },
        department: { connect: { id: departmentId } },
        specialization: 'General & Trauma Surgery',
        licenseNumber: `MED-LIC-${Date.now().toString().slice(-6)}`,
      },
    });
    doctorId = doctor.id;

    // 5. Setup Nurse User
    const nurseUser = await prisma.user.create({
      data: {
        tenantId,
        email: `nurse.station.${Date.now()}@metromedical.org`,
        passwordHash: await authService.hashPassword('Password123!'),
        firstName: 'Clara',
        lastName: 'Barton',
      },
    });
    nurseUserId = nurseUser.id;

    // 6. Setup Patient
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        hospitalId,
        mrn: `MRN-IPD-${Date.now()}`,
        firstName: 'Arthur',
        lastName: 'Pendelton',
        dateOfBirth: new Date('1975-04-12'),
        gender: 'MALE',
        mobile: '+15551239876',
        bloodGroup: 'A+',
      },
    });
    patientId = patient.id;

    // 7. JWT Token with superadmin permissions
    token = authService.generateAccessToken({
      userId: docUser.id,
      tenantId,
      email: docUser.email,
      roles: ['SuperAdmin', 'Doctor', 'Nurse', 'Surgeon'],
      permissions: ['*'],
      hospitalId,
      branchId,
    });
  });

  // =========================================================================
  // 1. IPD INPATIENT WORKFLOW
  // =========================================================================
  describe('1. IPD Inpatient ADT, Bed Board & Clinical MAR', () => {
    let wardId: string;
    let bed1Id: string;
    let bed2Id: string;
    let admissionId: string;
    let medOrderId: string;

    it('creates an inpatient ward', async () => {
      const res = await request(app)
        .post('/api/v1/ipd/wards')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Florence Nightingale Medical Ward',
          code: `WARD-FN-${Date.now().toString().slice(-4)}`,
          wardType: 'GENERAL',
          capacity: 30,
          floor: 'Floor 3',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      wardId = res.body.data.id;
    });

    it('creates beds within the ward', async () => {
      const res1 = await request(app)
        .post('/api/v1/ipd/beds')
        .set('Authorization', `Bearer ${token}`)
        .send({
          wardId,
          bedNumber: `BED-301-${Date.now().toString().slice(-3)}`,
          bedType: 'REGULAR',
          status: 'AVAILABLE',
        });
      expect(res1.status).toBe(201);
      bed1Id = res1.body.data.id;

      const res2 = await request(app)
        .post('/api/v1/ipd/beds')
        .set('Authorization', `Bearer ${token}`)
        .send({
          wardId,
          bedNumber: `BED-302-${Date.now().toString().slice(-3)}`,
          bedType: 'OXYGEN',
          status: 'AVAILABLE',
        });
      expect(res2.status).toBe(201);
      bed2Id = res2.body.data.id;
    });

    it('retrieves bed board telemetry and occupancy metrics', async () => {
      const res = await request(app)
        .get('/api/v1/ipd/bed-board')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalBeds).toBeGreaterThanOrEqual(2);
      expect(res.body.data.availableBeds).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(res.body.data.wards)).toBe(true);
    });

    it('creates a planned inpatient admission', async () => {
      const res = await request(app)
        .post('/api/v1/ipd/admissions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          admissionType: 'PLANNED',
          admissionSource: 'DIRECT',
          reason: 'Severe pneumonia requiring IV antibiotic therapy',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admissionNumber).toMatch(/^ADM-\d+-\d+$/);
      expect(['REQUESTED', 'ADMITTED']).toContain(res.body.data.status);
      admissionId = res.body.data.id;
    });

    it('allocates bed to the admitted patient and marks bed OCCUPIED', async () => {
      const res = await request(app)
        .post(`/api/v1/ipd/admissions/${admissionId}/allocate-bed`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          bedId: bed1Id,
          reason: 'Initial ward bed assignment',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify bed state is now OCCUPIED
      const bedCheck = await prisma.bed.findUnique({ where: { id: bed1Id } });
      expect(bedCheck?.status).toBe('OCCUPIED');
    });

    it('records a comprehensive nursing shift assessment', async () => {
      const res = await request(app)
        .post(`/api/v1/ipd/admissions/${admissionId}/nursing-assessments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          generalCondition: 'STABLE',
          painScore: 2,
          mobility: 'Assisted Ambulation',
          fallRisk: 'Low',
          skinCondition: 'Intact',
          notes: 'Patient resting comfortably on supplemental oxygen.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.painScore).toBe(2);
    });

    it('records fluid intake and output events', async () => {
      const resIntake = await request(app)
        .post(`/api/v1/ipd/admissions/${admissionId}/intake-output`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'INTAKE',
          category: 'IV_INFUSION',
          amount: 500,
          unit: 'ml',
          notes: 'Normal saline 0.9%',
        });
      expect(resIntake.status).toBe(201);

      const resOutput = await request(app)
        .post(`/api/v1/ipd/admissions/${admissionId}/intake-output`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'OUTPUT',
          category: 'URINE',
          amount: 350,
          unit: 'ml',
        });
      expect(resOutput.status).toBe(201);

      // Check listing
      const resList = await request(app)
        .get(`/api/v1/ipd/admissions/${admissionId}/intake-output`)
        .set('Authorization', `Bearer ${token}`);
      expect(resList.body.data.length).toBe(2);
    });

    it('documents daily doctor round progress notes', async () => {
      const res = await request(app)
        .post(`/api/v1/ipd/admissions/${admissionId}/rounds`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          clinicalStatus: 'IMPROVING',
          progressNote: 'Patient reports dyspnea resolved; lung bases clearing on auscultation.',
          assessment: 'Resolving community-acquired pneumonia',
          plan: 'Continue Ceftriaxone IV, encourage deep breathing exercises.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.clinicalStatus).toBe('IMPROVING');
    });

    it('prescribes an inpatient medication order on the MAR', async () => {
      const res = await request(app)
        .post(`/api/v1/ipd/admissions/${admissionId}/medication-orders`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          medicationName: 'Ceftriaxone Sodium Injection',
          dose: '1 g',
          route: 'IV',
          frequency: 'BID',
          instructions: 'Infuse over 30 minutes in 100ml D5W',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.medicationName).toBe('Ceftriaxone Sodium Injection');
      medOrderId = res.body.data.id;
    });

    it('enforces 5-rights verification on MAR administration (blocks when incomplete)', async () => {
      // Missing route and time check
      const resIncomplete = await request(app)
        .post(`/api/v1/ipd/mar/${medOrderId}/administer`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientVerificationChecked: true,
          medicationVerificationChecked: true,
          doseVerificationChecked: true,
          routeVerificationChecked: false, // Incomplete!
          timeVerificationChecked: true,
        });

      expect(resIncomplete.status).toBe(400);

      // Complete all 5 rights
      const resComplete = await request(app)
        .post(`/api/v1/ipd/mar/${medOrderId}/administer`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientVerificationChecked: true,
          medicationVerificationChecked: true,
          doseVerificationChecked: true,
          routeVerificationChecked: true,
          timeVerificationChecked: true,
          notes: 'Administered via peripheral IV catheter without reaction',
        });

      expect(resComplete.status).toBe(201);
      expect(resComplete.body.success).toBe(true);
      expect(resComplete.body.data.status).toBe('GIVEN');
    });

    it('executes an inpatient bed transfer to another room/bed', async () => {
      const res = await request(app)
        .post(`/api/v1/ipd/admissions/${admissionId}/transfer`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          toBedId: bed2Id,
          reason: 'Patient required bed with piped oxygen access',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify previous bed was freed to CLEANING or AVAILABLE
      const bed1 = await prisma.bed.findUnique({ where: { id: bed1Id } });
      const bed2 = await prisma.bed.findUnique({ where: { id: bed2Id } });
      expect(bed1?.status).not.toBe('OCCUPIED');
      expect(bed2?.status).toBe('OCCUPIED');
    });

    it('documents clinical discharge summary', async () => {
      const res = await request(app)
        .post(`/api/v1/ipd/admissions/${admissionId}/discharge-summary`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          finalDiagnosis: 'Community Acquired Pneumonia - Resolved',
          hospitalCourse: 'Patient admitted with hypoxemia and fever. Treated with IV Ceftriaxone for 4 days with complete resolution of infiltrates.',
          dischargeCondition: 'STABLE',
          medications: 'Cefixime 400mg PO QD for 3 days',
          followUpPlan: 'OPD follow-up in Pulmonary clinic in 1 week',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.finalDiagnosis).toContain('Pneumonia');
    });

    it('checks billing clearance for the admission', async () => {
      const res = await request(app)
        .get(`/api/v1/ipd/admissions/${admissionId}/billing-clearance`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cleared).toBeDefined();
    });
  });

  // =========================================================================
  // 2. ICU CRITICAL CARE WORKFLOW
  // =========================================================================
  describe('2. ICU Critical Care Flowsheets, SOFA Scores & Critical Alarms', () => {
    let icuEncounterId: string;

    beforeAll(async () => {
      const enc = await prisma.encounter.create({
        data: {
          tenantId,
          hospitalId,
          branchId,
          departmentId,
          doctorId,
          patientId,
          type: 'INPATIENT',
          status: 'IN_PROGRESS',
        },
      });
      icuEncounterId = enc.id;
    });

    it('records ICU flowsheet with SOFA score calculation and critical alarms', async () => {
      const res = await request(app)
        .post('/api/v1/icu/flowsheets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          encounterId: icuEncounterId,
          vitalSigns: {
            heartRate: 142, // Tachycardia alarm (>130)
            bpSystolic: 80,
            bpDiastolic: 45, // MAP = 56 mmHg (<65 critical hypotension)
            spo2: 88, // Critical hypoxemia (<90)
            respRate: 36, // Tachypnea alarm (>35)
            temperature: 38.6,
            gcs: 11, // SOFA Neurological component
            platelets: 45, // SOFA Coagulation component (<50)
            creatinine: 2.8, // SOFA Renal component
            bilirubin: 3.2, // SOFA Liver component
          },
          ventilatorParams: {
            mode: 'AC',
            fio2: 0.85, // High FiO2 requirement alarm (>0.8)
            peep: 12,
            peakPressure: 38, // High peak airway pressure alarm (>35)
            tidalVolume: 420,
          },
          fluidBalance: {
            enteralIntake: 0,
            ivIntake: 1200,
            urineOutput: 250,
            drainOutput: 50,
          },
          notes: 'Patient in septic shock, on norepinephrine infusion.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify SOFA score calculated
      expect(res.body.data.sofaScore).toBeDefined();
      expect(res.body.data.sofaScore.score).toBeGreaterThanOrEqual(8);
      expect(res.body.data.sofaScore.riskCategory).toBeDefined();

      // Verify Critical Alarms triggered
      expect(res.body.data.criticalAlarms.length).toBeGreaterThanOrEqual(4);
      expect(res.body.data.criticalAlarms.some((a: string) => a.includes('HYPOXEMIA'))).toBe(true);
      expect(res.body.data.criticalAlarms.some((a: string) => a.includes('HYPOTENSION'))).toBe(true);
      expect(res.body.data.criticalAlarms.some((a: string) => a.includes('AIRWAY PRESSURE'))).toBe(true);

      // Verify auto-calculated fluid balance
      expect(res.body.data.fluidBalance.netBalance).toBe(900); // 1200 - 300
    });

    it('retrieves ICU flowsheets for an encounter', async () => {
      const res = await request(app)
        .get(`/api/v1/icu/flowsheets?encounterId=${icuEncounterId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 3. OPERATING THEATRE (OT) WORKFLOW
  // =========================================================================
  describe('3. Operating Theatre (OT) Scheduling with Conflict Detection & WHO Checklist', () => {
    let otId: string;
    let requestId: string;
    let scheduleId: string;
    let otEncounterId: string;

    beforeAll(async () => {
      const enc = await prisma.encounter.create({
        data: {
          tenantId,
          hospitalId,
          branchId,
          departmentId,
          doctorId,
          patientId,
          type: 'INPATIENT',
          status: 'IN_PROGRESS',
        },
      });
      otEncounterId = enc.id;
    });

    it('registers an operating theatre suite', async () => {
      const res = await request(app)
        .post('/api/v1/ot/theatres')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Major Cardiac & Vascular OT 1',
          code: `OT-CAR-${Date.now().toString().slice(-4)}`,
          type: 'CARDIAC',
          branchId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      otId = res.body.data.id;
    });

    it('creates a surgery request', async () => {
      const res = await request(app)
        .post('/api/v1/ot/requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          encounterId: otEncounterId,
          procedureName: 'Coronary Artery Bypass Grafting (CABG x 3)',
          diagnosis: 'Triple Vessel Coronary Artery Disease',
          priority: 'URGENT',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REQUESTED');
      requestId = res.body.data.id;
    });

    it('schedules surgery in the theatre', async () => {
      const start = new Date(Date.now() + 86400000); // Tomorrow 09:00
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(13, 0, 0, 0);

      const res = await request(app)
        .post('/api/v1/ot/schedules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          requestId,
          otId,
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SCHEDULED');
      scheduleId = res.body.data.id;
    });

    it('DETECTS CONFLICT: rejects overlapping surgery in the same theatre with 409 Conflict', async () => {
      // Create a second request
      const req2 = await request(app)
        .post('/api/v1/ot/requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          encounterId: otEncounterId,
          procedureName: 'Aortic Valve Replacement',
          priority: 'ROUTINE',
        });

      // Try to schedule overlapping window (Tomorrow 10:00 - 12:00 in same OT)
      const conflictStart = new Date(Date.now() + 86400000);
      conflictStart.setHours(10, 0, 0, 0);
      const conflictEnd = new Date(conflictStart);
      conflictEnd.setHours(12, 0, 0, 0);

      const resConflict = await request(app)
        .post('/api/v1/ot/schedules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          requestId: req2.body.data.id,
          otId,
          scheduledStart: conflictStart.toISOString(),
          scheduledEnd: conflictEnd.toISOString(),
        });

      expect(resConflict.status).toBe(409);
      expect(resConflict.body.error.message).toContain('Conflict Detected');
    });

    it('assigns surgical team members', async () => {
      const res = await request(app)
        .post(`/api/v1/ot/schedules/${scheduleId}/team`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: doctorUserId,
          role: 'SURGEON',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('SURGEON');
    });

    it('certifies WHO Surgical Safety Checklist (Sign In, Time Out, Sign Out)', async () => {
      const res = await request(app)
        .post(`/api/v1/ot/schedules/${scheduleId}/who-checklist`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientIdentityConfirmed: true,
          surgicalSiteMarked: true,
          anaesthesiaMachineCheckComplete: true,
          pulseOximeterFunctioning: true,
          knownAllergiesReviewed: true,
          difficultAirwayAssessed: true,
          bloodLossRiskAssessed: true,
          teamIntroduced: true,
          verbalConfirmationPatientSiteProcedure: true,
          anticipatedCriticalEventsReviewed: true,
          antibioticProphylaxisGiven: true,
          essentialImagingDisplayed: true,
          procedureNameRecorded: true,
          instrumentNeedleSpongeCountComplete: true,
          specimenLabeledCorrectly: true,
          equipmentIssuesIdentified: false,
          keyConcernsForRecoveryReviewed: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.allPassed).toBe(true);
    });

    it('records operative procedure note & surgical implant', async () => {
      const resNote = await request(app)
        .post(`/api/v1/ot/schedules/${scheduleId}/notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          preOpDiagnosis: 'CAD - Triple Vessel',
          postOpDiagnosis: 'Status post successful CABG x 3 grafts',
          findings: 'Severe calcification of LAD and Circumflex vessels; good distal targets.',
          procedureDetails: 'Median sternotomy, cardiopulmonary bypass instituted, LIMA to LAD, SVG to OM and RCA anastomoses constructed.',
          complications: 'None',
          bloodLoss: 300,
        });
      expect(resNote.status).toBe(201);

      const resImplant = await request(app)
        .post(`/api/v1/ot/schedules/${scheduleId}/implants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          implantName: 'Sternal Closure Wire System',
          manufacturer: 'Ethicon Surgical',
          serialNumber: 'ETH-W-9921',
          lotNumber: 'LOT-2026-X',
        });
      expect(resImplant.status).toBe(201);
      expect(resImplant.body.data.implantName).toBe('Sternal Closure Wire System');
    });

    it('transitions surgery to COMPLETED, releasing theatre and triggering terminal clean', async () => {
      // 1. Move to IN_PROGRESS (theatre becomes IN_USE)
      await request(app)
        .patch(`/api/v1/ot/schedules/${scheduleId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'IN_PROGRESS' });

      let th = await prisma.operatingTheatre.findUnique({ where: { id: otId } });
      expect(th?.status).toBe('IN_USE');

      // 2. Move to COMPLETED (theatre becomes AVAILABLE, housekeeping task created)
      const resComplete = await request(app)
        .patch(`/api/v1/ot/schedules/${scheduleId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'COMPLETED' });

      expect(resComplete.status).toBe(200);
      expect(resComplete.body.data.status).toBe('COMPLETED');

      th = await prisma.operatingTheatre.findUnique({ where: { id: otId } });
      expect(th?.status).toBe('AVAILABLE');

      // Check Housekeeping task was created for OT
      const hkTask = await prisma.housekeepingTask.findFirst({
        where: { locationRef: otId, locationType: 'OT', taskType: 'TERMINAL' },
      });
      expect(hkTask).toBeDefined();
    });
  });

  // =========================================================================
  // 4. BLOOD BANK & TRANSFUSION MEDICINE WORKFLOW
  // =========================================================================
  describe('4. Blood Bank Donor Registry, Component Fractionation & Crossmatch Compatibility', () => {
    let donorOId: string;
    let donorBId: string;
    let donationId: string;
    let prbcComponentId: string;
    let bbEncounterId: string;
    let bloodIssueId: string;

    beforeAll(async () => {
      const enc = await prisma.encounter.create({
        data: {
          tenantId,
          hospitalId,
          branchId,
          departmentId,
          doctorId,
          patientId,
          type: 'INPATIENT',
          status: 'IN_PROGRESS',
        },
      });
      bbEncounterId = enc.id;
    });

    it('registers voluntary blood donors (Universal O- and incompatible B+)', async () => {
      // O- Donor
      const res1 = await request(app)
        .post('/api/v1/bloodbank/donors')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Samuel',
          lastName: 'Adams',
          bloodGroup: 'O-',
          gender: 'MALE',
          dateOfBirth: '1992-05-14',
          mobile: '9876500001',
          eligibilityStatus: 'ELIGIBLE',
        });
      expect(res1.status).toBe(201);
      donorOId = res1.body.data.id;

      // B+ Donor
      const res2 = await request(app)
        .post('/api/v1/bloodbank/donors')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Benjamin',
          lastName: 'Franklin',
          bloodGroup: 'B+',
          gender: 'MALE',
          dateOfBirth: '1989-11-20',
          mobile: '9876500002',
          eligibilityStatus: 'ELIGIBLE',
        });
      expect(res2.status).toBe(201);
      donorBId = res2.body.data.id;
    });

    it('records blood donation collection', async () => {
      const res = await request(app)
        .post('/api/v1/bloodbank/donations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          donorId: donorOId,
          volume: 450,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bagId).toMatch(/^BAG-/);
      donationId = res.body.data.id;
    });

    it('processes donation into components (PRBC, FFP, Platelets) with valid expiries', async () => {
      const res = await request(app)
        .post(`/api/v1/bloodbank/donations/${donationId}/process`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          components: ['PRBC', 'FFP', 'PLATELETS'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);

      const prbc = res.body.data.find((c: any) => c.componentType === 'PRBC');
      expect(prbc).toBeDefined();
      expect(prbc.bloodGroup).toBe('O-');
      prbcComponentId = prbc.id;
    });

    it('retrieves blood bank inventory summary matrix', async () => {
      const res = await request(app)
        .get('/api/v1/bloodbank/inventory-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary['O-']['PRBC']).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalAvailableUnits).toBeGreaterThanOrEqual(3);
    });

    it('CROSSMATCH TEST: verifies O- red cells are COMPATIBLE with Patient (A+)', async () => {
      const res = await request(app)
        .post('/api/v1/bloodbank/crossmatch-check')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientBloodGroup: 'A+',
          componentId: prbcComponentId,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isCompatible).toBe(true);
      expect(res.body.data.donorBloodGroup).toBe('O-');
    });

    it('CROSSMATCH TEST: verifies B+ red cells are INCOMPATIBLE with Patient (A+)', async () => {
      // Collect and process a B+ unit
      const donB = await request(app)
        .post('/api/v1/bloodbank/donations')
        .set('Authorization', `Bearer ${token}`)
        .send({ donorId: donorBId, volume: 450 });

      const procB = await request(app)
        .post(`/api/v1/bloodbank/donations/${donB.body.data.id}/process`)
        .set('Authorization', `Bearer ${token}`)
        .send({ components: ['PRBC'] });

      const bPrbc = procB.body.data[0];

      const resCheck = await request(app)
        .post('/api/v1/bloodbank/crossmatch-check')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientBloodGroup: 'A+',
          componentId: bPrbc.id,
        });

      expect(resCheck.status).toBe(200);
      expect(resCheck.body.data.isCompatible).toBe(false);
      expect(resCheck.body.message).toContain('INCOMPATIBLE');

      // Safety check: Attempting to issue this incompatible unit to patient must fail
      const resBlock = await request(app)
        .post('/api/v1/bloodbank/issues')
        .set('Authorization', `Bearer ${token}`)
        .send({
          componentId: bPrbc.id,
          patientId,
          encounterId: bbEncounterId,
        });

      expect(resBlock.status).toBe(400);
      expect(resBlock.body.error.message).toContain('Safety Block');
    });

    it('issues compatible blood unit and updates transfusion completion', async () => {
      const res = await request(app)
        .post('/api/v1/bloodbank/issues')
        .set('Authorization', `Bearer ${token}`)
        .send({
          componentId: prbcComponentId,
          patientId,
          encounterId: bbEncounterId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      bloodIssueId = res.body.data.id;

      // Update transfusion to COMPLETED
      const resTrans = await request(app)
        .patch(`/api/v1/bloodbank/issues/${bloodIssueId}/transfusion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ transfusionStatus: 'COMPLETED' });

      expect(resTrans.status).toBe(200);
      expect(resTrans.body.data.transfusionStatus).toBe('COMPLETED');
    });
  });

  // =========================================================================
  // 5. CSSD CENTRAL STERILE SERVICES WORKFLOW
  // =========================================================================
  describe('5. CSSD Sterilization Cycles, QA Indicators & Load Tracking', () => {
    let cycleId: string;

    it('starts an autoclave sterilization cycle', async () => {
      const res = await request(app)
        .post('/api/v1/cssd/cycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          machineId: 'AUTOCLAVE-01',
          method: 'AUTOCLAVE',
          temperatureTarget: 134,
          pressureTarget: 2.2,
          holdTimeMinutes: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cycleNumber).toMatch(/^CSSD-/);
      expect(res.body.data.result).toBe('PENDING');
      cycleId = res.body.data.id;
    });

    it('certifies cycle QA check with chemical and biological indicator pass', async () => {
      const res = await request(app)
        .post(`/api/v1/cssd/cycles/${cycleId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          result: 'PASSED',
          chemicalIndicatorPassed: true,
          biologicalIndicatorPassed: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.result).toBe('PASSED');
      expect(res.body.data.endTime).toBeDefined();
    });

    it('retrieves CSSD production stats', async () => {
      const res = await request(app)
        .get('/api/v1/cssd/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.passedToday).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 6. DIETARY & CLINICAL NUTRITION WORKFLOW
  // =========================================================================
  describe('6. Dietary Therapeutic Diet Orders & Kitchen Meal Worklist', () => {
    let dietTypeId: string;
    let dietEncounterId: string;
    let orderId: string;

    beforeAll(async () => {
      const enc = await prisma.encounter.create({
        data: {
          tenantId,
          hospitalId,
          branchId,
          departmentId,
          doctorId,
          patientId,
          type: 'INPATIENT',
          status: 'IN_PROGRESS',
        },
      });
      dietEncounterId = enc.id;
    });

    it('fetches and auto-seeds diet types (Diabetic, Renal, Low Sodium, NPO, Regular)', async () => {
      const res = await request(app)
        .get('/api/v1/dietary/diet-types')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(5);

      const diabetic = res.body.data.find((d: any) => d.code === 'DIABETIC');
      expect(diabetic).toBeDefined();
      dietTypeId = diabetic.id;
    });

    it('prescribes clinical diet order with restrictions', async () => {
      const res = await request(app)
        .post('/api/v1/dietary/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          encounterId: dietEncounterId,
          dietTypeId,
          restrictions: 'Strict 1800 kcal diabetic diet, low sodium (<2g/day)',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      orderId = res.body.data.id;
    });

    it('generates kitchen meal preparation and delivery worklist', async () => {
      const res = await request(app)
        .get('/api/v1/dietary/kitchen-worklist')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.worklist).toBeDefined();
      expect(res.body.data.summary).toBeDefined();
    });
  });

  // =========================================================================
  // 7. HOUSEKEEPING & ENVIRONMENTAL HYGIENE WORKFLOW
  // =========================================================================
  describe('7. Housekeeping Task Queue, Terminal Cleaning & Auto Bed Restoration', () => {
    let testBedId: string;
    let taskId: string;

    beforeAll(async () => {
      const b = await prisma.bed.create({
        data: {
          ward: {
            create: {
              tenantId,
              branchId,
              name: 'Housekeeping QA Ward',
              code: `HK-W-${Date.now().toString().slice(-4)}`,
              wardType: 'GENERAL',
              capacity: 10,
            },
          },
          bedNumber: `HK-BED-${Date.now().toString().slice(-4)}`,
          status: 'CLEANING', // In cleaning state
          bedType: 'REGULAR',
        },
      });
      testBedId = b.id;
    });

    it('creates a terminal cleaning task for a bed in CLEANING state', async () => {
      const res = await request(app)
        .post('/api/v1/housekeeping/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          locationRef: testBedId,
          locationType: 'BED',
          taskType: 'TERMINAL',
          priority: 'HIGH',
          branchId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REQUESTED');
      taskId = res.body.data.id;
    });

    it('starts cleaning task (moves to IN_PROGRESS)', async () => {
      const res = await request(app)
        .patch(`/api/v1/housekeeping/tasks/${taskId}/start`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });

    it('completes cleaning task and AUTOMATICALLY RESTORES BED STATUS to AVAILABLE', async () => {
      const res = await request(app)
        .patch(`/api/v1/housekeeping/tasks/${taskId}/complete`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.bedStatusUpdated).toBe(true);

      // Verify database bed status updated to AVAILABLE
      const bed = await prisma.bed.findUnique({ where: { id: testBedId } });
      expect(bed?.status).toBe('AVAILABLE');
    });

    it('verifies housekeeping task hygiene QA', async () => {
      const res = await request(app)
        .patch(`/api/v1/housekeeping/tasks/${taskId}/verify`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VERIFIED');
    });
  });

  // =========================================================================
  // 8. AMBULANCE FLEET & EMS DISPATCH WORKFLOW
  // =========================================================================
  describe('8. Ambulance Fleet Management, Trip Dispatch & Status Lifecycle', () => {
    let ambulanceId: string;
    let tripId: string;

    it('registers an Advanced Life Support (ALS) ambulance vehicle', async () => {
      const res = await request(app)
        .post('/api/v1/ambulance/ambulances')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleNumber: `AMB-ALS-${Date.now().toString().slice(-4)}`,
          vehicleType: 'ALS',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('AVAILABLE');
      ambulanceId = res.body.data.id;
    });

    it('dispatches ambulance on an emergency transit mission', async () => {
      const res = await request(app)
        .post('/api/v1/ambulance/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ambulanceId,
          patientId,
          pickupLocation: 'Scene: Inter-state Highway Marker 14',
          destination: 'Emergency Trauma Pavilion',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DISPATCHED');
      tripId = res.body.data.id;

      // Verify ambulance vehicle status transitioned to DISPATCHED
      const amb = await prisma.ambulance.findUnique({ where: { id: ambulanceId } });
      expect(amb?.status).toBe('DISPATCHED');
    });

    it('updates trip transit states: EN_ROUTE -> ARRIVED', async () => {
      const resEnRoute = await request(app)
        .patch(`/api/v1/ambulance/trips/${tripId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'EN_ROUTE' });
      expect(resEnRoute.status).toBe(200);
      expect(resEnRoute.body.data.status).toBe('EN_ROUTE');

      const resArrived = await request(app)
        .patch(`/api/v1/ambulance/trips/${tripId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'ARRIVED' });
      expect(resArrived.status).toBe(200);
      expect(resArrived.body.data.status).toBe('ARRIVED');
    });

    it('completes trip and AUTOMATICALLY RESTORES AMBULANCE to AVAILABLE', async () => {
      const res = await request(app)
        .patch(`/api/v1/ambulance/trips/${tripId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.completionTime).toBeDefined();

      // Verify ambulance vehicle is back in AVAILABLE status
      const amb = await prisma.ambulance.findUnique({ where: { id: ambulanceId } });
      expect(amb?.status).toBe('AVAILABLE');
    });
  });

  // =========================================================================
  // 9. SECTION 9 CLINICAL JOURNEY: ER-TO-IPD ADMISSION
  // =========================================================================
  describe('9. Section 9 End-to-End Journey: ER-to-IPD Admission', () => {
    let erPatientId: string;
    let erEncounterId: string;
    let erBedId: string;
    let ipdAdmissionId: string;

    it('step 1: fast emergency registration & triage assessment', async () => {
      // Fast register patient
      const ptRes = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          hospitalId,
          firstName: 'Robert',
          lastName: 'Morrow',
          gender: 'MALE',
          dateOfBirth: '1968-09-30',
          mobile: '+15554329988',
        });
      expect(ptRes.status).toBe(201);
      erPatientId = ptRes.body.data.id;

      // Record ER Triage (ESI Level 2) and start emergency encounter
      const triageRes = await request(app)
        .post('/api/v1/emergency/triage')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: erPatientId,
          priority: 'ORANGE',
          chiefComplaint: 'Acute chest pain radiating to left jaw',
          vitals: { heartRate: 110, systolic: 165, diastolic: 95, oxygenSaturation: 95, respiratoryRate: 24 },
          isMlc: false,
        });
      expect(triageRes.status).toBe(201);
      erEncounterId = triageRes.body.data.encounterId;
      expect(erEncounterId).toBeDefined();
    });

    it('step 2: ER physician decides ADMIT disposition', async () => {
      const dispRes = await request(app)
        .post(`/api/v1/emergency/encounters/${erEncounterId}/disposition`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          disposition: 'ADMIT',
          notes: 'Acute Coronary Syndrome, requires immediate telemetry bed',
        });

      expect(dispRes.status).toBe(200);
      expect(dispRes.body.data.disposition).toBe('ADMIT');
    });

    it('step 3: triggers IPD admission request & allocates bed', async () => {
      // Setup bed for admission
      const bed = await prisma.bed.create({
        data: {
          ward: {
            create: {
              tenantId,
              branchId,
              name: 'Coronary Care Unit',
              code: `CCU-${Date.now().toString().slice(-4)}`,
              wardType: 'ICU',
              capacity: 10,
            },
          },
          bedNumber: `CCU-BED-${Date.now().toString().slice(-4)}`,
          status: 'AVAILABLE',
          bedType: 'ICU',
        },
      });
      erBedId = bed.id;

      // Create IPD admission from Emergency source
      const admRes = await request(app)
        .post('/api/v1/ipd/admissions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: erPatientId,
          encounterId: erEncounterId,
          admissionType: 'EMERGENCY',
          admissionSource: 'EMERGENCY',
          reason: 'Acute Coronary Syndrome transferred from ER',
          bedId: erBedId,
        });

      expect(admRes.status).toBe(201);
      expect(admRes.body.data.admissionSource).toBe('EMERGENCY');
      expect(admRes.body.data.status).toBe('ADMITTED');
      ipdAdmissionId = admRes.body.data.id;

      // Verify bed is allocated and OCCUPIED
      const bedCheck = await prisma.bed.findUnique({ where: { id: erBedId } });
      expect(bedCheck?.status).toBe('OCCUPIED');
    });
  });

  // =========================================================================
  // 10. SECTION 9 CLINICAL JOURNEY: INPATIENT DISCHARGE
  // =========================================================================
  describe('10. Section 9 End-to-End Journey: IPD Inpatient Discharge', () => {
    let dcPatientId: string;
    let dcWardId: string;
    let dcBedId: string;
    let dcAdmissionId: string;

    it('step 1: admits patient into ward bed', async () => {
      const pt = await prisma.patient.create({
        data: {
          tenantId,
          hospitalId,
          mrn: `MRN-DC-${Date.now()}`,
          firstName: 'Margaret',
          lastName: 'Thatcher',
          dateOfBirth: new Date('1980-03-15'),
          gender: 'FEMALE',
          mobile: '5559991111',
        },
      });
      dcPatientId = pt.id;

      const b = await prisma.bed.create({
        data: {
          ward: {
            create: {
              tenantId,
              branchId,
              name: 'Surgical Recovery Ward',
              code: `SRW-${Date.now().toString().slice(-4)}`,
              wardType: 'GENERAL',
              capacity: 20,
            },
          },
          bedNumber: `SRW-BED-${Date.now().toString().slice(-4)}`,
          status: 'AVAILABLE',
          bedType: 'REGULAR',
        },
      });
      dcBedId = b.id;

      const admRes = await request(app)
        .post('/api/v1/ipd/admissions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: dcPatientId,
          admissionType: 'PLANNED',
          admissionSource: 'DIRECT',
          bedId: dcBedId,
          reason: 'Post-op observation',
        });

      expect(admRes.status).toBe(201);
      dcAdmissionId = admRes.body.data.id;

      const bed = await prisma.bed.findUnique({ where: { id: dcBedId } });
      expect(bed?.status).toBe('OCCUPIED');
    });

    it('step 2: completes nursing, MAR, and physician rounds', async () => {
      // Nursing
      await request(app)
        .post(`/api/v1/ipd/admissions/${dcAdmissionId}/nursing-assessments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ generalCondition: 'STABLE', painScore: 0 });

      // Round note
      await request(app)
        .post(`/api/v1/ipd/admissions/${dcAdmissionId}/rounds`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          clinicalStatus: 'IMPROVING',
          progressNote: 'Vitals stable throughout stay, incisions dry, approved for discharge home.',
        });
    });

    it('step 3: creates discharge summary and verifies billing clearance', async () => {
      const sumRes = await request(app)
        .post(`/api/v1/ipd/admissions/${dcAdmissionId}/discharge-summary`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          finalDiagnosis: 'Uncomplicated recovery',
          hospitalCourse: 'Uneventful post-operative observation, ambulatory and eating well.',
          dischargeCondition: 'RECOVERED',
        });
      expect([200, 201]).toContain(sumRes.status);

      const clearRes = await request(app)
        .get(`/api/v1/ipd/admissions/${dcAdmissionId}/billing-clearance`)
        .set('Authorization', `Bearer ${token}`);
      expect(clearRes.status).toBe(200);
      expect(clearRes.body.data.cleared).toBe(true);
    });

    it('step 4: executes discharge, frees bed to CLEANING, and generates Housekeeping task', async () => {
      const dcRes = await request(app)
        .post(`/api/v1/ipd/admissions/${dcAdmissionId}/discharge`)
        .set('Authorization', `Bearer ${token}`);

      expect(dcRes.status).toBe(200);
      expect(dcRes.body.success).toBe(true);
      expect(dcRes.body.data.housekeepingTriggered).toBe(true);

      // Verify admission status is DISCHARGED
      const adm = await prisma.admission.findUnique({ where: { id: dcAdmissionId } });
      expect(adm?.status).toBe('DISCHARGED');
      expect(adm?.actualDischargeDate).toBeDefined();

      // Verify bed is released and marked CLEANING
      const bed = await prisma.bed.findUnique({ where: { id: dcBedId } });
      expect(bed?.status).toBe('CLEANING');

      // Verify Housekeeping terminal clean task was automatically generated
      const hkTask = await prisma.housekeepingTask.findFirst({
        where: { locationRef: dcBedId, taskType: 'TERMINAL' },
      });
      expect(hkTask).toBeDefined();
      expect(hkTask?.status).toBe('REQUESTED');

      // Step 5: Housekeeping completes the clean -> bed returns to AVAILABLE
      await request(app)
        .patch(`/api/v1/housekeeping/tasks/${hkTask!.id}/complete`)
        .set('Authorization', `Bearer ${token}`);

      const restoredBed = await prisma.bed.findUnique({ where: { id: dcBedId } });
      expect(restoredBed?.status).toBe('AVAILABLE');
    });
  });

  // =========================================================================
  // 11. ENTITLEMENT MATRIX FOR WORKSTREAM G (8 MODULES)
  // =========================================================================
  describe('11. Entitlement Matrix Enforcement for Workstream G Modules', () => {
    const wsGModules = [
      { id: 'ipd', endpoint: '/api/v1/ipd/wards' },
      { id: 'icu', endpoint: '/api/v1/icu/flowsheets' },
      { id: 'ot', endpoint: '/api/v1/ot/theatres' },
      { id: 'bloodbank', endpoint: '/api/v1/bloodbank/donors' },
      { id: 'cssd', endpoint: '/api/v1/cssd/cycles' },
      { id: 'dietary', endpoint: '/api/v1/dietary/diet-types' },
      { id: 'housekeeping', endpoint: '/api/v1/housekeeping/tasks' },
      { id: 'ambulance', endpoint: '/api/v1/ambulance/ambulances' },
    ];

    for (const mod of wsGModules) {
      it(`blocks access to ${mod.id} with 404 MODULE_NOT_ENABLED when disabled`, async () => {
        // If testing ipd, temporarily disable dependents (icu, dietary) so resolver does not pull ipd back in
        if (mod.id === 'ipd') {
          await prisma.tenantEntitlement.updateMany({
            where: { tenantId, moduleId: { in: ['icu', 'dietary'] } },
            data: { enabled: false },
          });
        }

        // Disable module in entitlements
        await prisma.tenantEntitlement.upsert({
          where: { tenantId_moduleId: { tenantId, moduleId: mod.id } },
          update: { enabled: false },
          create: { tenantId, moduleId: mod.id, enabled: false },
        });
        clearEntitlementsCache(tenantId);

        const res = await request(app)
          .get(mod.endpoint)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error?.code).toBe('MODULE_NOT_ENABLED');

        // Re-enable module
        await prisma.tenantEntitlement.upsert({
          where: { tenantId_moduleId: { tenantId, moduleId: mod.id } },
          update: { enabled: true },
          create: { tenantId, moduleId: mod.id, enabled: true },
        });
        if (mod.id === 'ipd') {
          await prisma.tenantEntitlement.updateMany({
            where: { tenantId, moduleId: { in: ['icu', 'dietary'] } },
            data: { enabled: true },
          });
        }
        clearEntitlementsCache(tenantId);

        const resRestored = await request(app)
          .get(mod.endpoint)
          .set('Authorization', `Bearer ${token}`);

        expect(resRestored.status).toBe(200);
      });
    }
  });
});
