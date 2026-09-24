-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('WAREHOUSE', 'RACK', 'FINISH_GOOD_AREA');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOMING_SUPPLIER', 'TRANSFER_TO_RACK', 'PRODUCTION_USAGE', 'PRODUCTION_RESULT', 'DELIVERY_TO_CUSTOMER', 'NG_SCRAP', 'ADJUSTMENT_MANUAL', 'STOCK_OPNAME_DIFF', 'MATERIAL_OUT_DELIVERY');

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
CREATE TYPE "OutboxEventType" AS ENUM ('PRINT_PART_TAG_ANSEI', 'DELIVERY_NOTE_EMAIL');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PartType" AS ENUM ('ONE', 'TWO', 'THREE', 'FOUR');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('DRAFT', 'RELEASED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MTCAuthAction" AS ENUM ('LOGIN', 'LOGOUT', 'SSO_CALLBACK');

-- CreateEnum
CREATE TYPE "MTCAuthStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryNoteStatus" AS ENUM ('DRAFT', 'SHIPPED', 'RECEIVED', 'CANCELLED');

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
    "SupplierId" INTEGER,
    "SatuanId" INTEGER,
    "RackLocation" TEXT,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "DiscontinueDate" TIMESTAMP(3),
    "QtyRack" INTEGER NOT NULL DEFAULT 0,
    "QtyWarehouse" INTEGER NOT NULL DEFAULT 0,
    "MinimumStock" INTEGER NOT NULL DEFAULT 0,
    "MaximumStock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "FinishGood" (
    "Id" SERIAL NOT NULL,
    "PartNumber" TEXT NOT NULL,
    "PartName" TEXT NOT NULL,
    "Alias" TEXT,
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
    "PicturePath" TEXT,
    "Name" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Status" BOOLEAN NOT NULL DEFAULT true,
    "Line" TEXT,

    CONSTRAINT "ManPower_pkey" PRIMARY KEY ("Uid")
);

