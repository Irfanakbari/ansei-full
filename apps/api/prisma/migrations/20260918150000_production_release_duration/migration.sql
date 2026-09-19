-- Historical releases remain NULL; do not infer production duration from dates.
ALTER TABLE "ProductionRelease" ADD COLUMN "TotalProductionMinutes" INTEGER;

ALTER TABLE "ProductionRelease"
ADD CONSTRAINT "ProductionRelease_positive_production_minutes"
CHECK ("TotalProductionMinutes" IS NULL OR "TotalProductionMinutes" > 0);
