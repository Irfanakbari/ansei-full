-- CreateEnum
CREATE TYPE "PrintDocumentType" AS ENUM ('PART_TAG_ANSEI');

-- CreateEnum
CREATE TYPE "PrintAgentStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "PrintEnrollmentStatus" AS ENUM ('PENDING', 'CONSUMED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PrintCredentialStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ProfilePrinterStatus" AS ENUM ('READY', 'DISABLED');

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('QUEUED', 'LEASED', 'DOWNLOADED', 'SPOOLING', 'SUCCEEDED', 'FAILED', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "PrintJobEventType" AS ENUM ('CREATED', 'LEASED', 'RENEWED', 'DOWNLOADED', 'SPOOLING', 'SUCCEEDED', 'FAILED', 'LEASE_EXPIRED');

-- DropTable: this migration intentionally removes only the legacy printer configuration table.
DROP TABLE "PrinterSetting";

-- CreateTable
CREATE TABLE "PrintAgent" (
    "Id" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    "Status" "PrintAgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "LastHeartbeatAt" TIMESTAMP(3),
    "Version" TEXT,
    "Metadata" JSONB,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "UpdatedBy" TEXT NOT NULL,
    CONSTRAINT "PrintAgent_pkey" PRIMARY KEY ("Id")
);

CREATE TABLE "PrintAgentEnrollment" (
    "Id" TEXT NOT NULL,
    "AgentId" TEXT NOT NULL,
    "TokenHash" VARCHAR(64) NOT NULL,
    "TokenPrefix" VARCHAR(16) NOT NULL,
    "Status" "PrintEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "ExpiresAt" TIMESTAMP(3) NOT NULL,
    "ConsumedAt" TIMESTAMP(3),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    CONSTRAINT "PrintAgentEnrollment_pkey" PRIMARY KEY ("Id")
);

CREATE TABLE "PrintAgentCredential" (
    "Id" TEXT NOT NULL,
    "AgentId" TEXT NOT NULL,
    "SecretHash" VARCHAR(64) NOT NULL,
    "SecretPrefix" VARCHAR(16) NOT NULL,
    "Status" "PrintCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "LastUsedAt" TIMESTAMP(3),
    "ExpiresAt" TIMESTAMP(3),
    "RevokedAt" TIMESTAMP(3),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    CONSTRAINT "PrintAgentCredential_pkey" PRIMARY KEY ("Id")
);

CREATE TABLE "ProfilePrinter" (
    "Id" TEXT NOT NULL,
    "AgentId" TEXT NOT NULL,
    "ExternalId" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    "DocumentType" "PrintDocumentType" NOT NULL,
    "Status" "ProfilePrinterStatus" NOT NULL DEFAULT 'READY',
    "IsDefault" BOOLEAN NOT NULL DEFAULT false,
    "Revision" INTEGER NOT NULL,
    "ProfileSnapshot" JSONB NOT NULL,
    "SyncedAt" TIMESTAMP(3) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProfilePrinter_pkey" PRIMARY KEY ("Id")
);

CREATE TABLE "PrintJob" (
    "Id" TEXT NOT NULL,
    "OutboxEventId" TEXT NOT NULL,
    "ProfileId" TEXT NOT NULL,
    "AgentId" TEXT NOT NULL,
    "DocumentType" "PrintDocumentType" NOT NULL,
    "Status" "PrintJobStatus" NOT NULL DEFAULT 'QUEUED',
    "PayloadSnapshot" JSONB NOT NULL,
    "ProfileSnapshot" JSONB NOT NULL,
    "Attempt" INTEGER NOT NULL DEFAULT 0,
    "LeaseTokenHash" VARCHAR(64),
    "LeaseExpiresAt" TIMESTAMP(3),
    "DownloadedAt" TIMESTAMP(3),
    "SpoolingAt" TIMESTAMP(3),
    "SucceededAt" TIMESTAMP(3),
    "FailedAt" TIMESTAMP(3),
    "ErrorCode" VARCHAR(64),
    "ErrorMessage" VARCHAR(500),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("Id")
);

CREATE TABLE "PrintJobEvent" (
    "Id" TEXT NOT NULL,
    "JobId" TEXT NOT NULL,
    "AgentId" TEXT,
    "Type" "PrintJobEventType" NOT NULL,
    "FromStatus" "PrintJobStatus",
    "ToStatus" "PrintJobStatus" NOT NULL,
    "Attempt" INTEGER NOT NULL,
    "Detail" JSONB,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrintJobEvent_pkey" PRIMARY KEY ("Id")
);

CREATE INDEX "PrintAgent_Status_LastHeartbeatAt_idx" ON "PrintAgent"("Status", "LastHeartbeatAt");
CREATE UNIQUE INDEX "PrintAgentEnrollment_TokenHash_key" ON "PrintAgentEnrollment"("TokenHash");
CREATE INDEX "PrintAgentEnrollment_AgentId_Status_idx" ON "PrintAgentEnrollment"("AgentId", "Status");
CREATE INDEX "PrintAgentEnrollment_ExpiresAt_idx" ON "PrintAgentEnrollment"("ExpiresAt");
CREATE UNIQUE INDEX "PrintAgentCredential_SecretHash_key" ON "PrintAgentCredential"("SecretHash");
CREATE INDEX "PrintAgentCredential_AgentId_Status_idx" ON "PrintAgentCredential"("AgentId", "Status");
CREATE INDEX "ProfilePrinter_DocumentType_Status_IsDefault_idx" ON "ProfilePrinter"("DocumentType", "Status", "IsDefault");
CREATE UNIQUE INDEX "ProfilePrinter_AgentId_ExternalId_key" ON "ProfilePrinter"("AgentId", "ExternalId");
CREATE UNIQUE INDEX "ProfilePrinter_ready_default_document_type_key" ON "ProfilePrinter"("DocumentType") WHERE "Status" = 'READY' AND "IsDefault" = true;
CREATE UNIQUE INDEX "PrintJob_OutboxEventId_key" ON "PrintJob"("OutboxEventId");
CREATE INDEX "PrintJob_AgentId_Status_CreatedAt_idx" ON "PrintJob"("AgentId", "Status", "CreatedAt");
CREATE INDEX "PrintJob_LeaseExpiresAt_idx" ON "PrintJob"("LeaseExpiresAt");
CREATE INDEX "PrintJobEvent_JobId_CreatedAt_idx" ON "PrintJobEvent"("JobId", "CreatedAt");

ALTER TABLE "PrintAgentEnrollment" ADD CONSTRAINT "PrintAgentEnrollment_AgentId_fkey" FOREIGN KEY ("AgentId") REFERENCES "PrintAgent"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrintAgentCredential" ADD CONSTRAINT "PrintAgentCredential_AgentId_fkey" FOREIGN KEY ("AgentId") REFERENCES "PrintAgent"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfilePrinter" ADD CONSTRAINT "ProfilePrinter_AgentId_fkey" FOREIGN KEY ("AgentId") REFERENCES "PrintAgent"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_OutboxEventId_fkey" FOREIGN KEY ("OutboxEventId") REFERENCES "OutboxEvent"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_ProfileId_fkey" FOREIGN KEY ("ProfileId") REFERENCES "ProfilePrinter"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_AgentId_fkey" FOREIGN KEY ("AgentId") REFERENCES "PrintAgent"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrintJobEvent" ADD CONSTRAINT "PrintJobEvent_JobId_fkey" FOREIGN KEY ("JobId") REFERENCES "PrintJob"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrintJobEvent" ADD CONSTRAINT "PrintJobEvent_AgentId_fkey" FOREIGN KEY ("AgentId") REFERENCES "PrintAgent"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
