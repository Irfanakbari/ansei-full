import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { auditedTransaction } from '../../common/helpers/audited-transaction.helper';
import { lockInventoryCategory } from '../../common/helpers/inventory-transaction.helper';
import { nextRecordNumber } from '../../common/helpers/record-number.helper';
import { assertNoActiveInventoryCounting } from '../../common/helpers/inventory-counting-check.helper';
import {
  claimCommand,
  finishCommand,
} from '../../common/helpers/business-command.helper';
import {
  AllocateFindingDto,
  ProductionFindingQueryDto,
  PublicFindingOptionsQueryDto,
  RejectFindingDto,
  ReviewFindingDto,
  SubmitFinishGoodFindingDto,
  SubmitMaterialFindingDto,
} from './production-finding.dto';

const findingInclude = {
  Material: true,
  Forecast: { select: { PoId: true, PoNumber: true, FinishGoodId: true } },
  Release: { select: { Id: true, ReleaseNumber: true } },
  Snapshot: { include: { Revision: true } },
  Label: { select: { Id: true, LabelNumber: true } },
  Components: {
    include: {
      SnapshotLine: true,
      Allocations: { include: { Shopping: true } },
    },
  },
  Events: { orderBy: { CreatedAt: 'asc' as const } },
};

@Injectable()
export class ProductionFindingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogProcessService,
  ) {}

  async list(query: ProductionFindingQueryDto) {
    const where: Prisma.ProductionFindingWhereInput = {
      ...(query.category ? { Category: query.category } : {}),
      ...(query.status ? { Status: query.status } : {}),
      DeletedAt: null,
      ...(query.search
        ? {
            OR: [
              {
                RecordNumber: { contains: query.search, mode: 'insensitive' },
              },
              { MaterialId: { contains: query.search, mode: 'insensitive' } },
              {
                ProductionDemandId: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                Label: {
                  LabelNumber: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [data, totalItems] = await Promise.all([
      this.prisma.productionFinding.findMany({
        where,
        include: findingInclude,
        orderBy: [{ SubmittedAt: 'desc' }, { Id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.productionFinding.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }

  async get(id: string) {
    const finding = await this.prisma.productionFinding.findFirst({
      where: { Id: id, DeletedAt: null },
      include: findingInclude,
    });
    if (!finding) throw new NotFoundException('Production finding not found.');
    return finding;
  }

  async getPublicMaterialOptions(query: PublicFindingOptionsQueryDto) {
    const materials = await this.prisma.material.findMany({
      where: {
        IsActive: true,
        ...(query.search
          ? {
              OR: [
                {
                  PartNumber: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  PartName: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      select: { PartNumber: true, PartName: true },
      orderBy: [{ PartNumber: 'asc' }, { Id: 'asc' }],
      take: query.limit,
    });
    return materials.map((material) => ({
      partNumber: material.PartNumber,
      partName: material.PartName,
    }));
  }

  async getPublicLabelOptions(query: PublicFindingOptionsQueryDto) {
    const labels = await this.prisma.labelData.findMany({
      where: {
        ProductionRelease: { is: { Status: 'RELEASED' } },
        ...(query.search
          ? {
              OR: [
                {
                  LabelNumber: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  FinishGoodId: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  PartData: {
                    is: {
                      PartName: {
                        contains: query.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        LabelNumber: true,
        QtyThisBox: true,
        FinishGoodId: true,
        PartData: { select: { PartName: true } },
      },
      orderBy: [{ LabelNumber: 'asc' }, { Id: 'asc' }],
      take: query.limit,
    });
    return labels.map((label) => ({
      labelNumber: label.LabelNumber,
      labelQty: label.QtyThisBox,
      finishGoodPartNumber: label.FinishGoodId,
      finishGoodPartName: label.PartData.PartName,
    }));
  }

  async getPublicFinishGoodContext(labelNumber: string) {
    const normalizedLabelNumber = labelNumber.trim();
    const label = await this.prisma.labelData.findUnique({
      where: { LabelNumber: normalizedLabelNumber },
      select: {
        LabelNumber: true,
        QtyThisBox: true,
        FinishGoodId: true,
        ProductionDemandId: true,
        ProductionReleaseId: true,
        PartData: { select: { PartName: true } },
        ProductionRelease: { select: { Status: true } },
      },
    });
    if (!label)
      throw new NotFoundException('Released production label not found.');
    if (
      !label.ProductionReleaseId ||
      label.ProductionRelease?.Status !== 'RELEASED'
    )
      throw new ConflictException(
        'Label must belong to a RELEASED production order.',
      );
    const snapshot = await this.prisma.productionBomSnapshot.findFirst({
      where: {
        ProductionDemandId: label.ProductionDemandId,
        ReleaseId: label.ProductionReleaseId,
      },
      select: {
        FinishGoodPartNumber: true,
        FinishGoodPartName: true,
        Lines: {
          select: {
            Id: true,
            PartNumber: true,
            PartName: true,
            QtyPerUnit: true,
          },
          orderBy: [{ PartNumber: 'asc' }, { Id: 'asc' }],
        },
      },
      orderBy: { Version: 'desc' },
    });
    if (!snapshot)
      throw new ConflictException(
        'Immutable production BOM snapshot is unavailable.',
      );
    return {
      labelNumber: label.LabelNumber,
      finishGoodPartNumber: snapshot.FinishGoodPartNumber || label.FinishGoodId,
      finishGoodPartName:
        snapshot.FinishGoodPartName || label.PartData.PartName,
      labelQty: label.QtyThisBox,
      components: snapshot.Lines.map((line) => ({
        snapshotLineId: line.Id,
        materialPartNumber: line.PartNumber,
        materialPartName: line.PartName,
        QtyPerUnit: line.QtyPerUnit,
      })),
    };
  }

  private async execute(
    scope: string,
    requestId: string,
    actor: string,
    payload: unknown,
    work: (
      tx: Prisma.TransactionClient,
      processId: string,
    ) => Promise<{ id: string; event: string }>,
  ) {
    const process = await this.logs.startProcess({
      functionId: scope,
      functionName: `ProductionFinding.${scope}`,
      createdBy: actor,
    });
    try {
      const id = await auditedTransaction(
        this.prisma,
        async (tx) => {
          const { command, duplicate } = await claimCommand(
            tx,
            scope,
            requestId,
            actor,
            payload,
          );
          if (duplicate) {
            const result = command.Result as { id: string };
            await this.logs.completeProcess(
              process.ProcessId,
              'SUCCESS',
              'Command replay',
              tx,
            );
            return result.id;
          }
          const result = await work(tx, process.ProcessId);
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
      return this.get(id);
    } catch (error) {
      await this.logs.completeProcess(process.ProcessId, 'FAILED');
      throw error;
    }
  }

  submitMaterial(dto: SubmitMaterialFindingDto) {
    const actor = `DISPLAY:${dto.reporter.trim()}`;
    return this.execute(
      'PRODUCTION_FINDING_MATERIAL_SUBMIT',
      dto.requestId,
      actor,
      dto,
      async (tx) => {
        const material = await tx.material.findUnique({
          where: { PartNumber: dto.materialId },
        });
        if (!material?.IsActive)
          throw new BadRequestException('Material is missing or inactive.');
        const recordNumber = await nextRecordNumber(tx, 'ANR');
        const finding = await tx.productionFinding.create({
          data: {
            RecordNumber: recordNumber,
            Category: 'MATERIAL',
            Location: dto.location,
            MaterialId: material.PartNumber,
            Qty: dto.qty,
            Reason: dto.reason.trim(),
            Reporter: dto.reporter.trim(),
            ...(dto.location === 'ASSY'
              ? {
                  Components: {
                    create: {
                      MaterialId: material.PartNumber,
                      Qty: dto.qty,
                    },
                  },
                }
              : {}),
          },
        });
        await this.addEvent(tx, finding.Id, 'SUBMITTED', actor, {
          category: 'MATERIAL',
        });
        return { id: finding.Id, event: 'PRODUCTION_FINDING_SUBMITTED' };
      },
    );
  }

  submitFinishGood(dto: SubmitFinishGoodFindingDto) {
    const actor = `DISPLAY:${dto.reporter.trim()}`;
    return this.execute(
      'PRODUCTION_FINDING_FG_SUBMIT',
      dto.requestId,
      actor,
      dto,
      async (tx, processId) => {
        const label = await tx.labelData.findUnique({
          where: { LabelNumber: dto.labelNumber },
          include: {
            POData: { include: { ProductionRelease: true } },
          },
        });
        if (
          !label?.ProductionReleaseId ||
          label.POData.ProductionRelease?.Status !== 'RELEASED'
        )
          throw new ConflictException(
            'Label must belong to a RELEASED production order.',
          );
        const snapshot = await tx.productionBomSnapshot.findFirst({
          where: {
            ProductionDemandId: label.ProductionDemandId,
            ReleaseId: label.ProductionReleaseId,
          },
          include: { Lines: true },
          orderBy: { Version: 'desc' },
        });
        if (!snapshot)
          throw new ConflictException(
            'Immutable production BOM snapshot is unavailable.',
          );
        const selected = dto.components.map((component) => {
          const line = snapshot.Lines.find(
            (item) => item.Id === component.snapshotLineId,
          );
          if (!line)
            throw new BadRequestException(
              'Selected component is not in the label BOM snapshot.',
            );
          return { line, qty: component.qty };
        });
        const recordNumber = await nextRecordNumber(tx, 'ANR');
        const finding = await tx.productionFinding.create({
          data: {
            RecordNumber: recordNumber,
            Category: 'FINISH_GOOD',
            Qty: dto.qty,
            Reason: dto.reason.trim(),
            Reporter: dto.reporter.trim(),
            ProductionDemandId: label.ProductionDemandId,
            ReleaseId: label.ProductionReleaseId,
            SnapshotId: snapshot.Id,
            LabelId: label.Id,
            Components: {
              create: selected.map(({ line, qty }) => ({
                SnapshotLineId: line.Id,
                MaterialId: line.PartNumber,
                Qty: qty,
              })),
            },
          },
        });
        await this.addEvent(tx, finding.Id, 'SUBMITTED', actor, {
          category: 'FINISH_GOOD',
          labelNumber: label.LabelNumber,
        });
        await tx.productionTraceEvent.create({
          data: {
            ProductionDemandId: label.ProductionDemandId,
            ReleaseId: label.ProductionReleaseId,
            Type: 'PRODUCTION_FINDING_SUBMITTED',
            SourceType: 'ProductionFinding',
            SourceId: finding.Id,
            Actor: actor,
            CorrelationId: dto.requestId,
            ProcessId: processId,
          },
        });
        return { id: finding.Id, event: 'PRODUCTION_FINDING_SUBMITTED' };
      },
    );
  }

  delete(id: string, dto: RejectFindingDto, actor: string) {
    return this.execute(
      'PRODUCTION_FINDING_DELETE',
      dto.requestId,
      actor,
      { id, ...dto },
      async (tx, processId) => {
        const finding = await tx.productionFinding.findUnique({
          where: { Id: id },
        });
        if (!finding)
          throw new NotFoundException('Production finding not found.');
        if (finding.DeletedAt)
          return { id, event: 'PRODUCTION_FINDING_ALREADY_DELETED' };
        if (finding.Status !== 'PENDING')
          throw new ConflictException('Only pending findings can be deleted.');
        const deleted = await tx.productionFinding.updateMany({
          where: { Id: id, Status: 'PENDING', DeletedAt: null },
          data: {
            DeletedAt: new Date(),
            DeletedBy: actor,
          },
        });
        if (deleted.count !== 1)
          throw new ConflictException(
            'Production finding changed concurrently.',
          );
        await this.addEvent(tx, id, 'DELETED', actor, { note: dto.note });
        await this.addTrace(
          tx,
          finding,
          'PRODUCTION_FINDING_DELETED',
          actor,
          dto.requestId,
          processId,
        );
        return { id, event: 'PRODUCTION_FINDING_DELETED' };
      },
    );
  }

  approve(id: string, dto: ReviewFindingDto, actor: string) {
    return this.execute(
      'PRODUCTION_FINDING_APPROVE',
      dto.requestId,
      actor,
      { id, ...dto },
      async (tx, processId) => {
        const finding = await tx.productionFinding.findUnique({
          where: { Id: id },
        });
        if (!finding || finding.DeletedAt)
          throw new NotFoundException('Production finding not found.');
        if (finding.Status !== 'PENDING')
          throw new ConflictException('Only pending findings can be approved.');
        const waitsForPartChange =
          finding.Category === 'FINISH_GOOD' || finding.Location === 'ASSY';
        if (!waitsForPartChange) await this.approveMaterial(tx, finding, actor);
        await tx.productionFinding.update({
          where: { Id: id },
          data: waitsForPartChange
            ? {
                Status: 'WAITING_PART_CHANGE',
                ReviewedBy: actor,
                ReviewedAt: new Date(),
                ReviewNote: dto.note?.trim(),
              }
            : {
                Status: 'COMPLETED',
                ReviewedBy: actor,
                ReviewedAt: new Date(),
                ReviewNote: dto.note?.trim(),
                CompletedBy: actor,
                CompletedAt: new Date(),
              },
        });
        await this.addEvent(
          tx,
          id,
          waitsForPartChange
            ? 'APPROVED_WAITING_PART_CHANGE'
            : 'APPROVED_AND_SCRAPPED',
          actor,
        );
        await this.addTrace(
          tx,
          finding,
          'PRODUCTION_FINDING_APPROVED',
          actor,
          dto.requestId,
          processId,
        );
        return { id, event: 'PRODUCTION_FINDING_APPROVED' };
      },
    );
  }

  private async approveMaterial(
    tx: Prisma.TransactionClient,
    finding: {
      Id: string;
      MaterialId: string | null;
      Location: 'WAREHOUSE' | 'RACK' | 'ASSY' | 'FINISH_GOOD_AREA' | null;
      Qty: number;
    },
    actor: string,
  ) {
    if (
      !finding.MaterialId ||
      (finding.Location !== 'WAREHOUSE' && finding.Location !== 'RACK')
    )
      throw new ConflictException('Material finding stock context is invalid.');
    await lockInventoryCategory(tx, 'MATERIAL');
    await assertNoActiveInventoryCounting(
      tx,
      'MATERIAL',
      'Production finding NG scrap',
    );
    await tx.$executeRaw`SELECT 1 FROM "Material" WHERE "PartNumber" = ${finding.MaterialId} FOR UPDATE`;
    const material = await tx.material.findUniqueOrThrow({
      where: { PartNumber: finding.MaterialId },
    });
    const stock = await tx.inventoryLedger.aggregate({
      where: {
        MaterialId: finding.MaterialId,
        ItemCategory: 'MATERIAL',
        Location: finding.Location,
      },
      _sum: { QtyIn: true, QtyOut: true },
    });
    const before = (stock._sum.QtyIn ?? 0) - (stock._sum.QtyOut ?? 0);
    const cache =
      finding.Location === 'RACK' ? material.QtyRack : material.QtyWarehouse;
    if (before !== cache)
      throw new ConflictException(
        'Material cache differs from ledger. Reconcile before approval.',
      );
    if (before < finding.Qty)
      throw new BadRequestException(
        'Insufficient material stock for NG scrap.',
      );
    await tx.inventoryLedger.create({
      data: {
        ItemCategory: 'MATERIAL',
        MaterialId: finding.MaterialId,
        Location: finding.Location,
        TransactionType: 'NG_SCRAP',
        ReferenceDoc: finding.Id,
        BalanceBefore: before,
        QtyIn: 0,
        QtyOut: finding.Qty,
        BalanceAfter: before - finding.Qty,
        CreatedBy: actor,
        Notes: 'Production finding material NG approval',
      },
    });
    await tx.material.update({
      where: { Id: material.Id },
      data:
        finding.Location === 'RACK'
          ? { QtyRack: before - finding.Qty, UpdatedBy: actor }
          : { QtyWarehouse: before - finding.Qty, UpdatedBy: actor },
    });
  }

  reject(id: string, dto: RejectFindingDto, actor: string) {
    return this.execute(
      'PRODUCTION_FINDING_REJECT',
      dto.requestId,
      actor,
      { id, ...dto },
      async (tx, processId) => {
        const finding = await tx.productionFinding.findUnique({
          where: { Id: id },
        });
        if (!finding || finding.DeletedAt)
          throw new NotFoundException('Production finding not found.');
        if (finding.Status !== 'PENDING')
          throw new ConflictException('Only pending findings can be rejected.');
        await tx.productionFinding.update({
          where: { Id: id },
          data: {
            Status: 'REJECTED',
            ReviewedBy: actor,
            ReviewedAt: new Date(),
            ReviewNote: dto.note.trim(),
          },
        });
        await this.addEvent(tx, id, 'REJECTED', actor, {
          note: dto.note.trim(),
        });
        await this.addTrace(
          tx,
          finding,
          'PRODUCTION_FINDING_REJECTED',
          actor,
          dto.requestId,
          processId,
        );
        return { id, event: 'PRODUCTION_FINDING_REJECTED' };
      },
    );
  }

  allocate(id: string, dto: AllocateFindingDto, actor: string) {
    return this.execute(
      'PRODUCTION_FINDING_ALLOCATE',
      dto.requestId,
      actor,
      { id, ...dto },
      async (tx, processId) => {
        const finding = await tx.productionFinding.findUnique({
          where: { Id: id },
          include: { Components: { include: { Allocations: true } } },
        });
        if (
          !finding ||
          finding.DeletedAt ||
          (finding.Category !== 'FINISH_GOOD' && finding.Location !== 'ASSY')
        )
          throw new NotFoundException('Part-change finding not found.');
        if (finding.Status !== 'WAITING_PART_CHANGE')
          throw new ConflictException(
            'Finding is not waiting for part change.',
          );
        const component = finding.Components.find(
          (item) => item.Id === dto.componentId,
        );
        if (!component)
          throw new BadRequestException(
            'Component does not belong to this finding.',
          );
        const allocated = component.Allocations.reduce(
          (sum, item) => sum + item.Qty,
          0,
        );
        if (allocated + dto.qty > component.Qty)
          throw new BadRequestException(
            'Allocation exceeds component requirement.',
          );
        const shopping = await tx.shopping.findUnique({
          where: { Id: dto.shoppingId },
        });
        if (
          !shopping ||
          shopping.Type !== 'ADDITIONAL' ||
          shopping.Purpose !== 'NON_PRODUCTION' ||
          shopping.ProductionDemandId !== null ||
          shopping.MaterialId !== component.MaterialId
        )
          throw new BadRequestException(
            'Shopping must be eligible PO-less NON_PRODUCTION ADDITIONAL for the same material.',
          );
        if (dto.qty > shopping.QtyPick)
          throw new BadRequestException(
            'Allocation exceeds shopping quantity.',
          );
        await tx.productionFindingAllocation.create({
          data: {
            FindingId: id,
            ComponentId: component.Id,
            ShoppingId: shopping.Id,
            Qty: dto.qty,
            CreatedBy: actor,
          },
        });
        await this.addEvent(tx, id, 'SHOPPING_ALLOCATED', actor, {
          componentId: component.Id,
          shoppingId: shopping.Id,
          qty: dto.qty,
        });
        await this.addTrace(
          tx,
          finding,
          'PRODUCTION_FINDING_SHOPPING_ALLOCATED',
          actor,
          dto.requestId,
          processId,
        );
        return { id, event: 'PRODUCTION_FINDING_SHOPPING_ALLOCATED' };
      },
    );
  }

  complete(id: string, dto: ReviewFindingDto, actor: string) {
    return this.execute(
      'PRODUCTION_FINDING_COMPLETE',
      dto.requestId,
      actor,
      { id, ...dto },
      async (tx, processId) => {
        const finding = await tx.productionFinding.findUnique({
          where: { Id: id },
          include: { Components: { include: { Allocations: true } } },
        });
        if (
          !finding ||
          finding.DeletedAt ||
          (finding.Category !== 'FINISH_GOOD' && finding.Location !== 'ASSY')
        )
          throw new NotFoundException('Part-change finding not found.');
        if (finding.Status !== 'WAITING_PART_CHANGE')
          throw new ConflictException('Finding is not waiting for completion.');
        if (
          finding.Components.some(
            (component) =>
              component.Allocations.reduce((sum, item) => sum + item.Qty, 0) <
              component.Qty,
          )
        )
          throw new ConflictException(
            'All component quantities must be covered before completion.',
          );
        await tx.productionFinding.update({
          where: { Id: id },
          data: {
            Status: 'COMPLETED',
            CompletedBy: actor,
            CompletedAt: new Date(),
            ReviewNote: dto.note?.trim() ?? finding.ReviewNote,
          },
        });
        await this.addEvent(tx, id, 'COMPLETED', actor);
        await this.addTrace(
          tx,
          finding,
          'PRODUCTION_FINDING_COMPLETED',
          actor,
          dto.requestId,
          processId,
        );
        return { id, event: 'PRODUCTION_FINDING_COMPLETED' };
      },
    );
  }

  private addEvent(
    tx: Prisma.TransactionClient,
    findingId: string,
    type: string,
    actor: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return tx.productionFindingEvent.create({
      data: {
        FindingId: findingId,
        Type: type,
        Actor: actor,
        Metadata: metadata,
      },
    });
  }

  private addTrace(
    tx: Prisma.TransactionClient,
    finding: {
      Id: string;
      ProductionDemandId: string | null;
      ReleaseId: string | null;
    },
    type: string,
    actor: string,
    correlationId: string,
    processId: string,
  ) {
    if (!finding.ProductionDemandId) return Promise.resolve(null);
    return tx.productionTraceEvent.create({
      data: {
        ProductionDemandId: finding.ProductionDemandId,
        ReleaseId: finding.ReleaseId,
        Type: type,
        SourceType: 'ProductionFinding',
        SourceId: finding.Id,
        Actor: actor,
        CorrelationId: correlationId,
        ProcessId: processId,
      },
    });
  }
}
