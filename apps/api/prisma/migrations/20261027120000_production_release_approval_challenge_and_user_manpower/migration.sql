-- CreateEnum
CREATE TYPE "ApprovalChallengeStatus" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED', 'LOCKED');

-- AlterTable
ALTER TABLE "MTCUserManagement" ADD COLUMN "ManpowerUid" TEXT;

-- CreateTable
CREATE TABLE "ProductionReleaseApprovalChallenge" (
    "Id" TEXT NOT NULL,
    "ProductionReleaseId" TEXT NOT NULL,
    "RequesterUserId" TEXT NOT NULL,
    "ApproverUserId" TEXT NOT NULL,
    "TargetPhoneNumber" VARCHAR(32) NOT NULL,
    "CodeHash" VARCHAR(128) NOT NULL,
    "Status" "ApprovalChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "AttemptCount" INTEGER NOT NULL DEFAULT 0,
    "MaxAttempts" INTEGER NOT NULL DEFAULT 3,
    "ExpiresAt" TIMESTAMP(3) NOT NULL,
    "ConsumedAt" TIMESTAMP(3),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT NOT NULL,
    "UpdatedBy" TEXT NOT NULL,

    CONSTRAINT "ProductionReleaseApprovalChallenge_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE INDEX "ProductionReleaseApprovalChallenge_ProductionReleaseId_Status_idx" ON "ProductionReleaseApprovalChallenge"("ProductionReleaseId", "Status");

-- CreateIndex
CREATE INDEX "ProductionReleaseApprovalChallenge_RequesterUserId_Status_idx" ON "ProductionReleaseApprovalChallenge"("RequesterUserId", "Status");

-- CreateIndex
CREATE INDEX "ProductionReleaseApprovalChallenge_ApproverUserId_Status_idx" ON "ProductionReleaseApprovalChallenge"("ApproverUserId", "Status");

-- CreateIndex
CREATE INDEX "ProductionReleaseApprovalChallenge_ExpiresAt_idx" ON "ProductionReleaseApprovalChallenge"("ExpiresAt");

-- CreateIndex
CREATE INDEX "MTCUserManagement_ManpowerUid_idx" ON "MTCUserManagement"("ManpowerUid");

-- AddForeignKey
ALTER TABLE "ProductionReleaseApprovalChallenge" ADD CONSTRAINT "ProductionReleaseApprovalChallenge_ProductionReleaseId_fkey" FOREIGN KEY ("ProductionReleaseId") REFERENCES "ProductionRelease"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MTCUserManagement" ADD CONSTRAINT "MTCUserManagement_ManpowerUid_fkey" FOREIGN KEY ("ManpowerUid") REFERENCES "ManPower"("Uid") ON DELETE SET NULL ON UPDATE CASCADE;
