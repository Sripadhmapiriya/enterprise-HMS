# Enterprise HMS - Comprehensive Testing & Verification Guide

This document describes the test architecture, test execution procedures, entitlement matrix testing, and end-to-end clinical journey specifications for the Enterprise Hospital Management System.

---

## 1. Test Architecture Overview

The system is tested using **Vitest** in a hermetic, automated multi-tenant environment. Tests are structured into 17 focused test suites covering foundation security, tenant isolation, clinical modules, business operations, and edition builds:

```
tests/
├── baseline.test.ts                  # Workspace structure, build integrity & TypeScript checks
├── tenancy.test.ts                   # Multi-tenant isolation at Prisma extension and RLS layer
├── auth.test.ts                      # Argon2id password hashing, JWT rotation, lockout, RBAC
├── entitlements.test.ts              # Route-level module entitlement gating (404 MODULE_NOT_ENABLED)
├── shell-a11y.test.ts                # App shell, dynamic navigation, accessibility, and terminology checks
├── modules.test.ts                   # Module manifest catalog, DAG resolution, and cycle detection
├── patients.test.ts                  # Patient registration, MRN generation, and Patient 360 view
├── scheduling.test.ts                # Doctor appointment slots, bookings, and queue management
├── opd.test.ts                       # Clinical consultation, diagnosis, and e-prescriptions
├── pharmacy-er.test.ts               # ER triage assessment, FEFO batching, dispensing, and inventory stock
├── billing-diagnostics.test.ts       # Tariffs, cashier shifts, lab worklists, radiology, claims & Journeys A-C
├── inpatient-operations.test.ts      # IPD bed board, MAR, ICU flowsheets, OT WHO checklist, blood bank & Journeys
├── business-operations.test.ts       # Procurement, HR rosters/payroll, double-entry finance, CMMS, CRM & Journey
├── platform-and-integrations.test.ts # Worker, storage, notifications, CSV import, PDFs, ABDM, FHIR, HL7, LIS
├── licensing-provisioning.test.ts    # Ed25519 asymmetric signatures, license issue, and tenant provisioning CLI
├── edition-build.test.ts             # Physical route pruning and validation across all 6 edition presets
└── ui.test.ts                        # Design system tokens, clinical badges, and component specifications
```

---

## 2. Test Execution Commands

### Running All Automated Tests
```bash
# Run the complete test harness (all 17 test suites)
npm run test
```

### Running Specific Test Domains
```bash
# Run foundation, auth, and tenant isolation tests
npx vitest run tests/auth.test.ts tests/tenancy.test.ts tests/entitlements.test.ts

# Run inpatient and emergency clinical suites
npx vitest run tests/inpatient-operations.test.ts tests/pharmacy-er.test.ts

# Run platform services and external integration simulators
npx vitest run tests/platform-and-integrations.test.ts

# Run edition build and preset matrix verification
npx vitest run tests/edition-build.test.ts tests/licensing-provisioning.test.ts
```

### Running Full Monorepo Verification
```bash
# Executes TypeScript typechecking, test harness, and integrity scans
npm run verify
```

---

## 3. Entitlement Matrix Enforcement

