# Monorepo Hardcode Audit: Comprehensive Catalog & Elimination Plan

## 1. Frontend Audit (`apps/web`)

### Hardcoded KPIs, Metrics, and Trends
- `apps/web/src/app/(dashboard)/dashboard/page.tsx`:
  - Initial metrics state hardcoded: `activePersonnel: 24`, `hospitalBranches: 2`, `clinicalUnits: 12`, `activeRoles: 6`, `opdIntake: 142`, `bedOccupancy: 86`, `diagnosticsTat: '38m'`, `dispensesToday: 312`.
  - Static strings: `"98.4% on time"`, `"100% online"`, `"Audited"`, `"Average: 42 visits/hr"`, `"+2.5%"`.
  - Fake peak load hours distribution array: `[30, 45, 75, 95, 88, 92, 70, 85, 60, 40, 25, 20]`.
  - Fake recent audit activity feed array (`recentAudit`) with 5 hardcoded objects.
- `apps/web/src/app/(dashboard)/ipd/nursing/page.tsx`:
  - Previously had static wards list (already converted to dynamic extraction from active admissions).
- `apps/web/src/components/AppShell.tsx`:
  - Hardcoded fallback branch display name: `'City General Hospital - Main Branch'` in `allowedBranches` and `selectedBranch` initial state.
  - Hardcoded sample clinical alerts in notifications dropdown: `"Critical Lab Value: MRN-2024-0012"`, `"Serum Potassium 6.2 mEq/L"`, `"ICU Bed #4 sanitized"`, `"Pharmacy Shift Closing"`.

### Hardcoded Fallback Identifiers & Mock Arrays
- `apps/web/src/app/(dashboard)/appointments/page.tsx`:
  - Default form state with hardcoded IDs: `doctorId: 'doc-default'`, `departmentId: 'dept-opd'`, `branchId: 'branch-default'`.
- `apps/web/src/app/(dashboard)/patients/[id]/page.tsx`:
  - `MOCK_DOCTORS` array with fake IDs `'doc-123'`, `'doc-456'`, `'doc-789'`.
  - Fallback IDs in consultation start: `patient.branchId || 'branch-default'`, `patient.departmentId || 'dept-opd'`.
- `apps/web/src/app/(dashboard)/operations/blood-bank/page.tsx`:
  - Hardcoded dummy donor form values: `mobile: '9876543210'`, `dateOfBirth: '1995-01-01'`.
  - Hardcoded crossmatch patient group: `checkPatientGroup: 'A+'`.

### Clinical Safety Violations
- `apps/web/src/app/(dashboard)/opd/consultation/[id]/page.tsx`:
  - Hardcoded default vitals (`temperature: 98.6`, `pulse: 76`) filled into blank readings (fixed in previous step, verified).

### Math.random() in Frontend UI
- `apps/web/src/app/(dashboard)/pharmacy/page.tsx`: `Math.random().toString()` in local `addToast`.
- `apps/web/src/app/(dashboard)/pharmacy/prescriptions/page.tsx`: `Math.random().toString()` in local `addToast`.
- `apps/web/src/app/(dashboard)/ipd/chart/[id]/page.tsx`: `Math.random().toString(36)` in local toast.
- `apps/web/src/app/(dashboard)/patients/[id]/page.tsx`: `Math.random().toString(36)` in local toast.
- `apps/web/src/app/(dashboard)/integrations/page.tsx`: `Math.random()` for test payment IDs and signatures.

---

## 2. Backend Audit (`apps/api`)

### Invented Constants and Formulas in Analytics
- `apps/api/src/routes/analytics.ts`:
  - Hardcoded ALOS benchmark fallback: `let alosDays = 4.2`.
  - Hardcoded clinical rates: `mortalityRatePercent: 0.0, infectionRatePercent: 0.4`.
  - Hardcoded department encounters and revenue arithmetic: `patientCount: 15 + idx * 8, revenue: (15 + idx * 8) * 120`.
  - Hardcoded top prescribed medications: `Amoxicillin 500mg (142)`, `Paracetamol 650mg (289)`, `Pantoprazole 40mg (198)`, `Metformin 500mg (114)`, `Atorvastatin 10mg (87)`.
  - Hardcoded top lab investigations: `CBC (210)`, `LFT (125)`, `KFT (118)`, `HbA1c (94)`, `Serum Electrolytes (88)`.
  - Hardcoded turnaround times: `averageOpdWaitMinutes: 18, averageErTriageMinutes: 6, bedTurnaroundMinutes: 45, pharmacyDispenseMinutes: 8`.
  - Hardcoded sinusoidal mock formulas in `/trends`: `35 + Math.floor(Math.sin(i) * 10 + 5)`, `8 + Math.floor(Math.cos(i) * 3 + 2)`, etc.
  - Hardcoded summary in synchronous CSV export: `TotalAdmissions,42,BedOccupancyRate,78.5%,TotalRevenue,$145200`.

### Banned Fallback String Logic in Routes
- `apps/api/src/routes/scheduling.ts`:
  - Fallback checks accepting `branchId === 'branch-default'`.
  - Fallback checks accepting `doctorId === 'doc-default'`.
  - Fallback checks accepting `departmentId === 'dept-opd'`.

### Math.random() and Pseudo-Random Identifiers in Routes
- Multiple routes generate entities or references using `Math.random()` instead of cryptographic UUIDs or deterministic sequential generators:
  - `apps/api/src/services/notifications.ts`: `notif-Date.now()-Math.random()`
  - `apps/api/src/services/worker.ts`: `sim-job-Date.now()-Math.random()`
  - `apps/api/src/services/chargeCaptureService.ts`: `Math.random()`
  - `apps/api/src/routes/assets.ts`, `billing.ts`, `bloodbank.ts`, `cssd.ts`, `emergency.ts`, `finance.ts`, `hr.ts`, `insurance.ts`, `inventory.ts`, `ipd.ts`, `patients.ts`, `pharmacy.ts`, `procurement.ts`, `radiology.ts`, `laboratory.ts`.

---

## 3. Simulator Control Audit

- Currently, simulators (payment gateway, ABDM, worker queue, lab analyzer feeds) lack a unified `DEV_SIMULATORS=true` enforcement gate.
- Under production or standard development, local disk storage and in-process execution must be default without running external simulator mocks unless explicitly enabled via `DEV_SIMULATORS=true`.
- Simulators must display a visible "SIMULATED" badge in the UI.

---

## 4. Elimination & Replacement Strategy

1. **Dashboard & Analytics KPIs**: Refactor all endpoints in `apps/api/src/routes/analytics.ts` and `dashboard` to compute values exclusively from `req.prismaTenant` database aggregations (with honest zeros and empty states when no data exists).
2. **Remove Hardcoded IDs & Arrays**: Update `appointments/page.tsx`, `patients/[id]/page.tsx`, `blood-bank/page.tsx`, and `AppShell.tsx` to dynamically query database records (doctors, departments, branches, live notifications) and remove all fallback string literals.
3. **Deterministic Seeding (`seed:demo`)**: Rewrite `packages/database/seed.ts` to deterministically populate realistic data across all enabled modules over the prior 90 days.
4. **Simulator Gating**: Enforce `process.env.DEV_SIMULATORS === 'true'` flag with UI "SIMULATED" badge indicator.
5. **Automated Verification**: Implement `check:no-hardcoded-data` scanner and verify script integration.
