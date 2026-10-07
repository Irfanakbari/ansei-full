BEGIN;
-- Run during the coordinated production write pause. Never resets business data.
-- CreateEnum
CREATE TYPE "DemandSource" AS ENUM ('PO', 'NON_PO');

-- DropForeignKey
ALTER TABLE "ShoppingCompletion" DROP CONSTRAINT "ShoppingCompletion_ForecastId_fkey";

-- DropForeignKey
ALTER TABLE "ProductionReport" DROP CONSTRAINT "ProductionReport_ForecastId_fkey";

-- DropForeignKey
ALTER TABLE "LabelData" DROP CONSTRAINT "LabelData_ForecastId_fkey";

-- DropIndex
DROP INDEX "Shopping_forecastId_fkey";

-- DropIndex
DROP INDEX "ProductionReport_ForecastId_idx";

-- DropIndex
DROP INDEX "LabelData_forecastId_fkey";

-- DropIndex
DROP INDEX "DeliveryHistory_forecastId_fkey";

-- DropIndex
DROP INDEX "ProductionBomSnapshot_ForecastId_ReleaseId_Version_key";

-- DropIndex
DROP INDEX "ProductionFinding_ForecastId_SubmittedAt_idx";

-- DropIndex
DROP INDEX "ProductionTraceEvent_ForecastId_CreatedAt_Id_idx";

-- AlterTable
ALTER TABLE "ProductionRelease" ADD COLUMN     "SourceType" "DemandSource" NOT NULL DEFAULT 'PO';

-- AlterTable
ALTER TABLE "Shopping" ADD COLUMN     "ProductionDemandId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingCompletion" ADD COLUMN "ProductionDemandId" TEXT;

-- AlterTable
ALTER TABLE "ProductionReport" ADD COLUMN     "ProductionDemandId" TEXT;

-- AlterTable
ALTER TABLE "LabelData" ADD COLUMN     "ProductionDemandId" TEXT,
ALTER COLUMN "ForecastId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DeliveryHistory" ADD COLUMN     "ProductionDemandId" TEXT,
ALTER COLUMN "ForecastId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProductionBomSnapshot" ADD COLUMN     "ProductionDemandId" TEXT,
ALTER COLUMN "ForecastId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProductionFinding" ADD COLUMN     "ProductionDemandId" TEXT;

