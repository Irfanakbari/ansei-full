/*
  Warnings:

  - The values [IN_PROGRESS] on the enum `ProductionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProductionStatus_new" AS ENUM ('DRAFT', 'RELEASED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."ProductionRelease" ALTER COLUMN "Status" DROP DEFAULT;
ALTER TABLE "ProductionRelease" ALTER COLUMN "Status" TYPE "ProductionStatus_new" USING ("Status"::text::"ProductionStatus_new");
ALTER TYPE "ProductionStatus" RENAME TO "ProductionStatus_old";
ALTER TYPE "ProductionStatus_new" RENAME TO "ProductionStatus";
DROP TYPE "public"."ProductionStatus_old";
ALTER TABLE "ProductionRelease" ALTER COLUMN "Status" SET DEFAULT 'DRAFT';
COMMIT;
