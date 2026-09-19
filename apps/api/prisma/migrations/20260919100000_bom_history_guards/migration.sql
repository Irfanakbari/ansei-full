-- Legacy classification preserves uncertainty; no historical BOM is reconstructed.
UPDATE "Shopping" SET "Purpose" = 'STANDARD' WHERE "Type" = 'REGULER';

ALTER TABLE "BomRevisionLine" ADD CONSTRAINT "BomRevisionLine_positive_qty" CHECK ("Qty" > 0);
ALTER TABLE "ProductionBomSnapshot" ADD CONSTRAINT "Snapshot_positive_target" CHECK ("TargetQty" > 0 AND "Version" > 0);
ALTER TABLE "ProductionBomSnapshotLine" ADD CONSTRAINT "SnapshotLine_positive_qty" CHECK ("QtyPerUnit" > 0 AND "RequiredQty" > 0);
ALTER TABLE "MaterialNG" ADD CONSTRAINT "MaterialNG_replacement_bounds" CHECK ("CaseId" IS NULL OR ("Qty" > 0 AND "ReplacementRequestedQty" BETWEEN 0 AND "Qty"));
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_command_purpose" CHECK (
  "CommandId" IS NULL OR (
    "QtyPick" > 0 AND (
      ("Purpose" = 'STANDARD' AND "Type" = 'REGULER' AND "ForecastId" IS NOT NULL AND "SnapshotLineId" IS NOT NULL AND "MaterialNgId" IS NULL)
      OR ("Purpose" = 'NG_REPLACEMENT' AND "Type" = 'ADDITIONAL' AND "ForecastId" IS NOT NULL AND "SnapshotLineId" IS NOT NULL AND "MaterialNgId" IS NOT NULL)
      OR ("Purpose" = 'NON_PRODUCTION' AND "Type" = 'ADDITIONAL' AND "ForecastId" IS NULL AND COALESCE(length(trim("Destination")), 0) > 0 AND COALESCE(length(trim("Description")), 0) > 0)
    )
  )
);

CREATE FUNCTION "reject_history_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical evidence is append-only: %', TG_TABLE_NAME;
END;
$$;
CREATE TRIGGER "snapshot_immutable" BEFORE UPDATE OR DELETE ON "ProductionBomSnapshot" FOR EACH ROW EXECUTE FUNCTION "reject_history_mutation"();
CREATE TRIGGER "snapshot_line_immutable" BEFORE UPDATE OR DELETE ON "ProductionBomSnapshotLine" FOR EACH ROW EXECUTE FUNCTION "reject_history_mutation"();
CREATE TRIGGER "trace_immutable" BEFORE UPDATE OR DELETE ON "ProductionTraceEvent" FOR EACH ROW EXECUTE FUNCTION "reject_history_mutation"();
CREATE TRIGGER "revision_event_immutable" BEFORE UPDATE OR DELETE ON "BomRevisionEvent" FOR EACH ROW EXECUTE FUNCTION "reject_history_mutation"();

CREATE FUNCTION "protect_approved_bom"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'BomRevision' THEN
    IF OLD."Status" = 'APPROVED' THEN RAISE EXCEPTION 'Approved BOM is immutable'; END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM "BomRevision" WHERE "Id" = COALESCE(NEW."RevisionId", OLD."RevisionId") AND "Status" = 'APPROVED')
      OR (TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM "BomRevision" WHERE "Id" = OLD."RevisionId" AND "Status" = 'APPROVED'))
    THEN RAISE EXCEPTION 'Approved BOM components are immutable'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "approved_bom_immutable" BEFORE UPDATE OR DELETE ON "BomRevision" FOR EACH ROW EXECUTE FUNCTION "protect_approved_bom"();
CREATE TRIGGER "approved_bom_lines_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "BomRevisionLine" FOR EACH ROW EXECUTE FUNCTION "protect_approved_bom"();

CREATE FUNCTION "validate_active_bom"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."ActiveBomRevisionId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "BomRevision" WHERE "Id" = NEW."ActiveBomRevisionId" AND "FinishGoodId" = NEW."Id" AND "Status" = 'APPROVED'
  ) THEN RAISE EXCEPTION 'Active BOM must be approved for this finish good'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER "active_bom_approved" AFTER INSERT OR UPDATE ON "FinishGood" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_active_bom"();
