-- AlterEnum
ALTER TYPE "ItemCategory" ADD VALUE 'MATERIAL_RACK';

-- AlterTable
ALTER TABLE "LabelData" ADD COLUMN     "PokayokeScanHistoryId" TEXT;

-- AlterTable
ALTER TABLE "PokayokeScanHistory" ADD COLUMN     "LabelDataId" INTEGER;

-- AddForeignKey
ALTER TABLE "PokayokeScanHistory" ADD CONSTRAINT "PokayokeScanHistory_LabelDataId_fkey" FOREIGN KEY ("LabelDataId") REFERENCES "LabelData"("Id") ON DELETE SET NULL ON UPDATE CASCADE;
