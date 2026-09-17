import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryReconciliationService } from './inventory-reconciliation.service';

describe('InventoryReconciliationService', () => {
  let service: InventoryReconciliationService;
  const prisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryReconciliationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(InventoryReconciliationService);
  });

  it('returns categorized read-only findings and totals', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          issue: 'LEDGER_CHAIN_BREAK',
          key: 'ledger-1',
          expected: '5',
          actual: '4',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          issue: 'NEGATIVE_FINISH_GOOD',
          key: 'FG-1',
          expected: '>=0',
          actual: '-1',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.reconcile();

    expect(result.readOnly).toBe(true);
    expect(result.summary.totalIssues).toBe(2);
    expect(result.summary.ledgerChainBreaks).toBe(1);
    expect(result.summary.negativeStock).toBe(1);
  });

  it('does not execute write methods', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await service.reconcile();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(7);
    expect(Object.keys(prisma)).toEqual(['$queryRaw']);
  });
});
