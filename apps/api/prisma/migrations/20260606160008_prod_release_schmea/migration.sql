-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Forecast" ADD COLUMN     "ProductionReleaseId" TEXT;

-- AlterTable
ALTER TABLE "LabelData" ADD COLUMN     "ProductionReleaseId" TEXT;

-- CreateTable
CREATE TABLE "ProductionRelease" (
    "Id" TEXT NOT NULL,
    "ReleaseNumber" TEXT NOT NULL,
    "PlanDate" TIMESTAMP(3) NOT NULL,
    "Status" "ProductionStatus" NOT NULL DEFAULT 'DRAFT',
    "Notes" TEXT,
    "TotalTargetQty" INTEGER NOT NULL DEFAULT 0,
    "TotalGoodQty" INTEGER NOT NULL DEFAULT 0,
    "TotalNgQty" INTEGER NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRelease_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRelease_ReleaseNumber_key" ON "ProductionRelease"("ReleaseNumber");

-- CreateIndex
CREATE INDEX "ProductionRelease_PlanDate_idx" ON "ProductionRelease"("PlanDate");

-- CreateIndex
CREATE INDEX "ProductionRelease_Status_idx" ON "ProductionRelease"("Status");

-- CreateIndex
CREATE INDEX "Forecast_ProductionReleaseId_idx" ON "Forecast"("ProductionReleaseId");

-- CreateIndex
CREATE INDEX "LabelData_ProductionReleaseId_idx" ON "LabelData"("ProductionReleaseId");

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_ProductionReleaseId_fkey" FOREIGN KEY ("ProductionReleaseId") REFERENCES "ProductionRelease"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelData" ADD CONSTRAINT "LabelData_ProductionReleaseId_fkey" FOREIGN KEY ("ProductionReleaseId") REFERENCES "ProductionRelease"("Id") ON DELETE SET NULL ON UPDATE CASCADE;
