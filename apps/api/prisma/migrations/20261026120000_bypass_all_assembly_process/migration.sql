CREATE TABLE "AssemblyProcessSetting" (
    "Id" INTEGER NOT NULL,
    "BypassAllAssembly" BOOLEAN NOT NULL DEFAULT false,
    "ChangeReason" TEXT,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "UpdatedBy" TEXT NOT NULL,
    CONSTRAINT "AssemblyProcessSetting_pkey" PRIMARY KEY ("Id"),
    CONSTRAINT "AssemblyProcessSetting_singleton_check" CHECK ("Id" = 1)
);

INSERT INTO "AssemblyProcessSetting" (
    "Id",
    "BypassAllAssembly",
    "ChangeReason",
    "UpdatedAt",
    "UpdatedBy"
) VALUES (1, false, 'Initial disabled state', CURRENT_TIMESTAMP, 'SYSTEM');

ALTER TABLE "LabelData"
ADD COLUMN "BypassAssembly" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AssemblySession"
ALTER COLUMN "ManPowerUid" DROP NOT NULL;

CREATE TRIGGER "audit_assembly_process_setting"
AFTER INSERT OR UPDATE OR DELETE ON "AssemblyProcessSetting"
FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'BypassAllAssembly,ChangeReason,UpdatedAt,UpdatedBy');

DROP TRIGGER "audit_label" ON "LabelData";
CREATE TRIGGER "audit_label"
AFTER INSERT OR UPDATE OR DELETE ON "LabelData"
FOR EACH ROW EXECUTE FUNCTION "capture_action_audit"('Id', 'ProductionDemandId,ProductionReleaseId,Scanned,QtyThisBox,RequiresAssembly,BypassAssembly');
