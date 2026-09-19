import { snapshotBomEntries } from './bom-snapshot.helper';
import type { Prisma } from '../../generated/prisma/client';
import { BadRequestException } from '@nestjs/common';

/** Serialize production amendments with the first shopping/scan/delivery write. */
export async function lockProductionFlow(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(4163822, 1)`;
}

export function isShoppingComplete(requirements: {
  requirements: { qtyNeeded: number; qtyPicked: number }[];
}): boolean {
  return (
    requirements.requirements.length > 0 &&
    requirements.requirements.every(
      (item) => item.qtyNeeded > 0 && item.qtyPicked >= item.qtyNeeded,
    )
  );
}

/** Re-read prerequisites inside the mutation transaction after acquiring the flow lock. */
export async function assertLabelReady(
  tx: Prisma.TransactionClient,
  labelId: number,
  requireScanned: boolean,
  shoppingOnly = false,
) {
  const label = await tx.labelData.findUnique({ where: { Id: labelId } });
  if (!label || (requireScanned && !label.Scanned)) {
    throw new BadRequestException(
      'Label is missing or has not passed POKAYOKE. Refresh and scan again.',
    );
  }
  const forecast = await tx.forecast.findUnique({
    where: { PoId: label.ForecastId },
    include: { ProductionRelease: true },
  });
  if (
    !forecast ||
    forecast.ProductionRelease?.Status !== 'RELEASED' ||
    label.ProductionReleaseId !== forecast.ProductionReleaseId ||
    label.FinishGoodId !== forecast.FinishGoodId ||
    label.QtyThisBox <= 0
  ) {
    throw new BadRequestException(
      'Label must belong to the current RELEASED forecast and finish good.',
    );
  }
  const boms = await snapshotBomEntries(tx, forecast.PoId);
  const picks = await tx.shopping.findMany({
    where: { ForecastId: forecast.PoId, Purpose: 'STANDARD' },
    select: { Id: true, MaterialId: true, QtyPick: true },
  });
  const requirements = boms.map((bom) => ({
    qtyNeeded: forecast.Qty * bom.Qty,
    qtyPicked: picks
      .filter((pick) => pick.MaterialId === bom.MaterialData.PartNumber)
      .reduce((sum, pick) => sum + pick.QtyPick, 0),
  }));
  if (!isShoppingComplete({ requirements })) {
    throw new BadRequestException(
      'Shopping must be complete for every BOM material before scanning.',
    );
  }
  if (shoppingOnly) return { label, forecast };
  if (label.RequiresAssembly === true) {
    const session = await tx.assemblySession.findFirst({
      where: { LabelDataId: label.Id, Status: 'COMPLETED' },
    });
    if (!session)
      throw new BadRequestException(
        'Assembly must be completed before POKAYOKE or delivery.',
      );
    const result = await tx.inventoryLedger.aggregate({
      where: {
        ItemCategory: 'FINISH_GOOD',
        FinishGoodId: label.FinishGoodId,
        Location: 'FINISH_GOOD_AREA',
        TransactionType: 'PRODUCTION_RESULT',
        ReferenceDoc: `ASSY-${session.Id}`,
      },
      _sum: { QtyIn: true },
    });
    if (result._sum.QtyIn !== label.QtyThisBox)
      throw new BadRequestException('Assembly stock result is missing.');
    return { label, forecast };
  }
  // Ledger references also support production completed before the idempotency marker existed.
  const production = await tx.inventoryLedger.aggregate({
    where: {
      ItemCategory: 'FINISH_GOOD',
      FinishGoodId: forecast.FinishGoodId,
      Location: 'FINISH_GOOD_AREA',
      TransactionType: 'PRODUCTION_RESULT',
      ReferenceDoc: { in: picks.map((pick) => `PROD-${pick.Id}`) },
    },
    _sum: { QtyIn: true },
  });
  if ((production._sum.QtyIn ?? 0) < forecast.Qty) {
    throw new BadRequestException(
      'Shopping production result has not been recorded for this forecast.',
    );
  }
  return { label, forecast };
}

export function buildProductionLabels(
  forecast: {
    PoId: string;
    Qty: number;
    FinishGoodId: string;
  },
  releaseId: string,
  boxQty: number,
  requiresAssembly: boolean,
) {
  return Array.from(
    { length: Math.ceil(forecast.Qty / boxQty) },
    (_, index) => {
      const qty = Math.min(boxQty, forecast.Qty - index * boxQty);
      return {
        LabelNumber: `${forecast.PoId}${String(index + 1).padStart(3, '0')}${String(qty).padStart(5, '0')}`,
        FinishGoodId: forecast.FinishGoodId,
        ForecastId: forecast.PoId,
        Scanned: false,
        QtyThisBox: qty,
        ProductionReleaseId: releaseId,
        RequiresAssembly: requiresAssembly,
      };
    },
  );
}
