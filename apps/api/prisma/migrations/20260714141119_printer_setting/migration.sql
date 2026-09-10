-- CreateTable
CREATE TABLE "PrinterSetting" (
    "Id" TEXT NOT NULL,
    "Name" TEXT,
    "IpAddress" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrinterSetting_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrinterSetting_IpAddress_key" ON "PrinterSetting"("IpAddress");
