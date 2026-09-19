CREATE TABLE "ActionAuditEvent" (
  "Id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "SourceType" TEXT NOT NULL, "SourceId" TEXT NOT NULL, "Action" TEXT NOT NULL,
  "Actor" TEXT, "ActorSource" TEXT NOT NULL, "RequestId" TEXT, "ProcessId" TEXT,
  "Before" JSONB, "After" JSONB, "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionAuditEvent_pkey" PRIMARY KEY ("Id"),
  CONSTRAINT "ActionAuditEvent_ProcessId_fkey" FOREIGN KEY ("ProcessId") REFERENCES "LogProcess"("ProcessId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ActionAuditEvent_CreatedAt_Id_idx" ON "ActionAuditEvent"("CreatedAt", "Id");
CREATE INDEX "ActionAuditEvent_ProcessId_CreatedAt_idx" ON "ActionAuditEvent"("ProcessId", "CreatedAt");
CREATE INDEX "ActionAuditEvent_RequestId_CreatedAt_idx" ON "ActionAuditEvent"("RequestId", "CreatedAt");
CREATE INDEX "ActionAuditEvent_SourceType_SourceId_CreatedAt_idx" ON "ActionAuditEvent"("SourceType", "SourceId", "CreatedAt");
CREATE TRIGGER "action_audit_immutable" BEFORE UPDATE OR DELETE ON "ActionAuditEvent" FOR EACH ROW EXECUTE FUNCTION "reject_history_mutation"();
CREATE TRIGGER "log_detail_immutable" BEFORE UPDATE OR DELETE ON "LogProcessDetail" FOR EACH ROW EXECUTE FUNCTION "reject_history_mutation"();

-- No payloads, names, contact details, credentials, signatures or free-text notes.
-- Each trigger supplies an explicit allowlist of operational fields.
CREATE FUNCTION "capture_action_audit"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous JSONB; current_row JSONB; before_values JSONB; after_values JSONB;
  actor_id TEXT; actor_source TEXT; process_id TEXT; row_id TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN previous := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN current_row := to_jsonb(NEW); END IF;
  SELECT jsonb_object_agg(key, value) INTO before_values FROM jsonb_each(previous) WHERE key = ANY(string_to_array(TG_ARGV[1], ','));
  SELECT jsonb_object_agg(key, value) INTO after_values FROM jsonb_each(current_row) WHERE key = ANY(string_to_array(TG_ARGV[1], ','));
  -- Keep all writes, including changes to fields deliberately excluded from audit.
  row_id := COALESCE(current_row->>TG_ARGV[0], previous->>TG_ARGV[0]);
  actor_id := NULLIF(current_setting('ansei.actor', true), '');
  actor_source := CASE WHEN actor_id IS NOT NULL THEN 'REQUEST_CONTEXT' ELSE 'UNATTRIBUTED' END;
  IF actor_id IS NULL AND TG_OP = 'INSERT' THEN
    actor_id := COALESCE(current_row->>'CreatedBy', current_row->>'Actor');
    IF actor_id IS NOT NULL THEN actor_source := 'RECORD_CREATOR'; END IF;
  END IF;
  -- Never infer the actor of an UPDATE or DELETE from an old CreatedBy/UpdatedBy.
  process_id := NULLIF(current_setting('ansei.process_id', true), '');
  IF TG_TABLE_NAME = 'LogProcess' THEN process_id := row_id; END IF;
  INSERT INTO "ActionAuditEvent" ("SourceType", "SourceId", "Action", "Actor", "ActorSource", "RequestId", "ProcessId", "Before", "After")
    VALUES (TG_TABLE_NAME, row_id, TG_OP, actor_id, actor_source,
      NULLIF(current_setting('ansei.request_id', true), ''), process_id, before_values, after_values);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "audit_stock" AFTER INSERT OR UPDATE OR DELETE ON "InventoryLedger" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'ItemCategory,Location,TransactionType,ReferenceDoc,BalanceBefore,QtyIn,QtyOut,BalanceAfter');
CREATE TRIGGER "audit_shopping" AFTER INSERT OR UPDATE OR DELETE ON "Shopping" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'ForecastId,QtyPick,Purpose,SnapshotLineId,MaterialNgId,CommandId');
CREATE TRIGGER "audit_ng" AFTER INSERT OR UPDATE OR DELETE ON "MaterialNgCase" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'ForecastId,ReleaseId,SnapshotId,Status,Stage');
CREATE TRIGGER "audit_ng_detail" AFTER INSERT OR UPDATE OR DELETE ON "MaterialNG" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'CaseId,SnapshotLineId,Qty,ReplacementRequestedQty');
CREATE TRIGGER "audit_bom" AFTER INSERT OR UPDATE OR DELETE ON "BomRevision" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'FinishGoodId,Revision,Status,Version,BaseRevisionId');
CREATE TRIGGER "audit_bom_line" AFTER INSERT OR UPDATE OR DELETE ON "BomRevisionLine" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'RevisionId,MaterialId,Qty');
CREATE TRIGGER "audit_forecast" AFTER INSERT OR UPDATE OR DELETE ON "Forecast" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'PoId,Qty,ProductionReleaseId,FinishGoodId');
CREATE TRIGGER "audit_release" AFTER INSERT OR UPDATE OR DELETE ON "ProductionRelease" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'Status,TotalTargetQty,TotalGoodQty,TotalNgQty,TotalProductionMinutes');
CREATE TRIGGER "audit_incoming" AFTER INSERT OR UPDATE OR DELETE ON "Incoming" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'Closed,ApprovedAt');
CREATE TRIGGER "audit_incoming_line" AFTER INSERT OR UPDATE OR DELETE ON "IncomingMaterial" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'IncomingId,MaterialId,Qty,QtyChecked');
CREATE TRIGGER "audit_report" AFTER INSERT OR UPDATE OR DELETE ON "ProductionReport" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'ForecastId,Qty,NgQty,ValidatedAt');
CREATE TRIGGER "audit_assembly" AFTER INSERT OR UPDATE OR DELETE ON "AssemblySession" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'LabelDataId,Status,StartRequestId,CompleteRequestId');
CREATE TRIGGER "audit_label" AFTER INSERT OR UPDATE OR DELETE ON "LabelData" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'ForecastId,ProductionReleaseId,Scanned,QtyThisBox,RequiresAssembly');
CREATE TRIGGER "audit_delivery" AFTER INSERT OR UPDATE OR DELETE ON "DeliveryHistory" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'ForecastId,LabelDataId,Qty');
CREATE TRIGGER "audit_process" AFTER INSERT OR UPDATE ON "LogProcess" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('ProcessId', 'FunctionId,FunctionName,ProcessStatus,ProcessStart,ProcessEnd');
CREATE TRIGGER "audit_command" AFTER INSERT OR UPDATE ON "BusinessCommand" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'Scope,RequestId');

