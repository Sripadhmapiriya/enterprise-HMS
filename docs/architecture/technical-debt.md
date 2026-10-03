# Technical Debt Register

This register documents the technical debt accumulated during the rapid functional prototyping of Phases 1 through 8. It categorizes the debt and tracks remediation efforts.

## Critical (Must fix before production)
* **API Validation:** Currently missing strong Zod schema validations on many generated Prisma API routes. 
* **Database Indexes:** Most high-volume tables (`Patient`, `Encounter`, `Bill`) do not have composite indexes on `[tenantId, createdAt]` leading to full table scans.
* **Authentication Hardening:** MFA and rate limiting are not fully enforced across the Next.js API layer.
* **Tenant Isolation Checks:** Explicit E2E automation for tenant data leakage is missing. E2E isolation scripts must be written.

## High (Fix soon)
* **Background Workers:** Cron jobs for reports and notifications are stubbed but not executing via a robust message queue (e.g., BullMQ + Redis).
* **Connection Pooling:** Prisma Client instantiation in Next.js dev mode might exhaust connections. Needs PgBouncer or Prisma Accelerate validation for production.
* **File Uploads:** Object storage mapping is mocked. Needs direct S3 integration with presigned URLs.

## Medium
* **E2E Testing:** Playwright tests are incomplete for some minor modules (like Dietary and Housekeeping).
* **Caching:** Patient 360 could benefit from Redis caching rather than querying the DB heavily.

## Low
* **Code Splitting:** Next.js bundle sizes are large due to aggressive initial loading on dashboards.
