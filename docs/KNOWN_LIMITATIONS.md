# Enterprise HMS: Known Limitations & External Integration Runbook

This document details all external integration points, their active development/test simulator behaviors, and the exact step-by-step configuration required to connect live production services.

---

## Overview of External Integrations & Adapters

| Integration | Active Mode | Adapter Class | Production Protocol / Provider |
|---|---|---|---|
| **Background Worker Queue** | BullMQ with Redis / In-Memory Simulator | `BullMQQueueAdapter` / `InMemoryWorkerSimulator` | Redis 7+ cluster via BullMQ (`REDIS_URL`) |
| **Object File Storage** | Local Storage Simulator | `LocalStorageSimulator` / `S3StorageAdapter` | AWS S3 or MinIO S3 API with presigned URLs |
| **National Health Gateway** | ABDM Sandbox Simulator | `AbdmSimulatorAdapter` | Ayushman Bharat Digital Mission (M1/M2/M3) NHA Gateway |
| **Clinical Interoperability** | Native FHIR R4 & HL7 Parser | `FhirService` / `Hl7V2Service` | HL7 FHIR R4 JSON & HL7 v2.5 MLLP TCP listener |
| **Digital Payments** | Payment Gateway Simulator | `PaymentGatewaySimulator` | Razorpay / Stripe Order Checkout & Webhook verification |
| **Notifications (SMS/Email/WhatsApp)**| Multi-Channel Simulator Outbox | `NotificationService` | Twilio (SMS), WhatsApp Cloud API, SMTP / AWS SES (Email) |
| **Laboratory Analyzers** | ASTM E1394 Simulator Feed | `AnalyzerService` | Serial RS-232 / TCP Socket automated analyzer feed |
| **Biometric Devices** | Clock Punch Push Ingestion | `BiometricService` | ZKTeco / eSSL Push Protocol HTTP Endpoint |

---

## 1. Background Worker (BullMQ + Redis)

### Development / Test Simulator
- When `REDIS_URL` is unset or unreachable on `localhost:6379`, the system activates `InMemoryWorkerSimulator`.
- Background jobs (`reminders`, `notifications`, `report_generation`, `outbox_relay`, `scheduled_exports`) execute asynchronously in-process with state progression (`waiting` → `active` → `completed`), retry handling, and event emission.

### Live Production Configuration Steps
1. Provision a Redis 7+ instance (e.g. AWS ElastiCache, Redis Enterprise, or Docker Redis).
2. Set the environment variable in `.env`:
   ```env
   REDIS_URL=redis://:strongpassword@redis.internal.hospital.com:6379
   ```
3. Start the dedicated background worker process:
   ```bash
   npm run start --workspace=@enterprise-hms/worker
   ```
4. Verify worker connectivity via `GET /api/v1/platform/jobs` (returns `isSimulator: false`).

---

## 2. File Storage (AWS S3 / MinIO)

### Development / Test Simulator
- Emulates presigned upload/download URLs using tokenized routes (`/api/v1/platform/files/*`).
- Enforces strict 10MB maximum file size limits, permitted MIME types (`application/pdf`, `image/jpeg`, `image/png`, `application/dicom`, `text/csv`), and integrated ClamAV antivirus simulation (rejecting the standard EICAR test signature).

### Live Production Configuration Steps
1. Create an AWS S3 bucket (or MinIO instance) named e.g. `enterprise-hms-records-prod`.
2. Configure CORS rules allowing `PUT` and `GET` requests from the hospital web app domain.
3. Configure bucket server-side encryption (`AES256` or AWS KMS) and block all public access.
4. Set the environment variables in `.env`:
   ```env
   S3_ENDPOINT=https://s3.amazonaws.com # or http://minio:9000
   S3_BUCKET=enterprise-hms-records-prod
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```

---

## 3. Ayushman Bharat Digital Mission (ABDM) Gateway

### Development / Test Simulator
- The `AbdmSimulatorAdapter` implements the complete NHA M1, M2, and M3 flows:
  - ABHA ID Generation with Aadhaar/Mobile
  - OTP verification with sandbox test OTP `123456`
  - Care Context linking to Patient Encounters
  - Discovery and HIU/HIP consent exchange.

