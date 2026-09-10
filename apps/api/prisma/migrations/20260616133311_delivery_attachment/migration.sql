/*
  Warnings:

  - A unique constraint covering the columns `[AttachmentDeliveryId]` on the table `Forecast` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Forecast" ADD COLUMN     "AttachmentDeliveryId" INTEGER;

-- AlterTable
ALTER TABLE "ProductionRelease" ADD COLUMN     "IsNoAttachment" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DeliveryAttachment" (
    "id" SERIAL NOT NULL,
    "FileName" TEXT,
    "FilePath" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "ProductionReleaseId" TEXT,

    CONSTRAINT "DeliveryAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Forecast_AttachmentDeliveryId_key" ON "Forecast"("AttachmentDeliveryId");

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_AttachmentDeliveryId_fkey" FOREIGN KEY ("AttachmentDeliveryId") REFERENCES "DeliveryAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttachment" ADD CONSTRAINT "DeliveryAttachment_ProductionReleaseId_fkey" FOREIGN KEY ("ProductionReleaseId") REFERENCES "ProductionRelease"("Id") ON DELETE SET NULL ON UPDATE CASCADE;
