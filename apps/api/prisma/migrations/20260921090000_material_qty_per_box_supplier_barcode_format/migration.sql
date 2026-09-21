ALTER TABLE "Material" ADD COLUMN "QtyPerBox" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "SupplierBarcodeFormat" (
    "Id" SERIAL NOT NULL,
    "SupplierId" INTEGER NOT NULL,
    "Delimiter" TEXT NOT NULL,
    "Fields" JSONB NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "UpdatedBy" TEXT NOT NULL,

    CONSTRAINT "SupplierBarcodeFormat_pkey" PRIMARY KEY ("Id")
);

CREATE UNIQUE INDEX "SupplierBarcodeFormat_SupplierId_key" ON "SupplierBarcodeFormat"("SupplierId");

ALTER TABLE "SupplierBarcodeFormat" ADD CONSTRAINT "SupplierBarcodeFormat_SupplierId_fkey" FOREIGN KEY ("SupplierId") REFERENCES "Supplier"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
