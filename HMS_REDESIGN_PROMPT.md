# Enterprise HMS: Redesign, Completion and Modular Delivery Prompt

**How to use:** open Claude Code in the repo root (the folder containing `apps/`, `packages/`, `.agents/`).
Either paste everything under the line "PROMPT STARTS HERE", or save this file in the repo and say:
*"Read HMS_REDESIGN_PROMPT.md fully and execute it. Work through the workstreams in order and keep docs/redesign/PROGRESS.md updated."*

Before you start, run `/skills` in Claude Code. If the skills in `.agents/skills/` are not listed, expose them with
`mkdir -p .claude && ln -s ../.agents/skills .claude/skills` (or copy the folder).

---

# PROMPT STARTS HERE

## 0. Mission

You are the principal engineer and designer taking this monorepo (`enterprise-HMS`) from a prototype to a **production-grade, modular, multi-tenant Hospital Management System** that I can sell to different hospitals, each getting **only the modules they pay for**.

Deliver:

1. A professional redesign of the whole UI using the installed design skills, tuned for a clinical, data-dense product.
2. Every feature a real HMS needs, built and wired end to end, not mocked.
3. A **module system** so that I can deliver, for example, *Hospital A: patients only* and *Hospital B: pharmacy + ER only*, with the other modules absent from the UI, API and (for edition builds) the shipped code.
4. Removal of every "Phase 1 / Phase 2 / …" label from code, UI, docs and comments.
5. A real automated test suite proving that everything works, including for each client preset.

## 1. Ground rules (non-negotiable)

- **Honesty over appearance.** Never claim something works unless you ran it and saw it pass. Paste real command output in the progress file. If something cannot be done or verified, write it to `docs/KNOWN_LIMITATIONS.md` instead of faking it.
- **No placeholders in shipped code.** No `TODO`, "coming soon", "Pending", "module active", `placeholder`, `demo-token`, hardcoded sample rows, dead buttons, or links to routes that do not exist. A module that is not finished is **not shipped**: gate it off with the module system.
- **Apply the `full-output-enforcement` skill.** Write complete files. Never truncate with "…rest of file".
- **Work in workstreams (section 11), in order.** Commit after each one with a clear message. `main` must always build.
- **Persist your state.** Maintain `docs/redesign/PROGRESS.md` (done / in progress / blocked / next, plus the latest verification output). Your context may reset, so re-read this file and `PROGRESS.md` at the start of every session.
- **Do not use the word "Phase"** in anything you write (code, UI, docs, commits). Use "workstream", "module" or "release".
- **Do not read or print `.env` values.** `.env` must not be committed. Provide `.env.example` only.
- Do not rewrite what is good. The Prisma schema (136 models, Encounter-centric) is the strongest asset here. **Refine it, do not discard it.**

## 2. Audit findings (verified by static review of the uploaded zip)

Treat `README.md`, `TESTING_GUIDE.md` and `docs/` as aspirational. They claim things the code does not contain. Re-verify each point below yourself in workstream A, then fix it.

**Backend (`apps/api`)**
- Only 16 small route files (about 330 lines in total) exist: auth, tenants, hospitals, branches, departments, users, roles, permissions, staff, doctors, settings, audit, patients, appointments, queues, encounters. Most are 10-line `findMany` stubs.
- **No API exists** for IPD, ER, OT, ICU, lab, radiology, pharmacy, inventory, procurement, billing, insurance, blood bank, CSSD, dietary, housekeeping, ambulance, HR, finance, assets, CRM, analytics or integrations, although the schema models most of them.
- `POST /auth/login` returns a hardcoded `demo-token`. There is no JWT verification, no auth middleware, no RBAC enforcement, no rate limiting.
- **No tenant scoping anywhere.** `GET /patients` returns every patient of every tenant. `POST /patients` does `prisma.patient.create({ data: req.body })` (mass assignment, no validation). Zod is a dependency but unused.
- `cors()` is wide open; errors are swallowed into generic 500s; no request IDs or logging.

