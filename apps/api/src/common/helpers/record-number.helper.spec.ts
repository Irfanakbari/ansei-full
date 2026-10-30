import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { nextRecordNumber } from './record-number.helper';

describe('nextRecordNumber', () => {
  const tx = (rows: Array<{ BusinessDate: Date; LastSequence: number }>) =>
    ({
      $queryRaw: jest.fn().mockResolvedValue(rows),
    }) as unknown as Prisma.TransactionClient;

  it('preserves the existing two-digit AIC format', async () => {
    await expect(
      nextRecordNumber(
        tx([
          {
            BusinessDate: new Date('2026-10-29T00:00:00.000Z'),
            LastSequence: 7,
          },
        ]),
        'AIC',
      ),
    ).resolves.toBe('AIC-29102607');
  });

  it('generates a four-digit transfer-to-rack sequence', async () => {
    await expect(
      nextRecordNumber(
        tx([
          {
            BusinessDate: new Date('2026-10-29T00:00:00.000Z'),
            LastSequence: 42,
          },
        ]),
        'TTR',
      ),
    ).resolves.toBe('TTR-2910260042');
  });

  it('reports the TTR daily limit when allocation returns no row', async () => {
    await expect(nextRecordNumber(tx([]), 'TTR')).rejects.toThrow(
      new ConflictException(
        'Daily TTR record number limit of 9999 has been reached.',
      ),
    );
  });
});
