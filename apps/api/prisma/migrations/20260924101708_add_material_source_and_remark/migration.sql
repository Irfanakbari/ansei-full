-- CreateEnum
CREATE TYPE "MaterialSource" AS ENUM ('LOKAL', 'OVERSEAS');

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "MaterialSource" "MaterialSource" DEFAULT 'LOKAL',
ADD COLUMN     "Remark" TEXT;
