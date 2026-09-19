BEGIN;
-- Apply during maintenance only, after all released production has finished.
LOCK TABLE "ProductionRelease" IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ProductionRelease" WHERE "Status" = 'RELEASED') THEN
    RAISE EXCEPTION 'Finish all RELEASED production before enabling assembly';
  END IF;
END $$;
ALTER TABLE "FinishGood" ADD COLUMN "IsPassthrough" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LabelData" ADD COLUMN "RequiresAssembly" BOOLEAN;
ALTER TABLE "ShoppingProductionResult" RENAME TO "ShoppingCompletion";
ALTER TABLE "ShoppingCompletion" RENAME CONSTRAINT "ShoppingProductionResult_pkey" TO "ShoppingCompletion_pkey";
ALTER TABLE "ShoppingCompletion" RENAME CONSTRAINT "ShoppingProductionResult_ForecastId_fkey" TO "ShoppingCompletion_ForecastId_fkey";
ALTER INDEX "ShoppingProductionResult_ShoppingId_key" RENAME TO "ShoppingCompletion_ShoppingId_key";
ALTER INDEX "ShoppingProductionResult_CreatedAt_idx" RENAME TO "ShoppingCompletion_CreatedAt_idx";
CREATE TYPE "AssemblyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TABLE "AssemblySession" (
 "Id" TEXT NOT NULL PRIMARY KEY,
 "LabelDataId" INTEGER NOT NULL REFERENCES "LabelData"("Id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "ManPowerUid" TEXT NOT NULL REFERENCES "ManPower"("Uid") ON DELETE RESTRICT ON UPDATE CASCADE,
 "ManPowerName" TEXT NOT NULL,
 "Status" "AssemblyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
 "StartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "EndedAt" TIMESTAMP(3), "CancelledAt" TIMESTAMP(3), "CancelledBy" TEXT, "CancelReason" TEXT,
 "StartRequestId" TEXT NOT NULL, "CompleteRequestId" TEXT,
 "CreatedBy" TEXT NOT NULL, "CompletedBy" TEXT, "Channel" TEXT NOT NULL,
 CONSTRAINT "AssemblySession_state_check" CHECK (
  ("Status" = 'IN_PROGRESS' AND "EndedAt" IS NULL AND "CancelledAt" IS NULL) OR
  ("Status" = 'COMPLETED' AND "EndedAt" >= "StartedAt" AND "EndedAt" IS NOT NULL AND "CompleteRequestId" IS NOT NULL AND "CancelledAt" IS NULL) OR
  ("Status" = 'CANCELLED' AND "EndedAt" IS NULL AND "CancelledAt" IS NOT NULL AND "CancelledBy" IS NOT NULL AND "CancelReason" IS NOT NULL AND length(trim("CancelReason")) > 0)
 )
);
CREATE UNIQUE INDEX "AssemblySession_StartRequestId_key" ON "AssemblySession"("StartRequestId");
CREATE UNIQUE INDEX "AssemblySession_CompleteRequestId_key" ON "AssemblySession"("CompleteRequestId");
CREATE UNIQUE INDEX "AssemblySession_active_label_key" ON "AssemblySession"("LabelDataId") WHERE "Status" = 'IN_PROGRESS';
CREATE UNIQUE INDEX "AssemblySession_active_manpower_key" ON "AssemblySession"("ManPowerUid") WHERE "Status" = 'IN_PROGRESS';
CREATE UNIQUE INDEX "AssemblySession_completed_label_key" ON "AssemblySession"("LabelDataId") WHERE "Status" = 'COMPLETED';
CREATE INDEX "AssemblySession_LabelDataId_Status_idx" ON "AssemblySession"("LabelDataId", "Status");
CREATE INDEX "AssemblySession_ManPowerUid_Status_idx" ON "AssemblySession"("ManPowerUid", "Status");
CREATE INDEX "AssemblySession_StartedAt_idx" ON "AssemblySession"("StartedAt");

INSERT INTO "MTCPermission" ("Action", "Description", "CreateBy") VALUES
 ('IPCS.ASSEMBLY_READ', 'Read assembly sessions', 'MIGRATION'),
 ('IPCS.ASSEMBLY_CREATE', 'Start and complete assembly', 'MIGRATION'),
 ('IPCS.ASSEMBLY_CANCEL', 'Cancel active assembly with reason', 'MIGRATION')
ON CONFLICT ("Action") DO NOTHING;
COMMIT;
