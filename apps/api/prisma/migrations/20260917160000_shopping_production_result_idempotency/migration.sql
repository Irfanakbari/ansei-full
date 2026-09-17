DO $$
DECLARE
  duplicate_references text;
BEGIN
  SELECT string_agg("ReferenceDoc", ', ' ORDER BY "ReferenceDoc")
  INTO duplicate_references
  FROM (
    SELECT "ReferenceDoc"
    FROM "InventoryLedger"
    WHERE "TransactionType" = 'PRODUCTION_RESULT'
    GROUP BY "ReferenceDoc"
    HAVING count(*) > 1
    ORDER BY "ReferenceDoc"
    LIMIT 10
  ) duplicates;

  IF duplicate_references IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate historical PRODUCTION_RESULT ledger references exist (%). Resolve them before enabling shopping completion idempotency.', duplicate_references;
  END IF;
END $$;

CREATE TABLE "ShoppingProductionResult" (
    "ForecastId" TEXT NOT NULL,
    "ShoppingId" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" TEXT NOT NULL,

    CONSTRAINT "ShoppingProductionResult_pkey" PRIMARY KEY ("ForecastId")
);

CREATE UNIQUE INDEX "ShoppingProductionResult_ShoppingId_key" ON "ShoppingProductionResult"("ShoppingId");
CREATE INDEX "ShoppingProductionResult_CreatedAt_idx" ON "ShoppingProductionResult"("CreatedAt");

ALTER TABLE "ShoppingProductionResult" ADD CONSTRAINT "ShoppingProductionResult_ForecastId_fkey" FOREIGN KEY ("ForecastId") REFERENCES "Forecast"("PoId") ON DELETE CASCADE ON UPDATE CASCADE;
