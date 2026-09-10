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

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_KeyHash_key" ON "ApiKey"("KeyHash");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "MTCUserManagement"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;
