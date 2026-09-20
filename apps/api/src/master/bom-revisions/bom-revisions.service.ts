import { auditedTransaction } from '../../common/helpers/audited-transaction.helper';
import {
  claimCommand,
  finishCommand,
  requestCommandKey,
} from '../../common/helpers/business-command.helper';
/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  CreateRevisionDto,
  RevisionActionDto,
  RevisionLineDto,
  RevisionQueryDto,
  UpdateRevisionDto,
} from './bom-revision.dto';

const detail = {
  Lines: true,
  FinishGood: {
    select: {
      Id: true,
      PartNumber: true,
      PartName: true,
      ActiveBomRevisionId: true,
    },
  },
  Events: { orderBy: { CreatedAt: 'asc' as const } },
  Snapshots: {
    select: {
      Id: true,
      ForecastId: true,
      ReleaseId: true,
      Version: true,
      CreatedAt: true,
    },
  },
};

@Injectable()
export class BomRevisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogProcessService,
  ) {}

  async list(query: RevisionQueryDto) {
    const where: Prisma.BomRevisionWhereInput = {
      ...(query.finishGoodId ? { FinishGoodId: query.finishGoodId } : {}),
      ...(query.status ? { Status: query.status } : {}),
      ...(query.active === 'true' ? { ActiveFor: { isNot: null } } : {}),
      ...(query.search
        ? {
            FinishGood: {
              OR: [
                { PartNumber: { contains: query.search, mode: 'insensitive' } },
                { PartName: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const [data, totalItems] = await Promise.all([
      this.prisma.bomRevision.findMany({
        where,
        include: detail,
        orderBy: { CreatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.bomRevision.count({ where }),
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
    const value = await this.prisma.bomRevision.findUnique({
      where: { Id: id },
      include: detail,
    });
    if (!value) throw new NotFoundException('BOM revision not found.');
    return value;
  }
  private async lines(tx: Prisma.TransactionClient, lines: RevisionLineDto[]) {
    if (new Set(lines.map((l) => l.materialId)).size !== lines.length)
      throw new BadRequestException('Duplicate BOM material.');
    const materials = await tx.material.findMany({
      where: { Id: { in: lines.map((l) => l.materialId) }, IsActive: true },
      include: { SatuanData: true },
    });
    return lines.map((line) => {
      const material = materials.find((m) => m.Id === line.materialId);
      if (!material || !Number.isInteger(line.qty) || line.qty <= 0)
        throw new BadRequestException(
          'BOM requires active materials and positive integer quantities.',
        );
      return {
        MaterialId: material.Id,
        Qty: line.qty,
        PartNumber: material.PartNumber,
        PartName: material.PartName,
        UnitName: material.SatuanData?.Name ?? null,
      };
    });
  }
  private async mutate<T>(
    action: string,
    actor: string,
    payload: unknown,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    const requestId = requestCommandKey();
    const process = await this.logs.startProcess({
      functionId: `BOM_REV_${action}`,
      functionName: `BomRevisions.${action}`,
      createdBy: actor,
    });
    try {
      return await auditedTransaction(this.prisma, async (tx) => {
        const claimed = requestId
          ? await claimCommand(
              tx,
              `BOM_REV_${action}`,
              requestId,
              actor,
              payload,
            )
          : null;
        if (claimed?.duplicate) {
          await this.logs.completeProcess(
            process.ProcessId,
            'SUCCESS',
            'BOM command replay',
            tx,
          );
          return claimed.command.Result as T;
        }
        const result = await work(tx);
        if (claimed) await finishCommand(tx, claimed.command.Id, result);
        await this.logs.completeProcess(
          process.ProcessId,
          'SUCCESS',
          `BOM revision ${action}`,
          tx,
        );
        return result;
      });
    } catch (error) {
      await this.logs.completeProcess(process.ProcessId, 'FAILED');
      throw error;
    }
  }
  create(dto: CreateRevisionDto, actor: string) {
    if (!dto.reason.trim())
      throw new BadRequestException('Change reason is required.');
    return this.mutate('CREATE', actor, dto, async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "FinishGood" WHERE "Id" = ${dto.finishGoodId} FOR UPDATE`;
      const fg = await tx.finishGood.findUniqueOrThrow({
        where: { Id: dto.finishGoodId },
      });
      const source = dto.copyFromId
        ? await tx.bomRevision.findUniqueOrThrow({
            where: { Id: dto.copyFromId },
            include: { Lines: true },
          })
        : null;
      if (source && source.FinishGoodId !== fg.Id)
        throw new BadRequestException(
          'Cannot copy a BOM from another finish good.',
        );
      if (
        dto.importLegacy &&
        (fg.ActiveBomRevisionId || dto.copyFromId || dto.lines?.length)
      )
        throw new BadRequestException(
          'Legacy baseline import requires an unmigrated finish good.',
        );
      const baseline = dto.importLegacy
        ? await tx.billOfMaterials.findMany({ where: { FinishGoodId: fg.Id } })
        : [];
      const input =
        dto.lines ??
        source?.Lines.map((l) => ({ materialId: l.MaterialId, qty: l.Qty })) ??
        baseline.map((l) => ({ materialId: l.MaterialId, qty: l.Qty }));
      const max = await tx.bomRevision.aggregate({
        where: { FinishGoodId: fg.Id },
        _max: { Revision: true },
      });
      return tx.bomRevision.create({
        data: {
          FinishGoodId: fg.Id,
          Revision: (max._max.Revision ?? 0) + 1,
          BaseRevisionId: fg.ActiveBomRevisionId,
          Reason: dto.reason.trim(),
          CreatedBy: actor,
          LastEditedBy: actor,
          Lines: { create: await this.lines(tx, input) },
          Events: {
            create: {
              Action: dto.importLegacy ? 'BASELINE_IMPORTED' : 'CREATED',
              Actor: actor,
              Reason: dto.reason.trim(),
              Version: 1,
            },
          },
        },
        include: detail,
      });
    });
  }
  update(id: string, dto: UpdateRevisionDto, actor: string) {
    return this.action(id, 'EDIT', dto, actor);
  }
  action(
    id: string,
    action: string,
    dto: RevisionActionDto & {
      lines?: RevisionLineDto[];
      expectedActiveRevisionId?: string | null;
    },
    actor: string,
  ) {
    return this.mutate(action, actor, { id, dto }, async (tx) => {
      const initial = await tx.bomRevision.findUnique({ where: { Id: id } });
      if (!initial) throw new NotFoundException('BOM revision not found.');
      await tx.$executeRaw`SELECT 1 FROM "FinishGood" WHERE "Id" = ${initial.FinishGoodId} FOR UPDATE`;
      const revision = await tx.bomRevision.findUniqueOrThrow({
        where: { Id: id },
        include: { Lines: true, FinishGood: true },
      });
      if (revision.Version !== dto.expectedVersion)
        throw new ConflictException('BOM changed. Refresh before continuing.');
      if (revision.Status === 'APPROVED' || revision.Status === 'CANCELLED')
        throw new ConflictException(
          'This revision is immutable. Create a new draft.',
        );
      const version = revision.Version + 1;
      const reason = dto.reason?.trim() || revision.Reason;
      const data: Prisma.BomRevisionUpdateInput = { Version: version };
      if (action === 'EDIT') {
        if (revision.Status !== 'DRAFT' || !dto.lines)
          throw new ConflictException('Only a draft can be edited.');
        if (
          dto.expectedActiveRevisionId !==
          revision.FinishGood.ActiveBomRevisionId
        )
          throw new ConflictException(
            'Active BOM changed since this draft was reviewed. Refresh Comparison before saving.',
          );
        await tx.bomRevisionLine.deleteMany({ where: { RevisionId: id } });
        data.Lines = { create: await this.lines(tx, dto.lines) };
        data.Reason = reason;
        data.LastEditedBy = actor;
        // Editing a stale draft explicitly rebases its reviewed content onto the active revision.
        data.BaseRevision = revision.FinishGood.ActiveBomRevisionId
          ? { connect: { Id: revision.FinishGood.ActiveBomRevisionId } }
          : { disconnect: true };
      } else if (action === 'SUBMIT') {
        if (revision.Status !== 'DRAFT' || !revision.Lines.length)
          throw new ConflictException('Submit a non-empty draft.');
        if (revision.BaseRevisionId !== revision.FinishGood.ActiveBomRevisionId)
          throw new ConflictException(
            'Active BOM changed. Review and save the draft before submitting.',
          );
        data.Status = 'SUBMITTED';
        data.SubmittedAt = new Date();
        data.SubmittedBy = actor;
      } else if (action === 'APPROVE') {
        if (revision.Status !== 'SUBMITTED')
          throw new ConflictException(
            'Only submitted revisions can be approved.',
          );
        if ([revision.CreatedBy, revision.LastEditedBy].includes(actor))
          throw new ForbiddenException(
            'Creator/editor cannot approve their own BOM.',
          );
        if (revision.BaseRevisionId !== revision.FinishGood.ActiveBomRevisionId)
          throw new ConflictException(
            'Active BOM changed. Reject and review this draft again.',
          );
        await this.lines(
          tx,
          revision.Lines.map((l) => ({ materialId: l.MaterialId, qty: l.Qty })),
        );
        data.Status = 'APPROVED';
        data.ApprovedBy = actor;
        data.ApprovedAt = new Date();
        await tx.finishGood.update({
          where: { Id: revision.FinishGoodId },
          data: { ActiveBomRevisionId: id, UpdatedBy: actor },
        });
        // Compatibility read projection. Revision/snapshot tables remain authoritative.
        await tx.billOfMaterials.deleteMany({
          where: { FinishGoodId: revision.FinishGoodId },
        });
        await tx.billOfMaterials.createMany({
          data: revision.Lines.map((l) => ({
            FinishGoodId: revision.FinishGoodId,
            MaterialId: l.MaterialId,
            Qty: l.Qty,
          })),
        });
      } else if (action === 'REJECT') {
        if (revision.Status !== 'SUBMITTED' || !dto.reason?.trim())
          throw new BadRequestException(
            'Reject a submitted revision with a reason.',
          );
        data.Status = 'DRAFT';
      } else if (action === 'CANCEL') {
        if (revision.Status !== 'DRAFT' || !dto.reason?.trim())
          throw new BadRequestException('Cancel a draft with a reason.');
        data.Status = 'CANCELLED';
      } else throw new BadRequestException('Unknown revision action.');
      data.Events = {
        create: {
          Action: action,
          Actor: actor,
          Reason: reason,
          Version: version,
        },
      };
      return tx.bomRevision.update({
        where: { Id: id },
        data,
        include: detail,
      });
    });
  }
  async compare(id: string, baseId?: string) {
    const revision = await this.get(id);
    const base =
      baseId ||
      (revision.Status === 'DRAFT' || revision.Status === 'SUBMITTED'
        ? revision.FinishGood.ActiveBomRevisionId
        : revision.BaseRevisionId);
    const previous = base ? await this.get(base) : null;
    if (previous && previous.FinishGoodId !== revision.FinishGoodId)
      throw new BadRequestException(
        'Compare revisions of the same finish good.',
      );
    const ids = new Set(
      [...revision.Lines, ...(previous?.Lines ?? [])].map((l) => l.MaterialId),
    );
    return [...ids].map((materialId) => {
      const before = previous?.Lines.find((l) => l.MaterialId === materialId);
      const after = revision.Lines.find((l) => l.MaterialId === materialId);
      return {
        materialId,
        partNumber: (after ?? before)!.PartNumber,
        before: before?.Qty ?? 0,
        after: after?.Qty ?? 0,
        change: !before
          ? 'ADDED'
          : !after
            ? 'REMOVED'
            : before.Qty !== after.Qty
              ? 'CHANGED'
              : 'UNCHANGED',
      };
    });
  }
}
