/*
  Warnings:

  - You are about to drop the `RootPIN` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "RootPIN";

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

-- AddForeignKey
ALTER TABLE "LogProcessDetail" ADD CONSTRAINT "LogProcessDetail_ProcessId_fkey" FOREIGN KEY ("ProcessId") REFERENCES "LogProcess"("ProcessId") ON DELETE CASCADE ON UPDATE CASCADE;
