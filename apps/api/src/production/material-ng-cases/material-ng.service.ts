import { auditedTransaction } from '../../common/helpers/audited-transaction.helper';
/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { lockProductionFlow } from '../../common/helpers/production-flow.helper';
import { orderBom } from '../../common/helpers/bom-snapshot.helper';
import {
  claimCommand,
  finishCommand,
} from '../../common/helpers/business-command.helper';
import { lockInventoryCategory } from '../../common/helpers/inventory-transaction.helper';
import { assertNoActiveInventoryCounting } from '../../common/helpers/inventory-counting-check.helper';
import {
  CloseNgDto,
  CreateNgCaseDto,
  IssueNgDto,
  NgQueryDto,
} from './material-ng.dto';

const include = {
  Details: { include: { Replacements: true, SnapshotLine: true } },
  Snapshot: { include: { Revision: true } },
};
@Injectable()
export class MaterialNgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogProcessService,
  ) {}
  async candidates(q: NgQueryDto) {
    const where: Prisma.ForecastWhereInput = {
      ProductionRelease: { Status: 'RELEASED' },
      ...(q.search
        ? { PoId: { contains: q.search, mode: 'insensitive' } }
        : {}),
    };
    const [data, totalItems] = await Promise.all([
      this.prisma.forecast.findMany({
        where,
        select: {
          PoId: true,
          PoNumber: true,
          FinishGoodId: true,
          Qty: true,
          PartData: { select: { PartName: true } },
          ProductionRelease: {
            select: { Id: true, ReleaseNumber: true, Status: true },
          },
        },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { Id: 'desc' },
      }),
      this.prisma.forecast.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: q.page,
        limit: q.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / q.limit),
      },
    };
  }
  async list(q: NgQueryDto) {
    const where: Prisma.MaterialNgCaseWhereInput = {
      ...(q.forecastId ? { ForecastId: q.forecastId } : {}),
      ...(q.status ? { Status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { CaseNumber: { contains: q.search, mode: 'insensitive' } },
              { ForecastId: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, totalItems] = await Promise.all([
      this.prisma.materialNgCase.findMany({
        where,
        include,
        orderBy: { CreatedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.materialNgCase.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: q.page,
        limit: q.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / q.limit),
      },
    };
  }
  async get(id: string) {
    const value = await this.prisma.materialNgCase.findUnique({
      where: { Id: id },
      include,
    });
    if (!value) throw new NotFoundException('Material NG case not found.');
    return value;
  }
  private async run(
    scope: string,
    requestId: string,
    actor: string,
    payload: unknown,
    work: (
      tx: Prisma.TransactionClient,
      commandId: string,
      processId: string,
    ) => Promise<{ id: string; event: string }>,
  ) {
    const process = await this.logs.startProcess({
      functionId: scope,
      functionName: `MaterialNG.${scope}`,
      createdBy: actor,
    });
    try {
      const caseId = await auditedTransaction(
        this.prisma,
        async (tx) => {
          await lockInventoryCategory(tx, 'MATERIAL');
          await lockProductionFlow(tx);
          const { command, duplicate } = await claimCommand(
            tx,
            scope,
            requestId,
            actor,
            payload,
          );
          if (duplicate) {
            await this.logs.completeProcess(
              process.ProcessId,
              'SUCCESS',
              'Command replay',
              tx,
            );
            return (command.Result as { id: string }).id;
          }
          const result = await work(tx, command.Id, process.ProcessId);
          const ng = await tx.materialNgCase.findUniqueOrThrow({
            where: { Id: result.id },
          });
          await tx.productionTraceEvent.create({
            data: {
              ForecastId: ng.ForecastId,
              ReleaseId: ng.ReleaseId,
              Type: result.event,
              SourceType: 'MaterialNgCase',
              SourceId: ng.Id,
              Actor: actor,
              CorrelationId: requestId,
              ProcessId: process.ProcessId,
            },
          });
          await finishCommand(tx, command.Id, result);
          await this.logs.completeProcess(
            process.ProcessId,
            'SUCCESS',
            result.event,
            tx,
          );
          return result.id;
        },
        { timeout: 15000 },
      );
      return this.get(caseId);
    } catch (error) {
      await this.logs.completeProcess(process.ProcessId, 'FAILED');
      throw error;
    }
  }
  private async unfinished(
    tx: Prisma.TransactionClient,
    forecastId: string,
    labelId?: number,
  ) {
    const forecast = await tx.forecast.findUniqueOrThrow({
      where: { PoId: forecastId },
      include: { ProductionRelease: true },
    });
    if (forecast.ProductionRelease?.Status !== 'RELEASED')
      throw new ConflictException('Material NG requires a RELEASED order.');
    const count = await tx.labelData.count({
      where: {
        ForecastId: forecastId,
        ...(labelId ? { Id: labelId } : {}),
        Scanned: false,
        OR: [
          { RequiresAssembly: { not: true } },
          { RequiresAssembly: null },
          {
            RequiresAssembly: true,
            AssemblySessions: { none: { Status: 'COMPLETED' } },
          },
        ],
      },
    });
    if (!count)
      throw new ConflictException(
        'The selected production process is already finished. FG rework is outside this workflow.',
      );
  }
  create(dto: CreateNgCaseDto, actor: string) {
    if (!dto.reason.trim() || !dto.stage.trim())
      throw new BadRequestException('Stage and reason are required.');
    return this.run(
      'MATERIAL_NG_CREATE',
      dto.requestId,
      actor,
      dto,
      async (tx) => {
        await this.unfinished(tx, dto.forecastId, dto.labelId);
        const snapshot = await orderBom(tx, dto.forecastId);
        if (snapshot.Id !== dto.snapshotId)
          throw new ConflictException(
            'Order snapshot changed. Refresh the form.',
          );
        if (dto.assemblySessionId) {
          const session = await tx.assemblySession.findUnique({
            where: { Id: dto.assemblySessionId },
            include: { LabelData: true },
          });
          if (
            !session ||
            session.Status !== 'IN_PROGRESS' ||
            session.LabelData.ForecastId !== dto.forecastId ||
            (dto.labelId && session.LabelDataId !== dto.labelId)
          )
            throw new BadRequestException(
              'Assembly context does not match the order.',
            );
        }
        if (dto.productionReportId) {
          const report = await tx.productionReport.findUnique({
            where: { Id: dto.productionReportId },
          });
          if (report?.ForecastId !== dto.forecastId)
            throw new BadRequestException(
              'Production report does not match the order.',
            );
        }
        const details: Prisma.MaterialNGCreateWithoutCaseInput[] = [];
        for (const line of dto.lines) {
          const bom = snapshot.Lines.find(
            (l) => l.PartNumber === line.materialId,
          );
          if (!bom || line.qtyReplacement > line.qtyNg)
            throw new BadRequestException(
              'Replacement must match BOM material and cannot exceed declared NG.',
            );
          const [issued, declared] = await Promise.all([
            tx.shopping.aggregate({
              where: {
                ForecastId: dto.forecastId,
                SnapshotLineId: bom.Id,
                Purpose: { in: ['STANDARD', 'NG_REPLACEMENT'] },
              },
              _sum: { QtyPick: true },
            }),
            tx.materialNG.aggregate({
              where: {
                SnapshotLineId: bom.Id,
                Case: {
                  ForecastId: dto.forecastId,
                  Status: { not: 'CANCELLED' },
                },
              },
              _sum: { Qty: true },
            }),
          ]);
          if (
            (declared._sum.Qty ?? 0) + line.qtyNg >
            (issued._sum.QtyPick ?? 0)
          )
            throw new BadRequestException(
              'Declared NG exceeds material issued to this PO.',
            );
          details.push({
            MaterialData: { connect: { Id: bom.MaterialId } },
            SnapshotLine: { connect: { Id: bom.Id } },
            Qty: line.qtyNg,
            ReplacementRequestedQty: line.qtyReplacement,
            CreatedBy: actor,
            Description: dto.reason.trim(),
          });
        }
        const value = await tx.materialNgCase.create({
          data: {
            CaseNumber: `NG-${randomUUID()}`,
            ForecastId: dto.forecastId,
            ReleaseId: snapshot.ReleaseId,
            SnapshotId: snapshot.Id,
            Stage: dto.stage.trim(),
            Reason: dto.reason.trim(),
            CreatedBy: actor,
            LabelId: dto.labelId,
            AssemblySessionId: dto.assemblySessionId,
            ProductionReportId: dto.productionReportId,
            Status: dto.lines.some((l) => l.qtyReplacement > 0)
              ? 'OPEN'
              : 'FULFILLED',
            Details: { create: details },
          },
        });
        return { id: value.Id, event: 'MATERIAL_NG_REPORTED' };
      },
    );
  }
  issue(id: string, dto: IssueNgDto, actor: string) {
    return this.run(
      'MATERIAL_NG_ISSUE',
      dto.requestId,
      actor,
      { id, ...dto },
      async (tx, commandId) => {
        const value = await tx.materialNgCase.findUniqueOrThrow({
          where: { Id: id },
          include,
        });
        if (value.Status !== 'OPEN')
          throw new ConflictException(
            'This case has no open replacement requirement.',
          );
        await this.unfinished(tx, value.ForecastId, value.LabelId ?? undefined);
        await assertNoActiveInventoryCounting(
          tx,
          'MATERIAL',
          'Material NG replacement',
        );
        for (const line of [...dto.lines].sort(
          (a, b) => a.detailId - b.detailId,
        )) {
          const detail = value.Details.find((d) => d.Id === line.detailId);
          if (
            !detail ||
            line.qty >
              detail.ReplacementRequestedQty -
                detail.Replacements.reduce((sum, s) => sum + s.QtyPick, 0)
          )
            throw new BadRequestException(
              'Replacement exceeds outstanding quantity.',
            );
          await tx.$executeRaw`SELECT 1 FROM "Material" WHERE "PartNumber" = ${detail.MaterialId} FOR UPDATE`;
          const material = await tx.material.findUniqueOrThrow({
            where: { PartNumber: detail.MaterialId },
          });
          if (!material.IsActive)
            throw new BadRequestException('Material is inactive.');
          const stock = await tx.inventoryLedger.aggregate({
            where: {
              MaterialId: detail.MaterialId,
              ItemCategory: 'MATERIAL',
              Location: 'RACK',
            },
            _sum: { QtyIn: true, QtyOut: true },
          });
          const before = (stock._sum.QtyIn ?? 0) - (stock._sum.QtyOut ?? 0);
          if (before !== material.QtyRack)
            throw new ConflictException(
              'Rack cache differs from ledger. Reconcile before issuing.',
            );
          if (before < line.qty)
            throw new BadRequestException('Insufficient rack stock.');
          const shoppingId = `NG-${randomUUID()}`;
          await tx.shopping.create({
            data: {
              Id: shoppingId,
              Type: 'ADDITIONAL',
              Purpose: 'NG_REPLACEMENT',
              ForecastId: value.ForecastId,
              MaterialId: detail.MaterialId,
              QtyPick: line.qty,
              CreatedBy: actor,
              Description: value.Reason,
              SnapshotLineId: detail.SnapshotLineId,
              MaterialNgId: detail.Id,
              CommandId: commandId,
            },
          });
          await tx.inventoryLedger.create({
            data: {
              MaterialId: detail.MaterialId,
              ItemCategory: 'MATERIAL',
              Location: 'RACK',
              TransactionType: 'PRODUCTION_USAGE',
              ReferenceDoc: shoppingId,
              BalanceBefore: before,
              QtyIn: 0,
              QtyOut: line.qty,
              BalanceAfter: before - line.qty,
              CreatedBy: actor,
              Notes: 'Material NG replacement',
            },
          });
          await tx.material.update({
            where: { Id: material.Id },
            data: { QtyRack: before - line.qty },
          });
        }
        const updated = await tx.materialNgCase.findUniqueOrThrow({
          where: { Id: id },
          include,
        });
        if (
          updated.Details.every(
            (d) =>
              d.Replacements.reduce((sum, s) => sum + s.QtyPick, 0) >=
              d.ReplacementRequestedQty,
          )
        )
          await tx.materialNgCase.update({
            where: { Id: id },
            data: { Status: 'FULFILLED' },
          });
        return { id, event: 'MATERIAL_REPLACEMENT_ISSUED' };
      },
    );
  }
  close(id: string, dto: CloseNgDto, actor: string) {
    if (!dto.reason.trim())
      throw new BadRequestException('Closure reason is required.');
    return this.run(
      'MATERIAL_NG_CLOSE',
      dto.requestId,
      actor,
      { id, ...dto },
      async (tx) => {
        const value = await tx.materialNgCase.findUniqueOrThrow({
          where: { Id: id },
          include,
        });
        if (value.Status === 'CANCELLED' || value.Status === 'CLOSED')
          throw new ConflictException('Case is already closed.');
        if (
          dto.action === 'CANCEL' &&
          value.Details.some((d) => d.Replacements.length)
        )
          throw new ConflictException(
            'An issued replacement cannot be cancelled. Close the remaining requirement instead.',
          );
        await tx.materialNgCase.update({
          where: { Id: id },
          data: {
            Status: dto.action === 'CANCEL' ? 'CANCELLED' : 'CLOSED',
            ClosedAt: new Date(),
            ClosedBy: actor,
            CloseReason: dto.reason.trim(),
          },
        });
        return {
          id,
          event:
            dto.action === 'CANCEL'
              ? 'MATERIAL_NG_CANCELLED'
              : 'MATERIAL_NG_CLOSED',
        };
      },
    );
  }
}