### Live Production Configuration Steps
1. Register the hospital on the National Health Authority (NHA) Sandbox / Production portal: `https://sandbox.abdm.gov.in`.
2. Complete ABDM M1, M2, and M3 milestone certifications.
3. Obtain official `CLIENT_ID`, `CLIENT_SECRET`, and digital signature certificates (X.509).
4. Configure live ABDM credentials in `.env`:
   ```env
   ABDM_ENV=production
   ABDM_CLIENT_ID=sbx-hosp-client-id
   ABDM_CLIENT_SECRET=hosp-secret-key-32chars
   ABDM_BASE_URL=https://dev.abdm.gov.in/gateway
   ABDM_BRIDGE_URL=https://hms.hospital.com/api/v1/integrations/abdm/callback
   ```
5. Register public encryption keys on the NHA Gateway dashboard.

---

## 4. HL7 v2 and FHIR R4 Interoperability

### Development / Test Simulator
- `FhirService` generates standard HL7 FHIR R4 JSON payloads (`Patient`, `Encounter`, `Observation`, `DiagnosticReport`, and `Bundle`).
- `Hl7V2Service` parses pipe-delimited HL7 v2 messages (e.g. `ADT^A01`, `ORU^R01`) and produces outgoing segments.

### Live Production Configuration Steps
1. For HL7 v2 MLLP interfaces, bind an MLLP TCP socket listener on port `2575`:
   ```env
   HL7_MLLP_PORT=2575
   HL7_RECEIVING_FACILITY=HOSPITAL_A
   ```
2. For PACS / DICOM viewing (Orthanc / OHIF Viewer), configure the DICOM Web root:
   ```env
   PACS_DICOMWEB_URL=https://pacs.hospital.com/dicom-web
   PACS_AETITLE=ORTHANC_HMS
   ```

---

## 5. Payment Gateways (Razorpay / Stripe)

### Development / Test Simulator
- `PaymentGatewaySimulator` creates mock orders and verifies checkout signatures with simulated instant capture.

### Live Production Configuration Steps
1. Register merchant account on Razorpay or Stripe.
2. Obtain API Key ID and Key Secret.
3. Set environment variables in `.env`:
   ```env
   PAYMENT_PROVIDER=razorpay # or stripe
   RAZORPAY_KEY_ID=rzp_live_xxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
   PAYMENT_WEBHOOK_SECRET=whsec_xxxxxxxx
   ```
4. Register the webhook URL on your merchant dashboard: `https://hms.hospital.com/api/v1/integrations/payments/verify`.

---

## 6. External Notifications (SMS, WhatsApp, Email)

### Development / Test Simulator
- `NotificationService` logs all outbound SMS, WhatsApp, and Email dispatches to `simulatorOutbox`, queryable via `GET /api/v1/platform/notifications/simulator-outbox`.
- In-app notifications are stored and tracked with read/unread statuses.

### Live Production Configuration Steps
1. For SMS: Register with Twilio, AWS SNS, or Gupshup with DLT-registered templates.
   ```env
   SMS_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
   TWILIO_PHONE_NUMBER=+15551234567
   ```
2. For WhatsApp: Obtain WhatsApp Business Account (WABA) Cloud API token:
   ```env
   WHATSAPP_API_TOKEN=EAAxxxxxxx
   WHATSAPP_PHONE_NUMBER_ID=10987654321
   ```
3. For Email: Configure SMTP credentials or AWS SES:
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=SG.xxxxxxxx
   EMAIL_FROM="notifications@hospital.com"
   ```

---

## 7. Automated Laboratory Analyzers & Biometric Devices

### Development / Test Simulator
- `AnalyzerService` provides automated ASTM E1394 feed simulation with critical range validation.
- `BiometricService` provides clock-in/out punch ingestion matching employee codes to attendance records.

### Live Production Configuration Steps
1. Connect analyzer instruments via RS-232 serial cable or Ethernet TCP socket to the hospital LIS gateway daemon.
2. Configure the analyzer software to POST result packets to `https://hms.hospital.com/api/v1/integrations/analyzers/feed`.
3. Configure Biometric biometric time clocks (ZKTeco/eSSL) server IP address pointing to `https://hms.hospital.com/api/v1/integrations/biometric/punch`.
