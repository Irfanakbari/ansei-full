-- CreateTable
CREATE TABLE "SkillMatrix" (
    "Id" SERIAL NOT NULL,
    "ManPowerUid" TEXT NOT NULL,
    "Label" TEXT NOT NULL,
    "Point" INTEGER NOT NULL,

    CONSTRAINT "SkillMatrix_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE INDEX "SkillMatrix_ManPowerUid_idx" ON "SkillMatrix"("ManPowerUid");

-- AddForeignKey
ALTER TABLE "SkillMatrix" ADD CONSTRAINT "SkillMatrix_ManPowerUid_fkey" FOREIGN KEY ("ManPowerUid") REFERENCES "ManPower"("Uid") ON DELETE CASCADE ON UPDATE CASCADE;
