import { auditedTransaction } from '../../common/helpers/audited-transaction.helper';
/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import {
  assertLabelReady,
  lockProductionFlow,
} from '../../common/helpers/production-flow.helper';
import { assertNoActiveInventoryCounting } from '../../common/helpers/inventory-counting-check.helper';
import type { Prisma } from '../../generated/prisma/client';
import {
  AssemblyQueryDto,
  StartAssemblyDto,
  CompleteAssemblyDto,
  CompleteInternalAssemblyDto,
} from './dto/assembly.dto';

const sessionInclude = {
  LabelData: {
    select: {
      LabelNumber: true,
      FinishGoodId: true,
      QtyThisBox: true,
      ForecastId: true,
      ProductionReleaseId: true,
      ProductionRelease: { select: { ReleaseNumber: true } },
      PartData: { select: { PartName: true } },
    },
  },
} satisfies Prisma.AssemblySessionInclude;

@Injectable()
export class AssemblyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly log: LogProcessService,
  ) {}

  private async operator(tx: Prisma.TransactionClient, nik: string) {
    const operator = await tx.manPower.findUnique({ where: { Nik: nik } });
    if (!operator?.Status)
      throw new BadRequestException(
        'Select an active manpower before scanning.',
      );
    return operator;
  }

  async operatorSession(nik: string) {
    const operator = await this.prisma.manPower.findUnique({
      where: { Nik: nik },
    });
    if (!operator)
      return {
        active: false,
        session: null,
        serverTime: new Date().toISOString(),
      };
    const session = await this.prisma.assemblySession.findFirst({
      where: { ManPowerUid: operator.Uid, Status: 'IN_PROGRESS' },
      include: sessionInclude,
    });
    return {
      active: operator.Status,
      session,
      serverTime: new Date().toISOString(),
    };
  }

  async createOptions(query: AssemblyQueryDto) {
    const candidates = await this.prisma.labelData.findMany({
      where: {
        RequiresAssembly: true,
        Scanned: false,
        QtyThisBox: { gt: 0 },
        ProductionRelease: { Status: 'RELEASED' },
        POData: { ShoppingCompletion: { isNot: null } },
        AssemblySessions: {
          none: { Status: { in: ['IN_PROGRESS', 'COMPLETED'] } },
        },
        ...(query.labelNumber
          ? {
              LabelNumber: {
                contains: query.labelNumber,
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
      select: { Id: true, ...sessionInclude.LabelData.select },
      orderBy: { LabelNumber: 'asc' },
      take: 100,
    });
    const labels: typeof candidates = [];
    for (const label of candidates) {
      try {
        await assertLabelReady(this.prisma, label.Id, false, true);
        labels.push(label);
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
      }
    }
    const manpower = await this.prisma.manPower.findMany({
      where: {
        Status: true,
        AssemblySessions: { none: { Status: 'IN_PROGRESS' } },
      },
      select: { Nik: true, Name: true },
      orderBy: { Name: 'asc' },
    });
    return { labels, manpower };
  }

  async progress(query: AssemblyQueryDto) {
    const scope: Prisma.LabelDataWhereInput = {
      RequiresAssembly: { not: null },
      ProductionRelease: { Status: 'RELEASED' },
      ...(query.productionReleaseId
        ? { ProductionReleaseId: query.productionReleaseId }
        : {}),
      ...(query.labelNumber
        ? { LabelNumber: { contains: query.labelNumber, mode: 'insensitive' } }
        : {}),
    };
    const count = (where: Prisma.LabelDataWhereInput) =>
      this.prisma.labelData.count({ where: { AND: [scope, where] } });
    const [waitingShopping, ready, inProgress, completed, notRequired] =
      await Promise.all([
        count({ POData: { ShoppingCompletion: null } }),
        count({
          RequiresAssembly: true,
          POData: { ShoppingCompletion: { isNot: null } },
          AssemblySessions: {
            none: { Status: { in: ['IN_PROGRESS', 'COMPLETED'] } },
          },
        }),
        count({ AssemblySessions: { some: { Status: 'IN_PROGRESS' } } }),
        count({ AssemblySessions: { some: { Status: 'COMPLETED' } } }),
        count({
          RequiresAssembly: false,
          POData: { ShoppingCompletion: { isNot: null } },
        }),
      ]);
    return { waitingShopping, ready, inProgress, completed, notRequired };
  }

  async findAll(query: AssemblyQueryDto) {
    const page = query.page ?? 1,
      limit = query.limit ?? 50;
    const where: Prisma.AssemblySessionWhereInput = {
      Status: query.status,
      ...(query.manPowerNik ? { ManPower: { Nik: query.manPowerNik } } : {}),
      LabelData: {
        ...(query.productionReleaseId
          ? { ProductionReleaseId: query.productionReleaseId }
          : {}),
        ...(query.labelNumber
          ? {
              LabelNumber: { contains: query.labelNumber, mode: 'insensitive' },
            }
          : {}),
      },
    };
    const [data, totalItems] = await Promise.all([
      this.prisma.assemblySession.findMany({
        where,
        include: sessionInclude,
        orderBy: { StartedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.assemblySession.count({ where }),
    ]);
    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async inspect(labelNumber: string) {
    const label = await this.prisma.labelData.findUnique({
      where: { LabelNumber: labelNumber },
      include: {
        PartData: { select: { PartName: true } },
        AssemblySessions: {
          where: { Status: { in: ['IN_PROGRESS', 'COMPLETED'] } },
          take: 1,
        },
      },
    });
    if (!label) throw new NotFoundException('Label not found.');
    let ready = true;
    try {
      await assertLabelReady(this.prisma, label.Id, false, true);
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      ready = false;
    }
    const session = label.AssemblySessions[0];
    return {
      label,
      status: !ready
        ? 'WAITING_SHOPPING'
        : label.RequiresAssembly !== true
          ? 'NOT_REQUIRED'
          : (session?.Status ?? 'READY'),
    };
  }

  private async mutate<T extends { Id: string }>(
    action: string,
    actor: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const process = await this.log.startProcess({
      functionId: `ASSEMBLY_${action}`,
      functionName: `AssemblyService.${action}`,
      createdBy: actor,
    });
    try {
      return await auditedTransaction(this.prisma, async (tx) => {
        await lockProductionFlow(tx);
        const result = await work(tx);
        const session = await tx.assemblySession.findUniqueOrThrow({
          where: { Id: result.Id },
          include: { LabelData: true },
        });
        const type = `ASSEMBLY_${action}`;
        if (
          !(await tx.productionTraceEvent.findFirst({
            where: {
              SourceType: 'AssemblySession',
              SourceId: session.Id,
              Type: type,
            },
          }))
        )
          await tx.productionTraceEvent.create({
            data: {
              ForecastId: session.LabelData.ForecastId,
              ReleaseId: session.LabelData.ProductionReleaseId,
              Type: type,
              SourceType: 'AssemblySession',
              SourceId: session.Id,
              Actor: actor,
              CorrelationId:
                action === 'START'
                  ? session.StartRequestId
                  : (session.CompleteRequestId ?? session.Id),
              ProcessId: process.ProcessId,
            },
          });
        await this.log.addLog({
          processId: process.ProcessId,
          message: `Assembly ${action} committed for session ${result.Id}`,
          type: 'INFO',
          location: 'AssemblyService',
          client: tx,
        });
        await this.log.completeProcess(
          process.ProcessId,
          'SUCCESS',
          undefined,
          tx,
        );
        return result;
      });
    } catch (error) {
      await this.log.completeProcess(process.ProcessId, 'FAILED');
      throw error;
    }
  }

  start(dto: StartAssemblyDto, actor: string, channel: 'DISPLAY' | 'INTERNAL') {
    return this.mutate('START', actor, async (tx) => {
      const operator = await this.operator(tx, dto.manPowerNik);
      const previous = await tx.assemblySession.findUnique({
        where: { StartRequestId: dto.requestId },
        include: sessionInclude,
      });
      if (previous) {
        if (
          previous.ManPowerUid !== operator.Uid ||
          previous.LabelData.LabelNumber !== dto.labelNumber
        )
          throw new ConflictException(
            'Request identity was already used for another operation.',
          );
        return previous;
      }
      const label = await tx.labelData.findUnique({
        where: { LabelNumber: dto.labelNumber },
      });
      if (!label) throw new NotFoundException('Label not found.');
      await assertLabelReady(tx, label.Id, false, true);
      if (label.RequiresAssembly !== true)
        throw new BadRequestException(
          'This label does not require assembly. Continue to pre-delivery.',
        );
      if (label.Scanned)
        throw new ConflictException('Label already passed POKAYOKE.');
      const occupied = await tx.assemblySession.findFirst({
        where: {
          OR: [
            {
              LabelDataId: label.Id,
              Status: { in: ['IN_PROGRESS', 'COMPLETED'] },
            },
            { ManPowerUid: operator.Uid, Status: 'IN_PROGRESS' },
          ],
        },
      });
      if (occupied)
        throw new ConflictException(
          'Label is already assembled or a label/manpower has an active assembly session. Refresh the station.',
        );
      return tx.assemblySession.create({
        data: {
          LabelDataId: label.Id,
          ManPowerUid: operator.Uid,
          ManPowerName: operator.Name,
          StartRequestId: dto.requestId,
          CreatedBy: actor,
          Channel: channel,
        },
        include: sessionInclude,
      });
    });
  }

  complete(
    id: string,
    dto: CompleteAssemblyDto | CompleteInternalAssemblyDto,
    actor: string,
  ) {
    return this.mutate('COMPLETE', actor, async (tx) => {
      const session = await tx.assemblySession.findUnique({
        where: { Id: id },
        include: sessionInclude,
      });
      if (!session) throw new NotFoundException('Assembly session not found.');
      const operator =
        'manPowerNik' in dto
          ? await this.operator(tx, dto.manPowerNik)
          : await tx.manPower.findUnique({
              where: { Uid: session.ManPowerUid },
            });
      if (!operator?.Status)
        throw new BadRequestException(
          'The assembly manpower is no longer active.',
        );
      if (session.ManPowerUid !== operator.Uid)
        throw new ConflictException(
          'Only the manpower who started this box can complete it.',
        );
      if (session.Status === 'COMPLETED') return session;
      if (session.Status !== 'IN_PROGRESS')
        throw new ConflictException(
          'Only an active assembly session can be completed.',
        );
      const duplicate = await tx.assemblySession.findUnique({
        where: { CompleteRequestId: dto.requestId },
      });
      if (duplicate)
        throw new ConflictException(
          'Request identity was already used for another operation.',
        );
      const { label } = await assertLabelReady(
        tx,
        session.LabelDataId,
        false,
        true,
      );
      if (label.RequiresAssembly !== true || label.Scanned)
        throw new ConflictException(
          'Label is no longer eligible for assembly.',
        );
      await assertNoActiveInventoryCounting(
        tx,
        'FINISH_GOOD',
        'Assembly completion',
      );
      await tx.$executeRaw`SELECT 1 FROM "FinishGood" WHERE "PartNumber" = ${label.FinishGoodId} FOR UPDATE`;
      const stock = await tx.inventoryLedger.aggregate({
        where: {
          FinishGoodId: label.FinishGoodId,
          ItemCategory: 'FINISH_GOOD',
          Location: 'FINISH_GOOD_AREA',
        },
        _sum: { QtyIn: true, QtyOut: true },
      });
      const before = (stock._sum.QtyIn ?? 0) - (stock._sum.QtyOut ?? 0);
      const after = before + label.QtyThisBox;
      await tx.inventoryLedger.create({
        data: {
          Id: randomUUID(),
          TransactionDate: new Date(),
          ItemCategory: 'FINISH_GOOD',
          FinishGoodId: label.FinishGoodId,
          Location: 'FINISH_GOOD_AREA',
          TransactionType: 'PRODUCTION_RESULT',
          ReferenceDoc: `ASSY-${id}`,
          BalanceBefore: before,
          QtyIn: label.QtyThisBox,
          QtyOut: 0,
          BalanceAfter: after,
          CreatedBy: actor,
          Notes: 'Assembly box completion',
        },
      });
      await tx.finishGood.update({
        where: { PartNumber: label.FinishGoodId },
        data: { Qty: after },
      });
      return tx.assemblySession.update({
        where: { Id: id },
        data: {
          Status: 'COMPLETED',
          EndedAt: new Date(),
          CompleteRequestId: dto.requestId,
          CompletedBy: actor,
        },
        include: sessionInclude,
      });
    });
  }

  cancel(id: string, reason: string, actor: string) {
    if (!reason.trim())
      throw new BadRequestException('Cancellation reason is required.');
    return this.mutate('CANCEL', actor, async (tx) => {
      const session = await tx.assemblySession.findUnique({
        where: { Id: id },
      });
      if (!session) throw new NotFoundException('Assembly session not found.');
      if (session.Status !== 'IN_PROGRESS')
        throw new ConflictException(
          'Only an active assembly session can be cancelled.',
        );
      return tx.assemblySession.update({
        where: { Id: id },
        data: {
          Status: 'CANCELLED',
          CancelledAt: new Date(),
          CancelledBy: actor,
          CancelReason: reason,
        },
        include: sessionInclude,
      });
    });
  }
}