**Frontend (`apps/web`)**
- 37 pages. **31 import Prisma directly in server components**, bypassing the API, auth and tenancy completely.
- Only one file contains any `use client`, `onClick` or form. The 53 `<button>` elements are essentially decorative: no create, edit, search, filter or submit works.
- 7 pages are placeholders: finance/ledger, operations/ambulance, housekeeping, cssd, icu, dietary, blood-bank (e.g. "Blood Bank module active. Pending donor data.").
- **14 sidebar links 404**: /analytics, /branches, /crm/communications, /crm/feedback, /departments, /encounters, /finance/assets, /finance/maintenance, /finance/payables, /hr/attendance, /hr/payroll, /integrations, /security, /settings. Three "+ New" links also 404: /patients/new, /billing/invoices/new, /ipd/admissions/new.
- No login page, no middleware, no session handling. The sidebar hardcodes "System Admin / Demo Tenant", and the Dashboard nav item is always `active`.
- Emoji used as icons. Sidebar groups carry labels like "Clinical (Phase 2)", "Billing & RCM (Phase 6)". 9 "Phase" strings in the web source, more in docs.

**Database (`packages/database`)**
- 136 models in 2,640 lines, but only **9 `@@index`** in total. `tenantId` appears on only some models, so isolation depends on parent joins.
- Uses `prisma db push`, with no committed migrations. Prisma `^5.10`.
- `Enterprise → Subscription → FeatureEntitlement` exists (good base for modules) but is not linked to `Tenant` and is unused.
- Seed (755 lines) creates one of most things, with demo password `password123`. No production-safe minimal seed.

**Repo and process**
- 0 tests, 0 CI, no Dockerfiles for the apps. `docker-compose.yml` only runs Postgres, although the docs describe Redis, BullMQ workers, tRPC and Playwright (none exist).
- `packages/ui` and `packages/types` are `export const placeholder = true`. README mentions `packages/config` (missing).
- Committed build output (`apps/api/dist`, `packages/database/dist`), duplicate compiled `.js` next to `.ts` (`routes/auth.js`, `routes/tenants.js`, `seed.js`, `src/index.js`, `next.config.js` and `.ts`), and a shipped `.env`.
- Version drift: README says Next 14; `package.json` has Next 16.x and React 19.x.

## 3. How to use the installed skills

Skills are in `.agents/skills/`. Read each `SKILL.md` before using it. Use the **real installed path** for scripts (the skill text may mention `CLAUDE_PLUGIN_ROOT/.claude/skills/`, but the files are under `.agents/skills/`).

**Important:** `design-taste-frontend` states it is for "landing pages, portfolios, and redesigns, not dashboards, data tables, or multi-step product UI". This product is a dense clinical application, so use the skills selectively:

| Use | For |
|---|---|
| `redesign-existing-projects` | Start with its audit checklist on the current UI; apply its "Fix Priority" order; keep functionality intact. |
| `ui-ux-pro-max` | Generate the design system: `python3 .agents/skills/ui-ux-pro-max/scripts/search.py "hospital management healthcare clinical dashboard" --design-system --persist -p "Enterprise HMS" --output-dir .` then read `design-system/enterprise-hms/MASTER.md`. Also use its `--domain ux`, `--domain chart` and `--stack nextjs` / `--stack shadcn` searches and its pre-delivery checklist. |
| `ui-styling` + `design-system` | shadcn/ui + Tailwind implementation, three-layer tokens (primitive → semantic → component), accessibility references. |
| `design-taste-frontend`, `minimalist-ui` | Anti-generic guardrails. Set dials explicitly: **DESIGN_VARIANCE 2, MOTION_INTENSITY 2, VISUAL_DENSITY 8** for the app. Use higher variance only for the login screen and any public landing surface. |
| `full-output-enforcement` | Always. |

**Do not use** (wrong fit for a clinical app): `gpt-taste` (GSAP scroll marketing), `image-to-code`, `imagegen-frontend-*` (need image generation), `industrial-brutalist-ui`, `stitch-design-taste`, `brand`, `brandkit`, `banner-design`, `slides`, and the logo/CIP parts of `design`. `high-end-visual-design` only for the login screen.

## 4. Target architecture

### 4.1 Monorepo layout

