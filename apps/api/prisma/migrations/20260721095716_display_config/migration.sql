-- CreateTable
CREATE TABLE "DisplayConfig" (
    "Id" SERIAL NOT NULL,
    "Description" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "IsOpen" BOOLEAN NOT NULL DEFAULT false,
    "Url" TEXT NOT NULL,
    "Loop" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DisplayConfig_pkey" PRIMARY KEY ("Id")
);
