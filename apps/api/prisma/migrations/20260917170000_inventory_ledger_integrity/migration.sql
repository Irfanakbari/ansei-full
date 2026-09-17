DO $$
DECLARE
  violation_count bigint;
  sample_ids text;
BEGIN
  SELECT count(*), string_agg("Id", ', ' ORDER BY "Id") FILTER (WHERE rn <= 10)
  INTO violation_count, sample_ids
  FROM (
    SELECT "Id", row_number() OVER (ORDER BY "Id") AS rn
    FROM "InventoryLedger"
    WHERE "QtyIn" < 0 OR "QtyOut" < 0
  ) violations;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'InventoryLedger has % rows with negative QtyIn/QtyOut (sample IDs: %). Correct these rows before applying migration 20260917170000_inventory_ledger_integrity.', violation_count, sample_ids;
  END IF;

  SELECT count(*), string_agg("Id", ', ' ORDER BY "Id") FILTER (WHERE rn <= 10)
  INTO violation_count, sample_ids
  FROM (
    SELECT "Id", row_number() OVER (ORDER BY "Id") AS rn
    FROM "InventoryLedger"
    WHERE "BalanceAfter" <> "BalanceBefore" + "QtyIn" - "QtyOut"
  ) violations;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'InventoryLedger has % arithmetic violations (sample IDs: %). BalanceAfter must equal BalanceBefore + QtyIn - QtyOut.', violation_count, sample_ids;
  END IF;

  SELECT count(*), string_agg("Id", ', ' ORDER BY "Id") FILTER (WHERE rn <= 10)
  INTO violation_count, sample_ids
  FROM (
    SELECT "Id", row_number() OVER (ORDER BY "Id") AS rn
    FROM "InventoryLedger"
    WHERE ("MaterialId" IS NULL) = ("FinishGoodId" IS NULL)
       OR ("ItemCategory" = 'MATERIAL' AND ("MaterialId" IS NULL OR "FinishGoodId" IS NOT NULL))
       OR ("ItemCategory" = 'FINISH_GOOD' AND ("FinishGoodId" IS NULL OR "MaterialId" IS NOT NULL))
  ) violations;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'InventoryLedger has % item/category violations (sample IDs: %). Exactly one item ID must be populated and must match ItemCategory.', violation_count, sample_ids;
  END IF;

  SELECT count(*), string_agg("Id", ', ' ORDER BY "Id") FILTER (WHERE rn <= 10)
  INTO violation_count, sample_ids
  FROM (
    SELECT "Id", row_number() OVER (ORDER BY "Id") AS rn
    FROM "InventoryLedger"
    WHERE ("ItemCategory" = 'MATERIAL' AND "Location" = 'FINISH_GOOD_AREA')
       OR ("ItemCategory" = 'FINISH_GOOD' AND "Location" <> 'FINISH_GOOD_AREA')
       OR ("TransactionType" = 'PRODUCTION_RESULT' AND ("ItemCategory" <> 'FINISH_GOOD' OR "Location" <> 'FINISH_GOOD_AREA'))
  ) violations;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'InventoryLedger has % category/location violations (sample IDs: %). Material cannot use FINISH_GOOD_AREA; finish good and PRODUCTION_RESULT rows must use FINISH_GOOD_AREA.', violation_count, sample_ids;
  END IF;

  SELECT count(*), string_agg(key, ', ' ORDER BY key) FILTER (WHERE rn <= 10)
  INTO violation_count, sample_ids
  FROM (
    SELECT "ReferenceDoc" AS key, row_number() OVER (ORDER BY "ReferenceDoc") AS rn
    FROM "InventoryLedger"
    WHERE "TransactionType" = 'PRODUCTION_RESULT'
    GROUP BY "ReferenceDoc"
    HAVING count(*) > 1
  ) violations;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'InventoryLedger has % duplicate PRODUCTION_RESULT references (sample references: %). Deduplicate with business approval before applying this migration.', violation_count, sample_ids;
  END IF;
END $$;

ALTER TABLE "InventoryLedger"
  ADD CONSTRAINT "InventoryLedger_nonnegative_quantities_check"
    CHECK ("QtyIn" >= 0 AND "QtyOut" >= 0),
  ADD CONSTRAINT "InventoryLedger_balance_arithmetic_check"
    CHECK ("BalanceAfter" = "BalanceBefore" + "QtyIn" - "QtyOut"),
  ADD CONSTRAINT "InventoryLedger_exactly_one_item_check"
    CHECK (("MaterialId" IS NOT NULL)::integer + ("FinishGoodId" IS NOT NULL)::integer = 1),
  ADD CONSTRAINT "InventoryLedger_item_category_check"
    CHECK (
      ("ItemCategory" = 'MATERIAL' AND "MaterialId" IS NOT NULL AND "FinishGoodId" IS NULL)
      OR
      ("ItemCategory" = 'FINISH_GOOD' AND "FinishGoodId" IS NOT NULL AND "MaterialId" IS NULL)
    ),
  ADD CONSTRAINT "InventoryLedger_category_location_check"
    CHECK (
      ("ItemCategory" = 'MATERIAL' AND "Location" <> 'FINISH_GOOD_AREA')
      OR
      ("ItemCategory" = 'FINISH_GOOD' AND "Location" = 'FINISH_GOOD_AREA')
    ),
  ADD CONSTRAINT "InventoryLedger_production_result_check"
    CHECK (
      "TransactionType" <> 'PRODUCTION_RESULT'
      OR ("ItemCategory" = 'FINISH_GOOD' AND "Location" = 'FINISH_GOOD_AREA' AND "QtyIn" > 0 AND "QtyOut" = 0)
    );

CREATE UNIQUE INDEX "InventoryLedger_production_result_reference_key"
ON "InventoryLedger" ("ReferenceDoc")
WHERE "TransactionType" = 'PRODUCTION_RESULT';
