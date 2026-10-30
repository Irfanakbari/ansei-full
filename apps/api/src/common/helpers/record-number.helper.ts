import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';

interface CounterRow {
  BusinessDate: Date;
  LastSequence: number;
}

export async function nextRecordNumber(
  tx: Prisma.TransactionClient,
  prefix: 'ANR' | 'AIC' | 'TTR',
): Promise<string> {
  const maxSequence = prefix === 'TTR' ? 9999 : 99;
  const sequenceWidth = prefix === 'TTR' ? 4 : 2;
  const rows = await tx.$queryRaw<CounterRow[]>`
    INSERT INTO "RecordNumberCounter" (
      "Id", "Prefix", "BusinessDate", "LastSequence", "CreatedAt", "UpdatedAt"
    )
    VALUES (
      gen_random_uuid()::text,
      ${prefix},
      (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date,
      1,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("Prefix", "BusinessDate") DO UPDATE
    SET "LastSequence" = "RecordNumberCounter"."LastSequence" + 1,
        "UpdatedAt" = CURRENT_TIMESTAMP
    WHERE "RecordNumberCounter"."LastSequence" < ${maxSequence}
    RETURNING "BusinessDate", "LastSequence"
  `;
  const row = rows[0];
  if (!row) {
    throw new ConflictException(
      `Daily ${prefix} record number limit of ${maxSequence} has been reached.`,
    );
  }
  const date = new Date(
    `${row.BusinessDate.toISOString().slice(0, 10)}T00:00:00Z`,
  );
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(date.getUTCFullYear()).slice(-2);
  return `${prefix}-${dd}${mm}${yy}${String(row.LastSequence).padStart(sequenceWidth, '0')}`;
}