-- CreateTable
CREATE TABLE "SkillMatrix" (
    "Id" SERIAL NOT NULL,
    "ManPowerUid" TEXT NOT NULL,
    "Label" TEXT NOT NULL,
    "Point" INTEGER NOT NULL,

    CONSTRAINT "SkillMatrix_pkey" PRIMARY KEY ("Id")
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
    "Tolerance" DOUBLE PRECISION DEFAULT 0,
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
    "SystemQtyRack" INTEGER NOT NULL DEFAULT 0,
    "ActualQty" INTEGER,
    "ActualQtyRack" INTEGER,
    "DiffQty" INTEGER,
    "DiffQtyRack" INTEGER,
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
    "Closed" BOOLEAN NOT NULL DEFAULT false,
    "ApprovedBy" TEXT,
    "SupplierId" INTEGER NOT NULL,
    "FileName" TEXT,
    "FilePath" TEXT,

    CONSTRAINT "Incoming_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "IncomingMaterial" (
    "Id" SERIAL NOT NULL,
    "IncomingId" TEXT,
    "MaterialId" INTEGER,
    "Qty" INTEGER NOT NULL DEFAULT 0,
    "QtyChecked" INTEGER NOT NULL DEFAULT 0,
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
    "ProductionReleaseId" TEXT,

    CONSTRAINT "Forecast_pkey" PRIMARY KEY ("Id")
);

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
    "TotalProductionMinutes" INTEGER,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "IsNoAttachment" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductionRelease_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "DeliveryAttachment" (
    "id" SERIAL NOT NULL,
    "FileName" TEXT,
    "FilePath" TEXT,
    "OriginalFileName" TEXT,
    "FileSize" INTEGER,
    "MimeType" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "UpdatedBy" TEXT,
    "ProductionReleaseId" TEXT,

    CONSTRAINT "DeliveryAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shopping" (
    "Id" TEXT NOT NULL,
    "Description" TEXT,
    "Type" "TypeShopping" NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "ForecastId" TEXT,
    "CreatedBy" TEXT NOT NULL,
    "QtyPick" INTEGER NOT NULL,
    "MaterialId" TEXT NOT NULL,

    CONSTRAINT "Shopping_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ShoppingProductionResult" (
    "ForecastId" TEXT NOT NULL,
    "ShoppingId" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,

    CONSTRAINT "ShoppingProductionResult_pkey" PRIMARY KEY ("ForecastId")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "Id" TEXT NOT NULL,
    "IdempotencyKey" VARCHAR(255) NOT NULL,
    "Type" "OutboxEventType" NOT NULL,
    "Payload" JSONB NOT NULL,
    "Status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "Attempts" INTEGER NOT NULL DEFAULT 0,
    "MaxAttempts" INTEGER NOT NULL DEFAULT 5,
    "NextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "LastErrorCode" VARCHAR(64),
    "LastError" VARCHAR(500),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "QueuedAt" TIMESTAMP(3),
    "ProcessingAt" TIMESTAMP(3),
    "SucceededAt" TIMESTAMP(3),
    "FailedAt" TIMESTAMP(3),
    "Actor" VARCHAR(255),
    "ReferenceType" VARCHAR(64),
    "ReferenceId" VARCHAR(255),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("Id")
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
    "ValidatedAt" TIMESTAMP(3),
    "ValidatedBy" TEXT,
    "RecordType" "PartType",
    "Qty" INTEGER NOT NULL DEFAULT 0,
    "ManPowerUid" TEXT NOT NULL,
    "FinishGoodId" TEXT NOT NULL,
    "ForecastId" TEXT,

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
    "ProductionReleaseId" TEXT,
    "PokayokeScanHistoryId" TEXT,

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
    "LabelDataId" INTEGER,

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
CREATE TABLE "LogProcess" (
    "ProcessId" VARCHAR(50) NOT NULL,
    "FunctionId" VARCHAR(50) NOT NULL,
    "FunctionName" VARCHAR(255) NOT NULL,
    "ProcessStatus" VARCHAR(20) NOT NULL,
    "ProcessStart" TIMESTAMP(3) NOT NULL,
    "ProcessEnd" TIMESTAMP(3),
    "ProcessDate" TIMESTAMP(3) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,

    CONSTRAINT "LogProcess_pkey" PRIMARY KEY ("ProcessId")
);

-- CreateTable
CREATE TABLE "LogProcessDetail" (
    "ProcessDetailId" BIGSERIAL NOT NULL,
    "ProcessId" VARCHAR(50) NOT NULL,
    "MessageId" VARCHAR(50) NOT NULL,
    "Message" TEXT NOT NULL,
    "Type" VARCHAR(20) NOT NULL,
    "Location" VARCHAR(255) NOT NULL,
    "ProcessDate" TIMESTAMP(3) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogProcessDetail_pkey" PRIMARY KEY ("ProcessDetailId")
);

-- CreateTable
CREATE TABLE "MTCUserSession" (
    "SessionId" TEXT NOT NULL,
    "UserId" TEXT NOT NULL,
    "UserAgent" TEXT NOT NULL,
    "IpAddress" TEXT NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ExpiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MTCUserSession_pkey" PRIMARY KEY ("SessionId")
);

-- CreateTable
CREATE TABLE "MTCUserManagement" (
    "Id" TEXT NOT NULL,
    "UserId" TEXT NOT NULL,
    "PhoneNumber" VARCHAR(32),
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "Name" TEXT NOT NULL,
    "LastLogin" TIMESTAMP(3),
    "Email" TEXT NOT NULL,
    "SsoObjectId" TEXT NOT NULL,
    "RoleId" INTEGER,

    CONSTRAINT "MTCUserManagement_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "MTCAuthLog" (
    "Id" TEXT NOT NULL,
    "UserId" TEXT,
    "EmailAttempt" VARCHAR(255),
    "Action" "MTCAuthAction" NOT NULL,
    "Status" "MTCAuthStatus" NOT NULL,
    "FailureReason" VARCHAR(255),
    "IpAddress" VARCHAR(45),
    "UserAgent" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MTCAuthLog_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "MTCRole" (
    "Id" SERIAL NOT NULL,
    "RoleName" TEXT NOT NULL,
    "Description" TEXT,
    "CreateDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreateBy" TEXT,
    "UpdateDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "UpdateBy" TEXT,

    CONSTRAINT "MTCRole_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "MTCPermission" (
    "Id" SERIAL NOT NULL,
    "Action" TEXT NOT NULL,
    "Description" TEXT,
    "CreateDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreateBy" TEXT,
    "UpdateDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "UpdateBy" TEXT,

    CONSTRAINT "MTCPermission_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "MaterialDeliveryNote" (
    "Id" TEXT NOT NULL,
    "DeliveryNoteNum" TEXT NOT NULL,
    "Destination" TEXT NOT NULL,
    "Status" "DeliveryNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "Notes" TEXT,
    "DNPath" TEXT,
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
    "FinishGoodPartTemp" TEXT,
    "QtyRequested" INTEGER NOT NULL,
    "QtyPicking" INTEGER NOT NULL,
    "QtyReceived" INTEGER,

    CONSTRAINT "MaterialDeliveryNoteDetail_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "PrinterSetting" (
    "Id" TEXT NOT NULL,
    "Name" TEXT,
    "IpAddress" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrinterSetting_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "Id" TEXT NOT NULL,
    "KeyHash" TEXT NOT NULL,
    "KeyPrefix" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    "Description" TEXT,
    "UserId" TEXT NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "LastUsedAt" TIMESTAMP(3),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "DisplayConfig" (
    "Id" SERIAL NOT NULL,
    "Description" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "IsOpen" BOOLEAN NOT NULL DEFAULT false,
    "Url" TEXT,
    "Loop" BOOLEAN NOT NULL DEFAULT true,
    "FilePath" TEXT,
    "Line" TEXT,

    CONSTRAINT "DisplayConfig_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "_MTCPermissionToMTCRole" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_MTCPermissionToMTCRole_AB_pkey" PRIMARY KEY ("A","B")
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
CREATE INDEX "SkillMatrix_ManPowerUid_idx" ON "SkillMatrix"("ManPowerUid");

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
CREATE INDEX "Forecast_ProductionReleaseId_idx" ON "Forecast"("ProductionReleaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRelease_ReleaseNumber_key" ON "ProductionRelease"("ReleaseNumber");

-- CreateIndex
CREATE INDEX "ProductionRelease_PlanDate_idx" ON "ProductionRelease"("PlanDate");

-- CreateIndex
CREATE INDEX "ProductionRelease_Status_idx" ON "ProductionRelease"("Status");

-- CreateIndex
CREATE INDEX "DeliveryAttachment_ProductionReleaseId_idx" ON "DeliveryAttachment"("ProductionReleaseId");

-- CreateIndex
CREATE INDEX "Shopping_forecastId_fkey" ON "Shopping"("ForecastId");

-- CreateIndex
CREATE INDEX "Shopping_materialId_fkey" ON "Shopping"("MaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingProductionResult_ShoppingId_key" ON "ShoppingProductionResult"("ShoppingId");

-- CreateIndex
CREATE INDEX "ShoppingProductionResult_CreatedAt_idx" ON "ShoppingProductionResult"("CreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_IdempotencyKey_key" ON "OutboxEvent"("IdempotencyKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_Status_NextAttemptAt_idx" ON "OutboxEvent"("Status", "NextAttemptAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_ReferenceType_ReferenceId_CreatedAt_idx" ON "OutboxEvent"("ReferenceType", "ReferenceId", "CreatedAt");

-- CreateIndex
CREATE INDEX "ProductionReport_ForecastId_idx" ON "ProductionReport"("ForecastId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionReport_Date_ManPowerUid_FinishGoodId_CreatedAt_key" ON "ProductionReport"("Date", "ManPowerUid", "FinishGoodId", "CreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LabelData_LabelNumber_key" ON "LabelData"("LabelNumber");

-- CreateIndex
CREATE INDEX "LabelData_finishGoodId_fkey" ON "LabelData"("FinishGoodId");

-- CreateIndex
CREATE INDEX "LabelData_forecastId_fkey" ON "LabelData"("ForecastId");

-- CreateIndex
CREATE INDEX "LabelData_ProductionReleaseId_idx" ON "LabelData"("ProductionReleaseId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryHistory_pk" ON "DeliveryHistory"("LabelDataId");

-- CreateIndex
CREATE INDEX "DeliveryHistory_forecastId_fkey" ON "DeliveryHistory"("ForecastId");

-- CreateIndex
CREATE INDEX "DeliveryHistory_CreatedAt_idx" ON "DeliveryHistory"("CreatedAt");

-- CreateIndex
CREATE INDEX "LineStatus_finishGoodId_fkey" ON "LineStatus"("FinishGoodId");

-- CreateIndex
CREATE INDEX "LogProcess_ProcessId_idx" ON "LogProcess"("ProcessId");

-- CreateIndex
CREATE INDEX "LogProcess_FunctionId_idx" ON "LogProcess"("FunctionId");

-- CreateIndex
CREATE INDEX "LogProcess_ProcessDate_idx" ON "LogProcess"("ProcessDate");

-- CreateIndex
CREATE INDEX "LogProcess_ProcessStatus_idx" ON "LogProcess"("ProcessStatus");

-- CreateIndex
CREATE INDEX "LogProcessDetail_ProcessId_idx" ON "LogProcessDetail"("ProcessId");

-- CreateIndex
CREATE INDEX "LogProcessDetail_MessageId_idx" ON "LogProcessDetail"("MessageId");

-- CreateIndex
CREATE INDEX "LogProcessDetail_Type_idx" ON "LogProcessDetail"("Type");

-- CreateIndex
CREATE INDEX "LogProcessDetail_ProcessDate_idx" ON "LogProcessDetail"("ProcessDate");

-- CreateIndex
CREATE UNIQUE INDEX "MTCUserManagement_UserId_key" ON "MTCUserManagement"("UserId");

-- CreateIndex
CREATE UNIQUE INDEX "MTCUserManagement_Email_key" ON "MTCUserManagement"("Email");

-- CreateIndex
CREATE UNIQUE INDEX "MTCUserManagement_SsoObjectId_key" ON "MTCUserManagement"("SsoObjectId");

-- CreateIndex
CREATE INDEX "MTCUserManagement_Email_idx" ON "MTCUserManagement"("Email");

-- CreateIndex
CREATE INDEX "MTCUserManagement_SsoObjectId_idx" ON "MTCUserManagement"("SsoObjectId");

-- CreateIndex
CREATE INDEX "MTCAuthLog_UserId_idx" ON "MTCAuthLog"("UserId");

-- CreateIndex
CREATE INDEX "MTCAuthLog_CreatedAt_idx" ON "MTCAuthLog"("CreatedAt");

-- CreateIndex
CREATE INDEX "MTCAuthLog_EmailAttempt_idx" ON "MTCAuthLog"("EmailAttempt");

-- CreateIndex
CREATE UNIQUE INDEX "MTCRole_RoleName_key" ON "MTCRole"("RoleName");

-- CreateIndex
CREATE UNIQUE INDEX "MTCPermission_Action_key" ON "MTCPermission"("Action");

-- CreateIndex
CREATE INDEX "MTCPermission_Action_idx" ON "MTCPermission"("Action");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialDeliveryNote_DeliveryNoteNum_key" ON "MaterialDeliveryNote"("DeliveryNoteNum");

-- CreateIndex
CREATE INDEX "MaterialDeliveryNote_Status_idx" ON "MaterialDeliveryNote"("Status");

-- CreateIndex
CREATE INDEX "MaterialDeliveryNote_DeliveryNoteNum_idx" ON "MaterialDeliveryNote"("DeliveryNoteNum");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialDeliveryNoteDetail_DeliveryNoteId_MaterialId_key" ON "MaterialDeliveryNoteDetail"("DeliveryNoteId", "MaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "PrinterSetting_IpAddress_key" ON "PrinterSetting"("IpAddress");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_KeyHash_key" ON "ApiKey"("KeyHash");

-- CreateIndex
CREATE INDEX "_MTCPermissionToMTCRole_B_index" ON "_MTCPermissionToMTCRole"("B");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_SatuanId_fkey" FOREIGN KEY ("SatuanId") REFERENCES "Satuan"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_SupplierId_fkey" FOREIGN KEY ("SupplierId") REFERENCES "Supplier"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxQTY" ADD CONSTRAINT "BoxQTY_PartNumber_fkey" FOREIGN KEY ("PartNumber") REFERENCES "FinishGood"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterials" ADD CONSTRAINT "BillOfMaterials_FinishGoodId_fkey" FOREIGN KEY ("FinishGoodId") REFERENCES "FinishGood"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterials" ADD CONSTRAINT "BillOfMaterials_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMatrix" ADD CONSTRAINT "SkillMatrix_ManPowerUid_fkey" FOREIGN KEY ("ManPowerUid") REFERENCES "ManPower"("Uid") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_ProductionReleaseId_fkey" FOREIGN KEY ("ProductionReleaseId") REFERENCES "ProductionRelease"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttachment" ADD CONSTRAINT "DeliveryAttachment_ProductionReleaseId_fkey" FOREIGN KEY ("ProductionReleaseId") REFERENCES "ProductionRelease"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingProductionResult" ADD CONSTRAINT "ShoppingProductionResult_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionReport" ADD CONSTRAINT "ProductionReport_ManPowerUid_fkey" FOREIGN KEY ("ManPowerUid") REFERENCES "ManPower"("Uid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionReport" ADD CONSTRAINT "ProductionReport_FinishGoodId_fkey" FOREIGN KEY ("FinishGoodId") REFERENCES "FinishGood"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionReport" ADD CONSTRAINT "ProductionReport_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelData" ADD CONSTRAINT "LabelData_FinishGoodId_fkey" FOREIGN KEY ("FinishGoodId") REFERENCES "FinishGood"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelData" ADD CONSTRAINT "LabelData_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelData" ADD CONSTRAINT "LabelData_ProductionReleaseId_fkey" FOREIGN KEY ("ProductionReleaseId") REFERENCES "ProductionRelease"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokayokeScanHistory" ADD CONSTRAINT "PokayokeScanHistory_LabelDataId_fkey" FOREIGN KEY ("LabelDataId") REFERENCES "LabelData"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryHistory" ADD CONSTRAINT "DeliveryHistory_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryHistory" ADD CONSTRAINT "DeliveryHistory_LabelDataId_fkey" FOREIGN KEY ("LabelDataId") REFERENCES "LabelData"("LabelNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineStatus" ADD CONSTRAINT "LineStatus_FinishGoodId_fkey" FOREIGN KEY ("FinishGoodId") REFERENCES "FinishGood"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogProcessDetail" ADD CONSTRAINT "LogProcessDetail_ProcessId_fkey" FOREIGN KEY ("ProcessId") REFERENCES "LogProcess"("ProcessId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MTCUserManagement" ADD CONSTRAINT "MTCUserManagement_RoleId_fkey" FOREIGN KEY ("RoleId") REFERENCES "MTCRole"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MTCAuthLog" ADD CONSTRAINT "MTCAuthLog_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "MTCUserManagement"("UserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialDeliveryNoteDetail" ADD CONSTRAINT "MaterialDeliveryNoteDetail_DeliveryNoteId_fkey" FOREIGN KEY ("DeliveryNoteId") REFERENCES "MaterialDeliveryNote"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialDeliveryNoteDetail" ADD CONSTRAINT "MaterialDeliveryNoteDetail_MaterialId_fkey" FOREIGN KEY ("MaterialId") REFERENCES "Material"("PartNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "MTCUserManagement"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MTCPermissionToMTCRole" ADD CONSTRAINT "_MTCPermissionToMTCRole_A_fkey" FOREIGN KEY ("A") REFERENCES "MTCPermission"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MTCPermissionToMTCRole" ADD CONSTRAINT "_MTCPermissionToMTCRole_B_fkey" FOREIGN KEY ("B") REFERENCES "MTCRole"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
