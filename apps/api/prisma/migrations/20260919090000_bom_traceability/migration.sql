-- CreateEnum
CREATE TYPE "BomRevisionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShoppingPurpose" AS ENUM ('STANDARD', 'NG_REPLACEMENT', 'NON_PRODUCTION', 'LEGACY_UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "MaterialNgCaseStatus" AS ENUM ('OPEN', 'FULFILLED', 'CLOSED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "Shopping" DROP CONSTRAINT "Shopping_ForecastId_fkey";

-- AlterTable
ALTER TABLE "FinishGood" ADD COLUMN     "ActiveBomRevisionId" TEXT;

-- AlterTable
ALTER TABLE "MaterialNG" ADD COLUMN     "CaseId" TEXT,
ADD COLUMN     "ReplacementRequestedQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "SnapshotLineId" TEXT;

-- AlterTable
ALTER TABLE "Shopping" ADD COLUMN     "CommandId" TEXT,
ADD COLUMN     "Destination" TEXT,
ADD COLUMN     "MaterialNgId" INTEGER,
ADD COLUMN     "Purpose" "ShoppingPurpose" NOT NULL DEFAULT 'LEGACY_UNCLASSIFIED',
ADD COLUMN     "SnapshotLineId" TEXT;

-- CreateTable
CREATE TABLE "BomRevision" (
    "Id" TEXT NOT NULL,
    "FinishGoodId" INTEGER NOT NULL,
    "Revision" INTEGER NOT NULL,
    "Status" "BomRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "BaseRevisionId" TEXT,
    "Reason" TEXT NOT NULL,
    "Version" INTEGER NOT NULL DEFAULT 1,
    "CreatedBy" TEXT NOT NULL,
    "LastEditedBy" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "SubmittedBy" TEXT,
    "SubmittedAt" TIMESTAMP(3),
    "ApprovedBy" TEXT,
    "ApprovedAt" TIMESTAMP(3),

    CONSTRAINT "BomRevision_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "BomRevisionLine" (
    "Id" TEXT NOT NULL,
    "RevisionId" TEXT NOT NULL,
    "MaterialId" INTEGER NOT NULL,
    "Qty" INTEGER NOT NULL,
    "PartNumber" TEXT NOT NULL,
    "PartName" TEXT NOT NULL,
    "UnitName" TEXT,

    CONSTRAINT "BomRevisionLine_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "BomRevisionEvent" (
    "Id" TEXT NOT NULL,
    "RevisionId" TEXT NOT NULL,
    "Action" TEXT NOT NULL,
    "Actor" TEXT NOT NULL,
    "Reason" TEXT NOT NULL,
    "Version" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BomRevisionEvent_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProductionBomSnapshot" (
    "Id" TEXT NOT NULL,
    "ForecastId" TEXT NOT NULL,
    "ReleaseId" TEXT NOT NULL,
    "RevisionId" TEXT NOT NULL,
    "Version" INTEGER NOT NULL,
    "PreviousId" TEXT,
    "TargetQty" INTEGER NOT NULL,
    "FinishGoodPartNumber" TEXT NOT NULL,
    "FinishGoodPartName" TEXT NOT NULL,
    "CreatedBy" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionBomSnapshot_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProductionBomSnapshotLine" (
    "Id" TEXT NOT NULL,
    "SnapshotId" TEXT NOT NULL,
    "MaterialId" INTEGER NOT NULL,
    "QtyPerUnit" INTEGER NOT NULL,
    "RequiredQty" INTEGER NOT NULL,
    "PartNumber" TEXT NOT NULL,
    "PartName" TEXT NOT NULL,
    "UnitName" TEXT,

    CONSTRAINT "ProductionBomSnapshotLine_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "MaterialNgCase" (
    "Id" TEXT NOT NULL,
    "CaseNumber" TEXT NOT NULL,
    "ForecastId" TEXT NOT NULL,
    "ReleaseId" TEXT NOT NULL,
    "SnapshotId" TEXT NOT NULL,
    "Stage" TEXT NOT NULL,
    "Reason" TEXT NOT NULL,
    "Status" "MaterialNgCaseStatus" NOT NULL DEFAULT 'OPEN',
    "CreatedBy" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ClosedBy" TEXT,
    "ClosedAt" TIMESTAMP(3),
    "CloseReason" TEXT,
    "LabelId" INTEGER,
    "AssemblySessionId" TEXT,
    "ProductionReportId" INTEGER,

    CONSTRAINT "MaterialNgCase_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "BusinessCommand" (
    "Id" TEXT NOT NULL,
    "Scope" TEXT NOT NULL,
    "RequestId" TEXT NOT NULL,
    "Fingerprint" TEXT NOT NULL,
    "Actor" TEXT NOT NULL,
    "Result" JSONB,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessCommand_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProductionTraceEvent" (
    "Id" TEXT NOT NULL,
    "ForecastId" TEXT NOT NULL,
    "ReleaseId" TEXT,
    "Type" TEXT NOT NULL,
    "SourceType" TEXT NOT NULL,
    "SourceId" TEXT NOT NULL,
    "Actor" TEXT NOT NULL,
    "CorrelationId" TEXT NOT NULL,
    "ProcessId" TEXT,
    "Metadata" JSONB,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionTraceEvent_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE INDEX "BomRevision_Status_CreatedAt_idx" ON "BomRevision"("Status", "CreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BomRevision_FinishGoodId_Revision_key" ON "BomRevision"("FinishGoodId", "Revision");

-- CreateIndex
CREATE UNIQUE INDEX "BomRevisionLine_RevisionId_MaterialId_key" ON "BomRevisionLine"("RevisionId", "MaterialId");

-- CreateIndex
CREATE INDEX "BomRevisionEvent_RevisionId_CreatedAt_idx" ON "BomRevisionEvent"("RevisionId", "CreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBomSnapshot_PreviousId_key" ON "ProductionBomSnapshot"("PreviousId");

-- CreateIndex
CREATE INDEX "ProductionBomSnapshot_ReleaseId_idx" ON "ProductionBomSnapshot"("ReleaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBomSnapshot_ForecastId_ReleaseId_Version_key" ON "ProductionBomSnapshot"("ForecastId", "ReleaseId", "Version");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBomSnapshotLine_SnapshotId_MaterialId_key" ON "ProductionBomSnapshotLine"("SnapshotId", "MaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialNgCase_CaseNumber_key" ON "MaterialNgCase"("CaseNumber");

-- CreateIndex
CREATE INDEX "MaterialNgCase_ForecastId_CreatedAt_idx" ON "MaterialNgCase"("ForecastId", "CreatedAt");

-- CreateIndex
CREATE INDEX "MaterialNgCase_ReleaseId_Status_idx" ON "MaterialNgCase"("ReleaseId", "Status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCommand_Scope_RequestId_key" ON "BusinessCommand"("Scope", "RequestId");

-- CreateIndex
CREATE INDEX "ProductionTraceEvent_ForecastId_CreatedAt_Id_idx" ON "ProductionTraceEvent"("ForecastId", "CreatedAt", "Id");

-- CreateIndex
CREATE INDEX "ProductionTraceEvent_CorrelationId_idx" ON "ProductionTraceEvent"("CorrelationId");

-- CreateIndex
CREATE UNIQUE INDEX "FinishGood_ActiveBomRevisionId_key" ON "FinishGood"("ActiveBomRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialNG_CaseId_MaterialId_key" ON "MaterialNG"("CaseId", "MaterialId");

-- AddForeignKey
ALTER TABLE "FinishGood" ADD CONSTRAINT "FinishGood_ActiveBomRevisionId_fkey" FOREIGN KEY ("ActiveBomRevisionId") REFERENCES "BomRevision"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialNG" ADD CONSTRAINT "MaterialNG_CaseId_fkey" FOREIGN KEY ("CaseId") REFERENCES "MaterialNgCase"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialNG" ADD CONSTRAINT "MaterialNG_SnapshotLineId_fkey" FOREIGN KEY ("SnapshotLineId") REFERENCES "ProductionBomSnapshotLine"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_SnapshotLineId_fkey" FOREIGN KEY ("SnapshotLineId") REFERENCES "ProductionBomSnapshotLine"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_MaterialNgId_fkey" FOREIGN KEY ("MaterialNgId") REFERENCES "MaterialNG"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_CommandId_fkey" FOREIGN KEY ("CommandId") REFERENCES "BusinessCommand"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomRevision" ADD CONSTRAINT "BomRevision_FinishGoodId_fkey" FOREIGN KEY ("FinishGoodId") REFERENCES "FinishGood"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomRevision" ADD CONSTRAINT "BomRevision_BaseRevisionId_fkey" FOREIGN KEY ("BaseRevisionId") REFERENCES "BomRevision"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomRevisionLine" ADD CONSTRAINT "BomRevisionLine_RevisionId_fkey" FOREIGN KEY ("RevisionId") REFERENCES "BomRevision"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomRevisionLine" ADD CONSTRAINT "BomRevisionLine_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomRevisionEvent" ADD CONSTRAINT "BomRevisionEvent_RevisionId_fkey" FOREIGN KEY ("RevisionId") REFERENCES "BomRevision"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBomSnapshot" ADD CONSTRAINT "ProductionBomSnapshot_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBomSnapshot" ADD CONSTRAINT "ProductionBomSnapshot_ReleaseId_fkey" FOREIGN KEY ("ReleaseId") REFERENCES "ProductionRelease"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBomSnapshot" ADD CONSTRAINT "ProductionBomSnapshot_RevisionId_fkey" FOREIGN KEY ("RevisionId") REFERENCES "BomRevision"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBomSnapshot" ADD CONSTRAINT "ProductionBomSnapshot_PreviousId_fkey" FOREIGN KEY ("PreviousId") REFERENCES "ProductionBomSnapshot"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBomSnapshotLine" ADD CONSTRAINT "ProductionBomSnapshotLine_SnapshotId_fkey" FOREIGN KEY ("SnapshotId") REFERENCES "ProductionBomSnapshot"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBomSnapshotLine" ADD CONSTRAINT "ProductionBomSnapshotLine_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialNgCase" ADD CONSTRAINT "MaterialNgCase_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialNgCase" ADD CONSTRAINT "MaterialNgCase_ReleaseId_fkey" FOREIGN KEY ("ReleaseId") REFERENCES "ProductionRelease"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialNgCase" ADD CONSTRAINT "MaterialNgCase_SnapshotId_fkey" FOREIGN KEY ("SnapshotId") REFERENCES "ProductionBomSnapshot"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialNgCase" ADD CONSTRAINT "MaterialNgCase_LabelId_fkey" FOREIGN KEY ("LabelId") REFERENCES "LabelData"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialNgCase" ADD CONSTRAINT "MaterialNgCase_AssemblySessionId_fkey" FOREIGN KEY ("AssemblySessionId") REFERENCES "AssemblySession"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialNgCase" ADD CONSTRAINT "MaterialNgCase_ProductionReportId_fkey" FOREIGN KEY ("ProductionReportId") REFERENCES "ProductionReport"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTraceEvent" ADD CONSTRAINT "ProductionTraceEvent_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTraceEvent" ADD CONSTRAINT "ProductionTraceEvent_ReleaseId_fkey" FOREIGN KEY ("ReleaseId") REFERENCES "ProductionRelease"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTraceEvent" ADD CONSTRAINT "ProductionTraceEvent_ProcessId_fkey" FOREIGN KEY ("ProcessId") REFERENCES "LogProcess"("ProcessId") ON DELETE RESTRICT ON UPDATE CASCADE;
