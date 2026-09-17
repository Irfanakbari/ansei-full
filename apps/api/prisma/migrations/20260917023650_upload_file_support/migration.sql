-- AlterTable
ALTER TABLE "DisplayConfig" ADD COLUMN     "FilePath" TEXT,
ADD COLUMN     "Line" TEXT,
ALTER COLUMN "Url" DROP NOT NULL;
