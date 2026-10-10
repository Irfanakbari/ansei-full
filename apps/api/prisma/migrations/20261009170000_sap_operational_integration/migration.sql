ALTER TYPE "OutboxEventType" ADD VALUE IF NOT EXISTS 'SAP_TRANSACTION';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'CUSTOMER_RETURN';
CREATE TABLE "SapTransaction" (
  "Id" TEXT PRIMARY KEY, "SourceKey" TEXT NOT NULL, "LedgerId" TEXT, "DemandId" TEXT,
  "Kind" TEXT NOT NULL, "Company" TEXT NOT NULL, "Warehouse" TEXT NOT NULL,
  "ItemCode" TEXT NOT NULL, "Quantity" INTEGER NOT NULL, "Snapshot" JSONB NOT NULL, "SubmittedRequest" JSONB, "Effects" JSONB NOT NULL,
  "DocumentEntry" INTEGER, "DocumentNumber" INTEGER, "PostedAt" TIMESTAMP(3), "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SapTransaction_Id_fkey" FOREIGN KEY ("Id") REFERENCES "OutboxEvent"("Id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SapTransaction_SourceKey_key" ON "SapTransaction"("SourceKey");
CREATE UNIQUE INDEX "SapTransaction_LedgerId_key" ON "SapTransaction"("LedgerId");
CREATE INDEX "SapTransaction_DemandId_Kind_idx" ON "SapTransaction"("DemandId", "Kind");
CREATE INDEX "SapTransaction_Company_Warehouse_ItemCode_idx" ON "SapTransaction"("Company", "Warehouse", "ItemCode");
CREATE TABLE "SapDemandMapping" (
  "DemandId" TEXT PRIMARY KEY, "Company" TEXT NOT NULL, "ItemCode" TEXT NOT NULL,
  "SalesOrderEntry" INTEGER NOT NULL, "SalesOrderLine" INTEGER NOT NULL, "CardCode" TEXT NOT NULL,
  "UpdatedAt" TIMESTAMP(3) NOT NULL, "UpdatedBy" TEXT NOT NULL
);
CREATE TABLE "SapBackflushPick" (
  "LedgerId" TEXT PRIMARY KEY, "Company" TEXT NOT NULL, "Warehouse" TEXT NOT NULL,
  "ItemCode" TEXT NOT NULL, "DemandId" TEXT NOT NULL, "Quantity" INTEGER NOT NULL, "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SapBackflushPick_Company_Warehouse_ItemCode_idx" ON "SapBackflushPick"("Company", "Warehouse", "ItemCode");
CREATE INDEX "SapBackflushPick_DemandId_idx" ON "SapBackflushPick"("DemandId");
CREATE TABLE "SapStockSnapshot" (
  "Company" TEXT NOT NULL, "Warehouse" TEXT NOT NULL, "ItemCode" TEXT NOT NULL, "Quantity" DOUBLE PRECISION NOT NULL,
  "ObservedAt" TIMESTAMP(3) NOT NULL, "StartedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SapStockSnapshot_pkey" PRIMARY KEY ("Company", "Warehouse", "ItemCode")
);
CREATE TABLE "SapConnectionState" (
  "Company" TEXT PRIMARY KEY, "CheckedAt" TIMESTAMP(3), "Connected" BOOLEAN NOT NULL DEFAULT false,
  "RefreshStartedAt" TIMESTAMP(3), "RefreshedAt" TIMESTAMP(3), "RefreshError" TEXT, "WorkerAt" TIMESTAMP(3)
);
ALTER TABLE "LabelData" ADD COLUMN "InvalidatedAt" TIMESTAMP(3), ADD COLUMN "StockSourceLabelId" INTEGER,
  ADD COLUMN "ReplacesLabelId" INTEGER, ADD COLUMN "ReplacementFindingId" TEXT;
ALTER TABLE "ProductionFinding" ADD COLUMN "Disposition" TEXT NOT NULL DEFAULT 'REWORK', ADD COLUMN "ReplacementLabelId" INTEGER;
CREATE TABLE "CustomerReturn" (
  "Id" TEXT PRIMARY KEY, "DeliveryId" INTEGER NOT NULL, "Quantity" INTEGER NOT NULL, "ScrappedQuantity" INTEGER NOT NULL DEFAULT 0,
  "Reason" TEXT NOT NULL, "CreatedBy" TEXT NOT NULL, "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CustomerReturn_DeliveryId_idx" ON "CustomerReturn"("DeliveryId");
INSERT INTO "MTCPermission" ("Action", "Description", "CreateBy", "UpdateBy", "UpdateDate")
VALUES ('IPCS.SAP_MAPPING_UPDATE', 'Manage reviewed SAP Sales Order mappings', 'SYSTEM:MIGRATION', 'SYSTEM:MIGRATION', CURRENT_TIMESTAMP)
ON CONFLICT ("Action") DO NOTHING;