```
apps/
  api/                 Express + TypeScript, modular routers
  web/                 Next.js App Router
  worker/              background jobs (BullMQ)
packages/
  database/            Prisma schema (split per domain), migrations, seeds
  types/               Zod schemas + inferred TS types, shared by api and web
  ui/                  real design-system component library + tokens
  modules/             module registry, manifests, dependency resolver, presets
  config/              eslint/tsconfig/tailwind presets, env validation
  testing/             fixtures, factories, tenant harness, e2e helpers
presets/               *.json edition presets (see 4.3)
scripts/               provision, build-edition, issue-license, verify
```

- **The web app talks to the API only** (typed client generated from the shared Zod schemas / OpenAPI). Remove every direct `prisma` import from `apps/web`. Auth uses httpOnly cookies, with Next middleware redirecting unauthenticated users to `/login`.
- Remove committed `dist/`, duplicate compiled `.js`, the duplicate `next.config.js`, and any committed `.env`. Align all version claims in docs with `package.json`. Upgrade dependencies (Next, React, Prisma, etc.) to current supported releases and fix what breaks.

### 4.2 The module system (the core requirement)

Create `packages/modules` as the **single source of truth** for what exists. Each module declares a manifest:

```ts
interface ModuleManifest {
  id: string;                    // 'pharmacy'
  name: string;
  description: string;
  kind: 'foundation' | 'clinical' | 'diagnostic' | 'support' | 'business' | 'platform';
  requires: string[];            // HARD dependencies, auto-enabled by the resolver
  integratesWith: string[];      // OPTIONAL: features light up when both are enabled
  permissions: PermissionDef[];  // 'pharmacy.dispense.create' ...
  nav: NavItem[];                // sidebar entries (icon, label, route, permission)
  api: () => Router;             // mounted only when enabled
  web: { routes: string[] };     // route prefixes owned by this module
  events: { emits: string[]; handles: Record<string, Handler> };
  seeds: { minimal: SeedFn; demo: SeedFn };
  limits?: Record<string, number>; // e.g. maxBeds
}
```

Rules:
1. **Foundation (always on, not sellable alone as a "module"):** auth, users/roles/RBAC, organization (tenant, hospital, branch, department), audit log, settings, notifications, file storage, print/PDF engine, global search, module registry. Required by everything.
2. **Dependency resolution:** enabling a module auto-enables its `requires` chain. Disabling one that others require is rejected with a clear message. Detect cycles at startup.
3. **Loose coupling through ports and events**, never direct imports between modules. Define ports such as `ChargeCapturePort`, `OrderingPort`, `ResultsPort`, `NotificationPort`, `PatientLookupPort`. When an optional counterpart is absent, the port degrades gracefully. Example: pharmacy without billing records dispensing and offers its own POS receipt; with billing enabled, it posts charges to the patient's bill. Use an in-process event bus plus an **outbox table** for reliability, with the worker handling async work.
4. All patient-linked modules depend on `patients` (the master patient index). This is what lets "pharmacy + ER only" work: the resolver adds `patients` automatically and the client simply never sees OPD, IPD, etc.

### 4.3 Module catalog (build all; each must be complete per section 6)

