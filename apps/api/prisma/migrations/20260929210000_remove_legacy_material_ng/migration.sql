DELETE FROM "ProductionFindingAllocation"
WHERE "ShoppingId" IN (
    SELECT "Id" FROM "Shopping" WHERE "Purpose" = 'NG_REPLACEMENT'
);

DELETE FROM "Shopping" WHERE "Purpose" = 'NG_REPLACEMENT';

ALTER TABLE "Shopping" DROP CONSTRAINT IF EXISTS "Shopping_MaterialNgId_fkey";
ALTER TABLE "Shopping" DROP COLUMN IF EXISTS "MaterialNgId";

DROP TABLE IF EXISTS "MaterialNG";
DROP TABLE IF EXISTS "MaterialNgCase";

ALTER TYPE "ShoppingPurpose" RENAME TO "ShoppingPurpose_old";
CREATE TYPE "ShoppingPurpose" AS ENUM ('STANDARD', 'NON_PRODUCTION', 'LEGACY_UNCLASSIFIED');
ALTER TABLE "Shopping" ALTER COLUMN "Purpose" DROP DEFAULT;
ALTER TABLE "Shopping"
    ALTER COLUMN "Purpose" TYPE "ShoppingPurpose"
    USING ("Purpose"::text::"ShoppingPurpose");
ALTER TABLE "Shopping" ALTER COLUMN "Purpose" SET DEFAULT 'LEGACY_UNCLASSIFIED';
DROP TYPE "ShoppingPurpose_old";
DROP TYPE IF EXISTS "MaterialNgCaseStatus";

ALTER TABLE "Shopping" DROP CONSTRAINT IF EXISTS "Shopping_traceability_shape";
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_traceability_shape" CHECK (
    ("Purpose" = 'STANDARD' AND "Type" = 'REGULER' AND "ForecastId" IS NOT NULL AND "SnapshotLineId" IS NOT NULL)
    OR ("Purpose" = 'NON_PRODUCTION' AND "Type" = 'ADDITIONAL' AND "ForecastId" IS NULL AND "SnapshotLineId" IS NULL)
    OR ("Purpose" = 'LEGACY_UNCLASSIFIED')
);

DELETE FROM "MTCPermission"
WHERE "Action" IN (
    'IPCS.MATERIAL_NG_READ',
    'IPCS.MATERIAL_NG_CREATE',
    'IPCS.MATERIAL_NG_ISSUE',
    'IPCS.MATERIAL_NG_CLOSE'
);
