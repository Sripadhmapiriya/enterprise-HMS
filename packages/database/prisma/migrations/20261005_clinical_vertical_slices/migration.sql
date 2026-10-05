-- AlterTable
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "abhaNumber" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "abhaAddress" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "mergedIntoPatientId" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "mergedAt" TIMESTAMP(3);

-- CreateTable doctor_schedules
CREATE TABLE IF NOT EXISTS "doctor_schedules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 15,
    "maxOverbooking" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable patient_consents
CREATE TABLE IF NOT EXISTS "patient_consents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GRANTED',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "witnessName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable patient_documents
CREATE TABLE IF NOT EXISTS "patient_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable encounter_referrals
CREATE TABLE IF NOT EXISTS "encounter_referrals" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "referralType" TEXT NOT NULL,
    "toDepartmentId" TEXT,
    "toDoctorId" TEXT,
    "toExternalFacility" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounter_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable medical_certificates
CREATE TABLE IF NOT EXISTS "medical_certificates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "diagnosisSummary" TEXT NOT NULL,
    "restDaysRecommended" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "remarks" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "doctor_schedules_tenantId_branchId_doctorId_idx" ON "doctor_schedules"("tenantId", "branchId", "doctorId");
CREATE INDEX IF NOT EXISTS "patient_consents_tenantId_patientId_idx" ON "patient_consents"("tenantId", "patientId");
CREATE INDEX IF NOT EXISTS "patient_documents_tenantId_patientId_idx" ON "patient_documents"("tenantId", "patientId");
CREATE INDEX IF NOT EXISTS "medical_certificates_tenantId_patientId_idx" ON "medical_certificates"("tenantId", "patientId");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_schedules_doctorId_fkey') THEN
        ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_schedules_branchId_fkey') THEN
        ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_consents_patientId_fkey') THEN
        ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_documents_patientId_fkey') THEN
        ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_documents_uploadedById_fkey') THEN
        ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'encounter_referrals_encounterId_fkey') THEN
        ALTER TABLE "encounter_referrals" ADD CONSTRAINT "encounter_referrals_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'encounter_referrals_toDepartmentId_fkey') THEN
        ALTER TABLE "encounter_referrals" ADD CONSTRAINT "encounter_referrals_toDepartmentId_fkey" FOREIGN KEY ("toDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'encounter_referrals_toDoctorId_fkey') THEN
        ALTER TABLE "encounter_referrals" ADD CONSTRAINT "encounter_referrals_toDoctorId_fkey" FOREIGN KEY ("toDoctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medical_certificates_encounterId_fkey') THEN
        ALTER TABLE "medical_certificates" ADD CONSTRAINT "medical_certificates_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medical_certificates_patientId_fkey') THEN
        ALTER TABLE "medical_certificates" ADD CONSTRAINT "medical_certificates_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medical_certificates_doctorId_fkey') THEN
        ALTER TABLE "medical_certificates" ADD CONSTRAINT "medical_certificates_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
