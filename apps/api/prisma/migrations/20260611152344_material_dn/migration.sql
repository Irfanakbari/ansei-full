-- CreateEnum
CREATE TYPE "DeliveryNoteStatus" AS ENUM ('DRAFT', 'SHIPPED', 'RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'MATERIAL_OUT_DELIVERY';

-- CreateTable
CREATE TABLE "MaterialDeliveryNote" (
    "Id" TEXT NOT NULL,
    "DeliveryNoteNum" TEXT NOT NULL,
    "Destination" TEXT NOT NULL,
    "Status" "DeliveryNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "Notes" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "ShippedAt" TIMESTAMP(3),
    "ShippedBy" TEXT,
    "ReceivedAt" TIMESTAMP(3),
    "ReceivedBy" TEXT,

    CONSTRAINT "MaterialDeliveryNote_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "MaterialDeliveryNoteDetail" (
    "Id" SERIAL NOT NULL,
    "DeliveryNoteId" TEXT NOT NULL,
    "MaterialId" TEXT NOT NULL,
    "QtyRequested" INTEGER NOT NULL,
    "QtyPicking" INTEGER NOT NULL,
    "QtyReceived" INTEGER,

    CONSTRAINT "MaterialDeliveryNoteDetail_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialDeliveryNote_DeliveryNoteNum_key" ON "MaterialDeliveryNote"("DeliveryNoteNum");

-- CreateIndex
CREATE INDEX "MaterialDeliveryNote_Status_idx" ON "MaterialDeliveryNote"("Status");

-- CreateIndex
CREATE INDEX "MaterialDeliveryNote_DeliveryNoteNum_idx" ON "MaterialDeliveryNote"("DeliveryNoteNum");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialDeliveryNoteDetail_DeliveryNoteId_MaterialId_key" ON "MaterialDeliveryNoteDetail"("DeliveryNoteId", "MaterialId");

-- AddForeignKey
ALTER TABLE "MaterialDeliveryNoteDetail" ADD CONSTRAINT "MaterialDeliveryNoteDetail_DeliveryNoteId_fkey" FOREIGN KEY ("DeliveryNoteId") REFERENCES "MaterialDeliveryNote"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialDeliveryNoteDetail" ADD CONSTRAINT "MaterialDeliveryNoteDetail_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
