-- AlterEnum
ALTER TYPE "OutboxEventType" ADD VALUE 'PALLET_CONNECTOR_HISTORY';

-- AlterTable
ALTER TABLE "DeliveryHistory" ADD COLUMN     "PalletNumber" TEXT;
