/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma, ProductionFinding } from '../../generated/prisma/client';
import {
  createSapLedger,
  captureSapIntent,
  sapCaptureEnabled,
  sapScope,
  sapAudit,
} from '../../common/sap/sap-transaction-capture';
import { lockProductionFlow } from '../../common/helpers/production-flow.helper';
import { assertNoActiveInventoryCounting } from '../../common/helpers/inventory-counting-check.helper';
import { randomUUID } from 'node:crypto';
import { sapComponents } from '../../common/sap/sap-posting.service';
import { sapPostingDate } from '../../common/sap/sap-posting-date';

export async function approveFgScrap(
  tx: Prisma.TransactionClient,
  finding: ProductionFinding,
  actor: string,
) {
  await lockProductionFlow(tx);
  await assertNoActiveInventoryCounting(tx, undefined, 'FG scrap');
  if (!finding.LabelId || !finding.SnapshotId || !finding.ProductionDemandId)
    throw new ConflictException(
      'FG scrap requires a frozen BOM and production label.',
    );
  const label = await tx.labelData.findUniqueOrThrow({
    where: { Id: finding.LabelId },
    include: { AssemblySessions: true, DeliveryHistory: true },
  });
  if (
    label.InvalidatedAt ||
    label.ReplacementFindingId ||
    label.StockSourceLabelId
  )
    throw new ConflictException(
      'This label has already been split or replaced. Review its lineage before another scrap.',
    );
  if (label.DeliveryHistory)
    throw new ConflictException(
      'Delivered FG must be returned through Customer Return before scrap.',
    );
  if (finding.Qty > label.QtyThisBox)
    throw new BadRequestException('Scrap quantity exceeds label quantity.');
  if (label.AssemblySessions.some((s) => s.Status === 'IN_PROGRESS'))
    throw new ConflictException(
      'Finish or cancel the active assembly session before scrap approval.',
    );
  const bom = await tx.productionBomSnapshot.findUniqueOrThrow({
    where: { Id: finding.SnapshotId },
    include: { Lines: { include: { Material: true } } },
  });
  const received =
    label.RequiresAssembly !== true ||
    label.AssemblySessions.some((s) => s.Status === 'COMPLETED');
  // Passthrough output exists only after shopping completion.
  const passthrough =
    label.RequiresAssembly !== true &&
    (await tx.shoppingCompletion.findUnique({
      where: { ProductionDemandId: label.ProductionDemandId },
    }));
  const hasReceipt =
    received && (label.RequiresAssembly === true || !!passthrough);
  const fg = await tx.finishGood.findUniqueOrThrow({
    where: { PartNumber: label.FinishGoodId },
  });
  if (hasReceipt) {
    await tx.$executeRaw`SELECT 1 FROM "FinishGood" WHERE "PartNumber"=${label.FinishGoodId} FOR UPDATE`;
    const stock = await tx.inventoryLedger.aggregate({
      where: { FinishGoodId: label.FinishGoodId, Location: 'FINISH_GOOD_AREA' },
      _sum: { QtyIn: true, QtyOut: true },
    });
    const before = (stock._sum.QtyIn ?? 0) - (stock._sum.QtyOut ?? 0);
    if (before < finding.Qty || before !== fg.Qty)
      throw new ConflictException(
        'FG stock is insufficient or differs from the ledger.',
      );
    await createSapLedger(
      tx,
      {
        data: {
          ItemCategory: 'FINISH_GOOD',
          FinishGoodId: label.FinishGoodId,
          Location: 'FINISH_GOOD_AREA',
          TransactionType: 'NG_SCRAP',
          ReferenceDoc: finding.Id,
          BalanceBefore: before,
          QtyOut: finding.Qty,
          BalanceAfter: before - finding.Qty,
          CreatedBy: actor,
        },
      },
      label.ProductionDemandId,
    );
    await tx.finishGood.update({
      where: { PartNumber: label.FinishGoodId },
      data: { Qty: before - finding.Qty, UpdatedBy: actor },
    });
  } else {
    const picks = await tx.shopping.findMany({
      where: {
        ProductionDemandId: label.ProductionDemandId,
        Purpose: 'STANDARD',
      },
    });
    if (
      bom.Lines.some(
        (line) =>
          picks
            .filter((p) => p.MaterialId === line.PartNumber)
            .reduce((n, p) => n + p.QtyPick, 0) < line.RequiredQty,
      )
    )
      throw new ConflictException(
        'Complete standard shopping before approving in-process FG scrap.',
      );
    if (sapCaptureEnabled()) {
      const order = await tx.sapTransaction.findFirst({
        where: { DemandId: label.ProductionDemandId, Kind: 'PRODUCTION_ORDER' },
        orderBy: { CreatedAt: 'desc' },
      });
      if (order) {
        const scope = sapScope();
        const frozen = order.Snapshot as {
          components: { itemCode: string; perUnit: number }[];
        };
        for (const component of sapComponents(frozen.components)) {
          const quantity = component.perUnit * finding.Qty;
          await captureSapIntent(
            tx,
            {
              sourceKey: `wip-scrap:${finding.Id}:${component.itemCode}`,
              kind: 'GOODS_ISSUE',
              itemCode: component.itemCode,
              quantity,
              demandId: label.ProductionDemandId,
              snapshot: {
                date: sapPostingDate(new Date()),
                reference: finding.Id,
                orderEventId: order.Id,
              },
              effects: [{ itemCode: component.itemCode, quantity: -quantity }],
            },
            actor,
          );
          await tx.sapBackflushPick.create({
            data: {
              LedgerId: `wip-scrap:${finding.Id}:${component.itemCode}`,
              Company: scope.company,
              Warehouse: scope.warehouse,
              ItemCode: component.itemCode,
              DemandId: label.ProductionDemandId,
              Quantity: -quantity,
            },
          });
        }
      }
    }
  }
  await tx.productionFindingComponent.deleteMany({
    where: { FindingId: finding.Id },
  });
  await tx.productionFindingComponent.createMany({
    data: bom.Lines.map((line) => ({
      FindingId: finding.Id,
      SnapshotLineId: line.Id,
      MaterialId: line.PartNumber,
      Qty: line.QtyPerUnit * finding.Qty,
    })),
  });
  await tx.labelData.update({
    where: { Id: label.Id },
    data: { InvalidatedAt: new Date(), Scanned: false },
  });
  // Split labels must pass quality again; do not retain the original box's good count.
  if (label.Scanned && label.ProductionReleaseId)
    await tx.productionRelease.update({
      where: { Id: label.ProductionReleaseId },
      data: { TotalGoodQty: { decrement: label.QtyThisBox } },
    });
  const existing = await tx.labelData.findMany({
    where: { ProductionDemandId: label.ProductionDemandId },
    select: { LabelNumber: true },
  });
  let seq = Math.max(
    0,
    ...existing.map(
      (l) =>
        Number(
          l.LabelNumber.slice(
            label.ProductionDemandId.length,
            label.ProductionDemandId.length + 3,
          ),
        ) || 0,
    ),
  );
  const makeLabel = async (qty: number, replacement: boolean) => {
    if (++seq > 999 || qty > 99999)
      throw new ConflictException(
        'Replacement label exceeds barcode sequence capacity.',
      );
    return tx.labelData.create({
      data: {
        LabelNumber: `${label.ProductionDemandId}${String(seq).padStart(3, '0')}${String(qty).padStart(5, '0')}`,
        FinishGoodId: label.FinishGoodId,
        ProductionDemandId: label.ProductionDemandId,
        ProductionReleaseId: label.ProductionReleaseId,
        QtyThisBox: qty,
        Scanned: false,
        RequiresAssembly:
          replacement || !hasReceipt ? true : label.RequiresAssembly,
        ReplacesLabelId: label.Id,
        StockSourceLabelId: !replacement && hasReceipt ? label.Id : null,
        ReplacementFindingId: replacement ? finding.Id : null,
      },
    });
  };
  if (finding.Qty < label.QtyThisBox)
    await makeLabel(label.QtyThisBox - finding.Qty, false);
  const replacement = await makeLabel(finding.Qty, true);
  await tx.productionFinding.update({
    where: { Id: finding.Id },
    data: {
      Disposition: hasReceipt ? 'SCRAP_AFTER_RECEIPT' : 'SCRAP_BEFORE_RECEIPT',
      ReplacementLabelId: replacement.Id,
    },
  });
  await sapAudit(tx, actor, 'FG_SCRAP_LABEL_REPLACED', finding.Id);
}

