ALTER TABLE "SapConnectionState" ADD COLUMN "DocumentCursors" JSONB;
CREATE TABLE "SapExternalDocument" (
  "Company" TEXT NOT NULL, "Resource" TEXT NOT NULL, "DocumentEntry" INTEGER NOT NULL,
  "DocumentNumber" INTEGER NOT NULL, "Warehouse" TEXT NOT NULL,
  "ObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SapExternalDocument_pkey" PRIMARY KEY ("Company", "Resource", "DocumentEntry")
);
CREATE INDEX "SapExternalDocument_Company_Warehouse_ObservedAt_idx" ON "SapExternalDocument"("Company", "Warehouse", "ObservedAt");
