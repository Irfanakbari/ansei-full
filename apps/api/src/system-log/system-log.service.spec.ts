import { SystemLogService } from './system-log.service';

describe('SystemLogService', () => {
  const prisma = {
    logProcess: { count: jest.fn(), findMany: jest.fn() },
    inventoryLedger: { count: jest.fn(), findMany: jest.fn() },
  };
  const service = new SystemLogService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

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
});