| id | Scope | requires |
|---|---|---|
| `patients` | Registration, master patient index, Patient 360, allergies/alerts, documents, consent, duplicates/merge, ID capture | foundation |
| `scheduling` | Appointments, doctor schedules/slots, OPD queue, token display, reminders | patients |
| `opd` | Consultation workspace, encounters, e-prescription, orders, follow-up, referrals, certificates | patients |
| `emergency` | Triage (ESI), tracking board, medico-legal flag, resuscitation record, disposition | patients |
| `ipd` | Admission/ADT, bed board, nursing, MAR, rounds, care plans, transfer, discharge summary | patients |
| `icu` | Flowsheets, severity scores, ventilator/infusion charting | ipd |
| `ot` | Theatre scheduling, WHO checklist, anaesthesia record, implants, post-op notes | patients |
| `laboratory` | Sample collection, worklist, result entry/validation, critical alerts, reports, QC | patients |
| `radiology` | Orders, worklist, reporting templates, PACS/DICOM viewer link | patients |
| `pharmacy` | Dispensing, walk-in POS, returns, narcotics register, substitution, interaction/allergy checks | patients, inventory |
| `inventory` | Stores, batches, FEFO, expiry/reorder alerts, indents, stock take, ledger | foundation |
| `procurement` | Requisition → PO → GRN → vendor invoices, approvals | inventory |
| `billing` | Charge master, tariffs, packages, deposits, invoices, payments, refunds, cashier shifts, GST/tax | patients |
| `insurance` | Payers/TPA, pre-authorization, claims, settlements, denials | billing |
| `bloodbank` | Donors, screening, components, crossmatch, issue, reaction reporting | patients |
| `cssd` | Instrument sets, sterilization cycles, issue/return tracking | foundation |
| `dietary` | Diet orders, meal service, kitchen worklist | ipd |
| `housekeeping` | Task board, bed turnaround, checklists | foundation |
| `ambulance` | Fleet, dispatch, trips, billing hook | foundation |
| `hr` | Employee master, credentials, attendance, leave, rosters, payroll | foundation |
| `finance` | Chart of accounts, journals, ledger, AP/AR, trial balance | foundation |
| `assets` | Asset register, maintenance (CMMS), calibration, AMC | foundation |
| `crm` | Feedback/complaints, communications, campaigns | patients |
| `analytics` | Role dashboards, MIS reports, report builder, scheduled exports | foundation |
| `integrations` | HL7/FHIR, ABDM, SMS/WhatsApp/email, payment gateways, analyzers, biometric | foundation |
| `enterprise` | Multi-hospital group admin, cross-site reporting, module manager | foundation |

**Presets** (`presets/*.json`), each with `{ id, name, modules: [...] }`:
`patients-only`, `pharmacy-er`, `opd-clinic`, `diagnostic-centre` (lab, radiology, billing), `hospital-standard`, `full-enterprise`. Presets are only starting points. The module list per client must be fully custom.

### 4.4 Enforcement: four layers, all tested

