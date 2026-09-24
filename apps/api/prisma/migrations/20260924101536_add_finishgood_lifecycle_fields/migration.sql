-- AlterTable
ALTER TABLE "FinishGood" ADD COLUMN     "DiscontinueDate" TIMESTAMP(3),
ADD COLUMN     "IsActive" BOOLEAN NOT NULL DEFAULT true;
