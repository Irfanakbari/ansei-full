-- CreateTable
CREATE TABLE "StockOpnameAttachment" (
    "Id" SERIAL NOT NULL,
    "FileName" TEXT NOT NULL,
    "FilePath" TEXT NOT NULL,
    "OriginalFileName" TEXT NOT NULL,
    "FileSize" INTEGER NOT NULL,
    "MimeType" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "OpnameId" TEXT NOT NULL,

    CONSTRAINT "StockOpnameAttachment_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE INDEX "StockOpnameAttachment_OpnameId_idx" ON "StockOpnameAttachment"("OpnameId");

-- AddForeignKey
ALTER TABLE "StockOpnameAttachment" ADD CONSTRAINT "StockOpnameAttachment_OpnameId_fkey" FOREIGN KEY ("OpnameId") REFERENCES "StockOpname"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
