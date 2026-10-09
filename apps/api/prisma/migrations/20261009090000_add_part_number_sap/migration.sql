ALTER TABLE "Material" ADD COLUMN "PartNumberSAP" TEXT;
ALTER TABLE "FinishGood" ADD COLUMN "PartNumberSAP" TEXT;

CREATE UNIQUE INDEX "Material_PartNumberSAP_key" ON "Material"("PartNumberSAP");
CREATE UNIQUE INDEX "FinishGood_PartNumberSAP_key" ON "FinishGood"("PartNumberSAP");
