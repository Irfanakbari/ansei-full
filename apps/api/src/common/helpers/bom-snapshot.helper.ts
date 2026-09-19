/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

type Client = Prisma.TransactionClient | PrismaService;

export async function latestSnapshot(
  tx: Client,
  forecastId: string,
  releaseId?: string,
) {
  return tx.productionBomSnapshot.findFirst({
    where: {
      ForecastId: forecastId,
      ...(releaseId ? { ReleaseId: releaseId } : {}),
    },
    orderBy: [{ CreatedAt: 'desc' }, { Version: 'desc' }],
    include: { Lines: true, Revision: true },
  });
}

/** Business requirements always resolve from the released order, never a mutable master. */
export async function orderBom(tx: Client, forecastId: string) {
  const forecast = await tx.forecast.findUniqueOrThrow({
    where: { PoId: forecastId },
  });
  const snapshot = await latestSnapshot(
    tx,
    forecastId,
    forecast.ProductionReleaseId ?? undefined,
  );
  if (!snapshot || snapshot.ReleaseId !== forecast.ProductionReleaseId)
    throw new ConflictException(
      'Historical BOM snapshot is unavailable. This legacy order cannot use the new production workflow.',
    );
  return snapshot;
}

/** Caller holds the production-flow lock. Append snapshots; never rewrite history. */
export async function snapshotRelease(
  tx: Prisma.TransactionClient,
  releaseId: string,
  actor: string,
  processId?: string,
) {
  const forecasts = await tx.forecast.findMany({
    where: { ProductionReleaseId: releaseId },
    include: { PartData: true },
  });
  for (const forecast of forecasts) {
    const previous = await latestSnapshot(tx, forecast.PoId, releaseId);
    if (
      previous?.TargetQty === forecast.Qty &&
      previous.Revision.FinishGoodId === forecast.PartData.Id
    )
      continue;
    if (previous) {
      const activity = await tx.shopping.count({
        where: { ForecastId: forecast.PoId },
      });
      const labels = await tx.labelData.count({
        where: {
          ForecastId: forecast.PoId,
          OR: [{ Scanned: true }, { AssemblySessions: { some: {} } }],
        },
      });
      if (activity || labels)
        throw new ConflictException(
          'An order with production activity cannot change its BOM snapshot.',
        );
      if (previous.Revision.FinishGoodId !== forecast.PartData.Id)
        throw new ConflictException(
          'A released order cannot change finish good.',
        );
    }
    const revisionId =
      previous?.RevisionId ?? forecast.PartData.ActiveBomRevisionId;
    if (!revisionId)
      throw new ConflictException(
        'Every released finish good requires an approved BOM revision.',
      );
    const revision = await tx.bomRevision.findUniqueOrThrow({
      where: { Id: revisionId },
      include: { Lines: true },
    });
    if (
      revision.Status !== 'APPROVED' ||
      revision.FinishGoodId !== forecast.PartData.Id ||
      !revision.Lines.length
    )
      throw new ConflictException('An approved non-empty BOM is required.');
    if (
      !Number.isInteger(forecast.Qty) ||
      forecast.Qty <= 0 ||
      revision.Lines.some((line) => line.Qty * forecast.Qty > 2147483647)
    ) {
      throw new ConflictException(
        'Snapshot quantities must be positive and fit the supported integer range.',
      );
    }
    const snapshot = await tx.productionBomSnapshot.create({
      data: {
        ForecastId: forecast.PoId,
        ReleaseId: releaseId,
        RevisionId: revisionId,
        Version: (previous?.Version ?? 0) + 1,
        PreviousId: previous?.Id,
        TargetQty: forecast.Qty,
        FinishGoodPartNumber: forecast.FinishGoodId,
        FinishGoodPartName: forecast.PartData.PartName,
        CreatedBy: actor,
        Lines: {
          create: revision.Lines.map((line) => ({
            MaterialId: line.MaterialId,
            QtyPerUnit: line.Qty,
            RequiredQty: line.Qty * forecast.Qty,
            PartNumber: line.PartNumber,
            PartName: line.PartName,
            UnitName: line.UnitName,
          })),
        },
      },
    });
    await tx.productionTraceEvent.create({
      data: {
        ForecastId: forecast.PoId,
        ReleaseId: releaseId,
        Type: 'BOM_SNAPSHOT',
        SourceType: 'ProductionBomSnapshot',
        SourceId: snapshot.Id,
        Actor: actor,
        CorrelationId: snapshot.Id,
        ProcessId: processId,
        Metadata: { revision: revision.Revision, version: snapshot.Version },
      },
    });
  }
}

export async function assertNoOutstandingReplacement(
  tx: Client,
  releaseId: string,
) {
  if (
    await tx.materialNgCase.count({
      where: { ReleaseId: releaseId, Status: 'OPEN' },
    })
  )
    throw new ConflictException(
      'Resolve or close outstanding material replacement cases before completing the release.',
    );
}

/** Shape adapter for existing order consumers; all quantities/names come from immutable snapshots. */
export async function snapshotBomEntries(tx: Client, forecastId: string) {
  const snapshot = await orderBom(tx, forecastId);
  const identities = await tx.material.findMany({
    where: { Id: { in: snapshot.Lines.map((line) => line.MaterialId) } },
    select: { Id: true, PartNumber: true },
  });
  return snapshot.Lines.map((line) => ({
    Id: line.MaterialId,
    MaterialId: line.MaterialId,
    FinishGoodId: snapshot.Revision.FinishGoodId,
    Qty: line.QtyPerUnit,
    SnapshotLineId: line.Id,
    RequiredQty: line.RequiredQty,
    MaterialData: {
      Id: line.MaterialId,
      PartNumber:
        identities.find((material) => material.Id === line.MaterialId)
          ?.PartNumber ?? line.PartNumber,
      PartName: line.PartName,
    },
    FGData: {
      Id: snapshot.Revision.FinishGoodId,
      PartNumber: snapshot.FinishGoodPartNumber,
      PartName: snapshot.FinishGoodPartName,
    },
  }));
}
