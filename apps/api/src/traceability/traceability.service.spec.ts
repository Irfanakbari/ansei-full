import { TraceabilityService } from './traceability.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../common/helpers/user-lookup.helper', () => ({
  getUserDisplayNameMap: jest.fn().mockResolvedValue(
    new Map([
      ['user-id', 'Jane Doe'],
      ['SYSTEM', 'System'],
    ]),
  ),
}));

describe('TraceabilityService events', () => {
  const events = [
    {
      Id: 'event-1',
      ForecastId: 'PO-1',
      ReleaseId: 'release-id',
      Type: 'ASSEMBLY_COMPLETE',
      SourceType: 'AssemblySession',
      SourceId: 'session-id',
      Actor: 'user-id',
      CorrelationId: 'correlation-id',
      ProcessId: null,
      Metadata: null,
      CreatedAt: new Date(),
    },
    {
      Id: 'event-2',
      ForecastId: 'PO-1',
      ReleaseId: 'release-id',
      Type: 'RELEASE_STATUS_CHANGED',
      SourceType: 'ProductionRelease',
      SourceId: 'release-id',
      Actor: 'unknown-user',
      CorrelationId: 'correlation-id',
      ProcessId: null,
      Metadata: null,
      CreatedAt: new Date(),
    },
    {
      Id: 'event-3',
      ForecastId: 'PO-1',
      ReleaseId: 'release-id',
      Type: 'BOM_SNAPSHOT',
      SourceType: 'ProductionBomSnapshot',
      SourceId: 'snapshot-id',
      Actor: 'SYSTEM',
      CorrelationId: 'snapshot-id',
      ProcessId: null,
      Metadata: null,
      CreatedAt: new Date(),
    },
    {
      Id: 'event-4',
      ForecastId: 'PO-1',
      ReleaseId: 'release-id',
      Type: 'SHOPPING_ISSUED',
      SourceType: 'Shopping',
      SourceId: 'SHOP-001',
      Actor: 'user-id',
      CorrelationId: 'correlation-id',
      ProcessId: null,
      Metadata: null,
      CreatedAt: new Date(),
    },
  ];
  const prisma = {
    productionTraceEvent: {
      findMany: jest.fn().mockResolvedValue(events),
      count: jest.fn().mockResolvedValue(events.length),
    },
    assemblySession: {
      findMany: jest.fn().mockResolvedValue([
        {
          Id: 'session-id',
          LabelData: {
            LabelNumber: 'LABEL-001',
            ProductionRelease: { ReleaseNumber: 'REL-001' },
          },
        },
      ]),
    },
    productionRelease: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ Id: 'release-id', ReleaseNumber: 'REL-001' }]),
    },
    productionBomSnapshot: {
      findMany: jest.fn().mockResolvedValue([
        {
          Id: 'snapshot-id',
          ForecastId: 'PO-1',
          Version: 2,
          Revision: { Revision: 3 },
        },
      ]),
    },
  };

  it('enriches actors and document references using batched lookups', async () => {
    const service = new TraceabilityService(prisma as unknown as PrismaService);

    const result = await service.events('PO-1', { page: 1, limit: 100 });

    expect(result.data).toEqual([
      expect.objectContaining({
        actorName: 'Jane Doe',
        documentReference: 'LABEL-001 / REL-001',
      }),
      expect.objectContaining({
        actorName: 'unknown-user',
        documentReference: 'REL-001',
      }),
      expect.objectContaining({
        actorName: 'System',
        documentReference: 'PO-1 / BOM revision 3 / snapshot 2',
      }),
      expect.objectContaining({
        actorName: 'Jane Doe',
        documentReference: 'SHOP-001',
      }),
    ]);
    expect(prisma.assemblySession.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.productionRelease.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.productionBomSnapshot.findMany).toHaveBeenCalledTimes(1);
  });
});