1. **API:** every module router is mounted behind `requireModule(id)`. A disabled module returns `404 MODULE_NOT_ENABLED` (404, not 403, so its existence is not leaked). Permission checks (`requirePermission`) sit inside.
2. **Web:** the sidebar, command palette, dashboard widgets and routes are built from `GET /me/capabilities` (enabled modules ∩ the user's permissions). Direct URL access to a disabled module renders the standard not-found page via a server-side guard.
3. **Edition build:** `npm run build:edition -- --preset pharmacy-er` (or `--modules pharmacy,emergency`) generates a manifest, prunes disabled module routes and API mounts, then builds. The output for that edition must **physically exclude** the other modules' routes and code. A test greps the build output and requests those URLs, expecting 404.
4. **Runtime entitlements per tenant** (multi-tenant SaaS mode): re-model `Subscription`/`FeatureEntitlement` so entitlements attach to **Tenant** (and optionally Hospital), with `moduleId`, `enabled`, `limits`, `validFrom/validTo`. Add a super-admin **Module Manager** screen and API to toggle modules per client, audited, with dependency checks and effect on next request (cache with short TTL and explicit invalidation).

### 4.5 Licensing and provisioning

- **License file:** an Ed25519-signed JSON/JWT containing `clientId`, `modules[]`, `limits` (users, beds, hospitals), `issuedAt`, `expiresAt`. The API verifies it at startup and periodically. Expired → clear banner and a grace period, then read-only for clinical safety (never block emergency access to existing records). The private key is never in the repo; `scripts/issue-license.ts` takes the key path as an argument.
- **Provisioning CLI:** `npm run provision -- --client "Hospital B" --preset pharmacy-er --admin-email ... ` creates tenant, hospital, branch, entitlements, role templates, the first admin (must change password on first login), and prints the license. It is idempotent.
- **Per-client customization without code forks:** branding (name, logo, brand colour via design tokens), locale/timezone/currency/tax profile, print templates (invoice, prescription, lab report, discharge summary), custom fields on patient registration, terminology labels, and workflow switches (e.g. require billing clearance before discharge). All stored as tenant settings and covered by tests.

## 5. Platform hardening (build in the foundation)

**Authentication and sessions**
- Real login. Hash with argon2id (migrate away from the ad-hoc scrypt in the seed).
- Short-lived access token plus rotating refresh token (hashed in `Session`), httpOnly + Secure + SameSite cookies, CSRF protection, idle timeout, session list and revoke.
- Rate limiting and account lockout, password policy, forced password change on first login, TOTP MFA (mandatory option per tenant), `SecurityEvent` logging for all auth events.

**Authorization**
- Permission codes `module.resource.action`. Seed role templates: Hospital Admin, Doctor, Nurse, Pharmacist, Lab Technician, Radiologist, Receptionist, Billing Clerk, Store Keeper, HR Manager, Auditor.
- Enforce on every endpoint and hide unauthorized controls in the UI. Support branch- and department-scoped access.
- **Break-glass** access for emergencies (reason required, time-boxed, heavily audited).

**Tenant isolation**
- Prisma client extension that injects `tenantId` (and `hospitalId` where scoped) into every query; reject writes without them. Add `tenantId` to all PHI tables so every row is directly scoped and indexable.
- Postgres Row-Level Security as defence in depth (`SET LOCAL app.tenant_id` per request).
- A generated test walks the whole route table with two tenants and proves no cross-tenant read, update or delete (expect 404).

**Audit and compliance**
- Audit every write and every PHI **read** (who, what, when, from where, reason where required). Immutable, append-only. Viewer with filters and export in the Security module.
- Soft-delete (never hard-delete) clinical and financial records; `createdBy/updatedBy/version` on clinical tables (optimistic concurrency).
- Consent capture, data export per patient, retention settings. Make the compliance layer configurable per locale (e.g. ABDM/ABHA and GST for India; the schema and nav already hint at this).

**API conventions**
- Zod validation on every input; no raw `req.body` into Prisma. Standard pagination, sort and filter. Error envelope `{ error: { code, message, details, requestId } }`. Helmet, CORS allowlist from env, body size limits. OpenAPI generated from the Zod schemas, with Swagger UI in non-production.

**Data layer**
- Switch to `prisma migrate` with committed migrations. Split the schema per domain (Prisma multi-file schema if the installed version supports it), and keep one database.
- Add composite indexes: `[tenantId, hospitalId, createdAt]` on all high-volume tables, plus lookup indexes (MRN, mobile, name search with trigram, encounter/patient FKs, invoice number, batch expiry). MRN, invoice and receipt numbers: per-branch sequences, unique and gap-safe where law requires. Money as `Decimal`. Store UTC, display in hospital timezone.
- Two seed modes: `seed:minimal` (roles, permissions, presets, first admin: safe for production) and `seed:demo` (realistic data **only for modules in the active preset**). Seeds must refuse to run in production without an explicit flag.

**Platform services**
- Worker app with BullMQ + Redis: reminders, notifications, report generation, outbox relay, scheduled exports.
- File storage via S3-compatible API (MinIO in dev) using presigned URLs; virus-scan hook; size/type limits.
- PDF/print engine with templates: invoice, receipt, prescription, lab report, radiology report, discharge summary, wristband and barcode labels.
- Notifications (in-app, email, SMS/WhatsApp via provider adapters), global search, CSV/Excel import for onboarding a new hospital (patients, items, tariffs, staff) with validation report, structured logging (pino + request IDs), `/health`, `/ready`, metrics endpoint.

## 6. Functional completeness: what "complete" means per module

Every module needs: list, search, filter, create, edit, detail view, status workflow, validation, permission checks, audit, empty/loading/error states, print/export where relevant, and tests. Audit the existing schema against these lists. Add missing models and fields, and delete nothing that is used.

- **patients:** quick vs full registration; duplicate detection (name+DOB+mobile) and merge; photo; ID proofs/ABHA; next of kin; allergies and alerts with a **persistent patient banner** (name, MRN, age/sex, allergies, alerts) on every clinical screen; documents; consent; timeline of all encounters.
- **scheduling:** doctor schedules, slot generation, overbooking rules, reschedule/cancel, walk-in, queue with token numbers, display-board screen, SMS/WhatsApp reminders, no-show tracking.
- **opd:** SOAP consultation, vitals, ICD-coded diagnosis, e-prescription with **drug-allergy and interaction checks**, templates, investigation orders, follow-up, referral, medical certificate, encounter close, printouts.
- **emergency:** triage with ESI levels and vitals, tracking board with timers, MLC flag, resuscitation record, orders, disposition (admit/discharge/transfer/LAMA/death), fast registration of unknown patients.
- **ipd:** admission request → bed allocation → ADT; bed board with housekeeping status; nursing assessment, vitals, intake/output, **MAR with administration check (right patient/drug/dose/time)**, doctor rounds, care plans, handover notes, transfers, discharge planning and summary, billing clearance.
- **icu:** flowsheet, scores (e.g. SOFA/APACHE), ventilator and infusion charting, alarms for critical ranges.
- **ot:** surgery request → scheduling with conflict detection → pre-op checklist → WHO safety checklist → anaesthesia record → implants → op notes → recovery.
- **laboratory:** order → sample collection with barcodes → worklist → result entry with reference ranges → technical validation → authorization → critical-value alert and acknowledgment → report PDF → TAT dashboard; QC; analyzer import hook.
- **radiology:** order → scheduling → performed → report with templates → verification → PACS/DICOM viewer link (Orthanc/OHIF integration point) → TAT.
- **pharmacy:** prescription queue, FEFO batch picking, dispense with label, substitution rules, partial dispense, returns, narcotics/controlled register, walk-in POS, stock alerts, daily closing.
- **inventory/procurement:** item master, batches, expiry, reorder levels, indents, issues, returns, stock take with variance, requisition → approval → PO → GRN → vendor invoice matching.
- **billing:** auto charge capture from clinical modules, packages and bundles, deposits and advances, interim and final bills, discount/waiver with approval, refunds and credit notes, multiple payment modes, cashier shift close, GST/tax, receipts and invoices as PDF, corporate and credit accounts, outstanding aging.
- **insurance:** payer and plan master, eligibility, pre-auth workflow, claim creation and submission tracking, settlement and short-payment/denial handling.
- **bloodbank, cssd, dietary, housekeeping, ambulance:** real workflows with status transitions, inventory/expiry where relevant, and the same CRUD and audit standards (no placeholders).
- **hr:** employee master, credentials with expiry alerts, attendance, leave, duty rosters, payroll run and payslips.
- **finance/assets:** chart of accounts, double-entry journals auto-posted from billing and procurement (when present), trial balance and P&L, AP/AR; asset register, preventive maintenance schedules, work orders, calibration.
- **crm, analytics, integrations, enterprise:** feedback workflow with SLA; role-based dashboards and an exportable MIS pack; FHIR/HL7 endpoints and ABDM adapter interfaces with credential management and a test console; multi-hospital switcher and group reporting.

If a capability needs an external service you cannot access, build the adapter interface plus a local simulator for tests, and list the live-service steps in `docs/KNOWN_LIMITATIONS.md`.

## 7. UI and UX redesign specification

- **Generate and follow the design system** from `ui-ux-pro-max` (section 3). Record the final choices as design tokens in `packages/ui` (primitive → semantic → component) and keep `design-system/enterprise-hms/MASTER.md` current.
- **Direction:** calm, high-legibility clinical UI. Neutral surfaces, one configurable brand hue, restrained motion. Light theme by default plus a dark theme. No gradients, glassmorphism, decorative animation or marketing-style hero sections inside the app.
- **Clinical semantics:** a defined token set for critical, warning, stable, info and neutral. Status is **never conveyed by colour alone** (icon + text). Tabular numerals for all clinical and financial numbers.
- **App shell:** collapsible sidebar generated from the module registry (grouped by kind, no "Phase" labels), top bar with hospital/branch switcher, global search / command palette (Ctrl+K), notification centre, user menu, breadcrumbs. Role-based home dashboards.
- **Components in `packages/ui` (real, documented, tested):** Button, Input and form fields (react-hook-form + Zod), Select/Combobox, DatePicker, DataTable (TanStack Table: sorting, filters, column visibility, virtualization, CSV export, saved views), Tabs, Dialog/Sheet, Toast, Badge/StatusPill, PatientBanner, Timeline, Stepper, Calendar/Scheduler, Chart wrappers, EmptyState, ErrorState, Skeleton, PermissionGate, PrintLayout.
- **Replace emoji icons** with an SVG icon set (Lucide or Phosphor).
- **Every view has** loading skeletons, empty state with a primary action, error state with retry, and success feedback. Destructive actions need confirmation. Long forms autosave drafts. Forms show inline validation.
- **Accessibility:** WCAG 2.2 AA, full keyboard navigation, visible focus, correct labels/ARIA, contrast checks, reduced-motion support. Layouts work from 1280px desktop down to tablet (bedside nursing and ward rounds) and degrade usably on mobile.
- **Print:** dedicated print stylesheets and PDF templates for clinical and financial documents.
- Login screen: professional and branded per tenant (logo and name from tenant settings); MFA step; password reset flow.

## 8. Remove every "Phase" reference

- Delete all "Phase N" labels from the UI (sidebar groups, headings such as "Diagnostics & Investigations (Phase 4)", dashboard text), code comments, seed and schema comments, README, `TESTING_GUIDE.md`, `docs/**`, package descriptions and commit messages.
- Rewrite `README.md` as a proper product README: what it is, module list and presets, quick start, architecture, scripts, testing, deployment, licensing. Rewrite `TESTING_GUIDE.md` to match reality. Update `docs/architecture/technical-debt.md` so it lists only genuinely remaining items (and delete resolved ones), and update the runbook and disaster-recovery docs to match the real stack.
- Add a CI check `npm run check:no-phase` that fails if `\bPhase\s*\d` (case-insensitive) appears anywhere outside `node_modules`, `.agents` and `CHANGELOG`.

## 9. Testing and verification: "everything must work"

Build the tooling, then **run it and fix failures until green.** Use Vitest (unit), Supertest against a real Postgres (integration, via Docker or testcontainers), Playwright (end-to-end, per module and per preset), axe-core (accessibility), and a small k6 or autocannon smoke for performance.

Required automated suites:

1. **Unit:** the module resolver (dependencies, cycles, forced enabling), pricing/tax/discount calculations, drug-interaction rules, FEFO selection, sequence generators, permission evaluation, license verification (valid, expired, tampered).
2. **API integration:** for every endpoint: happy path, validation failure, unauthenticated (401), unauthorized (403), wrong tenant (404), pagination and filters, audit entry created.
3. **Tenant isolation:** a generated test over the full route table with two tenants. Zero leaks allowed.
4. **Entitlement matrix:** for each preset and for a handful of custom module sets: every route of an enabled module works; every route of a disabled module returns `404 MODULE_NOT_ENABLED`; sidebar and command palette show exactly the enabled modules; direct URL to a disabled page is not found; dependency auto-enable works; disabling a required module is rejected.
5. **Edition build:** build each preset edition and assert the disabled modules' routes and code are absent from the output; the edition boots and passes its own e2e suite.
6. **End-to-end clinical journeys** (Playwright, against a seeded database):
   - OPD: register patient → book appointment → queue → consult → e-prescription → pharmacy dispense → invoice → payment → receipt PDF.
   - ER: fast registration → triage → orders → disposition (admit) → IPD admission.
   - IPD: admit → bed → nursing/MAR → rounds → discharge summary → billing clearance → discharge → housekeeping task.
   - Diagnostics: order → collect → result → validate → critical alert → report PDF → visible in Patient 360.
   - Insurance: pre-auth → claim → settlement.
   - Procurement: requisition → PO → GRN → stock appears in pharmacy batch list.
   - Admin: create user and role, assign permissions, MFA enrolment, audit log shows everything above.
   - **Preset journeys:** `patients-only` (registration to Patient 360 only) and `pharmacy-er` (ER triage, pharmacy dispense and stock; no OPD/IPD/billing screens present) must pass on their own edition builds.
7. **Integrity checks (scripts, run in CI):**
   - `check:links`: crawl every nav item and in-app link per preset; none may 404 or 500.
   - `check:placeholders`: fail on "Pending", "coming soon", "module active", `TODO`, `demo-token`, `placeholder`, `mock`, `lorem` in shipped source.
   - `check:dead-controls`: every button and form in shipped pages has a handler or a navigation target.
   - `check:no-phase` (section 8), `check:no-direct-prisma-in-web`, `check:no-committed-secrets`.
   - Console-error check: no unhandled console errors or failed network requests on any page load in e2e.
8. **Accessibility:** axe scan on every route, zero serious or critical violations.

Create one command, `npm run verify`, that runs: typecheck → lint → unit → integration → tenant isolation → entitlement matrix → build all editions → e2e (matrix over presets) → a11y → integrity checks. GitHub Actions runs it, with the e2e matrix over `patients-only`, `pharmacy-er`, `opd-clinic`, `full-enterprise`.

## 10. DevOps and documentation

- Dockerfiles (multi-stage, non-root) for `api`, `web`, `worker`. `docker-compose.yml` with postgres, redis, minio, mailpit, api, web, worker, healthchecks, and a one-command dev start. `docker-compose.prod.example.yml`.
- Zod-validated environment config that fails fast with readable errors. `.env.example` complete; no secrets in repo.
- `docs/`: architecture (modules, ports/events, tenancy), module catalog and presets, **client onboarding guide** (how to provision Hospital A and Hospital B step by step, including license issue, branding, data import), security model, API reference (OpenAPI), runbook, backup/restore and disaster recovery, upgrade/migration guide, contribution guide.

## 11. Execution order (workstreams)

Complete each, run its checks, update `PROGRESS.md`, commit, then continue.

- **A. Baseline and hygiene.** Install, build, run what exists; record the real current state. Remove dist/duplicate JS/committed secrets; align versions; set up lint/typecheck/test tooling and CI skeleton; migrate to `prisma migrate`. *Exit: clean build, empty-but-running test harness.*
- **B. Foundation.** `packages/modules` (registry, resolver, presets), env config, logging, error envelope, auth (login, refresh, MFA, lockout), RBAC, tenant-scoping Prisma extension (+ RLS), audit, validation layer, shared types/client, indexes. *Exit: auth, tenancy and entitlement tests green.*
- **C. Design system and app shell.** Run the design-system generation, build `packages/ui` and tokens, login, shell, dynamic nav from capabilities, patient banner, DataTable, forms, command palette, error/empty/loading patterns. *Exit: a11y and link checks green on the shell.*
- **D. `patients` + `scheduling` + `opd`,** full vertical slices (API, UI, tests). Then **the Module Manager, license verification, provisioning CLI and edition build** so `patients-only` is demonstrable early. *Exit: `patients-only` edition builds, boots and passes its e2e journey.*
- **E. `inventory` + `pharmacy` + `emergency`.** *Exit: `pharmacy-er` edition builds, boots and passes its e2e journey; ER and pharmacy work without billing, and charges flow automatically when billing is enabled.*
- **F. `billing` + `insurance` + `laboratory` + `radiology`.**
- **G. `ipd` + `icu` + `ot` + `bloodbank` + `cssd` + `dietary` + `housekeeping` + `ambulance`.**
- **H. `procurement` + `hr` + `finance` + `assets` + `crm`.**
- **I. `analytics` + `integrations` + `enterprise` + platform services** (worker, files, notifications, import tools, PDF templates).
- **J. Final pass.** Remove all "Phase" text, rewrite docs, run `npm run verify` on the whole matrix, fix everything, write `docs/KNOWN_LIMITATIONS.md`, produce the final report.

## 12. Definition of done and final report

Done means all of the following are true **and demonstrated with real output:**

- `npm run verify` passes across the full preset matrix.
- Zero placeholder text, zero dead links or buttons, zero "Phase" strings, zero direct Prisma use in the web app, no secrets committed.
- The `patients-only` and `pharmacy-er` editions build, start from a fresh database via `provision`, and contain no code or routes of other modules.
- A new client can be provisioned with any custom module list in a single command, with branding and a signed license.

Finish with a report (also saved to `docs/redesign/FINAL_REPORT.md`) containing: what was built per module; test counts and results (actual numbers); the verify command output summary; the module/preset matrix; known limitations and any items needing my input (external provider credentials, legal/compliance sign-off, real PACS/analyzer connections); and the exact steps to deliver to Hospital A and Hospital B.

# PROMPT ENDS HERE
