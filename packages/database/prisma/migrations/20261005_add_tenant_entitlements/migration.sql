-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_entitlements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limits" JSONB,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_entitlements_tenantId_moduleId_key" ON "tenant_entitlements"("tenantId", "moduleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_entitlements_tenantId_idx" ON "tenant_entitlements"("tenantId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenant_entitlements_tenantId_fkey'
    ) THEN
        ALTER TABLE "tenant_entitlements" ADD CONSTRAINT "tenant_entitlements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
