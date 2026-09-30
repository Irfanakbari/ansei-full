ALTER TABLE "ProductionFindingComponent" ALTER COLUMN "SnapshotLineId" DROP NOT NULL;
ALTER TABLE "ProductionFinding" DROP CONSTRAINT "ProductionFinding_shape";
ALTER TABLE "ProductionFinding" ADD CONSTRAINT "ProductionFinding_shape" CHECK (
  ("Category" = 'MATERIAL' AND "MaterialId" IS NOT NULL AND "Location" IN ('WAREHOUSE', 'RACK', 'ASSY') AND "ForecastId" IS NULL AND "ReleaseId" IS NULL AND "SnapshotId" IS NULL AND "LabelId" IS NULL)
  OR
  ("Category" = 'FINISH_GOOD' AND "MaterialId" IS NULL AND "Location" IS NULL AND "ForecastId" IS NOT NULL AND "ReleaseId" IS NOT NULL AND "SnapshotId" IS NOT NULL AND "LabelId" IS NOT NULL)
);
CREATE UNIQUE INDEX "ProductionFindingComponent_FindingId_ASSY_key" ON "ProductionFindingComponent"("FindingId") WHERE "SnapshotLineId" IS NULL;

CREATE TABLE "RecordNumberCounter" (
  "Id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "Prefix" TEXT NOT NULL,
  "BusinessDate" DATE NOT NULL,
  "LastSequence" INTEGER NOT NULL,
  "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecordNumberCounter_pkey" PRIMARY KEY ("Id"),
  CONSTRAINT "RecordNumberCounter_sequence_check" CHECK ("LastSequence" BETWEEN 1 AND 99)
);
CREATE UNIQUE INDEX "RecordNumberCounter_Prefix_BusinessDate_key" ON "RecordNumberCounter"("Prefix", "BusinessDate");
ALTER TABLE "ProductionFinding" ADD COLUMN "RecordNumber" TEXT;
ALTER TABLE "ProductionFinding" ADD COLUMN "DeletedAt" TIMESTAMP(3);
ALTER TABLE "ProductionFinding" ADD COLUMN "DeletedBy" TEXT;
ALTER TABLE "StockOpname" ADD COLUMN "RecordNumber" TEXT;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM (SELECT ("CreatedAt" AT TIME ZONE 'Asia/Jakarta')::date, count(*) FROM "ProductionFinding" GROUP BY 1 HAVING count(*) > 99) excess) THEN
    RAISE EXCEPTION 'ProductionFinding backfill exceeds 99 records for at least one Asia/Jakarta business date';
  END IF;
  IF EXISTS (SELECT 1 FROM (SELECT ("CreatedAt" AT TIME ZONE 'Asia/Jakarta')::date, count(*) FROM "StockOpname" GROUP BY 1 HAVING count(*) > 99) excess) THEN
    RAISE EXCEPTION 'StockOpname backfill exceeds 99 records for at least one Asia/Jakarta business date';
  END IF;
END $$;
WITH ranked AS (
  SELECT "Id", ("CreatedAt" AT TIME ZONE 'Asia/Jakarta')::date AS business_date,
    row_number() OVER (PARTITION BY ("CreatedAt" AT TIME ZONE 'Asia/Jakarta')::date ORDER BY "CreatedAt", "Id") AS sequence
  FROM "ProductionFinding"
)
UPDATE "ProductionFinding" finding SET "RecordNumber" = 'ANR-' || to_char(ranked.business_date, 'DDMMYY') || lpad(ranked.sequence::text, 2, '0') FROM ranked WHERE finding."Id" = ranked."Id";
WITH ranked AS (
  SELECT "Id", ("CreatedAt" AT TIME ZONE 'Asia/Jakarta')::date AS business_date,
    row_number() OVER (PARTITION BY ("CreatedAt" AT TIME ZONE 'Asia/Jakarta')::date ORDER BY "CreatedAt", "Id") AS sequence
  FROM "StockOpname"
)
UPDATE "StockOpname" opname SET "RecordNumber" = 'AIC-' || to_char(ranked.business_date, 'DDMMYY') || lpad(ranked.sequence::text, 2, '0') FROM ranked WHERE opname."Id" = ranked."Id";
INSERT INTO "RecordNumberCounter" ("Prefix", "BusinessDate", "LastSequence") SELECT 'ANR', ("CreatedAt" AT TIME ZONE 'Asia/Jakarta')::date, count(*)::integer FROM "ProductionFinding" GROUP BY 2;
INSERT INTO "RecordNumberCounter" ("Prefix", "BusinessDate", "LastSequence") SELECT 'AIC', ("CreatedAt" AT TIME ZONE 'Asia/Jakarta')::date, count(*)::integer FROM "StockOpname" GROUP BY 2;
ALTER TABLE "ProductionFinding" ALTER COLUMN "RecordNumber" SET NOT NULL;
ALTER TABLE "StockOpname" ALTER COLUMN "RecordNumber" SET NOT NULL;
CREATE UNIQUE INDEX "ProductionFinding_RecordNumber_key" ON "ProductionFinding"("RecordNumber");
CREATE UNIQUE INDEX "StockOpname_RecordNumber_key" ON "StockOpname"("RecordNumber");
DROP INDEX "ProductionFinding_FindingNumber_key";
DROP INDEX "StockOpname_OpnameNumber_key";
ALTER TABLE "ProductionFinding" DROP COLUMN "FindingNumber";
ALTER TABLE "StockOpname" DROP COLUMN "OpnameNumber";
DROP TRIGGER IF EXISTS "audit_opname" ON "StockOpname";
CREATE TRIGGER "audit_opname" AFTER INSERT OR UPDATE OR DELETE ON "StockOpname" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'RecordNumber,Status,Category,Tolerance,StartedAt,CompletedAt');
CREATE TRIGGER "audit_production_finding" AFTER INSERT OR UPDATE OR DELETE ON "ProductionFinding" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'RecordNumber,Category,Status,Location,Qty,ForecastId,ReleaseId,SnapshotId,LabelId,DeletedAt,DeletedBy');
CREATE TRIGGER "audit_record_number_counter" AFTER INSERT OR UPDATE OR DELETE ON "RecordNumberCounter" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'Prefix,BusinessDate,LastSequence');
