# Architecture Technical Register & Remediation Status

This register documents historical architecture considerations and tracks the hardening status of enterprise capabilities.

---

## 1. Resolved Foundation Items

| Domain | Historical Concern | Current Production Status | Verification Suite |
|---|---|---|---|
| **API Validation** | Loose request payload validation | Strictly enforced via Zod schemas across all routers; unified standard error envelope (`ApiErrorEnvelopeSchema`) | `tests/auth.test.ts`, `tests/patients.test.ts` |
| **Tenant Isolation** | Potential cross-tenant data leakage | Enforced at Prisma client extension level (`packages/database/src/tenancy.ts`); auto-injects `tenantId` and blocks cross-tenant access | `tests/tenancy.test.ts`, `tests/entitlements.test.ts` |
| **Authentication** | Demo tokens and weak hashing | Upgraded to Argon2id password hashing, rotating JWT access/refresh tokens in `Session` table, and 15-minute account lockout after 5 failed attempts | `tests/auth.test.ts` |
| **Database Indexing** | Missing composite query indexes | Added composite indexes (`[tenantId, createdAt]`, `[tenantId, status]`, `[tenantId, mrn]`) across high-volume tables | `packages/database/prisma/schema.prisma` |
| **Background Processing**| Mocked asynchronous tasks | Built dedicated `apps/worker` with BullMQ + Redis adapter and in-memory simulator fallback | `tests/platform-and-integrations.test.ts` |
| **File Storage** | Unchecked local file handling | Built S3/MinIO presigned URL generator with 10MB ceiling, MIME validation, and ClamAV/EICAR malware rejection | `tests/platform-and-integrations.test.ts` |
| **Interoperability** | Missing national health standards | Implemented ABDM Sandbox (M1/M2/M3), HL7 FHIR R4, and HL7 v2 ADT adapters | `tests/platform-and-integrations.test.ts` |

---

## 2. Active Operational Considerations

- **Redis Deployment**: In standalone environments without Redis, the platform automatically activates the `InMemoryWorkerSimulator`. For distributed clustering across multiple node instances, external Redis 7+ must be provisioned.
- **S3 Storage Bucket**: The default fallback stores files in the local sandboxed directory. Live production deployments require S3 or MinIO credentials as outlined in `docs/KNOWN_LIMITATIONS.md`.
- **ABDM Live Gateway**: Sandboxed test protocol uses OTP `123456`. Production cutover requires National Health Authority (NHA) production credentials and TLS certificates.
