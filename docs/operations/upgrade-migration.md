# Database Upgrades & Migration Runbook

This runbook outlines the zero-downtime database migration strategy and schema versioning protocol for the Enterprise HMS.

---

## 1. Migration Protocol with Prisma

The database schema is managed using **Prisma Migrate** with committed SQL migrations under `packages/database/prisma/migrations/`.

### Migration Rules
1. **Never use `db push` in production**: All production environments must use `npx prisma migrate deploy`.
2. **Expand and Contract Pattern**: Schema modifications must be backwards-compatible with the currently running application code.
   - Step 1 (Expand): Add new nullable column or table. Deploy migration.
   - Step 2 (Deploy Code): Deploy application code writing to both old and new columns.
   - Step 3 (Backfill): Backfill existing records asynchronously via worker jobs.
   - Step 4 (Contract): Remove old column in a subsequent release.

### Executing Migrations in Staging & Production
```bash
# Verify pending migrations without applying
npx prisma migrate status --schema=packages/database/prisma/schema.prisma

# Apply pending migrations
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

---

## 2. Upgrading Client Editions

When a hospital client purchases additional modules (e.g. upgrading Hospital A from `patients-only` to `opd-clinic`):

### 1. Apply Preset via API or CLI
```bash
# Using the module management CLI
npm run provision -- --code HOSP-A-STJUDE --preset opd-clinic --admin admin@stjude.org
```

### 2. Verify Dynamic Activation
- The module resolver enables `opd`, `scheduling`, and `billing`.
- New capabilities appear immediately in the client's app shell navigation.
- Previously blocked routes now return HTTP 200.
