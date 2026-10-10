-- Preserve individual Genba parts while allowing many-to-one SAP item mapping.
-- No rows, part numbers, quantities, or transaction relations are changed.
BEGIN;
DROP INDEX "FinishGood_PartNumberSAP_key";
CREATE INDEX "FinishGood_PartNumberSAP_idx" ON "FinishGood"("PartNumberSAP");
COMMIT;
