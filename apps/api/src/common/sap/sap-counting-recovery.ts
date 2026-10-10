/* By Irfan Akbari Vuteq Indonesia - 2026-10-10 */
import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { captureSapIntent, sapAudit } from './sap-transaction-capture';
import { countingSnapshot } from './sap-counting';
import { SAFE_RETRY, SENDING, UNCERTAIN } from '../outbox/outbox-state.service';

/** Compensate local approval only while SAP posting is provably absent and the durable hold remains. */
export async function cancelRejectedCounting(
  tx: Prisma.TransactionClient,
  eventId: string,
  actor: string,
  reason: string,
) {
  const posting = await tx.sapTransaction.findUniqueOrThrow({
    where: { Id: eventId },
    include: { Event: true },
  });
  if (
    posting.Kind !== 'INVENTORY_POSTING' ||
    posting.PostedAt ||
    posting.DocumentEntry !== null ||
    posting.Event.Status !== 'FAILED' ||
    !['SAP_BLOCKED', SAFE_RETRY].includes(posting.Event.LastErrorCode ?? '')
  )
    throw new ConflictException(
      'Only a definitely rejected or unsent Inventory Posting can be cancelled. Reconcile unknown outcomes first.',
    );
  const snapshot = countingSnapshot(posting);
  const root = await tx.sapTransaction.findUniqueOrThrow({
    where: { Id: snapshot.rootId! },
    include: { Event: true },
  });
  if (!root.PostedAt || root.Event.ReferenceType !== 'STO_HOLD')
    throw new ConflictException(
      'The original SAP counting and stock hold must still be active.',
    );
  const count = await tx.stockOpname.findUniqueOrThrow({
    where: { Id: snapshot.countingId },
  });
  if (count.Status !== 'COMPLETED')
    throw new ConflictException(
      'Only a locally approved STO can be compensated.',
    );
  const close = await tx.sapTransaction.findUnique({
    where: { SourceKey: `sto:${count.Id}:close` },
    include: { Event: true },
  });
  if (
    !close ||
    close.PostedAt ||
    close.SubmittedRequest ||
    !['PENDING', 'QUEUED', 'FAILED'].includes(close.Event.Status) ||
    [SENDING, UNCERTAIN].includes(close.Event.LastErrorCode ?? '')
  )
    throw new ConflictException(
      'Close is being processed or has an unknown outcome. Refresh or reconcile before cancellation.',
    );
  for (const row of [posting, close]) {
    const changed = await tx.outboxEvent.updateMany({
      where: {
        Id: row.Id,
        Status: row.Event.Status,
        UpdatedAt: row.Event.UpdatedAt,
        LastErrorCode: row.Event.LastErrorCode,
      },
      data: {
        Status: 'FAILED',
        LastErrorCode: 'SAP_COUNTING_CANCELLED',
        LastError: 'STO approval reversed after a confirmed posting rejection.',
      },
    });
    if (changed.count !== 1)
      throw new ConflictException(
        'SAP worker state changed. Refresh before cancellation.',
      );
  }
  const entries = await tx.inventoryLedger.findMany({
    where: {
      ReferenceDoc: count.RecordNumber,
      TransactionType: 'STOCK_OPNAME_DIFF',
    },
  });
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.MaterialId ?? entry.FinishGoodId}:${entry.Location}`;
    if (seen.has(key))
      throw new ConflictException(
        'Ambiguous original STO ledger. Manual reconciliation is required.',
      );
    seen.add(key);
    const master = entry.MaterialId
      ? await tx.material.findUniqueOrThrow({
          where: { PartNumber: entry.MaterialId },
        })
      : await tx.finishGood.findUniqueOrThrow({
          where: { PartNumber: entry.FinishGoodId! },
        });
    const current =
      'QtyWarehouse' in master
        ? entry.Location === 'RACK'
          ? master.QtyRack
          : master.QtyWarehouse
        : master.Qty;
    const balance = await tx.inventoryLedger.aggregate({
      where: {
        MaterialId: entry.MaterialId,
        FinishGoodId: entry.FinishGoodId,
        Location: entry.Location,
      },
      _sum: { QtyIn: true, QtyOut: true },
    });
    if (
      current !== entry.BalanceAfter ||
      (balance._sum.QtyIn ?? 0) - (balance._sum.QtyOut ?? 0) !== current
    )
      throw new ConflictException(
        'Stock moved after STO approval. Reconcile before cancelling.',
      );
    if (entry.QtyIn === 0 && entry.QtyOut === 0) continue;
    if (entry.MaterialId)
      await tx.material.update({
        where: { PartNumber: entry.MaterialId },
        data: {
          [entry.Location === 'RACK' ? 'QtyRack' : 'QtyWarehouse']:
            entry.BalanceBefore,
          UpdatedBy: actor,
        },
      });
    else
      await tx.finishGood.update({
        where: { PartNumber: entry.FinishGoodId! },
        data: { Qty: entry.BalanceBefore, UpdatedBy: actor },
      });
    await tx.inventoryLedger.create({
      data: {
        ItemCategory: entry.ItemCategory,
        MaterialId: entry.MaterialId,
        FinishGoodId: entry.FinishGoodId,
        Location: entry.Location,
        TransactionType: 'STOCK_OPNAME_DIFF',
        ReferenceDoc: `STO_CANCEL:${count.RecordNumber}`,
        BalanceBefore: current,
        QtyIn: entry.QtyOut,
        QtyOut: entry.QtyIn,
        BalanceAfter: entry.BalanceBefore,
        TransactionDate: new Date(),
        CreatedBy: actor,
        Notes: `Reversal of ledger ${entry.Id}: ${reason}`,
      },
    });
  }
  if (!entries.length)
    throw new ConflictException('Original STO ledger is missing.');
  await tx.stockOpname.update({
    where: { Id: count.Id },
    data: {
      Status: 'CANCELLED',
      Notes: `${count.Notes ?? ''}\n[SAP RECOVERY by ${actor}]: ${reason}`,
    },
  });
  // Keep the frozen intent and old ledger intact; only the new close releases the hold after SAP proof.
  await captureSapIntent(
    tx,
    {
      sourceKey: `sto:${count.Id}:recovery-close`,
      kind: 'COUNTING_CLOSE',
      itemCode: root.ItemCode,
      quantity: snapshot.lines.length,
      frozenDimensions: {
        projectCode: snapshot.projectCode ?? null,
        costCenter: snapshot.costCenter ?? null,
      },
      snapshot: {
        ...snapshot,
        rootId: root.Id,
        dependencyId: root.Id,
        cancelled: true,
      },
      effects: [],
    },
    actor,
  );
  await sapAudit(tx, actor, 'STO_APPROVAL_COMPENSATED', posting.Id);
  return { id: count.Id, reference: count.RecordNumber };
}