CREATE FUNCTION "protect_completed_command"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."Result" IS NOT NULL OR
    (to_jsonb(NEW) - 'Result') IS DISTINCT FROM (to_jsonb(OLD) - 'Result') THEN
    RAISE EXCEPTION 'Business commands are immutable after completion';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "command_immutable" BEFORE UPDATE OR DELETE ON "BusinessCommand" FOR EACH ROW EXECUTE FUNCTION "protect_completed_command"();

CREATE TRIGGER "audit_opname" AFTER INSERT OR UPDATE OR DELETE ON "StockOpname" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'Status,Category,Tolerance,StartedAt,CompletedAt');
CREATE TRIGGER "audit_opname_detail" AFTER INSERT OR UPDATE OR DELETE ON "StockOpnameDetail" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'OpnameId,Location,SystemQty,SystemQtyRack,ActualQty,ActualQtyRack,DiffQty,DiffQtyRack');

CREATE FUNCTION "protect_process_history"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."ProcessEnd" IS NOT NULL OR
    (to_jsonb(NEW) - 'ProcessStatus' - 'ProcessEnd') IS DISTINCT FROM (to_jsonb(OLD) - 'ProcessStatus' - 'ProcessEnd') THEN
    RAISE EXCEPTION 'Completed process history is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "process_history_immutable" BEFORE UPDATE OR DELETE ON "LogProcess" FOR EACH ROW EXECUTE FUNCTION "protect_process_history"();

CREATE TRIGGER "audit_material" AFTER INSERT OR UPDATE OR DELETE ON "Material" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'QtyWarehouse,QtyRack,IsActive');
CREATE TRIGGER "audit_finish_good" AFTER INSERT OR UPDATE OR DELETE ON "FinishGood" FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'Qty,IsActive,ActiveBomRevisionId');
