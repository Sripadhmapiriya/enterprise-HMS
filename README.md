# Enterprise HMS

A production-grade, modular, multi-tenant Hospital Management System (HMS) built for high-density clinical and administrative workflows. The platform features an extensible module registry, dynamic RBAC entitlements, Ed25519-signed licensing, tenant-isolated persistence, and edition build tools to ship bespoke client packaging (such as *Hospital A: Patients Only* or *Hospital B: Pharmacy & Emergency Only*).

---

## 1. System Architecture

The repository is structured as a high-performance TypeScript monorepo with 8 dedicated workspaces:

```
enterprise-HMS/
├── apps/
│   ├── api/                 Hardened Express REST API with tenant isolation, auth, and modular routers
│   ├── web/                 Next.js 16 (App Router + Turbopack) clinical app shell & responsive dashboards
│   └── worker/              BullMQ background job runner (with in-memory simulator fallback)
├── packages/
│   ├── modules/             Module registry, dependency resolver (DAG), manifests & edition presets
│   ├── database/            Prisma ORM schema (136 models), migrations, seed scripts & tenancy extensions
│   ├── types/               Shared Zod validation schemas and TypeScript domain types
│   ├── ui/                  Accessible design system, tokens, Clinical Status badges & data tables
│   └── config/              Environment configuration and schema validators
├── presets/                 JSON edition presets for client distribution
├── scripts/                 Provisioning CLI, license generator, edition builder, integrity verification
└── docs/                    Architecture, module catalog, client onboarding, runbooks, and API specs
```

---

## 2. Core Modules & Edition Presets

### The 25 Clinical & Operational Modules
The platform is organized into 25 independent modules gated through runtime entitlements:
- **Core Clinical**: `patients`, `scheduling`, `opd`, `emergency`, `ipd`, `icu`, `ot`
- **Diagnostics**: `laboratory`, `radiology`, `bloodbank`
- **Pharmacy & Supply Chain**: `pharmacy`, `inventory`, `procurement`
- **Revenue Cycle Management**: `billing`, `insurance`, `finance`
- **Operations & Facility**: `cssd`, `dietary`, `housekeeping`, `ambulance`, `assets`
- **Workforce & Engagement**: `hr`, `crm`
- **Enterprise Platform**: `analytics`, `integrations`, `enterprise`

### Shipped Edition Presets
Pre-packaged client tiers are defined in `packages/modules/src/presets.ts`:
1. `patients-only`: Minimalist patient registry and demographics engine (auto-enables `foundation`).
2. `pharmacy-er`: High-velocity emergency triage, stock dispensing, FEFO batching, and inventory management.
3. `opd-clinic`: Outpatient registration, doctor queue, consultation charting, and cashier billing.
4. `diagnostic-centre`: Complete diagnostic laboratory worklists, imaging templates, and PACS integration.
5. `hospital-standard`: Comprehensive general hospital operations (IPD, OPD, ER, Lab, Pharmacy, Billing).
6. `full-enterprise`: Unrestricted hospital network platform across all 25 modules and multi-site telemetry.

---

## 3. Technology Stack

- **Runtime & Language**: Node.js 20+, TypeScript 5.x
- **Frontend**: Next.js 16.3.8 (Turbopack, React 19, Tailwind CSS)
- **API Server**: Express 4.x with custom tenant-scoping middleware, Argon2id auth, and Zod validation
- **Background Worker**: BullMQ + Redis queue adapter (with built-in `InMemoryWorkerSimulator`)
- **Database & Isolation**: PostgreSQL with Prisma ORM client extensions enforcing tenant boundary isolation
- **Document & Print Engine**: PDFKit vector rendering for invoices, receipts, prescriptions, wristbands, and barcode labels
- **Interoperability**: ABDM (M1/M2/M3 Sandbox), HL7 FHIR R4, HL7 v2 ADT, and ASTM analyzer simulators
- **Testing & Verification**: Vitest test harness (235+ tests) with full entitlement and edition matrix testing

---

## 4. Getting Started

### Prerequisites
- Node.js 20.x or higher
- PostgreSQL 15+ (or Docker)
- Redis 7+ (optional, fallback simulator included)

### 1. Installation
```bash
git clone https://github.com/atriowings/enterprise-HMS.git
cd enterprise-HMS
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Configure DATABASE_URL and JWT_SECRET as needed
```

### 3. Database Initialization
```bash
# Push schema and apply initial migrations
npm run db:push --workspace=@enterprise-hms/database

# Seed baseline organization, admin credentials, and clinical demo data
npm run db:seed --workspace=@enterprise-hms/database
```

### 4. Running the Development Stack
```bash
# Run all workspaces concurrently
npm run dev

# Or run individual applications
npm run dev --workspace=@enterprise-hms/api    # Port 4000
npm run dev --workspace=web                    # Port 3000
npm run dev --workspace=worker                 # Background job processing
```

---

## 5. Client Provisioning & Edition Builds

### Provision a New Hospital Client
Use the automated provisioning CLI to register an organization, issue an Ed25519-signed license, seed default branches and admin users, and activate specific module sets:

```bash
# Provision Hospital A (Patients Only)
npm run provision -- --code HOSP-A --name "St. Jude Clinic" --preset patients-only --admin admin@stjude.org

# Provision Hospital B (Pharmacy + ER)
npm run provision -- --code HOSP-B --name "City Trauma Center" --preset pharmacy-er --admin admin@cityer.org
```

### Physical Edition Pruning
To create a stripped client bundle where disabled module routes are physically pruned from disk:

```bash
# Build the pharmacy-er edition
npm run build:edition -- --preset pharmacy-er

# Restore workspace to full multi-module tree
npm run build:edition -- --restore
```

---

## 6. Testing & Quality Verification

Run the comprehensive monorepo verification pipeline:

```bash
# Run full verification (TypeScript typecheck + Vitest test harness + Integrity scans)
npm run verify

# Run automated test suites only
npm run test

# Run integrity checks (zero Phase labels, zero direct Prisma in web, zero placeholders, no committed secrets)
npm run check:integrity
```

---

## 7. License & Compliance
This software is proprietary and confidential. Licensed exclusively for deployment under authorized enterprise agreements.
