-- AlterTable
ALTER TABLE "ProductionReport" ADD COLUMN     "ForecastId" TEXT;

-- CreateIndex
CREATE INDEX "ProductionReport_ForecastId_idx" ON "ProductionReport"("ForecastId");

-- AddForeignKey
ALTER TABLE "ProductionReport" ADD CONSTRAINT "ProductionReport_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE SET NULL ON UPDATE CASCADE;
