UPDATE "DeliveryAttachment" AS attachment
SET "ProductionReleaseId" = ownership."ProductionReleaseId"
FROM (
    SELECT
        forecast."AttachmentDeliveryId" AS "AttachmentDeliveryId",
        MIN(forecast."ProductionReleaseId") AS "ProductionReleaseId"
    FROM "Forecast" AS forecast
    WHERE forecast."AttachmentDeliveryId" IS NOT NULL
      AND forecast."ProductionReleaseId" IS NOT NULL
    GROUP BY forecast."AttachmentDeliveryId"
    HAVING COUNT(DISTINCT forecast."ProductionReleaseId") = 1
) AS ownership
WHERE attachment."id" = ownership."AttachmentDeliveryId"
  AND attachment."ProductionReleaseId" IS NULL;

ALTER TABLE "DeliveryAttachment"
    ADD COLUMN "OriginalFileName" TEXT,
    ADD COLUMN "FileSize" INTEGER,
    ADD COLUMN "MimeType" TEXT,
    ADD COLUMN "UpdatedBy" TEXT;

UPDATE "DeliveryAttachment"
SET "OriginalFileName" = "FileName"
WHERE "OriginalFileName" IS NULL;

ALTER TABLE "Forecast" DROP CONSTRAINT IF EXISTS "Forecast_AttachmentDeliveryId_fkey";
DROP INDEX IF EXISTS "Forecast_AttachmentDeliveryId_key";
ALTER TABLE "Forecast" DROP COLUMN "AttachmentDeliveryId";

CREATE INDEX "DeliveryAttachment_ProductionReleaseId_idx"
    ON "DeliveryAttachment"("ProductionReleaseId");
