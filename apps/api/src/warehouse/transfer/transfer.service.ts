import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import type { LogProcessModel } from '../../generated/prisma/models';
import {
  LocationType,
  TransactionType,
  ItemCategory,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { assertNoActiveInventoryCounting } from '../../common/helpers/inventory-counting-check.helper';
import { withInventoryTransaction } from '../../common/helpers/inventory-transaction.helper';
import {
  claimCommand,
  finishCommand,
} from '../../common/helpers/business-command.helper';
import { TransferQueryDto } from './dto';
import { nextRecordNumber } from '../../common/helpers/record-number.helper';

export interface TransferResult {
  partNumber: string;
  warehouseBefore: number;
  warehouseAfter: number;
  rackBefore: number;
  rackAfter: number;
  transferQty: number;
  success: boolean;
}

@Injectable()
export class TransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async transferToRack(
    partNumber: string,
    qty: number,
    transferredBy: string,
    requestId?: string,
    scanCode?: string,
    notes?: string,
  ): Promise<TransferResult> {
    if (!Number.isSafeInteger(qty) || qty <= 0 || qty > 2147483647) {
      throw new BadRequestException(
        'Transfer quantity must be a positive integer.',
      );
    }
    let logProcess: LogProcessModel | undefined;
    try {
      logProcess = await this.logService.startProcess({
        functionId: 'TRANSFER_001',
        functionName: 'TransferService.TransferToRack',
        createdBy: transferredBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting transfer to rack: Material=${partNumber}, Qty=${qty}${notes ? `, Notes=${notes}` : ''}`,
        type: 'INFO',
        location: 'transfer.service.ts:35',
      });

      // POKAYOKE: Tolak transaksi jika sesi Inventory Counting sedang aktif
      const processId = logProcess.ProcessId;
      const balances = await withInventoryTransaction(
        this.prisma,
        ItemCategory.MATERIAL,
        async (tx) => {
          const claimed = requestId
            ? await claimCommand(
                tx,
                'TRANSFER_TO_RACK',
                requestId,
                transferredBy,
                {
                  partNumber,
                  qty,
                  ...(scanCode === undefined ? {} : { scanCode }),
                  ...(notes?.trim() ? { notes: notes.trim() } : {}),
                },
              )
            : null;
          if (claimed?.duplicate) {
            await this.logService.completeProcess(
              processId,
              'SUCCESS',
              'Transfer replay: stock unchanged',
              tx,
            );
            return claimed.command.Result as unknown as TransferResult;
          }
          await assertNoActiveInventoryCounting(
            tx,
            ItemCategory.MATERIAL,
            'Transfer to Rack',
          );
          const material = await tx.material.findUnique({
            where: { PartNumber: partNumber },
            select: {
              PartNumber: true,
              RackLocation: true,
              IsActive: true,
              QtyWarehouse: true,
              QtyRack: true,
            },
          });
          if (!material) {
            throw new BadRequestException(
              `POKAYOKE: Material ${partNumber} not found in Material master`,
            );
          }
          if (!material.IsActive) {
            throw new BadRequestException(
              `POKAYOKE: Material ${partNumber} is discontinued and cannot be used in transactions. Please reactivate the material first.`,
            );
          }
          if (scanCode !== undefined) {
            const scanned = scanCode.trim().toUpperCase();
            if (
              !scanned ||
              (scanned !== material.PartNumber.trim().toUpperCase() &&
                scanned !== material.RackLocation?.trim().toUpperCase())
            ) {
              throw new BadRequestException(
                'Scanned code does not match the selected material PartNumber or RackLocation.',
              );
            }
          }
          if (material.QtyWarehouse < qty) {
            throw new BadRequestException(
              `POKAYOKE: Insufficient stock in warehouse. Available: ${material.QtyWarehouse}, Required: ${qty}`,
            );
          }
          const warehouseBefore = material.QtyWarehouse;
          const rackBefore = material.QtyRack;
          for (const [location, cached] of [
            [LocationType.WAREHOUSE, warehouseBefore],
            [LocationType.RACK, rackBefore],
          ] as const) {
            const balance = await tx.inventoryLedger.aggregate({
              where: {
                ItemCategory: ItemCategory.MATERIAL,
                MaterialId: partNumber,
                Location: location,
              },
              _sum: { QtyIn: true, QtyOut: true },
            });
            if (
              (balance._sum.QtyIn ?? 0) - (balance._sum.QtyOut ?? 0) !==
              cached
            ) {
              throw new BadRequestException(
                'Inventory balance does not match the ledger. Reconcile stock before transferring.',
              );
            }
          }
          const warehouseAfter = warehouseBefore - qty;
          const rackAfter = rackBefore + qty;
          const referenceDoc = await nextRecordNumber(tx, 'TTR');
          // Update Material stock
          await tx.material.update({
            where: { PartNumber: partNumber },
            data: {
              QtyWarehouse: warehouseAfter,
              QtyRack: rackAfter,
              UpdatedBy: transferredBy,
            },
          });

          await this.logService.addLog({
            processId,
            message: `Material stock updated: Warehouse ${warehouseBefore}->${warehouseAfter}, Rack ${rackBefore}->${rackAfter}`,
            type: 'INFO',
            location: 'transfer.service.ts:62',
            client: tx,
          });

          // Create InventoryLedger for warehouse decrease
          await tx.inventoryLedger.create({
            data: {
              Id: crypto.randomUUID(),
              TransactionDate: new Date(),
              ItemCategory: 'MATERIAL',
              MaterialId: partNumber,
              Location: LocationType.WAREHOUSE,
              TransactionType: TransactionType.TRANSFER_TO_RACK,
              ReferenceDoc: referenceDoc,
              BalanceBefore: warehouseBefore,
              QtyIn: 0,
              QtyOut: qty,
              BalanceAfter: warehouseAfter,
              CreatedBy: transferredBy,
              Notes: notes?.trim()
                ? `Transfer to Rack for ${partNumber}, Qty: ${qty} - ${notes.trim()}`
                : `Transfer to Rack for ${partNumber}, Qty: ${qty}`,
            },
          });

          await this.logService.addLog({
            processId,
            message: `Warehouse Ledger created: ${warehouseBefore} -> ${warehouseAfter}`,
            type: 'INFO',
            location: 'transfer.service.ts:76',
            client: tx,
          });

          // Create InventoryLedger for rack increase
          await tx.inventoryLedger.create({
            data: {
              Id: crypto.randomUUID(),
              TransactionDate: new Date(),
              ItemCategory: 'MATERIAL',
              MaterialId: partNumber,
              Location: LocationType.RACK,
              TransactionType: TransactionType.TRANSFER_TO_RACK,
              ReferenceDoc: referenceDoc,
              BalanceBefore: rackBefore,
              QtyIn: qty,
              QtyOut: 0,
              BalanceAfter: rackAfter,
              CreatedBy: transferredBy,
              Notes: notes?.trim()
                ? `Transfer from Warehouse, Qty: ${qty} - ${notes.trim()}`
                : `Transfer from Warehouse, Qty: ${qty}`,
            },
          });

          await this.logService.addLog({
            processId,
            message: `Rack Ledger created: ${rackBefore} -> ${rackAfter}`,
            type: 'INFO',
            location: 'transfer.service.ts:90',
            client: tx,
          });
          await this.logService.addLog({
            processId,
            message: `Transfer to rack completed: ${partNumber}, Qty: ${qty}`,
            type: 'INFO',
            location: 'TransferService.transferToRack',
            client: tx,
          });
          await this.logService.completeProcess(
            processId,
            'SUCCESS',
            undefined,
            tx,
          );
          if (claimed)
            await finishCommand(tx, claimed.command.Id, {
              warehouseBefore,
              warehouseAfter,
              rackBefore,
              rackAfter,
            });
          return { warehouseBefore, warehouseAfter, rackBefore, rackAfter };
        },
      );

      return {
        partNumber,
        ...balances,
        transferQty: qty,
        success: true,
      };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'transfer.service.ts:109',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  private async validateMaterialExists(
    partNumber: string,
    processId: string,
  ): Promise<void> {
    const material = await this.prisma.material.findUnique({
      where: { PartNumber: partNumber },
      select: { Id: true, PartNumber: true, IsActive: true },
    });

    if (!material) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: Material ${partNumber} not found in Material master`,
        type: 'ERROR',
        location: 'transfer.service.ts:124',
      });
      throw new BadRequestException(
        `POKAYOKE: Material ${partNumber} not found in Material master`,
      );
    }

    if (!material.IsActive) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: Material ${partNumber} is discontinued (IsActive=false)`,
        type: 'ERROR',
        location: 'transfer.service.ts:136',
      });
      throw new BadRequestException(
        `POKAYOKE: Material ${partNumber} is discontinued and cannot be used in transactions. Please reactivate the material first.`,
      );
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: Material ${partNumber} validated (active)`,
      type: 'INFO',
      location: 'transfer.service.ts:146',
    });
  }

  private async validateWarehouseStock(
    partNumber: string,
    qty: number,
    processId: string,
  ): Promise<void> {
    const material = await this.prisma.material.findUnique({
      where: { PartNumber: partNumber },
      select: { QtyWarehouse: true },
    });

    const availableStock = material?.QtyWarehouse || 0;

    if (availableStock < qty) {
      await this.logService.addLog({
        processId,
        message: `POKAYOKE FAILED: Insufficient warehouse stock. Available: ${availableStock}, Required: ${qty}`,
        type: 'ERROR',
        location: 'transfer.service.ts:148',
      });
      throw new BadRequestException(
        `POKAYOKE: Insufficient stock in warehouse. Available: ${availableStock}, Required: ${qty}`,
      );
    }

    await this.logService.addLog({
      processId,
      message: `POKAYOKE: Warehouse stock sufficient. Available: ${availableStock} >= Qty: ${qty}`,
      type: 'INFO',
      location: 'transfer.service.ts:157',
    });
  }

  async getTransferHistory(query: TransferQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    let matchingPartNumbers: string[] | undefined;
    if (query.search?.trim()) {
      const s = query.search.trim();
      const materials = await this.prisma.material.findMany({
        where: {
          OR: [
            { PartNumber: { contains: s, mode: 'insensitive' } },
            { PartName: { contains: s, mode: 'insensitive' } },
          ],
        },
        select: { PartNumber: true },
      });
      matchingPartNumbers = materials.map((m) => m.PartNumber);
    }

    const where: Prisma.InventoryLedgerWhereInput = {
      ItemCategory: ItemCategory.MATERIAL,
      TransactionType: TransactionType.TRANSFER_TO_RACK,
      Location: LocationType.WAREHOUSE,
      NOT: { ReferenceDoc: { startsWith: 'REVERT-' } },
      QtyOut: { gt: 0 },
    };

    if (query.status === 'REVERTED') {
      const revertedLedgers = await this.prisma.inventoryLedger.findMany({
        where: {
          ReferenceDoc: { startsWith: 'REVERT-' },
          TransactionType: TransactionType.TRANSFER_TO_RACK,
        },
        select: { ReferenceDoc: true },
      });
      const originalDocs = [
        ...new Set(
          revertedLedgers.map((r) => r.ReferenceDoc.replace(/^REVERT-/, '')),
        ),
      ];
      where.ReferenceDoc = { in: originalDocs };
    } else if (query.status === 'COMPLETED') {
      const revertedLedgers = await this.prisma.inventoryLedger.findMany({
        where: {
          ReferenceDoc: { startsWith: 'REVERT-' },
          TransactionType: TransactionType.TRANSFER_TO_RACK,
        },
        select: { ReferenceDoc: true },
      });
      const originalDocs = [
        ...new Set(
          revertedLedgers.map((r) => r.ReferenceDoc.replace(/^REVERT-/, '')),
        ),
      ];
      where.ReferenceDoc = { notIn: originalDocs };
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      const searchOr: Prisma.InventoryLedgerWhereInput[] = [
        { ReferenceDoc: { contains: s, mode: 'insensitive' } },
        { CreatedBy: { contains: s, mode: 'insensitive' } },
        { Notes: { contains: s, mode: 'insensitive' } },
      ];
      if (matchingPartNumbers && matchingPartNumbers.length > 0) {
        searchOr.push({ MaterialId: { in: matchingPartNumbers } });
      } else {
        searchOr.push({ MaterialId: { contains: s, mode: 'insensitive' } });
      }
      where.OR = searchOr;
    }

    const [total, warehouseLedgers] = await Promise.all([
      this.prisma.inventoryLedger.count({ where }),
      this.prisma.inventoryLedger.findMany({
        where,
        orderBy: { TransactionDate: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    if (warehouseLedgers.length === 0) {
      return {
        data: [],
        meta: {
          page,
          limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const referenceDocs = warehouseLedgers.map((l) => l.ReferenceDoc);
    const materialIds = [
      ...new Set(
        warehouseLedgers
          .map((l) => l.MaterialId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const revertDocs = referenceDocs.map((doc) => `REVERT-${doc}`);

    const [pairedRackLedgers, revertLedgers, materials] = await Promise.all([
      this.prisma.inventoryLedger.findMany({
        where: {
          ReferenceDoc: { in: referenceDocs },
          Location: LocationType.RACK,
          QtyIn: { gt: 0 },
        },
      }),
      this.prisma.inventoryLedger.findMany({
        where: {
          ReferenceDoc: { in: revertDocs },
          Location: LocationType.WAREHOUSE,
        },
      }),
      this.prisma.material.findMany({
        where: { PartNumber: { in: materialIds } },
        select: { PartNumber: true, PartName: true, RackLocation: true },
      }),
    ]);

    const rackMap = new Map(pairedRackLedgers.map((l) => [l.ReferenceDoc, l]));
    const revertMap = new Map(
      revertLedgers.map((l) => [l.ReferenceDoc.replace(/^REVERT-/, ''), l]),
    );
    const materialMap = new Map(materials.map((m) => [m.PartNumber, m]));

    const data = warehouseLedgers.map((wh) => {
      const rack = rackMap.get(wh.ReferenceDoc);
      const revert = revertMap.get(wh.ReferenceDoc);
      const mat = wh.MaterialId ? materialMap.get(wh.MaterialId) : undefined;
      const isReverted = Boolean(revert);

      return {
        id: wh.Id,
        referenceDoc: wh.ReferenceDoc,
        materialId: wh.MaterialId ?? '-',
        partName: mat?.PartName ?? '-',
        rackLocation: mat?.RackLocation ?? null,
        qty: wh.QtyOut,
        warehouseBefore: wh.BalanceBefore,
        warehouseAfter: wh.BalanceAfter,
        rackBefore: rack?.BalanceBefore ?? 0,
        rackAfter: rack?.BalanceAfter ?? wh.QtyOut,
        transactionDate: wh.TransactionDate,
        createdBy: wh.CreatedBy,
        status: isReverted ? ('REVERTED' as const) : ('COMPLETED' as const),
        revertedAt: revert?.TransactionDate ?? null,
        revertedBy: revert?.CreatedBy ?? null,
        notes: wh.Notes,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async revertTransfer(
    referenceDoc: string,
    actor: string,
    reason: string,
    requestId: string,
  ) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      throw new BadRequestException('A revert reason is required.');
    }
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'TRANSFER_002',
        functionName: 'TransferService.revertTransfer',
        createdBy: actor,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Starting revert transfer: ReferenceDoc=${referenceDoc}, Actor=${actor}`,
        type: 'INFO',
        location: 'TransferService.revertTransfer',
      });

      const processId = logProcess.ProcessId;

      const result = await withInventoryTransaction(
        this.prisma,
        ItemCategory.MATERIAL,
        async (tx) => {
          const claimed = await claimCommand(
            tx,
            'TRANSFER_REVERT',
            requestId,
            actor,
            { referenceDoc, reason: normalizedReason },
          );
          if (claimed.duplicate) {
            await this.logService.completeProcess(
              processId,
              'SUCCESS',
              'Transfer revert replay: stock unchanged',
              tx,
            );
            return claimed.command.Result as unknown as {
              success: boolean;
              referenceDoc: string;
              partNumber: string;
              transferQty: number;
              warehouseBefore: number;
              warehouseAfter: number;
              rackBefore: number;
              rackAfter: number;
              revertedAt: Date;
              revertedBy: string;
            };
          }

          await assertNoActiveInventoryCounting(
            tx,
            ItemCategory.MATERIAL,
            'Revert Transfer',
          );

          const originalLedgers = await tx.inventoryLedger.findMany({
            where: {
              ReferenceDoc: referenceDoc,
              ItemCategory: ItemCategory.MATERIAL,
              TransactionType: TransactionType.TRANSFER_TO_RACK,
            },
          });
          const originalWarehouse = originalLedgers.find(
            (ledger) =>
              ledger.Location === LocationType.WAREHOUSE &&
              ledger.QtyIn === 0 &&
              ledger.QtyOut > 0,
          );
          const originalRack = originalLedgers.find(
            (ledger) =>
              ledger.Location === LocationType.RACK &&
              ledger.QtyOut === 0 &&
              ledger.QtyIn > 0,
          );
          if (!originalWarehouse || !originalRack) {
            throw new NotFoundException(
              `Complete transfer ledger pair ${referenceDoc} was not found.`,
            );
          }
          const partNumber = originalWarehouse.MaterialId;
          const transferQty = originalWarehouse.QtyOut;
          if (
            !partNumber ||
            originalRack.MaterialId !== partNumber ||
            transferQty <= 0 ||
            originalRack.QtyIn !== transferQty ||
            originalLedgers.length !== 2
          ) {
            throw new BadRequestException(
              'Original transfer ledger pair is inconsistent and cannot be reverted.',
            );
          }
          const alreadyReverted = await tx.inventoryLedger.findFirst({
            where: {
              ReferenceDoc: `REVERT-${referenceDoc}`,
              ItemCategory: ItemCategory.MATERIAL,
              TransactionType: TransactionType.TRANSFER_TO_RACK,
            },
          });
          if (alreadyReverted) {
            throw new BadRequestException(
              `Transfer ${referenceDoc} has already been reverted.`,
            );
          }

          // Find and validate material
          const material = await tx.material.findUnique({
            where: { PartNumber: partNumber },
            select: {
              PartNumber: true,
              IsActive: true,
              QtyWarehouse: true,
              QtyRack: true,
            },
          });

          if (!material) {
            throw new BadRequestException(
              `POKAYOKE: Material ${partNumber} not found in Material master.`,
            );
          }

          if (!material.IsActive) {
            throw new BadRequestException(
              `POKAYOKE: Material ${partNumber} is discontinued.`,
            );
          }

          // Check rack stock availability
          if (material.QtyRack < transferQty) {
            throw new BadRequestException(
              `POKAYOKE: Insufficient stock in rack to revert transfer. Available in rack: ${material.QtyRack}, Required to revert: ${transferQty}`,
            );
          }

          // Verify ledger integrity
          const warehouseBefore = material.QtyWarehouse;
          const rackBefore = material.QtyRack;

          for (const [location, cached] of [
            [LocationType.WAREHOUSE, warehouseBefore],
            [LocationType.RACK, rackBefore],
          ] as const) {
            const balance = await tx.inventoryLedger.aggregate({
              where: {
                ItemCategory: ItemCategory.MATERIAL,
                MaterialId: partNumber,
                Location: location,
              },
              _sum: { QtyIn: true, QtyOut: true },
            });
            if (
              (balance._sum.QtyIn ?? 0) - (balance._sum.QtyOut ?? 0) !==
              cached
            ) {
              throw new BadRequestException(
                'Inventory balance does not match the ledger. Reconcile stock before reverting transfer.',
              );
            }
          }

          const warehouseAfter = warehouseBefore + transferQty;
          const rackAfter = rackBefore - transferQty;
          const revertDoc = `REVERT-${referenceDoc}`;
          const now = new Date();

          // Update material cache
          await tx.material.update({
            where: { PartNumber: partNumber },
            data: {
              QtyWarehouse: warehouseAfter,
              QtyRack: rackAfter,
              UpdatedBy: actor,
            },
          });

          // Ledger 1: Deduct from RACK
          await tx.inventoryLedger.create({
            data: {
              Id: crypto.randomUUID(),
              TransactionDate: now,
              ItemCategory: ItemCategory.MATERIAL,
              MaterialId: partNumber,
              Location: LocationType.RACK,
              TransactionType: TransactionType.TRANSFER_TO_RACK,
              ReferenceDoc: revertDoc,
              BalanceBefore: rackBefore,
              QtyIn: 0,
              QtyOut: transferQty,
              BalanceAfter: rackAfter,
              CreatedBy: actor,
              Notes: `Revert transfer ${referenceDoc}: returned ${transferQty} to Warehouse (Reason: ${normalizedReason})`,
            },
          });

          // Ledger 2: Add back to WAREHOUSE
          await tx.inventoryLedger.create({
            data: {
              Id: crypto.randomUUID(),
              TransactionDate: now,
              ItemCategory: ItemCategory.MATERIAL,
              MaterialId: partNumber,
              Location: LocationType.WAREHOUSE,
              TransactionType: TransactionType.TRANSFER_TO_RACK,
              ReferenceDoc: revertDoc,
              BalanceBefore: warehouseBefore,
              QtyIn: transferQty,
              QtyOut: 0,
              BalanceAfter: warehouseAfter,
              CreatedBy: actor,
              Notes: `Revert transfer ${referenceDoc}: returned ${transferQty} from Rack (Reason: ${normalizedReason})`,
            },
          });

          await this.logService.addLog({
            processId,
            message: `Revert transfer completed: Material=${partNumber}, Qty=${transferQty}, Rack: ${rackBefore}->${rackAfter}, Warehouse: ${warehouseBefore}->${warehouseAfter}`,
            type: 'INFO',
            location: 'TransferService.revertTransfer',
            client: tx,
          });

          await this.logService.completeProcess(
            processId,
            'SUCCESS',
            undefined,
            tx,
          );

          const commandResult = {
            success: true,
            referenceDoc,
            partNumber,
            transferQty,
            warehouseBefore,
            warehouseAfter,
            rackBefore,
            rackAfter,
            revertedAt: now,
            revertedBy: actor,
          };
          await finishCommand(tx, claimed.command.Id, commandResult);
          return commandResult;
        },
      );

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'TransferService.revertTransfer',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
