/*
  Warnings:

  - The values [MATERIAL_RACK] on the enum `ItemCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ItemCategory_new" AS ENUM ('MATERIAL', 'FINISH_GOOD');
ALTER TABLE "InventoryLedger" ALTER COLUMN "ItemCategory" TYPE "ItemCategory_new" USING ("ItemCategory"::text::"ItemCategory_new");
ALTER TABLE "StockOpname" ALTER COLUMN "Category" TYPE "ItemCategory_new" USING ("Category"::text::"ItemCategory_new");
ALTER TYPE "ItemCategory" RENAME TO "ItemCategory_old";
ALTER TYPE "ItemCategory_new" RENAME TO "ItemCategory";
DROP TYPE "public"."ItemCategory_old";
COMMIT;

-- AlterTable
ALTER TABLE "StockOpnameDetail" ADD COLUMN     "ActualQtyRack" INTEGER,
ADD COLUMN     "DiffQtyRack" INTEGER,
ADD COLUMN     "SystemQtyRack" INTEGER NOT NULL DEFAULT 0;
