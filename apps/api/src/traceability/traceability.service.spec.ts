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
    {
      Id: 'event-5',
      ForecastId: 'PO-1',
      ReleaseId: 'release-id',
      Type: 'PRODUCTION_FINDING_SUBMITTED',
      SourceType: 'ProductionFinding',
      SourceId: 'finding-id',
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
    productionFinding: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ Id: 'finding-id', RecordNumber: 'PF-001' }]),
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
      expect.objectContaining({
        actorName: 'Jane Doe',
        documentReference: 'PF-001',
      }),
    ]);
    expect(prisma.assemblySession.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.productionRelease.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.productionBomSnapshot.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('TraceabilityService detail', () => {
  it('returns only forecast-linked finish-good findings in the separate projection', async () => {
    const finding = {
      Id: 'finding-id',
      RecordNumber: 'PF-001',
      Category: 'FINISH_GOOD',
      Status: 'PENDING',
      Qty: 1,
      Reason: 'Damaged part',
      Reporter: 'Operator',
      SubmittedAt: new Date(),
      ForecastId: 'PO-1',
      ReleaseId: 'release-id',
      SnapshotId: 'snapshot-id',
      LabelId: 1,
      Label: { LabelNumber: 'LABEL-001' },
      Components: [
        {
          Id: 'component-id',
          Qty: 2,
          SnapshotLine: {
            PartNumber: 'MAT-001',
            PartName: 'Material 1',
            UnitName: 'PCS',
            QtyPerUnit: 2,
          },
          Allocations: [
            {
              Id: 'allocation-id',
              Qty: 2,
              Shopping: {
                Id: 'non-production-shopping-id',
                MaterialId: 'MAT-001',
                QtyPick: 2,
                Purpose: 'NON_PRODUCTION',
                Destination: 'PRODUCTION_FINDING',
                Description: 'Finding replacement',
                CreatedAt: new Date('2026-09-29T12:00:00.000Z'),
              },
            },
          ],
        },
      ],
    };
    const prisma = {
      forecast: {
        findUnique: jest.fn().mockResolvedValue({ PoId: 'PO-1' }),
      },
      productionBomSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
      shopping: { findMany: jest.fn().mockResolvedValue([]) },
      productionFinding: { findMany: jest.fn().mockResolvedValue([finding]) },
      labelData: { findMany: jest.fn().mockResolvedValue([]) },
      productionReport: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new TraceabilityService(prisma as unknown as PrismaService);

    const result = await service.get('PO-1');

    expect(result.findings).toEqual([finding]);
    expect(prisma.productionFinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ForecastId: 'PO-1',
          Category: 'FINISH_GOOD',
          DeletedAt: null,
        },
        select: expect.objectContaining({
          Components: expect.objectContaining({
            select: expect.objectContaining({
              Id: true,
              Qty: true,
              SnapshotLine: expect.any(Object),
              Allocations: expect.any(Object),
            }),
          }),
        }),
      }),
    );
    expect(result.findings[0].Components[0]).toEqual(
      expect.objectContaining({
        Id: 'component-id',
        Qty: 2,
        SnapshotLine: expect.objectContaining({ PartNumber: 'MAT-001' }),
        Allocations: [
          expect.objectContaining({
            Id: 'allocation-id',
            Qty: 2,
            Shopping: expect.objectContaining({
              Id: 'non-production-shopping-id',
              Purpose: 'NON_PRODUCTION',
              MaterialId: 'MAT-001',
              QtyPick: 2,
            }),
          }),
        ],
      }),
    );
    expect(result.shopping).toEqual([]);
    expect(result.materials).toEqual([]);
  });
});