-- AlterTable
ALTER TABLE "ProductionTraceEvent" ADD COLUMN     "ProductionDemandId" TEXT,
ALTER COLUMN "ForecastId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ForecastNonPo" (
    "Id" SERIAL NOT NULL,
    "ReferenceNumber" TEXT NOT NULL,
    "PartNumber" TEXT NOT NULL,
    "DeliveryDate" TIMESTAMP(3) NOT NULL,
    "ReceivingArea" TEXT NOT NULL,
    "DeliveryPeriod" INTEGER NOT NULL,
    "Qty" INTEGER NOT NULL,
    "PoNumber" TEXT,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "UpdatedBy" TEXT NOT NULL,

    CONSTRAINT "ForecastNonPo_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProductionDemand" (
    "Id" TEXT NOT NULL,
    "SourceType" "DemandSource" NOT NULL,
    "ForecastPoId" TEXT,
    "ForecastNonPoId" INTEGER,
    "ProductionReleaseId" TEXT,

    CONSTRAINT "ProductionDemand_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ForecastNonPoImport" (
    "Id" TEXT NOT NULL,
    "FileHash" TEXT NOT NULL,
    "RequestId" TEXT NOT NULL,
    "SourceIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "PayloadHash" TEXT,
    "CreatedCount" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,

    CONSTRAINT "ForecastNonPoImport_pkey" PRIMARY KEY ("Id")
);

-- Preserve every legacy identity before switching constraints.
INSERT INTO "ProductionDemand" ("Id", "SourceType", "ForecastPoId", "ProductionReleaseId")
SELECT "PoId", 'PO', "PoId", "ProductionReleaseId" FROM "Forecast";
UPDATE "Shopping" SET "ProductionDemandId" = "ForecastId";
UPDATE "ShoppingCompletion" SET "ProductionDemandId" = "ForecastId";
UPDATE "ProductionReport" SET "ProductionDemandId" = "ForecastId";
UPDATE "LabelData" SET "ProductionDemandId" = "ForecastId";
UPDATE "DeliveryHistory" SET "ProductionDemandId" = "ForecastId";
-- Only the new identity column is backfilled; immutable evidence stays unchanged.
-- DDL holds exclusive locks until commit, and these guards are restored below.
ALTER TABLE "ProductionBomSnapshot" DISABLE TRIGGER "snapshot_immutable";
ALTER TABLE "ProductionTraceEvent" DISABLE TRIGGER "trace_immutable";
UPDATE "ProductionBomSnapshot" SET "ProductionDemandId" = "ForecastId";
UPDATE "ProductionFinding" SET "ProductionDemandId" = "ForecastId";
UPDATE "ProductionTraceEvent" SET "ProductionDemandId" = "ForecastId";
ALTER TABLE "ProductionBomSnapshot" ENABLE TRIGGER "snapshot_immutable";
ALTER TABLE "ProductionTraceEvent" ENABLE TRIGGER "trace_immutable";
ALTER TABLE "ShoppingCompletion" ALTER COLUMN "ProductionDemandId" SET NOT NULL;
ALTER TABLE "LabelData" ALTER COLUMN "ProductionDemandId" SET NOT NULL;
ALTER TABLE "DeliveryHistory" ALTER COLUMN "ProductionDemandId" SET NOT NULL;
ALTER TABLE "ProductionBomSnapshot" ALTER COLUMN "ProductionDemandId" SET NOT NULL;
ALTER TABLE "ProductionTraceEvent" ALTER COLUMN "ProductionDemandId" SET NOT NULL;
ALTER TABLE "ShoppingCompletion" DROP CONSTRAINT "ShoppingCompletion_pkey";
ALTER TABLE "ShoppingCompletion" ALTER COLUMN "ForecastId" DROP NOT NULL;
ALTER TABLE "ShoppingCompletion" ADD CONSTRAINT "ShoppingCompletion_pkey" PRIMARY KEY ("ProductionDemandId");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastNonPo_ReferenceNumber_key" ON "ForecastNonPo"("ReferenceNumber");

-- CreateIndex
CREATE INDEX "ForecastNonPo_DeliveryDate_idx" ON "ForecastNonPo"("DeliveryDate");

-- CreateIndex
CREATE INDEX "ForecastNonPo_PartNumber_idx" ON "ForecastNonPo"("PartNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionDemand_ForecastPoId_key" ON "ProductionDemand"("ForecastPoId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionDemand_ForecastNonPoId_key" ON "ProductionDemand"("ForecastNonPoId");

-- CreateIndex
CREATE INDEX "ProductionDemand_ProductionReleaseId_idx" ON "ProductionDemand"("ProductionReleaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastNonPoImport_FileHash_key" ON "ForecastNonPoImport"("FileHash");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastNonPoImport_RequestId_key" ON "ForecastNonPoImport"("RequestId");

-- CreateIndex
CREATE INDEX "Shopping_forecastId_fkey" ON "Shopping"("ProductionDemandId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingCompletion_ForecastId_key" ON "ShoppingCompletion"("ForecastId");

-- CreateIndex
CREATE INDEX "ProductionReport_ProductionDemandId_idx" ON "ProductionReport"("ProductionDemandId");

-- CreateIndex
CREATE INDEX "LabelData_forecastId_fkey" ON "LabelData"("ProductionDemandId");

-- CreateIndex
CREATE INDEX "DeliveryHistory_forecastId_fkey" ON "DeliveryHistory"("ProductionDemandId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBomSnapshot_ProductionDemandId_ReleaseId_Version_key" ON "ProductionBomSnapshot"("ProductionDemandId", "ReleaseId", "Version");

-- CreateIndex
CREATE INDEX "ProductionFinding_ProductionDemandId_SubmittedAt_idx" ON "ProductionFinding"("ProductionDemandId", "SubmittedAt");

-- CreateIndex
CREATE INDEX "ProductionTraceEvent_ProductionDemandId_CreatedAt_Id_idx" ON "ProductionTraceEvent"("ProductionDemandId", "CreatedAt", "Id");

-- AddForeignKey
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_ProductionDemandId_fkey" FOREIGN KEY ("ProductionDemandId") REFERENCES "ProductionDemand"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingCompletion" ADD CONSTRAINT "ShoppingCompletion_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingCompletion" ADD CONSTRAINT "ShoppingCompletion_ProductionDemandId_fkey" FOREIGN KEY ("ProductionDemandId") REFERENCES "ProductionDemand"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionReport" ADD CONSTRAINT "ProductionReport_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionReport" ADD CONSTRAINT "ProductionReport_ProductionDemandId_fkey" FOREIGN KEY ("ProductionDemandId") REFERENCES "ProductionDemand"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelData" ADD CONSTRAINT "LabelData_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelData" ADD CONSTRAINT "LabelData_ProductionDemandId_fkey" FOREIGN KEY ("ProductionDemandId") REFERENCES "ProductionDemand"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryHistory" ADD CONSTRAINT "DeliveryHistory_ProductionDemandId_fkey" FOREIGN KEY ("ProductionDemandId") REFERENCES "ProductionDemand"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBomSnapshot" ADD CONSTRAINT "ProductionBomSnapshot_ProductionDemandId_fkey" FOREIGN KEY ("ProductionDemandId") REFERENCES "ProductionDemand"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionFinding" ADD CONSTRAINT "ProductionFinding_ProductionDemandId_fkey" FOREIGN KEY ("ProductionDemandId") REFERENCES "ProductionDemand"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTraceEvent" ADD CONSTRAINT "ProductionTraceEvent_ProductionDemandId_fkey" FOREIGN KEY ("ProductionDemandId") REFERENCES "ProductionDemand"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastNonPo" ADD CONSTRAINT "ForecastNonPo_PartNumber_fkey" FOREIGN KEY ("PartNumber") REFERENCES "FinishGood"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDemand" ADD CONSTRAINT "ProductionDemand_ForecastPoId_fkey" FOREIGN KEY ("ForecastPoId") REFERENCES "Forecast"("PoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDemand" ADD CONSTRAINT "ProductionDemand_ForecastNonPoId_fkey" FOREIGN KEY ("ForecastNonPoId") REFERENCES "ForecastNonPo"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDemand" ADD CONSTRAINT "ProductionDemand_ProductionReleaseId_fkey" FOREIGN KEY ("ProductionReleaseId") REFERENCES "ProductionRelease"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionDemand" ADD CONSTRAINT "ProductionDemand_one_source" CHECK (
 ("SourceType" = 'PO' AND "ForecastPoId" IS NOT NULL AND "ForecastNonPoId" IS NULL) OR
 ("SourceType" = 'NON_PO' AND "ForecastPoId" IS NULL AND "ForecastNonPoId" IS NOT NULL)
);
ALTER TABLE "ForecastNonPo" ADD CONSTRAINT "ForecastNonPo_positive_quantities" CHECK ("Qty" > 0 AND "DeliveryPeriod" > 0);
ALTER TABLE "Shopping" DROP CONSTRAINT "Shopping_traceability_shape";
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_traceability_shape" CHECK (
    ("Purpose" = 'STANDARD' AND "Type" = 'REGULER' AND "ProductionDemandId" IS NOT NULL AND "SnapshotLineId" IS NOT NULL)
    OR ("Purpose" = 'NON_PRODUCTION' AND "Type" = 'ADDITIONAL' AND "ProductionDemandId" IS NULL AND "SnapshotLineId" IS NULL)
    OR "Purpose" = 'LEGACY_UNCLASSIFIED'
);
ALTER TABLE "ProductionFinding" DROP CONSTRAINT "ProductionFinding_shape";
ALTER TABLE "ProductionFinding" ADD CONSTRAINT "ProductionFinding_shape" CHECK (
 ("Category" = 'MATERIAL' AND "MaterialId" IS NOT NULL AND "Location" IN ('WAREHOUSE', 'RACK', 'ASSY') AND "ProductionDemandId" IS NULL AND "ReleaseId" IS NULL AND "SnapshotId" IS NULL AND "LabelId" IS NULL)
 OR ("Category" = 'FINISH_GOOD' AND "MaterialId" IS NULL AND "Location" IS NULL AND "ProductionDemandId" IS NOT NULL AND "ReleaseId" IS NOT NULL AND "SnapshotId" IS NOT NULL AND "LabelId" IS NOT NULL)
);

-- This projection has no independent business data or write operations.
CREATE VIEW "ProductionOrder" AS
 SELECT f."Id", d."Id" AS "PoId", d."SourceType", f."Date", f."VendorCode", f."VendorName",
 f."ReceivingArea", f."DeliveryDate", f."DeliveryPeriod", f."Classification", f."PoNumber", f."Item", f."Qty", f."FinishGoodId",
 d."ProductionReleaseId", NULL::text AS "Notes"
 FROM "ProductionDemand" d JOIN "Forecast" f ON f."PoId" = d."ForecastPoId"
 UNION ALL
 SELECT -n."Id", d."Id", d."SourceType", n."CreatedAt", ''::text, ''::text,
 n."ReceivingArea", n."DeliveryDate", n."DeliveryPeriod", ''::text, COALESCE(n."PoNumber", ''), 0, n."Qty", n."PartNumber",
 d."ProductionReleaseId", n."Notes"
 FROM "ProductionDemand" d JOIN "ForecastNonPo" n ON n."Id" = d."ForecastNonPoId";

CREATE FUNCTION sync_po_demand() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
   INSERT INTO "ProductionDemand" ("Id", "SourceType", "ForecastPoId", "ProductionReleaseId") VALUES (NEW."PoId", 'PO', NEW."PoId", NEW."ProductionReleaseId");
 ELSE
   UPDATE "ProductionDemand" SET "Id" = NEW."PoId", "ProductionReleaseId" = NEW."ProductionReleaseId"
   WHERE "ForecastPoId" = NEW."PoId" AND ("Id" IS DISTINCT FROM NEW."PoId" OR "ProductionReleaseId" IS DISTINCT FROM NEW."ProductionReleaseId");
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_po_demand AFTER INSERT OR UPDATE ON "Forecast" FOR EACH ROW EXECUTE FUNCTION sync_po_demand();
CREATE FUNCTION sync_nonpo_demand() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
   INSERT INTO "ProductionDemand" ("Id", "SourceType", "ForecastNonPoId") VALUES (NEW."ReferenceNumber", 'NON_PO', NEW."Id");
 ELSIF NEW."ReferenceNumber" IS DISTINCT FROM OLD."ReferenceNumber" THEN
   RAISE EXCEPTION 'Non PO reference is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_nonpo_demand AFTER INSERT OR UPDATE ON "ForecastNonPo" FOR EACH ROW EXECUTE FUNCTION sync_nonpo_demand();

CREATE FUNCTION guard_demand_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind "DemandSource";
BEGIN
 IF NEW."ProductionReleaseId" IS NOT NULL THEN
   SELECT "SourceType" INTO kind FROM "ProductionRelease" WHERE "Id" = NEW."ProductionReleaseId";
   IF kind IS DISTINCT FROM NEW."SourceType" THEN RAISE EXCEPTION 'A release cannot mix PO and Non PO'; END IF;
 END IF;
 IF TG_OP = 'UPDATE' AND (NEW."SourceType" IS DISTINCT FROM OLD."SourceType" OR NEW."ForecastNonPoId" IS DISTINCT FROM OLD."ForecastNonPoId") THEN
   RAISE EXCEPTION 'Demand source is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_demand_source BEFORE INSERT OR UPDATE ON "ProductionDemand" FOR EACH ROW EXECUTE FUNCTION guard_demand_source();
CREATE FUNCTION mirror_legacy_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."SourceType" = 'PO' THEN
   UPDATE "Forecast" SET "ProductionReleaseId" = NEW."ProductionReleaseId"
   WHERE "PoId" = NEW."ForecastPoId" AND "ProductionReleaseId" IS DISTINCT FROM NEW."ProductionReleaseId";
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mirror_legacy_release AFTER UPDATE ON "ProductionDemand" FOR EACH ROW EXECUTE FUNCTION mirror_legacy_release();
CREATE FUNCTION immutable_release_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."SourceType" IS DISTINCT FROM OLD."SourceType" THEN RAISE EXCEPTION 'Release source is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_release_source BEFORE UPDATE ON "ProductionRelease" FOR EACH ROW EXECUTE FUNCTION immutable_release_source();

-- Legacy FK remains a real PO FK; it is NULL for Non PO transactions.
CREATE FUNCTION mirror_legacy_forecast_fk() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' AND NEW."ProductionDemandId" IS NULL AND NEW."ForecastId" IS NOT NULL THEN
   NEW."ProductionDemandId" := NEW."ForecastId";
 END IF;
 SELECT "ForecastPoId" INTO NEW."ForecastId" FROM "ProductionDemand" WHERE "Id" = NEW."ProductionDemandId";
 RETURN NEW;
END $$;
CREATE TRIGGER mirror_legacy_forecast_fk BEFORE INSERT OR UPDATE ON "Shopping" FOR EACH ROW EXECUTE FUNCTION mirror_legacy_forecast_fk();
CREATE TRIGGER mirror_legacy_forecast_fk BEFORE INSERT OR UPDATE ON "ShoppingCompletion" FOR EACH ROW EXECUTE FUNCTION mirror_legacy_forecast_fk();
CREATE TRIGGER mirror_legacy_forecast_fk BEFORE INSERT OR UPDATE ON "ProductionReport" FOR EACH ROW EXECUTE FUNCTION mirror_legacy_forecast_fk();
CREATE TRIGGER mirror_legacy_forecast_fk BEFORE INSERT OR UPDATE ON "LabelData" FOR EACH ROW EXECUTE FUNCTION mirror_legacy_forecast_fk();
CREATE TRIGGER mirror_legacy_forecast_fk BEFORE INSERT OR UPDATE ON "DeliveryHistory" FOR EACH ROW EXECUTE FUNCTION mirror_legacy_forecast_fk();
CREATE TRIGGER mirror_legacy_forecast_fk BEFORE INSERT OR UPDATE ON "ProductionBomSnapshot" FOR EACH ROW EXECUTE FUNCTION mirror_legacy_forecast_fk();
CREATE TRIGGER mirror_legacy_forecast_fk BEFORE INSERT OR UPDATE ON "ProductionFinding" FOR EACH ROW EXECUTE FUNCTION mirror_legacy_forecast_fk();
CREATE TRIGGER mirror_legacy_forecast_fk BEFORE INSERT OR UPDATE ON "ProductionTraceEvent" FOR EACH ROW EXECUTE FUNCTION mirror_legacy_forecast_fk();
CREATE TRIGGER audit_nonpo_forecast AFTER INSERT OR UPDATE OR DELETE ON "ForecastNonPo" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'ReferenceNumber,PartNumber,DeliveryDate,DeliveryPeriod,Qty');
CREATE TRIGGER audit_production_demand AFTER INSERT OR UPDATE OR DELETE ON "ProductionDemand" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'SourceType,ForecastPoId,ForecastNonPoId,ProductionReleaseId');
CREATE TRIGGER audit_nonpo_import AFTER INSERT OR UPDATE OR DELETE ON "ForecastNonPoImport" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'CreatedCount');
-- Keep operational audit references populated for both sources.
DROP TRIGGER "audit_shopping" ON "Shopping";
CREATE TRIGGER "audit_shopping" AFTER INSERT OR UPDATE OR DELETE ON "Shopping" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'ProductionDemandId,QtyPick,Purpose,SnapshotLineId,CommandId');
DROP TRIGGER "audit_report" ON "ProductionReport";
CREATE TRIGGER "audit_report" AFTER INSERT OR UPDATE OR DELETE ON "ProductionReport" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'ProductionDemandId,Qty,NgQty,ValidatedAt');
DROP TRIGGER "audit_label" ON "LabelData";
CREATE TRIGGER "audit_label" AFTER INSERT OR UPDATE OR DELETE ON "LabelData" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'ProductionDemandId,ProductionReleaseId,Scanned,QtyThisBox,RequiresAssembly');
DROP TRIGGER "audit_delivery" ON "DeliveryHistory";
CREATE TRIGGER "audit_delivery" AFTER INSERT OR UPDATE OR DELETE ON "DeliveryHistory" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'ProductionDemandId,LabelDataId,Qty');
DROP TRIGGER "audit_production_finding" ON "ProductionFinding";
CREATE TRIGGER "audit_production_finding" AFTER INSERT OR UPDATE OR DELETE ON "ProductionFinding" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'RecordNumber,Category,Status,Location,Qty,ProductionDemandId,ReleaseId,SnapshotId,LabelId,DeletedAt,DeletedBy');
COMMIT;