export async function pickScrapReplacement(
  tx: Prisma.TransactionClient,
  findingId: string,
  componentId: string,
  quantity: number,
  actor: string,
) {
  await lockProductionFlow(tx);
  await assertNoActiveInventoryCounting(
    tx,
    'MATERIAL',
    'Scrap replacement picking',
  );
  const finding = await tx.productionFinding.findUniqueOrThrow({
    where: { Id: findingId },
    include: { Components: { include: { Allocations: true } } },
  });
  if (
    !finding.Disposition.startsWith('SCRAP_') ||
    finding.Status !== 'WAITING_PART_CHANGE' ||
    !finding.ProductionDemandId
  )
    throw new ConflictException(
      'Finding is not waiting for scrap replacement materials.',
    );
  const component = finding.Components.find((c) => c.Id === componentId);
  if (
    !component ||
    quantity <= 0 ||
    quantity >
      component.Qty - component.Allocations.reduce((n, a) => n + a.Qty, 0)
  )
    throw new BadRequestException(
      'Pick quantity exceeds remaining replacement requirement.',
    );
  await tx.$executeRaw`SELECT 1 FROM "Material" WHERE "PartNumber"=${component.MaterialId} FOR UPDATE`;
  const material = await tx.material.findUniqueOrThrow({
    where: { PartNumber: component.MaterialId },
  });
  const balance = await tx.inventoryLedger.aggregate({
    where: { MaterialId: component.MaterialId, Location: 'RACK' },
    _sum: { QtyIn: true, QtyOut: true },
  });
  const before = (balance._sum.QtyIn ?? 0) - (balance._sum.QtyOut ?? 0);
  if (before !== material.QtyRack || before < quantity)
    throw new ConflictException(
      'Rack stock is insufficient or differs from the ledger.',
    );
  const shoppingId = randomUUID();
  await createSapLedger(
    tx,
    {
      data: {
        ItemCategory: 'MATERIAL',
        MaterialId: component.MaterialId,
        Location: 'RACK',
        TransactionType: 'PRODUCTION_USAGE',
        ReferenceDoc: shoppingId,
        BalanceBefore: before,
        QtyOut: quantity,
        BalanceAfter: before - quantity,
        CreatedBy: actor,
        Notes: 'FG scrap replacement; consumption deferred to backflush',
      },
    },
    finding.ProductionDemandId,
  );
  await tx.material.update({
    where: { PartNumber: component.MaterialId },
    data: { QtyRack: before - quantity, UpdatedBy: actor },
  });
  await tx.shopping.create({
    data: {
      Id: shoppingId,
      Type: 'ADDITIONAL',
      Purpose: 'NON_PRODUCTION',
      Destination: 'FG scrap replacement',
      MaterialId: component.MaterialId,
      QtyPick: quantity,
      CreatedBy: actor,
    },
  });
  await tx.productionFindingAllocation.create({
    data: {
      FindingId: finding.Id,
      ComponentId: component.Id,
      ShoppingId: shoppingId,
      Qty: quantity,
      CreatedBy: actor,
    },
  });
}
