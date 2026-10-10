/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { auditedTransaction } from '../helpers/audited-transaction.helper';
import { SapItemSyncService } from './sap-item-sync.service';
import type { SapMaterialUpdatePayload } from '../outbox/outbox.types';

export function materialSapValues(row: {
  Id: number;
  PartNumber: string;
  PartNumberSAP: string | null;
  PartName: string;
  MinimumStock: number;
  MaximumStock: number;
}): SapMaterialUpdatePayload {
  return {
    materialId: row.Id,
    itemCode: row.PartNumberSAP?.trim() || row.PartNumber.trim(),
    partName: row.PartName,
    minimumStock: row.MinimumStock,
    maximumStock: row.MaximumStock,
  };
}

export function parseSapMaterialPayload(
  value: unknown,
): SapMaterialUpdatePayload {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid SAP material job');
  const p = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(p.materialId) ||
    Number(p.materialId) <= 0 ||
    typeof p.itemCode !== 'string' ||
    !p.itemCode ||
    typeof p.partName !== 'string' ||
    !p.partName.trim() ||
    !Number.isSafeInteger(p.minimumStock) ||
    Number(p.minimumStock) < 0 ||
    !Number.isSafeInteger(p.maximumStock) ||
    Number(p.maximumStock) < 0
  )
    throw new Error('Invalid SAP material job');
  return {
    materialId: p.materialId as number,
    itemCode: p.itemCode,
    partName: p.partName,
    minimumStock: p.minimumStock as number,
    maximumStock: p.maximumStock as number,
  };
}

@Injectable()
export class SapMaterialWriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapItemSyncService,
  ) {}

  async send(value: unknown): Promise<'SENT' | 'SUPERSEDED'> {
    const payload = parseSapMaterialPayload(value);
    // Serialize SAP sends by item code across replicas without locking stock rows.
    // A bounded external call is deliberately inside this advisory-lock transaction.
    // The callback is never automatically retried by auditedTransaction.
    return auditedTransaction(
      this.prisma,
      async (tx) => {
        const locks = await tx.$queryRaw<
          { locked: boolean }[]
        >`SELECT pg_try_advisory_xact_lock(hashtext('SAP_MATERIAL_WRITE'), hashtext(${payload.itemCode})) AS locked`;
        if (!locks[0]?.locked)
          throw new Error('SAP material item is being synchronized');
        const current = await tx.material.findUnique({
          where: { Id: payload.materialId },
        });
        if (
          !current ||
          JSON.stringify(materialSapValues(current)) !== JSON.stringify(payload)
        )
          return 'SUPERSEDED';
        await this.sap.updateMaterial(payload.itemCode, payload);
        return 'SENT';
      },
      { maxWait: 5000, timeout: 60000 },
    );
  }
}
