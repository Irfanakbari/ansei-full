ALTER TABLE "RecordNumberCounter"
DROP CONSTRAINT "RecordNumberCounter_sequence_check";

ALTER TABLE "RecordNumberCounter"
ADD CONSTRAINT "RecordNumberCounter_sequence_check"
CHECK (
  ("Prefix" IN ('ANR', 'AIC') AND "LastSequence" BETWEEN 1 AND 99)
  OR
  ("Prefix" = 'TTR' AND "LastSequence" BETWEEN 1 AND 9999)
);

CREATE INDEX IF NOT EXISTS "InventoryLedger_ReferenceDoc_idx"
ON "InventoryLedger" ("ReferenceDoc");
