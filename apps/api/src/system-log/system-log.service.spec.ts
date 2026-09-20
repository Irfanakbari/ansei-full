import { SystemLogService } from './system-log.service';
import { validate } from 'class-validator';
import { InventoryLedgerQueryDto } from './dto/inventory-ledger-query.dto';

describe('SystemLogService', () => {
  const prisma = {
    logProcess: { count: jest.fn(), findMany: jest.fn() },
    inventoryLedger: { count: jest.fn(), findMany: jest.fn() },
  };
  const service = new SystemLogService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('validates ledger date query fields as YYYY-MM-DD dates', async () => {
    const validQuery = Object.assign(new InventoryLedgerQueryDto(), {
      dateFrom: '2026-09-01',
      dateTo: '2026-09-02',
    });
    const invalidQuery = Object.assign(new InventoryLedgerQueryDto(), {
      dateFrom: '2026-02-30',
      dateTo: '09/02/2026',
    });

    await expect(validate(validQuery)).resolves.toHaveLength(0);
    await expect(validate(invalidQuery)).resolves.toHaveLength(2);
  });

  it('returns canonical system-log data and pagination metadata', async () => {
    prisma.logProcess.count.mockResolvedValue(1);
    prisma.logProcess.findMany.mockResolvedValue([
      {
        ProcessId: 'PR1',
        FunctionId: 'FN1',
        FunctionName: 'Test',
        ProcessStatus: 'SUCCESS',
        ProcessDate: new Date('2026-01-01'),
        ProcessStart: new Date('2026-01-01'),
        ProcessEnd: null,
        CreatedAt: new Date('2026-01-01'),
      },
    ]);

    const result = await service.findAll({
      page: 2,
      limit: 50,
      search: 'test',
    });

    expect(result.meta).toEqual({
      page: 2,
      limit: 50,
      totalItems: 1,
      totalPages: 1,
    });
    expect(prisma.logProcess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 50 }),
    );
    expect(result.data[0]).toMatchObject({ processId: 'PR1' });
  });

  it('builds typed ledger filters and returns canonical metadata', async () => {
    prisma.inventoryLedger.count.mockResolvedValue(0);
    prisma.inventoryLedger.findMany.mockResolvedValue([]);

    const result = await service.findAllInventoryLedger({
      page: 1,
      limit: 25,
      search: 'part',
      referenceDoc: 'ref',
    });

    expect(prisma.inventoryLedger.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: expect.any(Array),
        ReferenceDoc: { contains: 'ref', mode: 'insensitive' },
      }),
    });
    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 25, totalItems: 0, totalPages: 0 },
    });
  });

  it('filters ledger transaction dates by inclusive Jakarta days', async () => {
    prisma.inventoryLedger.count.mockResolvedValue(0);
    prisma.inventoryLedger.findMany.mockResolvedValue([]);

    await service.findAllInventoryLedger({
      page: 1,
      limit: 25,
      dateFrom: '2026-09-01',
      dateTo: '2026-09-02',
    });

    expect(prisma.inventoryLedger.count).toHaveBeenCalledWith({
      where: {
        TransactionDate: {
          gte: new Date('2026-08-31T17:00:00.000Z'),
          lte: new Date('2026-09-02T16:59:59.999Z'),
        },
      },
    });
  });

  it('supports either ledger date bound', async () => {
    prisma.inventoryLedger.count.mockResolvedValue(0);
    prisma.inventoryLedger.findMany.mockResolvedValue([]);

    await service.findAllInventoryLedger({
      page: 1,
      limit: 25,
      dateTo: '2026-09-02',
    });

    expect(prisma.inventoryLedger.count).toHaveBeenCalledWith({
      where: {
        TransactionDate: {
          lte: new Date('2026-09-02T16:59:59.999Z'),
        },
      },
    });
  });

  it('rejects a reversed ledger date range', async () => {
    await expect(
      service.findAllInventoryLedger({
        page: 1,
        limit: 25,
        dateFrom: '2026-09-03',
        dateTo: '2026-09-02',
      }),
    ).rejects.toThrow('dateFrom must not be after dateTo');

    expect(prisma.inventoryLedger.count).not.toHaveBeenCalled();
  });
});
