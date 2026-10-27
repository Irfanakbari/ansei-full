-- Add nullable authenticated-user attribution while preserving physical manpower attribution.
ALTER TABLE "AssemblySession" ADD COLUMN "UserId" TEXT;

CREATE INDEX "AssemblySession_UserId_idx" ON "AssemblySession"("UserId");

ALTER TABLE "AssemblySession"
ADD CONSTRAINT "AssemblySession_UserId_fkey"
FOREIGN KEY ("UserId") REFERENCES "MTCUserManagement"("UserId")
ON DELETE SET NULL ON UPDATE CASCADE;
