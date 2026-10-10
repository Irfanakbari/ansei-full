/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { auditedTransaction } from '../../common/helpers/audited-transaction.helper';
import {
  claimCommand,
  finishCommand,
} from '../../common/helpers/business-command.helper';
import { lockProductionFlow } from '../../common/helpers/production-flow.helper';
import { assertNoActiveInventoryCounting } from '../../common/helpers/inventory-counting-check.helper';
import {
  createSapLedger,
  sapAudit,
} from '../../common/sap/sap-transaction-capture';
import { CustomerReturnDto } from './dto/customer-return.dto';

export function recordCustomerReturn(
  prisma: PrismaService,
  deliveryId: number,
  dto: CustomerReturnDto,
  actor: string,
  scrapReturnId?: string,
) {
  return auditedTransaction(prisma, async (tx) => {
    const command = await claimCommand(
      tx,
      scrapReturnId ? 'CUSTOMER_RETURN_SCRAP' : 'CUSTOMER_RETURN',
      dto.requestId,
      actor,
      { deliveryId, scrapReturnId, ...dto },
    );
    if (command.duplicate) return command.command.Result;
    await lockProductionFlow(tx);
    await assertNoActiveInventoryCounting(tx, 'FINISH_GOOD', 'Customer return');
    const delivery = await tx.deliveryHistory.findUniqueOrThrow({
      where: { Id: deliveryId },
      include: { LabelData: true },
    });
    const code = delivery.LabelData.FinishGoodId;
    await tx.$executeRaw`SELECT 1 FROM "FinishGood" WHERE "PartNumber"=${code} FOR UPDATE`;
    const fg = await tx.finishGood.findUniqueOrThrow({
      where: { PartNumber: code },
    });
    const balance = await tx.inventoryLedger.aggregate({
      where: { FinishGoodId: code, Location: 'FINISH_GOOD_AREA' },
      _sum: { QtyIn: true, QtyOut: true },
    });
    const before = (balance._sum.QtyIn ?? 0) - (balance._sum.QtyOut ?? 0);
    if (before !== fg.Qty)
      throw new ConflictException('FG cache differs from ledger.');
    let returnId: string;
    if (scrapReturnId) {
      const returned = await tx.customerReturn.findUniqueOrThrow({
        where: { Id: scrapReturnId },
      });
      if (
        returned.DeliveryId !== deliveryId ||
        returned.Quantity - returned.ScrappedQuantity < dto.quantity ||
        before < dto.quantity
      )
        throw new ConflictException('Scrap exceeds available returned stock.');
      await tx.customerReturn.update({
        where: { Id: scrapReturnId },
        data: { ScrappedQuantity: { increment: dto.quantity } },
      });
      returnId = scrapReturnId;
    } else {
      const total = await tx.customerReturn.aggregate({
        where: { DeliveryId: deliveryId },
        _sum: { Quantity: true },
      });
      if ((total._sum.Quantity ?? 0) + dto.quantity > delivery.Qty)
        throw new ConflictException(
          'Return quantity exceeds the delivered quantity.',
        );
      const returned = await tx.customerReturn.create({
        data: {
          DeliveryId: deliveryId,
          Quantity: dto.quantity,
          Reason: dto.reason,
          CreatedBy: actor,
        },
      });
      returnId = returned.Id;
    }
    const after = before + (scrapReturnId ? -dto.quantity : dto.quantity);
    await createSapLedger(
      tx,
      {
        data: {
          ItemCategory: 'FINISH_GOOD',
          FinishGoodId: code,
          Location: 'FINISH_GOOD_AREA',
          TransactionType: scrapReturnId ? 'NG_SCRAP' : 'CUSTOMER_RETURN',
          ReferenceDoc: `${scrapReturnId ? 'RETURN_SCRAP' : 'CUSTOMER_RETURN'}:${returnId}:${command.command.Id}`,
          BalanceBefore: before,
          QtyIn: scrapReturnId ? 0 : dto.quantity,
          QtyOut: scrapReturnId ? dto.quantity : 0,
          BalanceAfter: after,
          CreatedBy: actor,
          Notes: dto.reason,
        },
      },
      delivery.ProductionDemandId,
    );
    await tx.finishGood.update({
      where: { PartNumber: code },
      data: { Qty: after, UpdatedBy: actor },
    });
    await sapAudit(
      tx,
      actor,
      scrapReturnId ? 'CUSTOMER_RETURN_SCRAP' : 'CUSTOMER_RETURN',
      returnId,
    );
    const result = { returnId, deliveryId, quantity: dto.quantity };
    await finishCommand(tx, command.command.Id, result);
    return result;
  });
}
