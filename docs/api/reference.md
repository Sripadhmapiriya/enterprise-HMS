# Enterprise HMS REST API Reference

The Enterprise HMS REST API is served on `http://localhost:4000/api/v1` and organized into modular domain routers.

---

## 1. Standard Response & Error Envelopes

### Success Envelope
All successful responses return HTTP 200 or 201:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142
  }
}
```

### Error Envelope
All error responses adhere to the standard error envelope:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [
      { "field": "email", "message": "Invalid email address format" }
    ],
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## 2. Authentication Headers

All requests to protected endpoints require a Bearer JWT token in the `Authorization` header:
```http
Authorization: Bearer <ACCESS_TOKEN>
```

---

## 3. Core API Endpoints

### Authentication & Sessions (`/api/v1/auth`)
- `POST /login`: Authenticate credentials, returns access & refresh tokens.
- `POST /refresh`: Rotate refresh token and issue new access token.
- `GET /me`: Return current user profile, organization, and assigned roles.
- `POST /logout`: Revoke active refresh token session.

### Patient Demographics (`/api/v1/patients`)
- `GET /`: Search and list patients (with pagination and filtering).
- `POST /`: Enroll new patient (auto-generates unique MRN).
- `GET /:id`: Retrieve Patient 360 view (demographics, encounters, past visits).
- `PATCH /:id`: Update patient details.

### Appointments & Queue (`/api/v1/scheduling`)
- `GET /appointments`: Query scheduled appointments by date/doctor.
- `POST /appointments`: Book new patient appointment slot.
- `GET /queues`: Live doctor queue status and waiting list.
- `PATCH /queues/:id/call`: Call next patient into consultation.

### Outpatient Consultations (`/api/v1/opd`)
- `POST /consultations`: Record clinical encounter note, vitals, and diagnosis.
- `POST /prescriptions`: Issue electronic prescription with dosage and frequency.

### Emergency Department (`/api/v1/emergency`)
- `POST /triage`: Record triage assessment and ESI acuity level.
- `GET /board`: Real-time emergency tracking board.
- `PATCH /disposition`: Record physician disposition (`DISCHARGE`, `ADMIT`, `TRANSFER`).

### Inpatient Care (`/api/v1/ipd`)
- `GET /bed-board`: Visual bed telemetry and occupancy status.
- `POST /admissions`: Create inpatient admission.
- `POST /beds/allocate`: Assign ward bed to admitted patient.
- `POST /nursing/mar`: Prescribe inpatient MAR medication order.
- `POST /nursing/mar/administer`: Administer medication with 5-rights check.
- `POST /discharge`: Issue clinical discharge summary and initiate bed cleaning.

### Pharmacy & Stock (`/api/v1/pharmacy`)
- `GET /prescriptions`: Query pending prescriptions for fulfillment.
- `POST /dispense`: Dispense medication with automated FEFO batch decrement.
- `GET /inventory`: Query current formulary stock levels and batch expiries.

### Diagnostics (`/api/v1/laboratory` & `/api/v1/radiology`)
- `GET /laboratory/worklist`: List active diagnostic specimens.
- `POST /laboratory/results`: Record test values with automated critical flags.
- `GET /radiology/worklist`: Scheduled imaging procedures.
- `POST /radiology/reports`: Submit radiologist diagnostic findings.

### Revenue & Billing (`/api/v1/billing`)
- `GET /invoices`: Query itemized bills and payment balances.
- `POST /invoices`: Generate bill from captured charges.
- `POST /payments`: Collect payment and issue receipt.
- `POST /insurance/claims`: Submit TPA claim for pre-authorization or settlement.

### Platform Services (`/api/v1/platform`)
- `POST /files/upload-url`: Request presigned S3 upload URL with 10MB ceiling.
- `POST /notifications/send`: Dispatch multi-channel notification.
- `POST /import/validate`: Run CSV dry-run validation with error report.
- `POST /import/commit`: Ingest validated CSV rows into database.
- `POST /print/generate`: Generate PDF vector documents for 8 clinical templates.

### Interoperability Hub (`/api/v1/integrations`)
- `GET /status`: Healthcheck status across external adapters.
- `POST /abdm/m1/generate-abha`: Generate ABHA health ID.
- `POST /abdm/m2/verify-otp`: Complete Aadhaar OTP verification.
- `POST /abdm/m3/link-care-context`: Link visit to national health record.
- `GET /fhir/r4/Patient/:id`: Export HL7 FHIR R4 Patient resource.
- `POST /hl7/v2/parse`: Ingest pipe-delimited HL7 v2 messages.
- `POST /analyzers/feed`: Ingest automated laboratory analyzer results.
