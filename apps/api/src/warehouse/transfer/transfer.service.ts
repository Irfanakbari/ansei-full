import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import type { LogProcessModel } from '../../generated/prisma/models';
import {
  LocationType,
  TransactionType,
  ItemCategory,
} from '../../generated/prisma/enums';
import { assertNoActiveInventoryCounting } from '../../common/helpers/inventory-counting-check.helper';
import { withInventoryTransaction } from '../../common/helpers/inventory-transaction.helper';
import {
  claimCommand,
  finishCommand,
} from '../../common/helpers/business-command.helper';

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
        message: `Starting transfer to rack: Material=${partNumber}, Qty=${qty}`,
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
                { partNumber, qty },
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
            select: { IsActive: true, QtyWarehouse: true, QtyRack: true },
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
          const referenceDoc = `TRANSFER-TO-RACK-${crypto.randomUUID()}`;
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
              Notes: `Transfer to Rack for ${partNumber}, Qty: ${qty}`,
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
              Notes: `Transfer from Warehouse, Qty: ${qty}`,
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
}
