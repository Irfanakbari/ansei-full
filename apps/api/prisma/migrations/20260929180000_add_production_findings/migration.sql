CREATE TYPE "ProductionFindingCategory" AS ENUM ('MATERIAL', 'FINISH_GOOD');
CREATE TYPE "ProductionFindingStatus" AS ENUM ('PENDING', 'WAITING_PART_CHANGE', 'COMPLETED', 'REJECTED');

CREATE TABLE "ProductionFinding" (
    "Id" TEXT NOT NULL,
    "FindingNumber" TEXT NOT NULL,
    "Category" "ProductionFindingCategory" NOT NULL,
    "Status" "ProductionFindingStatus" NOT NULL DEFAULT 'PENDING',
    "Location" "LocationType",
    "MaterialId" TEXT,
    "Qty" INTEGER NOT NULL,
    "Reason" TEXT NOT NULL,
    "Reporter" TEXT NOT NULL,
    "SubmittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ForecastId" TEXT,
    "ReleaseId" TEXT,
    "SnapshotId" TEXT,
    "LabelId" INTEGER,
    "ReviewedBy" TEXT,
    "ReviewedAt" TIMESTAMP(3),
    "ReviewNote" TEXT,
    "CompletedBy" TEXT,
    "CompletedAt" TIMESTAMP(3),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionFinding_pkey" PRIMARY KEY ("Id"),
    CONSTRAINT "ProductionFinding_positive_qty" CHECK ("Qty" > 0),
    CONSTRAINT "ProductionFinding_shape" CHECK (
      ("Category" = 'MATERIAL' AND "MaterialId" IS NOT NULL AND "Location" IN ('WAREHOUSE', 'RACK') AND "ForecastId" IS NULL AND "ReleaseId" IS NULL AND "SnapshotId" IS NULL AND "LabelId" IS NULL)
      OR
      ("Category" = 'FINISH_GOOD' AND "MaterialId" IS NULL AND "Location" IS NULL AND "ForecastId" IS NOT NULL AND "ReleaseId" IS NOT NULL AND "SnapshotId" IS NOT NULL AND "LabelId" IS NOT NULL)
    )
);

CREATE TABLE "ProductionFindingComponent" (
    "Id" TEXT NOT NULL,
    "FindingId" TEXT NOT NULL,
    "SnapshotLineId" TEXT NOT NULL,
    "MaterialId" TEXT NOT NULL,
    "Qty" INTEGER NOT NULL,
    CONSTRAINT "ProductionFindingComponent_pkey" PRIMARY KEY ("Id"),
    CONSTRAINT "ProductionFindingComponent_positive_qty" CHECK ("Qty" > 0)
);

CREATE TABLE "ProductionFindingAllocation" (
    "Id" TEXT NOT NULL,
    "FindingId" TEXT NOT NULL,
    "ComponentId" TEXT NOT NULL,
    "ShoppingId" TEXT NOT NULL,
    "Qty" INTEGER NOT NULL,
    "CreatedBy" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionFindingAllocation_pkey" PRIMARY KEY ("Id"),
    CONSTRAINT "ProductionFindingAllocation_positive_qty" CHECK ("Qty" > 0)
);

CREATE TABLE "ProductionFindingEvent" (
    "Id" TEXT NOT NULL,
    "FindingId" TEXT NOT NULL,
    "Type" TEXT NOT NULL,
    "Actor" TEXT NOT NULL,
    "Metadata" JSONB,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionFindingEvent_pkey" PRIMARY KEY ("Id")
);

CREATE UNIQUE INDEX "ProductionFinding_FindingNumber_key" ON "ProductionFinding"("FindingNumber");
CREATE INDEX "ProductionFinding_Status_SubmittedAt_idx" ON "ProductionFinding"("Status", "SubmittedAt");
CREATE INDEX "ProductionFinding_ForecastId_SubmittedAt_idx" ON "ProductionFinding"("ForecastId", "SubmittedAt");
CREATE INDEX "ProductionFinding_MaterialId_SubmittedAt_idx" ON "ProductionFinding"("MaterialId", "SubmittedAt");
CREATE UNIQUE INDEX "ProductionFindingComponent_FindingId_SnapshotLineId_key" ON "ProductionFindingComponent"("FindingId", "SnapshotLineId");
CREATE INDEX "ProductionFindingComponent_MaterialId_idx" ON "ProductionFindingComponent"("MaterialId");
CREATE UNIQUE INDEX "ProductionFindingAllocation_ShoppingId_key" ON "ProductionFindingAllocation"("ShoppingId");
CREATE INDEX "ProductionFindingAllocation_FindingId_CreatedAt_idx" ON "ProductionFindingAllocation"("FindingId", "CreatedAt");
CREATE INDEX "ProductionFindingAllocation_ComponentId_idx" ON "ProductionFindingAllocation"("ComponentId");
CREATE INDEX "ProductionFindingEvent_FindingId_CreatedAt_idx" ON "ProductionFindingEvent"("FindingId", "CreatedAt");

ALTER TABLE "ProductionFinding" ADD CONSTRAINT "ProductionFinding_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionFinding" ADD CONSTRAINT "ProductionFinding_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionFinding" ADD CONSTRAINT "ProductionFinding_ReleaseId_fkey" FOREIGN KEY ("ReleaseId") REFERENCES "ProductionRelease"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionFinding" ADD CONSTRAINT "ProductionFinding_SnapshotId_fkey" FOREIGN KEY ("SnapshotId") REFERENCES "ProductionBomSnapshot"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionFinding" ADD CONSTRAINT "ProductionFinding_LabelId_fkey" FOREIGN KEY ("LabelId") REFERENCES "LabelData"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionFindingComponent" ADD CONSTRAINT "ProductionFindingComponent_FindingId_fkey" FOREIGN KEY ("FindingId") REFERENCES "ProductionFinding"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionFindingComponent" ADD CONSTRAINT "ProductionFindingComponent_SnapshotLineId_fkey" FOREIGN KEY ("SnapshotLineId") REFERENCES "ProductionBomSnapshotLine"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionFindingComponent" ADD CONSTRAINT "ProductionFindingComponent_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionFindingAllocation" ADD CONSTRAINT "ProductionFindingAllocation_FindingId_fkey" FOREIGN KEY ("FindingId") REFERENCES "ProductionFinding"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionFindingAllocation" ADD CONSTRAINT "ProductionFindingAllocation_ComponentId_fkey" FOREIGN KEY ("ComponentId") REFERENCES "ProductionFindingComponent"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionFindingAllocation" ADD CONSTRAINT "ProductionFindingAllocation_ShoppingId_fkey" FOREIGN KEY ("ShoppingId") REFERENCES "Shopping"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionFindingEvent" ADD CONSTRAINT "ProductionFindingEvent_FindingId_fkey" FOREIGN KEY ("FindingId") REFERENCES "ProductionFinding"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_production_finding_event_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Production finding events are append-only';
END;
$$;
CREATE TRIGGER "production_finding_event_immutable" BEFORE UPDATE OR DELETE ON "ProductionFindingEvent" FOR EACH ROW EXECUTE FUNCTION "reject_production_finding_event_mutation"();

INSERT INTO "MTCPermission" ("Action", "Description", "CreateDate", "CreateBy", "UpdateDate", "UpdateBy")
VALUES ('IPCS.MATERIAL_NG_REVIEW', 'Review production findings and NG', CURRENT_TIMESTAMP, 'SYSTEM', CURRENT_TIMESTAMP, 'SYSTEM')
ON CONFLICT ("Action") DO NOTHING;
