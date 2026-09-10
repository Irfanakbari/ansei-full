-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('WAREHOUSE', 'RACK', 'FINISH_GOOD_AREA');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOMING_SUPPLIER', 'TRANSFER_TO_RACK', 'PRODUCTION_USAGE', 'PRODUCTION_RESULT', 'DELIVERY_TO_CUSTOMER', 'NG_SCRAP', 'ADJUSTMENT_MANUAL', 'STOCK_OPNAME_DIFF');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('MATERIAL', 'FINISH_GOOD');

-- CreateEnum
CREATE TYPE "OpnameStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TypeShopping" AS ENUM ('REGULER', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "PokayokeCompareStatus" AS ENUM ('SUKSES', 'GAGAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MANAGEMENT', 'DEFAULT');

-- CreateEnum
CREATE TYPE "PartType" AS ENUM ('ONE', 'TWO', 'THREE', 'FOUR');

-- CreateTable
CREATE TABLE "Satuan" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,

    CONSTRAINT "Satuan_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Material" (
    "Id" SERIAL NOT NULL,
    "PartNumber" TEXT NOT NULL,
    "PartName" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "Supplier" TEXT,
    "SatuanId" INTEGER,
    "RackLocation" TEXT,
    "QtyRack" INTEGER NOT NULL DEFAULT 0,
    "QtyWarehouse" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "FinishGood" (
    "Id" SERIAL NOT NULL,
    "PartNumber" TEXT NOT NULL,
    "PartName" TEXT NOT NULL,
    "Price" DOUBLE PRECISION DEFAULT 0,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "Qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FinishGood_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "BoxQTY" (
    "Id" SERIAL NOT NULL,
    "PartNumber" TEXT NOT NULL,
    "Qty" INTEGER NOT NULL,

    CONSTRAINT "BoxQTY_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "BillOfMaterials" (
    "Id" SERIAL NOT NULL,
    "MaterialId" INTEGER NOT NULL,
    "FinishGoodId" INTEGER NOT NULL,
    "Qty" INTEGER NOT NULL,

    CONSTRAINT "BillOfMaterials_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ManPower" (
    "Uid" TEXT NOT NULL,
    "Nik" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Status" BOOLEAN NOT NULL DEFAULT true,
    "Line" TEXT,

    CONSTRAINT "ManPower_pkey" PRIMARY KEY ("Uid")
);

-- CreateTable
CREATE TABLE "InventoryLedger" (
    "Id" TEXT NOT NULL,
    "TransactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ItemCategory" "ItemCategory" NOT NULL,
    "MaterialId" TEXT,
    "FinishGoodId" TEXT,
    "Location" "LocationType" NOT NULL,
    "TransactionType" "TransactionType" NOT NULL,
    "ReferenceDoc" TEXT NOT NULL,
    "BalanceBefore" INTEGER NOT NULL,
    "QtyIn" INTEGER NOT NULL DEFAULT 0,
    "QtyOut" INTEGER NOT NULL DEFAULT 0,
    "BalanceAfter" INTEGER NOT NULL,
    "CreatedBy" TEXT NOT NULL,
    "Notes" TEXT,

    CONSTRAINT "InventoryLedger_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "StockOpname" (
    "Id" TEXT NOT NULL,
    "OpnameNumber" TEXT NOT NULL,
    "Category" "ItemCategory" NOT NULL,
    "Status" "OpnameStatus" NOT NULL DEFAULT 'DRAFT',
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "StartedAt" TIMESTAMP(3),
    "CompletedAt" TIMESTAMP(3),
    "CompletedBy" TEXT,
    "Notes" TEXT,

    CONSTRAINT "StockOpname_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "StockOpnameDetail" (
    "Id" SERIAL NOT NULL,
    "OpnameId" TEXT NOT NULL,
    "MaterialId" TEXT,
    "FinishGoodId" TEXT,
    "Location" "LocationType" NOT NULL,
    "SystemQty" INTEGER NOT NULL DEFAULT 0,
    "ActualQty" INTEGER,
    "DiffQty" INTEGER,
    "Notes" TEXT,

    CONSTRAINT "StockOpnameDetail_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Incoming" (
    "Id" TEXT NOT NULL,
    "PoId" TEXT NOT NULL,
    "Description" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "ReceivedBy" TEXT NOT NULL,
    "ApprovedAt" TIMESTAMP(3),
    "ApprovedBy" TEXT,
    "SupplierId" INTEGER NOT NULL,

    CONSTRAINT "Incoming_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "IncomingMaterial" (
    "Id" SERIAL NOT NULL,
    "IncomingId" TEXT,
    "MaterialId" INTEGER,
    "Qty" INTEGER NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomingMaterial_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "MaterialNG" (
    "Id" SERIAL NOT NULL,
    "MaterialId" TEXT NOT NULL,
    "Qty" INTEGER NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "Description" TEXT NOT NULL,

    CONSTRAINT "MaterialNG_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Forecast" (
    "Id" SERIAL NOT NULL,
    "PoId" TEXT NOT NULL,
    "Date" TIMESTAMP(3) NOT NULL,
    "VendorCode" TEXT NOT NULL,
    "VendorName" TEXT NOT NULL,
    "ReceivingArea" TEXT NOT NULL,
    "DeliveryDate" TIMESTAMP(3) NOT NULL,
    "DeliveryPeriod" INTEGER NOT NULL,
    "Classification" TEXT NOT NULL,
    "PoNumber" TEXT NOT NULL,
    "Item" INTEGER NOT NULL,
    "Qty" INTEGER NOT NULL,
    "FinishGoodId" TEXT NOT NULL,

    CONSTRAINT "Forecast_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Shopping" (
    "Id" TEXT NOT NULL,
    "Description" TEXT,
    "Type" "TypeShopping" NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "ForecastId" TEXT NOT NULL,
    "CreatedBy" TEXT NOT NULL,
    "QtyPick" INTEGER NOT NULL,
    "MaterialId" TEXT NOT NULL,

    CONSTRAINT "Shopping_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProductionReport" (
    "Id" SERIAL NOT NULL,
    "Date" TEXT,
    "Time" TEXT,
    "ProductionStamp" TIMESTAMP(3) NOT NULL,
    "NgQty" INTEGER NOT NULL DEFAULT 0,
    "StartTime" TEXT,
    "StartStamp" TIMESTAMP(3),
    "EndTime" TEXT,
    "EndStamp" TIMESTAMP(3),
    "StopMinute" INTEGER DEFAULT 0,
    "LatchDate" TEXT,
    "CableHDate" TEXT,
    "CableLDate" TEXT,
    "CoverDate" TEXT,
    "RodDate" TEXT,
    "SponsDate" TEXT,
    "SponsRearDate" TEXT,
    "ClipDate" TEXT,
    "LeverDate" TEXT,
    "SmallPadDate" TEXT,
    "ActuatorDate" TEXT,
    "BackPlateDate" TEXT,
    "StampDate" TEXT,
    "PoNumber" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "RecordType" "PartType",
    "Qty" INTEGER NOT NULL DEFAULT 0,
    "ManPowerUid" TEXT NOT NULL,
    "FinishGoodId" TEXT NOT NULL,

    CONSTRAINT "ProductionReport_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "LabelData" (
    "Id" SERIAL NOT NULL,
    "LabelNumber" TEXT NOT NULL,
    "FinishGoodId" TEXT NOT NULL,
    "ForecastId" TEXT NOT NULL,
    "Scanned" BOOLEAN NOT NULL DEFAULT false,
    "QtyThisBox" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LabelData_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "PokayokeScanHistory" (
    "Id" SERIAL NOT NULL,
    "LabelNumber" TEXT NOT NULL,
    "PoId" TEXT NOT NULL,
    "PartNumber" TEXT NOT NULL,
    "PartName" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "Status" "PokayokeCompareStatus" NOT NULL,

    CONSTRAINT "PokayokeScanHistory_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "DeliveryHistory" (
    "Id" SERIAL NOT NULL,
    "ForecastId" TEXT NOT NULL,
    "Qty" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "LabelDataId" TEXT NOT NULL,

    CONSTRAINT "DeliveryHistory_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "Id" SERIAL NOT NULL,
    "ApiKey" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "LineStatus" (
    "Id" SERIAL NOT NULL,
    "LineName" TEXT NOT NULL,
    "FinishGoodId" TEXT NOT NULL,

    CONSTRAINT "LineStatus_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "EmailNotification" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "Type" "NotificationType" NOT NULL DEFAULT 'DEFAULT',

    CONSTRAINT "EmailNotification_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "DashboardSetting" (
    "Id" SERIAL NOT NULL,
    "StartDate" TIMESTAMP(3) NOT NULL,
    "EndDate" TIMESTAMP(3) NOT NULL,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardSetting_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "RootPIN" (
    "Id" SERIAL NOT NULL,
    "Remark" TEXT,
    "Pin" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3),

    CONSTRAINT "RootPIN_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Material_PartNumber_key" ON "Material"("PartNumber");

-- CreateIndex
CREATE INDEX "Material_satuanId_fkey" ON "Material"("SatuanId");

-- CreateIndex
CREATE UNIQUE INDEX "FinishGood_PartNumber_key" ON "FinishGood"("PartNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BoxQTY_PartNumber_key" ON "BoxQTY"("PartNumber");

-- CreateIndex
CREATE INDEX "BillOfMaterials_materialId_fkey" ON "BillOfMaterials"("MaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterials_FinishGoodId_MaterialId_key" ON "BillOfMaterials"("FinishGoodId", "MaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "ManPower_Nik_key" ON "ManPower"("Nik");

-- CreateIndex
CREATE INDEX "InventoryLedger_MaterialId_Location_idx" ON "InventoryLedger"("MaterialId", "Location");

-- CreateIndex
CREATE INDEX "InventoryLedger_FinishGoodId_idx" ON "InventoryLedger"("FinishGoodId");

-- CreateIndex
CREATE INDEX "InventoryLedger_TransactionDate_idx" ON "InventoryLedger"("TransactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpname_OpnameNumber_key" ON "StockOpname"("OpnameNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpnameDetail_OpnameId_MaterialId_Location_key" ON "StockOpnameDetail"("OpnameId", "MaterialId", "Location");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpnameDetail_OpnameId_FinishGoodId_Location_key" ON "StockOpnameDetail"("OpnameId", "FinishGoodId", "Location");

-- CreateIndex
CREATE UNIQUE INDEX "Incoming_PoId_key" ON "Incoming"("PoId");

-- CreateIndex
CREATE INDEX "Incoming_supplierId_fkey" ON "Incoming"("SupplierId");

-- CreateIndex
CREATE INDEX "IncomingMaterial_incomingId_fkey" ON "IncomingMaterial"("IncomingId");

-- CreateIndex
CREATE INDEX "IncomingMaterial_materialId_fkey" ON "IncomingMaterial"("MaterialId");

-- CreateIndex
CREATE INDEX "MaterialNG_materialId_fkey" ON "MaterialNG"("MaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "Forecast_PoId_key" ON "Forecast"("PoId");

-- CreateIndex
CREATE INDEX "Forecast_finishGoodId_fkey" ON "Forecast"("FinishGoodId");

-- CreateIndex
CREATE INDEX "Forecast_DeliveryDate_idx" ON "Forecast"("DeliveryDate");

-- CreateIndex
CREATE INDEX "Forecast_PoId_idx" ON "Forecast"("PoId");

-- CreateIndex
CREATE INDEX "Shopping_forecastId_fkey" ON "Shopping"("ForecastId");

-- CreateIndex
CREATE INDEX "Shopping_materialId_fkey" ON "Shopping"("MaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionReport_Date_ManPowerUid_FinishGoodId_CreatedAt_key" ON "ProductionReport"("Date", "ManPowerUid", "FinishGoodId", "CreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LabelData_LabelNumber_key" ON "LabelData"("LabelNumber");

-- CreateIndex
CREATE INDEX "LabelData_finishGoodId_fkey" ON "LabelData"("FinishGoodId");

-- CreateIndex
CREATE INDEX "LabelData_forecastId_fkey" ON "LabelData"("ForecastId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryHistory_pk" ON "DeliveryHistory"("LabelDataId");

-- CreateIndex
CREATE INDEX "DeliveryHistory_forecastId_fkey" ON "DeliveryHistory"("ForecastId");

-- CreateIndex
CREATE INDEX "DeliveryHistory_CreatedAt_idx" ON "DeliveryHistory"("CreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_ApiKey_key" ON "ApiKey"("ApiKey");

-- CreateIndex
CREATE INDEX "LineStatus_finishGoodId_fkey" ON "LineStatus"("FinishGoodId");

-- CreateIndex
CREATE UNIQUE INDEX "RootPIN_Pin_key" ON "RootPIN"("Pin");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_SatuanId_fkey" FOREIGN KEY ("SatuanId") REFERENCES "Satuan"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxQTY" ADD CONSTRAINT "BoxQTY_PartNumber_fkey" FOREIGN KEY ("PartNumber") REFERENCES "FinishGood"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterials" ADD CONSTRAINT "BillOfMaterials_FinishGoodId_fkey" FOREIGN KEY ("FinishGoodId") REFERENCES "FinishGood"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterials" ADD CONSTRAINT "BillOfMaterials_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("PartNumber") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_FinishGoodId_fkey" FOREIGN KEY ("FinishGoodId") REFERENCES "FinishGood"("PartNumber") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameDetail" ADD CONSTRAINT "StockOpnameDetail_OpnameId_fkey" FOREIGN KEY ("OpnameId") REFERENCES "StockOpname"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameDetail" ADD CONSTRAINT "StockOpnameDetail_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("PartNumber") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameDetail" ADD CONSTRAINT "StockOpnameDetail_FinishGoodId_fkey" FOREIGN KEY ("FinishGoodId") REFERENCES "FinishGood"("PartNumber") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incoming" ADD CONSTRAINT "Incoming_SupplierId_fkey" FOREIGN KEY ("SupplierId") REFERENCES "Supplier"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingMaterial" ADD CONSTRAINT "IncomingMaterial_IncomingId_fkey" FOREIGN KEY ("IncomingId") REFERENCES "Incoming"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingMaterial" ADD CONSTRAINT "IncomingMaterial_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialNG" ADD CONSTRAINT "MaterialNG_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_FinishGoodId_fkey" FOREIGN KEY ("FinishGoodId") REFERENCES "FinishGood"("PartNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionReport" ADD CONSTRAINT "ProductionReport_ManPowerUid_fkey" FOREIGN KEY ("ManPowerUid") REFERENCES "ManPower"("Uid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionReport" ADD CONSTRAINT "ProductionReport_FinishGoodId_fkey" FOREIGN KEY ("FinishGoodId") REFERENCES "FinishGood"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelData" ADD CONSTRAINT "LabelData_FinishGoodId_fkey" FOREIGN KEY ("FinishGoodId") REFERENCES "FinishGood"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelData" ADD CONSTRAINT "LabelData_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryHistory" ADD CONSTRAINT "DeliveryHistory_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryHistory" ADD CONSTRAINT "DeliveryHistory_LabelDataId_fkey" FOREIGN KEY ("LabelDataId") REFERENCES "LabelData"("LabelNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineStatus" ADD CONSTRAINT "LineStatus_FinishGoodId_fkey" FOREIGN KEY ("FinishGoodId") REFERENCES "FinishGood"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
