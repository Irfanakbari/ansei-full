UPDATE "MTCUserManagement"
SET "SsoObjectId" = "UserId"
WHERE "SsoObjectId" IS NULL;

ALTER TABLE "MTCUserManagement"
  ALTER COLUMN "SsoObjectId" SET NOT NULL,
  DROP COLUMN "Password",
  DROP COLUMN "AuthProvider";

CREATE TYPE "MTCAuthAction_new" AS ENUM ('LOGIN', 'LOGOUT', 'SSO_CALLBACK');
DELETE FROM "MTCAuthLog" WHERE "Action" = 'PASSWORD_RESET';
ALTER TABLE "MTCAuthLog"
  ALTER COLUMN "Action" TYPE "MTCAuthAction_new"
  USING ("Action"::text::"MTCAuthAction_new");
DROP TYPE "MTCAuthAction";
ALTER TYPE "MTCAuthAction_new" RENAME TO "MTCAuthAction";
