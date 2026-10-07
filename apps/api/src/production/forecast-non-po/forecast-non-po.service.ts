/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Workbook } from 'exceljs';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { auditedTransaction } from '../../common/helpers/audited-transaction.helper';
import {
  lockProductionFlow,
  buildProductionLabels,
} from '../../common/helpers/production-flow.helper';
import { snapshotRelease } from '../../common/helpers/bom-snapshot.helper';
import { ExcelService } from '../../common/utils/excel.service';
import { validateUploadContent } from '../../common/utils/upload-security.util';
import { ForecastService } from '../forecast/forecast.service';
import {
  CreateNonPoDto,
  UpdateNonPoDto,
  NonPoQueryDto,
  NonPoFieldsDto,
  ImportNonPoDto,
} from './forecast-non-po.dto';

type Client = Prisma.TransactionClient;
const COLUMNS = [
  'partNumber',
  'deliveryDate',
  'receivingArea',
  'deliveryPeriod',
  'qty',
  'poNumber',
  'notes',
];
const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class ForecastNonPoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly log: LogProcessService,
    private readonly excel: ExcelService,
    private readonly forecast: ForecastService,
  ) {}

  async findAll(query: NonPoQueryDto) {
    const where: Prisma.ForecastNonPoWhereInput = {
      ...(query.referenceNumber
        ? {
            ReferenceNumber: {
              contains: query.referenceNumber,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.partNumber
        ? { PartNumber: { contains: query.partNumber, mode: 'insensitive' } }
        : {}),
      ...(query.receivingArea
        ? {
            ReceivingArea: {
              contains: query.receivingArea,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.poNumber
        ? { PoNumber: { contains: query.poNumber, mode: 'insensitive' } }
        : {}),
      ...(query.deliveryDate
        ? { DeliveryDate: new Date(query.deliveryDate) }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                ReferenceNumber: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                PartNumber: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await Promise.all([
      this.prisma.forecastNonPo.count({ where }),
      this.prisma.forecastNonPo.findMany({
        where,
        include: {
          PartData: { select: { PartName: true } },
          Demand: {
            include: {
              ProductionRelease: {
                select: { ReleaseNumber: true, Status: true },
              },
            },
          },
        },
        orderBy: [{ DeliveryDate: 'asc' }, { Id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
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

  async findOne(id: number) {
    const row = await this.prisma.forecastNonPo.findUnique({
      where: { Id: id },
      include: {
        PartData: { select: { PartName: true } },
        Demand: { include: { ProductionRelease: true } },
      },
    });
    if (!row) throw new NotFoundException('Non PO forecast not found.');
    let operationalLocked = false;
    try {
      await this.requireEditable(this.prisma, row.ReferenceNumber);
    } catch (error) {
      if (error instanceof ConflictException) operationalLocked = true;
      else throw error;
    }
    return { ...row, operationalLocked };
  }

  private fields(dto: NonPoFieldsDto) {
    return {
      PartNumber: dto.partNumber.trim(),
      DeliveryDate: new Date(dto.deliveryDate),
      ReceivingArea: dto.receivingArea.trim(),
      DeliveryPeriod: dto.deliveryPeriod,
      Qty: dto.qty,
      PoNumber: dto.poNumber?.trim() || null,
      Notes: dto.notes?.trim() || null,
    };
  }

  private async write<T>(
    action: string,
    actor: string,
    work: (tx: Client, processId: string) => Promise<T>,
  ): Promise<T> {
    const process = await this.log.startProcess({
      functionId: `FORECAST_NON_PO_${action}`,
      functionName: `ForecastNonPo.${action}`,
      createdBy: actor,
    });
    try {
      return await auditedTransaction(
        this.prisma,
        async (tx) => {
          await lockProductionFlow(tx);
          const result = await work(tx, process.ProcessId);
          await this.log.addLog({
            processId: process.ProcessId,
            message: `Non PO ${action} completed`,
            type: 'INFO',
            location: 'ForecastNonPoService',
            client: tx,
          });
          await this.log.completeProcess(
            process.ProcessId,
            'SUCCESS',
            undefined,
            tx,
          );
          return result;
        },
        { isolationLevel: 'Serializable', timeout: 60000 },
      );
    } catch (error) {
      await this.log.completeProcess(process.ProcessId, 'FAILED');
      throw error;
    }
  }

  private async validatePart(tx: Client, partNumber: string) {
    if (
      !(await tx.finishGood.findUnique({
        where: { PartNumber: partNumber },
        select: { Id: true },
      }))
    )
      throw new BadRequestException(
        'Part number is not registered in Finish Good.',
      );
  }

  async create(dto: CreateNonPoDto, actor: string) {
    const data = this.fields(dto);
    const payloadHash = hash(JSON.stringify(data));
    return this.write('CREATE', actor, async (tx) => {
      const receipt = await tx.forecastNonPoImport.findUnique({
        where: { RequestId: dto.requestId },
      });
      if (receipt) {
        if (receipt.PayloadHash !== payloadHash)
          throw new ConflictException(
            'Request ID was already used for different data.',
          );
        const saved = await tx.forecastNonPo.findUnique({
          where: { Id: receipt.SourceIds[0] },
        });
        if (!saved)
          throw new ConflictException(
            'The original forecast was deleted; use a new request ID.',
          );
        return saved;
      }
      await this.validatePart(tx, data.PartNumber);
      if (
        !dto.confirmDuplicates &&
        (await tx.forecastNonPo.count({ where: data }))
      )
        throw new ConflictException(
          'An identical Non PO forecast exists. Confirm duplicate creation to continue.',
        );
      const saved = await tx.forecastNonPo.create({
        data: {
          ...data,
          ReferenceNumber: `NPO-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
          CreatedBy: actor,
          UpdatedBy: actor,
        },
      });
      await tx.forecastNonPoImport.create({
        data: {
          FileHash: `manual:${dto.requestId}`,
          RequestId: dto.requestId,
          PayloadHash: payloadHash,
          SourceIds: [saved.Id],
          CreatedCount: 1,
          CreatedBy: actor,
        },
      });
      return saved;
    });
  }

  private async requireEditable(tx: Client, reference: string) {
    const row = await tx.productionOrder.findUniqueOrThrow({
      where: { PoId: reference },
      include: {
        ProductionRelease: true,
        ShoppingCompletion: true,
        _count: {
          select: {
            Shopping: true,
            DeliveryHistory: true,
            ProductionReport: true,
            ProductionFindings: true,
          },
        },
        LabelData: {
          include: {
            _count: {
              select: { PokayokeHistory: true, AssemblySessions: true },
            },
          },
        },
      },
    });
    if (
      (row.ProductionRelease &&
        !['DRAFT', 'RELEASED'].includes(row.ProductionRelease.Status)) ||
      row.ShoppingCompletion ||
      Object.values(row._count).some((count) => count > 0) ||
      row.LabelData.some(
        (label) =>
          label.Scanned ||
          label._count.PokayokeHistory > 0 ||
          label._count.AssemblySessions > 0,
      )
    )
      throw new ConflictException(
        'Operational activity exists. Only PO number and notes can be changed.',
      );
    return row;
  }

  async update(id: number, dto: UpdateNonPoDto, actor: string) {
    return this.write('UPDATE', actor, async (tx, processId) => {
      const existing = await tx.forecastNonPo.findUnique({
        where: { Id: id },
        include: { Demand: true },
      });
      if (!existing) throw new NotFoundException('Non PO forecast not found.');
      const merged = this.fields({
        partNumber: dto.partNumber ?? existing.PartNumber,
        deliveryDate:
          dto.deliveryDate ?? existing.DeliveryDate.toISOString().slice(0, 10),
        receivingArea: dto.receivingArea ?? existing.ReceivingArea,
        deliveryPeriod: dto.deliveryPeriod ?? existing.DeliveryPeriod,
        qty: dto.qty ?? existing.Qty,
        poNumber: dto.poNumber !== undefined ? dto.poNumber : existing.PoNumber,
        notes: dto.notes !== undefined ? dto.notes : existing.Notes,
      });
      const changedOperational =
        merged.PartNumber !== existing.PartNumber ||
        merged.DeliveryDate.getTime() !== existing.DeliveryDate.getTime() ||
        merged.ReceivingArea !== existing.ReceivingArea ||
        merged.DeliveryPeriod !== existing.DeliveryPeriod ||
        merged.Qty !== existing.Qty;
      if (changedOperational)
        await this.requireEditable(tx, existing.ReferenceNumber);
      const labelChange =
        merged.PartNumber !== existing.PartNumber ||
        merged.Qty !== existing.Qty;
      if (
        merged.PartNumber !== existing.PartNumber &&
        (await tx.productionBomSnapshot.count({
          where: { ProductionDemandId: existing.ReferenceNumber },
        }))
      )
        throw new ConflictException(
          'A snapshotted order cannot change part number.',
        );
      await this.validatePart(tx, merged.PartNumber);
      if (
        !dto.confirmDuplicates &&
        (await tx.forecastNonPo.count({
          where: { ...merged, Id: { not: id } },
        }))
      )
        throw new ConflictException(
          'An identical Non PO forecast exists. Confirm duplicates to continue.',
        );
      const result = await tx.forecastNonPo.update({
        where: { Id: id },
        data: { ...merged, UpdatedBy: actor },
      });
      const releaseId = existing.Demand?.ProductionReleaseId;
      if (releaseId && changedOperational) {
        const release = await tx.productionRelease.findUniqueOrThrow({
          where: { Id: releaseId },
        });
        if (labelChange) {
          await tx.labelData.deleteMany({
            where: { ProductionDemandId: existing.ReferenceNumber },
          });
          if (release.Status === 'RELEASED') {
            const order = await tx.productionOrder.findUniqueOrThrow({
              where: { PoId: existing.ReferenceNumber },
              include: { PartData: { include: { BoxQTY: true } } },
            });
            const qty = order.PartData.BoxQTY?.Qty ?? 0;
            if (qty <= 0)
              throw new BadRequestException(
                'Configure Box Qty before changing a released order.',
              );
            await tx.labelData.createMany({
              data: buildProductionLabels(
                order,
                releaseId,
                qty,
                !order.PartData.IsPassthrough,
              ),
            });
          }
        }
        if (release.Status === 'RELEASED')
          await snapshotRelease(tx, releaseId, actor, processId);
        const totals = await tx.productionOrder.aggregate({
          where: { ProductionReleaseId: releaseId },
          _sum: { Qty: true },
        });
        await tx.productionRelease.update({
          where: { Id: releaseId },
          data: { TotalTargetQty: totals._sum.Qty ?? 0 },
        });
      }
      return result;
    });
  }

  async remove(id: number, actor: string) {
    return this.write('DELETE', actor, async (tx) => {
      const row = await tx.forecastNonPo.findUnique({
        where: { Id: id },
        include: { Demand: true },
      });
      if (!row) throw new NotFoundException('Non PO forecast not found.');
      if (row.Demand?.ProductionReleaseId)
        throw new ConflictException('Untag the order before deleting it.');
      await this.requireEditable(tx, row.ReferenceNumber);
      await tx.forecastNonPo.delete({ where: { Id: id } });
      return { deleted: true, id };
    });
  }

  async template() {
    const book = new Workbook();
    const sheet = book.addWorksheet('Forecast Non PO');
    sheet.addRow(COLUMNS);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => {
      column.width = 22;
    });
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  private async parse(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Excel file is required.');
    validateUploadContent(file, ['xlsx']);
    const book = new Workbook();
    await book.xlsx.load(new Uint8Array(file.buffer).buffer);
    const sheet = book.worksheets[0];
    if (
      !sheet ||
      COLUMNS.some(
        (name, i) =>
          String(sheet.getRow(1).getCell(i + 1).value ?? '').trim() !== name,
      )
    )
      throw new BadRequestException('Use the seven-column Non PO template.');
    if (sheet.rowCount > 5001)
      throw new BadRequestException('Maximum 5000 rows per import.');
    const rows = await this.excel.readExcelByPosition(file);
    return rows
      .map((row, i) => {
        if (
          Object.values(row).every(
            (value) =>
              value === null ||
              value === undefined ||
              String(value).trim() === '',
          )
        )
          return null;
        let date = '';
        try {
          const value = row[1];
          if (value instanceof Date) date = value.toISOString().slice(0, 10);
          else if (typeof value === 'number' && Number.isFinite(value))
            date = new Date(
              Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000,
            )
              .toISOString()
              .slice(0, 10);
          else if (typeof value === 'string') date = value.trim();
        } catch {
          /* validation reports the row */
        }
        const dto = plainToInstance(NonPoFieldsDto, {
          partNumber: String(row[0] ?? '').trim(),
          deliveryDate: date,
          receivingArea: String(row[2] ?? '').trim(),
          deliveryPeriod: Number(row[3]),
          qty: Number(row[4]),
          poNumber: String(row[5] ?? '').trim() || null,
          notes: String(row[6] ?? '').trim() || null,
        });
        const errors = validateSync(dto).flatMap((error) =>
          Object.values(error.constraints ?? {}),
        );
        return { rowNumber: i + 2, values: dto, errors, duplicate: false };
      })
      .filter((row) => row !== null);
  }

  private async inspect(
    tx: Client,
    rows: Awaited<ReturnType<ForecastNonPoService['parse']>>,
  ) {
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.errors.length) continue;
      const data = this.fields(row.values);
      if (
        !(await tx.finishGood.findUnique({
          where: { PartNumber: data.PartNumber },
          select: { Id: true },
        }))
      )
        row.errors.push('Part number is not registered in Finish Good.');
      const key = JSON.stringify(data);
      row.duplicate =
        seen.has(key) || (await tx.forecastNonPo.count({ where: data })) > 0;
      seen.add(key);
    }
    return rows;
  }

  async preview(file: Express.Multer.File) {
    const rows = await this.inspect(this.prisma, await this.parse(file));
    const existing = await this.prisma.forecastNonPoImport.findUnique({
      where: { FileHash: hash(file.buffer) },
    });
    return { rows, alreadyImported: !!existing, total: rows.length };
  }

  async importFile(
    file: Express.Multer.File,
    dto: ImportNonPoDto,
    actor: string,
  ) {
    const rows = await this.parse(file);
    if (!rows.length)
      throw new BadRequestException('The spreadsheet is empty.');
    const fileHash = hash(file.buffer);
    return this.write('IMPORT', actor, async (tx) => {
      const byRequest = await tx.forecastNonPoImport.findUnique({
        where: { RequestId: dto.requestId },
      });
      if (byRequest && byRequest.FileHash !== fileHash)
        throw new ConflictException(
          'Request ID was already used for another file.',
        );
      const receipt =
        byRequest ??
        (await tx.forecastNonPoImport.findUnique({
          where: { FileHash: fileHash },
        }));
      if (receipt)
        return {
          created: receipt.CreatedCount,
          ids: receipt.SourceIds,
          replayed: true,
        };
      await this.inspect(tx, rows);
      if (rows.some((row) => row.errors.length))
        throw new BadRequestException({
          message: 'Fix spreadsheet errors before importing.',
          rows: rows
            .filter((row) => row.errors.length)
            .map((row) => ({ rowNumber: row.rowNumber, errors: row.errors })),
        });
      if (rows.some((row) => row.duplicate) && dto.confirmDuplicates !== 'true')
        throw new ConflictException('Confirm duplicate rows before importing.');
      const ids: number[] = [];
      for (const row of rows) {
        const saved = await tx.forecastNonPo.create({
          data: {
            ...this.fields(row.values),
            ReferenceNumber: `NPO-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
            CreatedBy: actor,
            UpdatedBy: actor,
          },
        });
        ids.push(saved.Id);
      }
      await tx.forecastNonPoImport.create({
        data: {
          FileHash: fileHash,
          RequestId: dto.requestId,
          CreatedCount: ids.length,
          SourceIds: ids,
          CreatedBy: actor,
        },
      });
      return { created: ids.length, ids, replayed: false };
    });
  }

  async print(id: number, actor: string) {
    const row = await this.findOne(id);
    return this.forecast.printTag(row.ReferenceNumber, actor);
  }
  async download(id: number) {
    const row = await this.findOne(id);
    return this.forecast.downloadTag(row.ReferenceNumber);
  }
}
