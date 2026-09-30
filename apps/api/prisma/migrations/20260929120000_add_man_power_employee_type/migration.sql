ALTER TABLE "ManPower" ADD COLUMN "EmployeeType" TEXT;

UPDATE "ManPower"
SET "EmployeeType" = 'PCS'
WHERE "EmployeeType" IS NULL;

ALTER TABLE "ManPower" ALTER COLUMN "EmployeeType" SET NOT NULL;
