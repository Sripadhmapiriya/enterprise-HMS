-- CreateEnum
CREATE TYPE "AllergyStatus" AS ENUM ('NOT_ASSESSED', 'NKDA_CONFIRMED', 'HAS_ALLERGIES');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "allergyStatus" "AllergyStatus" NOT NULL DEFAULT 'NOT_ASSESSED';
