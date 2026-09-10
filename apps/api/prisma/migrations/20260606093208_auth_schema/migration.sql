/*
  Warnings:

  - You are about to drop the `ApiKey` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "MTCAuthAction" AS ENUM ('LOGIN', 'LOGOUT', 'PASSWORD_RESET', 'SSO_CALLBACK');

-- CreateEnum
CREATE TYPE "MTCAuthStatus" AS ENUM ('SUCCESS', 'FAILED');

-- DropTable
DROP TABLE "ApiKey";

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
    "Password" TEXT,
    "PhoneNumber" VARCHAR(32),
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "Name" TEXT NOT NULL,
    "LastLogin" TIMESTAMP(3),
    "Email" TEXT NOT NULL,
    "DeptPermission" TEXT[],
    "AuthProvider" TEXT NOT NULL DEFAULT 'LOCAL',
    "SsoObjectId" TEXT,
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
CREATE TABLE "_MTCPermissionToMTCRole" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_MTCPermissionToMTCRole_AB_pkey" PRIMARY KEY ("A","B")
);

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
CREATE INDEX "_MTCPermissionToMTCRole_B_index" ON "_MTCPermissionToMTCRole"("B");

-- AddForeignKey
ALTER TABLE "MTCUserManagement" ADD CONSTRAINT "MTCUserManagement_RoleId_fkey" FOREIGN KEY ("RoleId") REFERENCES "MTCRole"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MTCAuthLog" ADD CONSTRAINT "MTCAuthLog_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "MTCUserManagement"("UserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MTCPermissionToMTCRole" ADD CONSTRAINT "_MTCPermissionToMTCRole_A_fkey" FOREIGN KEY ("A") REFERENCES "MTCPermission"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MTCPermissionToMTCRole" ADD CONSTRAINT "_MTCPermissionToMTCRole_B_fkey" FOREIGN KEY ("B") REFERENCES "MTCRole"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
