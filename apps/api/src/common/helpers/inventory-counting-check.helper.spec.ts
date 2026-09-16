/* By Irfan Akbari Vuteq Indonesia - 2026-09-16 */
import { BadRequestException } from '@nestjs/common';
import { assertNoActiveInventoryCounting } from './inventory-counting-check.helper';
import { ItemCategory, OpnameStatus } from '../../generated/prisma/enums';

describe('assertNoActiveInventoryCounting', () => {
  it('should not throw if no active inventory counting is found', async () => {
    const mockPrisma = {
      stockOpname: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(
      assertNoActiveInventoryCounting(
        mockPrisma as any,
        ItemCategory.MATERIAL,
        'Shopping',
      ),
    ).resolves.toBeUndefined();
    expect(mockPrisma.stockOpname.findFirst).toHaveBeenCalledWith({
      where: {
        Status: OpnameStatus.IN_PROGRESS,
        Category: ItemCategory.MATERIAL,
      },
      select: {
        Id: true,
        OpnameNumber: true,
        Category: true,
        Status: true,
      },
    });
  });

  it('should throw BadRequestException if an active inventory counting is found', async () => {
    const mockPrisma = {
      stockOpname: {
        findFirst: jest.fn().mockResolvedValue({
          Id: 'op-123',
          OpnameNumber: 'IC-20260916-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.IN_PROGRESS,
        }),
      },
    };

    await expect(
      assertNoActiveInventoryCounting(
        mockPrisma as any,
        ItemCategory.MATERIAL,
        'Shopping',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should check without category if not specified', async () => {
    const mockPrisma = {
      stockOpname: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(
      assertNoActiveInventoryCounting(mockPrisma as any),
    ).resolves.toBeUndefined();
    expect(mockPrisma.stockOpname.findFirst).toHaveBeenCalledWith({
      where: {
        Status: OpnameStatus.IN_PROGRESS,
      },
      select: {
        Id: true,
        OpnameNumber: true,
        Category: true,
        Status: true,
      },
    });
  });
});
