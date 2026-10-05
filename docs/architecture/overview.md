# Enterprise HMS Architecture Specification

## 1. Architectural Philosophy

The Enterprise Hospital Management System (HMS) is engineered around three foundational principles:
1. **Strict Multi-Tenancy**: Data isolation is enforced at the database driver level. Every query automatically inherits the requesting tenant's context.
2. **Modular Decoupling**: Clinical and operational domains exist as discrete modules. Modules communicate via ports and in-process events rather than direct cross-boundary queries.
3. **Packaging Versatility**: The application can run as a unified full enterprise installation or be physically pruned into bespoke editions (e.g. *Patients Only*, *Pharmacy & Emergency*) for tier-based client delivery.

---

## 2. Monorepo Structure

```
enterprise-HMS/
├── apps/
│   ├── api/                 Express 4.x REST API with tenant isolation, auth, and modular routers
│   ├── web/                 Next.js 16 (App Router + Turbopack) clinical application shell
│   └── worker/              BullMQ background job runner with in-memory simulator fallback
├── packages/
│   ├── modules/             Module registry, dependency resolver (DAG), manifests & edition presets
│   ├── database/            Prisma ORM schema (136 models), migrations, seed scripts & tenancy extensions
│   ├── types/               Shared Zod validation schemas and TypeScript domain types
│   ├── ui/                  Accessible design system, tokens, Clinical Status badges & data tables
│   └── config/              Environment configuration and schema validators
├── presets/                 JSON edition presets for client distribution
└── scripts/                 Provisioning CLI, license generator, edition builder, integrity verification
```

---

## 3. Multi-Tenant Isolation Model

Tenant isolation is implemented through a custom Prisma Client Extension in `packages/database/src/tenancy.ts`:

- **Automatic Filter Injection**: On all read operations (`findMany`, `findFirst`, `count`), the extension automatically injects `{ tenantId: req.tenantId }` into the `where` clause.
- **Write Verification**: On `create` and `createMany`, the extension guarantees that `data.tenantId` matches the authenticated session's tenant ID, throwing a `TenantViolationError` if cross-tenant pollution is attempted.
- **Tenant Scope Middleware**: Every incoming API request passes through `authenticateToken`, which extracts the tenant ID from the verified JWT and mounts an isolated Prisma instance onto `req.prismaTenant`.

---

## 4. Module Registry & Dependency Resolution

The module system (`packages/modules`) acts as the single source of truth for features and entitlements:

- **Module Manifests**: Every module declares its ID, name, description, tier, dependencies, capabilities, navigation items, and API route prefixes.
- **Dependency Graph (DAG)**: The `ModuleResolver` performs topological graph traversal. If a client enables `pharmacy`, the resolver automatically enables prerequisite modules (`foundation`, `patients`, `inventory`).
- **Cycle Detection**: The dependency graph is verified during startup and in automated tests, ensuring zero cyclic dependencies.
- **Enforcement Layer**: The `requireModule(moduleId)` middleware checks tenant entitlements in the database. If a module is inactive, it returns `404 Not Found` with error code `MODULE_NOT_ENABLED`, concealing the module's presence from unauthorized organizations.

---

## 5. Ports & Event-Driven Decoupling

Modules interact across boundaries using loose-coupling ports and an in-process `EventBus`:

| Port | Description | Standalone Behavior | Connected Behavior |
|---|---|---|---|
| `ChargeCapturePort` | Emits billable charges | Discards or logs charge when billing module is absent | Enters charges into `ChargeMaster` / billing ledger when billing is active |
| `OrderingPort` | Emits lab / radiology diagnostic orders | Stores orders locally within consultation encounter | Routes orders to diagnostic worklists and accessioning queues |
| `ResultsPort` | Delivers diagnostic results | Stored in encounter chart | Updates Patient 360 and triggers alert notifications |
| `NotificationPort` | Clinical alert delivery | Recorded in in-memory simulation outbox | Dispatched via SMS, WhatsApp, Email, or In-App banner |