A core tenet of the modular architecture is that **a hospital client only receives the modules they subscribe to**. When a module is disabled:
1. **API Endpoints**: Return `404 Not Found` with error code `MODULE_NOT_ENABLED` (hiding the endpoint's existence from unauthorized tenants).
2. **App Shell Navigation**: Sidebar and command palette filter out navigation items associated with disabled capabilities.
3. **Frontend Routing**: Web routes for disabled modules either redirect or are physically pruned during edition builds.
4. **Dependency Safety**: The `ModuleResolver` rejects disabling any module that active modules depend upon (e.g. disabling `inventory` while `pharmacy` is active is blocked).

The entitlement matrix is continuously re-verified across all 25 modules in `tests/entitlements.test.ts`, `tests/business-operations.test.ts`, and `tests/inpatient-operations.test.ts`.

---

## 4. End-to-End Clinical & Operational Journeys

The test suite validates realistic cross-module operational lifecycles from start to finish:

### Journey 1: Outpatient Intake to Cash Clearance
*File: `tests/billing-diagnostics.test.ts`*
1. **Registration**: Patient enrolled with demographic verification and MRN generation.
2. **Appointment**: Consultation booked and assigned to doctor queue.
3. **Consultation**: Doctor records clinical notes, ICD-10 diagnosis, and electronic prescription.
4. **Dispense**: Pharmacy dispenses prescription with FEFO batch deduction.
5. **Billing**: Invoice generated from captured charges.
6. **Settlement**: Cashier collects payment, shifts update, and PDF receipt is issued.

### Journey 2: Diagnostic Investigation & Critical Flagging
*File: `tests/billing-diagnostics.test.ts`*
1. **Order**: Lab test ordered during consultation.
2. **Accessioning**: Specimen collected with barcode labeling.
3. **Analysis**: Results recorded from automated analyzer feed.
4. **Verification**: Critical result triggers threshold alert (`CRITICAL_ALERT_TRIGGERED`).
5. **Sign-off**: Pathologist signs report, PDF is generated and linked to Patient 360.

### Journey 3: Emergency Admission to Inpatient Bed
*File: `tests/inpatient-operations.test.ts`*
1. **Emergency Intake**: Fast-track ER registration.
2. **Triage**: Triage nurse assigns Emergency Severity Index (ESI) level and records vitals.
3. **Physician Evaluation**: Emergency physician issues `ADMIT` disposition.
4. **Bed Allocation**: IPD admission created, ward bed assigned, and bed state moves to `OCCUPIED`.

### Journey 4: Inpatient Discharge & Housekeeping Cycle
*File: `tests/inpatient-operations.test.ts`*
1. **Care Delivery**: Nursing shift assessments, vitals, MAR administrations, and doctor rounds.
2. **Discharge Planning**: Physician completes clinical discharge summary.
3. **Financial Clearance**: Billing clearance verified across open charges.
4. **Bed Turnover**: Patient discharged, bed state transitions to `CLEANING`.
5. **Housekeeping**: Terminal cleaning work order dispatched and executed, automatically restoring bed state to `AVAILABLE`.

### Journey 5: Procurement to Pharmacy Stock Restocking
*File: `tests/business-operations.test.ts`*
1. **Requisition**: Ward pharmacist submits purchase requisition for depleted medication.
2. **Purchase Order**: Procurement officer issues approved PO to verified vendor.
3. **Goods Receipt**: Warehouse inspects shipment and creates Goods Received Note (GRN).
4. **Stock Update**: System automatically creates `InventoryBatch` records and appends audit transaction to `InventoryLedger`.

---

## 5. Automated Integrity Checks

The `scripts/verify-integrity.ts` runner performs automated static and boundary scans:

| Check Name | Target | Acceptance Criteria |
|---|---|---|
| `check:no-phase` | All source, schemas, seeds, docs | Strictly zero occurrences of `\bPhase\s*\d` |
| `check:no-direct-prisma-in-web` | `apps/web/src` | Strictly zero direct imports of `@prisma/client` |
| `check:placeholders` | `apps/web/src`, `apps/api/src` | Zero occurrences of "Pending", "coming soon", "module active" |
| `check:no-committed-secrets` | Git tracking index | No `.env` or sensitive credential files tracked in version control |

---

## 6. Client Edition Matrix Verification

The edition build engine (`scripts/build-edition.ts`) validates that physical bundle pruning correctly partitions source code per edition preset:

```bash
# Verify edition pruning and manifest generation across all 6 presets
npx vitest run tests/edition-build.test.ts
```

| Preset | Enabled Capabilities | Pruned Routes |
|---|---|---|
| `patients-only` | Patients, demographics | Pharmacy, IPD, Billing, ER, Labs, etc. |
| `pharmacy-er` | Pharmacy, ER, Inventory, Patients | IPD, Billing, Lab, Radiology, OT, etc. |
| `opd-clinic` | OPD, Scheduling, Billing, Patients | IPD, ER, OT, Blood Bank, ICU, etc. |
| `diagnostic-centre` | Laboratory, Radiology, Billing, Patients | Inpatient, Surgery, Emergency, etc. |
| `hospital-standard` | OPD, IPD, ER, Lab, Radiology, Pharmacy | HR, Finance, Assets, CRM, etc. |
| `full-enterprise` | All 25 clinical and operational modules | None (Full enterprise package) |
