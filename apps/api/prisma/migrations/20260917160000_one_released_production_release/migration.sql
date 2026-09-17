DO $$
DECLARE
  released_count bigint;
  released_numbers text;
BEGIN
  SELECT count(*), string_agg("ReleaseNumber", ', ' ORDER BY "ReleaseNumber")
  INTO released_count, released_numbers
  FROM "ProductionRelease"
  WHERE "Status" = 'RELEASED';

  IF released_count > 1 THEN
    RAISE EXCEPTION 'ProductionRelease has % RELEASED rows (%). Complete or cancel all but one before applying migration 20260917160000_one_released_production_release.', released_count, released_numbers;
  END IF;
END $$;

CREATE UNIQUE INDEX "ProductionRelease_one_released_key"
ON "ProductionRelease" ((1))
WHERE "Status" = 'RELEASED';
