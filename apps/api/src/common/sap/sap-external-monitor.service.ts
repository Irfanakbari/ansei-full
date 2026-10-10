/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SapItemSyncService } from './sap-item-sync.service';
import { SapCacheService } from './sap-cache.service';
import { auditedTransaction } from '../helpers/audited-transaction.helper';
import { sapAudit } from './sap-transaction-capture';
const resources = [
  'InventoryGenEntries',
  'InventoryGenExits',
  'DeliveryNotes',
  'Returns',
  'StockTransfers',
  'InventoryPostings',
] as const;
@Injectable()
export class SapExternalMonitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapItemSyncService,
    private readonly cache: SapCacheService,
    private readonly config: ConfigService,
  ) {}
  async scan(actor: string) {
    const company = this.config.get<string>('SAP_COMPANY_DB') ?? '';
    const warehouse =
      this.config.get<string>('SAP_TRANSACTION_WAREHOUSE') ?? 'DMY-ANS';
    const scanned = await this.cache.load(
      'external-document-scan',
      60000,
      60000,
      async () => {
        const state = await this.prisma.sapConnectionState.findUnique({
          where: { Company: company },
        });
        const cursors = {
          ...((state?.DocumentCursors as Record<string, number> | null) ?? {}),
        };
        const found: {
          Company: string;
          Resource: string;
          DocumentEntry: number;
          DocumentNumber: number;
          Warehouse: string;
        }[] = [];
        for (const resource of resources) {
          const entryField =
            resource === 'InventoryPostings' ? 'DocumentEntry' : 'DocEntry';
          if (cursors[resource] === undefined) {
            const latest = await this.sap.readResource(resource, {
              $select: entryField,
              $orderby: `${entryField} desc`,
              $top: '1',
            });
            const rows = latest.value as Record<string, number>[];
            cursors[resource] = rows[0]?.[entryField] ?? 0;
            continue;
          }
          const page = await this.sap.readResource(resource, {
            $filter: `${entryField} gt ${cursors[resource]}`,
            $orderby: `${entryField} asc`,
            $top: '100',
          });
          if (!Array.isArray(page.value))
            throw new Error('Invalid SAP document scan response');
          for (const doc of page.value as Record<string, unknown>[]) {
            const entry = Number(doc.DocEntry ?? doc.DocumentEntry);
            const number = Number(doc.DocNum ?? doc.DocumentNumber);
            if (!Number.isSafeInteger(entry) || !Number.isSafeInteger(number))
              throw new Error('Invalid SAP document identity');
            const lines = (doc.DocumentLines ??
              doc.StockTransferLines ??
              doc.InventoryPostingLines) as {
              WarehouseCode?: string;
              FromWarehouseCode?: string;
              BaseType?: number;
              BaseEntry?: number;
            }[];
            if (!Array.isArray(lines))
              throw new Error('Invalid SAP document lines');
            const relevant = lines.filter(
              (l) =>
                l.WarehouseCode === warehouse ||
                l.FromWarehouseCode === warehouse,
            );
            if (relevant.length) {
              const marker = sapDocumentMarker(doc);
              const countingReference = sapCountingMarker(doc);
              const tracked =
                resource === 'InventoryPostings' &&
                countingReference &&
                doc.Reference2 === countingReference.replace('-', '')
                  ? await this.prisma.sapTransaction.findFirst({
                      where: {
                        Company: company,
                        Kind: 'INVENTORY_POSTING',
                        Snapshot: {
                          path: ['reference'],
                          equals: countingReference,
                        },
                      },
                    })
                  : marker
                    ? await this.prisma.sapTransaction.findFirst({
                        where: { Id: marker, Company: company },
                      })
                    : null;
              let automaticBackflush = false;
              if (
                resource === 'InventoryGenExits' &&
                relevant.every(
                  (l) => l.BaseType === 202 && Number.isInteger(l.BaseEntry),
                )
              ) {
                const parents = await this.prisma.sapTransaction.findMany({
                  where: {
                    Company: company,
                    Kind: 'PRODUCTION_ORDER',
                    DocumentEntry: { in: relevant.map((l) => l.BaseEntry!) },
                    PostedAt: { not: null },
                  },
                });
                automaticBackflush = relevant.every((l) =>
                  parents.some((p) => p.DocumentEntry === l.BaseEntry),
                );
              }
              if (!tracked && !automaticBackflush)
                found.push({
                  Company: company,
                  Resource: resource,
                  DocumentEntry: entry,
                  DocumentNumber: number,
                  Warehouse: warehouse,
                });
            }
            cursors[resource] = entry;
          }
        }
        return { cursors, found };
      },
    );
    await auditedTransaction(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('SAP_EXTERNAL_SCAN'))`;
      const previous = await tx.sapConnectionState.findUnique({
        where: { Company: company },
      });
      const cursors = {
        ...((previous?.DocumentCursors as Record<string, number> | null) ?? {}),
      };
      for (const resource of resources)
        cursors[resource] = Math.max(
          cursors[resource] ?? 0,
          scanned.value.cursors[resource] ?? 0,
        );
      await tx.sapExternalDocument.createMany({
        data: scanned.value.found,
        skipDuplicates: true,
      });
      await tx.sapConnectionState.upsert({
        where: { Company: company },
        create: { Company: company, DocumentCursors: cursors },
        update: { DocumentCursors: cursors },
      });
      await sapAudit(tx, actor, 'EXTERNAL_DOCUMENT_SCAN', company);
    });
    return { detected: scanned.value.found.length };
  }
}
import { sapCountingMarker, sapDocumentMarker } from './sap-document-reference';
