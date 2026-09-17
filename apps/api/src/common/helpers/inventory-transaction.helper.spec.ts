import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { ItemCategory } from '../../generated/prisma/enums';
import { withInventoryTransaction } from './inventory-transaction.helper';

describe('withInventoryTransaction', () => {
  it('retries P2034 with serializable isolation and commits once', async () => {
    const tx = { $executeRaw: jest.fn().mockResolvedValue(1) };
    const prisma = {
      $transaction: jest
        .fn()
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('conflict', {
            code: 'P2034',
            clientVersion: '7.8.0',
          }),
        )
        .mockImplementationOnce((callback: (client: typeof tx) => unknown) =>
          callback(tx),
        ),
    };
    const operation = jest.fn().mockResolvedValue('done');

    await expect(
      withInventoryTransaction(
        prisma as never,
        ItemCategory.MATERIAL,
        operation,
      ),
    ).resolves.toBe('done');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('fails with ConflictException after bounded P2034 retries', async () => {
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('conflict', {
          code: 'P2034',
          clientVersion: '7.8.0',
        }),
      ),
    };

    await expect(
      withInventoryTransaction(
        prisma as never,
        ItemCategory.FINISH_GOOD,
        jest.fn(),
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('propagates mutation failures without retrying', async () => {
    const error = new Error('ledger write failed');
    const prisma = { $transaction: jest.fn().mockRejectedValue(error) };

    await expect(
      withInventoryTransaction(
        prisma as never,
        ItemCategory.MATERIAL,
        jest.fn(),
      ),
    ).rejects.toBe(error);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
