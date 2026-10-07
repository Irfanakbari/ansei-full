/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { latestSnapshot } from '../common/helpers/bom-snapshot.helper';
import { getUserDisplayNameMap } from '../common/helpers/user-lookup.helper';
import type { Prisma } from '../generated/prisma/client';
import { TraceQueryDto } from './traceability.dto';
@Injectable()
export class TraceabilityService {
  constructor(private readonly prisma: PrismaService) {}
  async search(q: TraceQueryDto) {
    const contains = {
      contains: q.search?.trim() ?? '',
      mode: 'insensitive' as const,
    };
    const where: Prisma.ProductionOrderWhereInput = {
      OR: [
        { PoId: contains },
        { PoNumber: contains },
        { ProductionRelease: { ReleaseNumber: contains } },
        { LabelData: { some: { LabelNumber: contains } } },
        { Shopping: { some: { Id: contains } } },
        {
          ProductionFindings: {
            some: {
              Category: 'FINISH_GOOD',
              DeletedAt: null,
              RecordNumber: contains,
            },
          },
        },
      ],
    };
    const [data, totalItems] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where,
        select: {
          PoId: true,
          PoNumber: true,
          FinishGoodId: true,
          Qty: true,
          PartData: { select: { PartName: true } },
          ProductionRelease: {
            select: { Id: true, ReleaseNumber: true, Status: true },
          },
        },
        orderBy: { Id: 'desc' },
        take: q.limit,
        skip: (q.page - 1) * q.limit,
      }),
      this.prisma.productionOrder.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: q.page,
        limit: q.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / q.limit),
      },
    };
  }
  async get(poId: string) {
    const forecast = await this.prisma.productionOrder.findUnique({
      where: { PoId: poId },
      include: {
        PartData: { select: { PartName: true } },
        ProductionRelease: true,
      },
    });
    if (!forecast) throw new NotFoundException('PO not found.');
    const [snapshot, shopping, findings, labels, reports] = await Promise.all([
      latestSnapshot(this.prisma, poId),
      this.prisma.shopping.findMany({
        where: { ProductionDemandId: poId },
        orderBy: { CreatedAt: 'asc' },
      }),
      this.prisma.productionFinding.findMany({
        where: {
          ProductionDemandId: poId,
          Category: 'FINISH_GOOD',
          DeletedAt: null,
        },
        select: {
          Id: true,
          RecordNumber: true,
          Category: true,
          Status: true,
          Qty: true,
          Reason: true,
          Reporter: true,
          SubmittedAt: true,
          ProductionDemandId: true,
          ReleaseId: true,
          SnapshotId: true,
          LabelId: true,
          Label: { select: { LabelNumber: true } },
          Components: {
            select: {
              Id: true,
              Qty: true,
              SnapshotLine: {
                select: {
                  PartNumber: true,
                  PartName: true,
                  UnitName: true,
                  QtyPerUnit: true,
                },
              },
              Allocations: {
                select: {
                  Id: true,
                  Qty: true,
                  Shopping: {
                    select: {
                      Id: true,
                      MaterialId: true,
                      QtyPick: true,
                      Purpose: true,
                      Destination: true,
                      Description: true,
                      CreatedAt: true,
                    },
                  },
                },
                orderBy: [{ CreatedAt: 'asc' }, { Id: 'asc' }],
              },
            },
            orderBy: { Id: 'asc' },
          },
        },
        orderBy: [{ SubmittedAt: 'desc' }, { Id: 'desc' }],
      }),
      this.prisma.labelData.findMany({
        where: { ProductionDemandId: poId },
        include: {
          AssemblySessions: true,
          PokayokeHistory: true,
          DeliveryHistory: true,
        },
        orderBy: { Id: 'asc' },
      }),
      this.prisma.productionReport.findMany({
        where: { ProductionDemandId: poId },
        select: {
          Id: true,
          CreatedAt: true,
          Qty: true,
          NgQty: true,
          ValidatedAt: true,
        },
      }),
    ]);
    const materials = (snapshot?.Lines ?? []).map((line) => {
      const movements = shopping.filter((s) => s.SnapshotLineId === line.Id);
      const standardIssued = movements
        .filter((s) => s.Purpose === 'STANDARD')
        .reduce((n, s) => n + s.QtyPick, 0);
      return {
        materialId: line.PartNumber,
        materialName: line.PartName,
        unitName: line.UnitName,
        standardRequired: line.RequiredQty,
        standardIssued,
        totalIssued: standardIssued,
      };
    });
    const allActors = shopping.map((item) => item.CreatedBy);
    const actorNameMap = await getUserDisplayNameMap(allActors, this.prisma);

    const enrichedShopping = shopping.map((s) => ({
      ...s,
      CreatedByName: actorNameMap.get(s.CreatedBy) ?? s.CreatedBy,
    }));
    return {
      forecast,
      snapshot,
      materials,
      shopping: enrichedShopping,
      findings,
      labels,
      reports,
      materialLotTracked: false,
      completeness: snapshot ? 'DOCUMENT_LEVEL' : 'LEGACY',
      relationLevel: 'PO',
      legacyNotice: snapshot
        ? null
        : 'Historical BOM unavailable; current BOM is not historical evidence.',
    };
  }
  async events(poId: string, q: TraceQueryDto) {
    const where = { ProductionDemandId: poId };
    const [data, totalItems] = await Promise.all([
      this.prisma.productionTraceEvent.findMany({
        where,
        orderBy: [{ CreatedAt: 'desc' }, { Id: 'desc' }],
        take: q.limit,
        skip: (q.page - 1) * q.limit,
      }),
      this.prisma.productionTraceEvent.count({ where }),
    ]);
    const assemblyIds = data
      .filter((event) => event.SourceType === 'AssemblySession')
      .map((event) => event.SourceId);
    const releaseIds = data
      .filter((event) => event.SourceType === 'ProductionRelease')
      .map((event) => event.SourceId);
    const snapshotIds = data
      .filter((event) => event.SourceType === 'ProductionBomSnapshot')
      .map((event) => event.SourceId);
    const findingIds = data
      .filter((event) => event.SourceType === 'ProductionFinding')
      .map((event) => event.SourceId);
    const [actorNames, assemblySessions, releases, snapshots, findings] =
      await Promise.all([
        getUserDisplayNameMap(
          data.map((event) => event.Actor),
          this.prisma,
        ),
        assemblyIds.length
          ? this.prisma.assemblySession.findMany({
              where: { Id: { in: assemblyIds } },
              select: {
                Id: true,
                LabelData: {
                  select: {
                    LabelNumber: true,
                    ProductionRelease: { select: { ReleaseNumber: true } },
                  },
                },
              },
            })
          : Promise.resolve([]),
        releaseIds.length
          ? this.prisma.productionRelease.findMany({
              where: { Id: { in: releaseIds } },
              select: { Id: true, ReleaseNumber: true },
            })
          : Promise.resolve([]),
        snapshotIds.length
          ? this.prisma.productionBomSnapshot.findMany({
              where: { Id: { in: snapshotIds } },
              select: {
                Id: true,
                ProductionDemandId: true,
                Version: true,
                Revision: { select: { Revision: true } },
              },
            })
          : Promise.resolve([]),
        findingIds.length
          ? this.prisma.productionFinding.findMany({
              where: { Id: { in: findingIds }, DeletedAt: null },
              select: { Id: true, RecordNumber: true },
            })
          : Promise.resolve([]),
      ]);
    const assemblyReferences = new Map<string, string>(
      assemblySessions.map(
        (session) =>
          [
            session.Id,
            [
              session.LabelData.LabelNumber,
              session.LabelData.ProductionRelease?.ReleaseNumber,
            ]
              .filter(Boolean)
              .join(' / '),
          ] as const,
      ),
    );
    const releaseReferences = new Map<string, string>(
      releases.map((release) => [release.Id, release.ReleaseNumber] as const),
    );
    const snapshotReferences = new Map<string, string>(
      snapshots.map(
        (snapshot) =>
          [
            snapshot.Id,
            `${snapshot.ProductionDemandId} / BOM revision ${snapshot.Revision.Revision} / snapshot ${snapshot.Version}`,
          ] as const,
      ),
    );
    const findingReferences = new Map<string, string>(
      findings.map((finding) => [finding.Id, finding.RecordNumber] as const),
    );
    const enrichedData = data.map((event) => ({
      ...event,
      actorName: actorNames.get(event.Actor) ?? event.Actor,
      documentReference:
        assemblyReferences.get(event.SourceId) ??
        releaseReferences.get(event.SourceId) ??
        snapshotReferences.get(event.SourceId) ??
        findingReferences.get(event.SourceId) ??
        event.SourceId,
    }));
    return {
      data: enrichedData,
      meta: {
        page: q.page,
        limit: q.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / q.limit),
      },
    };
  }
  snapshots(releaseId: string) {
    return this.prisma.productionBomSnapshot.findMany({
      where: { ReleaseId: releaseId },
      include: { Lines: true, Revision: true },
      orderBy: [{ ProductionDemandId: 'asc' }, { Version: 'desc' }],
    });
  }
}
