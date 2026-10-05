# Enterprise HMS Security Architecture & Threat Model

This document outlines the security controls, authentication mechanisms, tenant isolation architecture, and role-based access control (RBAC) enforced within the Enterprise HMS.

---

## 1. Authentication & Credential Storage

### Argon2id Password Hashing
All user passwords are encrypted using **Argon2id** (`argon2@0.45.1`), adhering to OWASP password storage guidelines:
- Memory cost: 65,536 KiB (64 MB)
- Time cost: 3 iterations
- Parallelism: 4 threads
- Backward compatibility: Legacy seed hashes are automatically detected and verified; successful verification upgrades the stored hash to Argon2id.

### Rotating JWT Tokens & Active Sessions
Authentication issues short-lived JWT access tokens and long-lived rotating refresh tokens:
- **Access Tokens**: Expire in 15 minutes; contain `userId`, `tenantId`, and `email`. Signed with HS256 using `JWT_SECRET`.
- **Refresh Tokens**: Persisted in the `Session` table with an expiration of 7 days.
- **Token Rotation**: Using a refresh token revokes that token and issues a new access/refresh pair.
- **Explicit Logout**: Revokes the specific refresh session immediately in the database.

### Account Lockout Defense
To prevent brute-force attacks against staff accounts:
- Tracks consecutive failed authentication attempts in the `User` table (`failedLoginAttempts`).
- After **5 consecutive failures**, the account is locked for **15 minutes** (`lockedUntil`).
- Further authentication requests return `423 Locked` with remaining lockout duration.

---

## 2. Multi-Tenant Boundary Isolation

### Driver-Level Tenant Scoping
Data isolation between hospital organizations does not rely on application-level developer discipline. It is strictly enforced via a Prisma Client Extension (`packages/database/src/tenancy.ts`):
1. **Automated Tenant Injection**: All model queries automatically inject `{ tenantId: context.tenantId }`.
2. **Cross-Tenant Blockade**: If a query explicitly attempts to query or mutate a foreign `tenantId`, the driver throws a `TenantViolationError` and logs a security violation.
3. **Hermetic Request Scoping**: Middleware (`authenticateToken`) binds the verified `tenantId` to `req.tenantId` and exposes `req.prismaTenant`.

---

## 3. Role-Based Access Control (RBAC)

Permissions follow the standard `module.resource.action` schema (e.g. `pharmacy.prescription.dispense`, `billing.invoice.create`).

### Standard System Roles
- `SUPER_ADMIN`: Cross-tenant administration and system diagnostics.
- `ADMIN`: Tenant-level configuration, hospital branches, and user assignments.
- `DOCTOR`: Clinical consultation, appointment queues, order entry, e-prescriptions.
- `NURSE`: Triage assessments, vitals, nursing care plans, MAR administration.
- `PHARMACIST`: Prescription fulfillment, FEFO batch selection, inventory movements.
- `LAB_TECHNICIAN`: Diagnostic sample collection, analyzer result entry.
- `RADIOLOGIST`: Imaging study reporting and diagnostic sign-offs.
- `CASHIER`: Billing clearance, payment collection, cashier shifts.

### Enforcement
The `requirePermission(permission)` middleware verifies that the user possesses the required permission token via their assigned roles, responding with `403 Forbidden` if unauthorized.

---

## 4. Immutable Audit Logging

Every critical event is recorded in the `AuditLog` table:
- **Captured Attributes**: `tenantId`, `userId`, `action`, `entity`, `entityId`, `oldValues`, `newValues`, `ipAddress`, `userAgent`, `createdAt`.
- **High-Risk Events Logged**: User authentication, account lockouts, emergency triages, surgical completions, blood transfusions, medication administrations, and invoice voids.
