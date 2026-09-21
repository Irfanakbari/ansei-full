import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SystemLogQueryDto } from './dto/system-log-query.dto';
import { InventoryLedgerQueryDto } from './dto/inventory-ledger-query.dto';
import { InventoryLedgerExportDto } from './dto/inventory-ledger-export.dto';
import {
  LogProcessDetailResponseDto,
  LogProcessDto,
} from './dto/system-log-response.dto';
import { InventoryLedgerDto } from './dto/inventory-ledger-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  getUserDisplayName,
  getUserDisplayNameMap,
} from '../common/helpers/user-lookup.helper';
import ExcelJS from 'exceljs';
import moment from 'moment-timezone';
import type {
  ApiResult,
  PaginationMeta,
} from '../common/interceptors/api-response.interface';
import { Prisma } from '../generated/prisma/client';
import { ActionAuditQueryDto } from './dto/action-audit.dto';
import {
  SystemLogEventDto,
  SystemLogEventsQueryDto,
  SystemLogEventType,
} from './dto/system-log-events.dto';

type UnifiedEventRow = {
  id: string;
  occurredAt: Date;
  type: SystemLogEventType;
  event: string;
  referenceType: string | null;
  referenceId: string | null;
  status: string;
  actor: string | null;
  processId: string | null;
  summary: string;
  errorCode: string | null;
};

type CountRow = { total: bigint | number };

@Injectable()
export class SystemLogService {
  constructor(private readonly prisma: PrismaService) {}

  async events(
    query: SystemLogEventsQueryDto,
  ): Promise<ApiResult<SystemLogEventDto[], PaginationMeta>> {
    const search = query.search?.trim();
    const searchPattern = search ? `%${search}%` : null;
    const type = query.type ?? null;
    const offset = (query.page - 1) * query.limit;
    const events = Prisma.sql`
      SELECT
        lp."ProcessId" AS id,
        lp."CreatedAt" AS "occurredAt",
        'PROCESS'::text AS type,
        lp."FunctionName" AS event,
        'FUNCTION'::text AS "referenceType",
        lp."FunctionId" AS "referenceId",
        lp."ProcessStatus" AS status,
        lp."CreatedBy" AS actor,
        lp."ProcessId" AS "processId",
        lp."FunctionName" AS summary,
        NULL::text AS "errorCode"
      FROM "LogProcess" lp
      WHERE (${type}::text IS NULL OR ${type}::text = 'PROCESS')
        AND (${searchPattern}::text IS NULL OR concat_ws(' ', lp."ProcessId", lp."FunctionId", lp."FunctionName", lp."ProcessStatus", lp."CreatedBy") ILIKE ${searchPattern})
      UNION ALL
      SELECT
        aa."Id" AS id,
        aa."CreatedAt" AS "occurredAt",
        'ACTION'::text AS type,
        aa."Action" AS event,
        aa."SourceType" AS "referenceType",
        aa."SourceId" AS "referenceId",
        aa."Action" AS status,
        aa."Actor" AS actor,
        aa."ProcessId" AS "processId",
        concat_ws(' ', aa."SourceType", aa."Action") AS summary,
        NULL::text AS "errorCode"
      FROM "ActionAuditEvent" aa
      WHERE (${type}::text IS NULL OR ${type}::text = 'ACTION')
        AND (${searchPattern}::text IS NULL OR concat_ws(' ', aa."Id", aa."SourceType", aa."SourceId", aa."Action", aa."Actor", aa."ProcessId", aa."RequestId") ILIKE ${searchPattern})
      UNION ALL
      SELECT
        oe."Id" AS id,
        oe."CreatedAt" AS "occurredAt",
        'INTEGRATION'::text AS type,
        oe."Type"::text AS event,
        oe."ReferenceType" AS "referenceType",
        oe."ReferenceId" AS "referenceId",
        oe."Status"::text AS status,
        oe."Actor" AS actor,
        NULL::text AS "processId",
        concat('Integration ', oe."Status"::text) AS summary,
        oe."LastErrorCode" AS "errorCode"
      FROM "OutboxEvent" oe
      WHERE (${type}::text IS NULL OR ${type}::text = 'INTEGRATION')
        AND (${searchPattern}::text IS NULL OR concat_ws(' ', oe."Id", oe."Type"::text, oe."Status"::text, oe."Actor", oe."ReferenceType", oe."ReferenceId", oe."LastErrorCode") ILIKE ${searchPattern})
    `;
    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<UnifiedEventRow[]>`
        SELECT * FROM (${events}) unified_events
        ORDER BY "occurredAt" DESC, type ASC, id DESC
        LIMIT ${query.limit} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS total FROM (${events}) unified_events
      `,
    ]);
    const displayNames = await getUserDisplayNameMap(
      rows.map((row) => row.actor),
      this.prisma,
    );
    const totalItems = Number(countRows[0]?.total ?? 0);
    return {
      data: rows.map(({ errorCode, ...row }) => ({
        ...row,
        actorName: getUserDisplayName(row.actor, displayNames),
        recoverable:
          row.type === 'INTEGRATION' &&
          row.status === 'FAILED' &&
          errorCode === 'OUTBOX_SAFE_RETRY',
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }

  async actions(query: ActionAuditQueryDto) {
    const where: Prisma.ActionAuditEventWhereInput = {
      RequestId: query.requestId,
      ProcessId: query.processId,
      SourceType: query.sourceType,
      SourceId: query.sourceId,
      Action: query.action,
      CreatedAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };
    const [data, totalItems] = await Promise.all([
      this.prisma.actionAuditEvent.findMany({
        where,
        orderBy: [{ CreatedAt: 'desc' }, { Id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.actionAuditEvent.count({ where }),
    ]);
    const displayNames = await getUserDisplayNameMap(
      data.map((item) => item.Actor),
      this.prisma,
    );
    return {
      data: data.map((item) => ({
        ...item,
        ActorName: getUserDisplayName(item.Actor, displayNames),
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }

  /**
   * GET /system-log
   * Returns paginated list of LogProcess records (newest first, default 50 per page).
   */
  async findAll(
    query: SystemLogQueryDto,
  ): Promise<ApiResult<LogProcessDto[], PaginationMeta>> {
    const { page, limit } = query;
    const offset = (page - 1) * limit;

    const where: Prisma.LogProcessWhereInput = {};

    if (query.search) {
      where.OR = [
        { ProcessId: { contains: query.search, mode: 'insensitive' } },
        { FunctionId: { contains: query.search, mode: 'insensitive' } },
        { FunctionName: { contains: query.search, mode: 'insensitive' } },
        { ProcessStatus: { contains: query.search, mode: 'insensitive' } },
        { CreatedBy: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.functionId) {
      where.FunctionId = query.functionId;
    }

    if (query.processStatus) {
      where.ProcessStatus = query.processStatus;
    }

    const [total, data] = await Promise.all([
      this.prisma.logProcess.count({ where }),
      this.prisma.logProcess.findMany({
        where,
        orderBy: { CreatedAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          ProcessId: true,
          FunctionId: true,
          FunctionName: true,
          ProcessStatus: true,
          ProcessDate: true,
          ProcessStart: true,
          ProcessEnd: true,
          CreatedAt: true,
        },
      }),
    ]);

    return {
      data: data.map((item) => ({
        processId: item.ProcessId,
        functionId: item.FunctionId,
        functionName: item.FunctionName,
        processStatus: item.ProcessStatus,
        processDate: item.ProcessDate,
        processStart: item.ProcessStart,
        processEnd: item.ProcessEnd,
        createdAt: item.CreatedAt,
      })),
      meta: {
        totalItems: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /system-log/:id
   * Returns one LogProcess record with all its LogProcessDetail entries.
   */
  async findOne(processId: string): Promise<LogProcessDetailResponseDto> {
    const processResult = await this.prisma.logProcess.findUnique({
      where: { ProcessId: processId },
      include: {
        LogProcessDetails: {
          orderBy: { CreatedAt: 'asc' },
          select: {
            ProcessDetailId: true,
            ProcessId: true,
            MessageId: true,
            Message: true,
            Type: true,
            Location: true,
            ProcessDate: true,
            CreatedAt: true,
          },
        },
      },
    });

    if (!processResult) {
      throw new NotFoundException(
        `LogProcess with id "${processId}" not found`,
      );
    }

    return {
      processId: processResult.ProcessId,
      functionId: processResult.FunctionId,
      functionName: processResult.FunctionName,
      processStatus: processResult.ProcessStatus,
      processDate: processResult.ProcessDate,
      processStart: processResult.ProcessStart,
      processEnd: processResult.ProcessEnd,
      createdAt: processResult.CreatedAt,
      details: processResult.LogProcessDetails.map((detail) => ({
        id: Number(detail.ProcessDetailId),
        processId: detail.ProcessId,
        messageId: detail.MessageId,
        message: detail.Message,
        type: detail.Type,
        location: detail.Location,
        processDate: detail.ProcessDate,
        createdAt: detail.CreatedAt,
      })),
    };
  }

  /**
   * GET /system-log/inventory-ledger
   * Returns paginated list of InventoryLedger records (newest first by CreatedAt).
   */
  async findAllInventoryLedger(
    query: InventoryLedgerQueryDto,
  ): Promise<ApiResult<InventoryLedgerDto[], PaginationMeta>> {
    const { page, limit } = query;
    const offset = (page - 1) * limit;

    const where: Prisma.InventoryLedgerWhereInput = {};

    if (query.search) {
      where.OR = [
        { MaterialId: { contains: query.search, mode: 'insensitive' } },
        { FinishGoodId: { contains: query.search, mode: 'insensitive' } },
        { ReferenceDoc: { contains: query.search, mode: 'insensitive' } },
        { CreatedBy: { contains: query.search, mode: 'insensitive' } },
        { Notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      throw new BadRequestException('dateFrom must not be after dateTo');
    }

    if (query.dateFrom || query.dateTo) {
      where.TransactionDate = {};
      if (query.dateFrom) {
        where.TransactionDate.gte = moment
          .tz(query.dateFrom, 'YYYY-MM-DD', true, 'Asia/Jakarta')
          .startOf('day')
          .toDate();
      }
      if (query.dateTo) {
        where.TransactionDate.lte = moment
          .tz(query.dateTo, 'YYYY-MM-DD', true, 'Asia/Jakarta')
          .endOf('day')
          .toDate();
      }
    }

    // Filter by ItemCategory
    if (query.itemCategory) {
      where.ItemCategory = query.itemCategory;
    }

    // Filter by TransactionType
    if (query.transactionType) {
      where.TransactionType = query.transactionType;
    }

    // Filter by MaterialId (PartNumber)
    if (query.materialId) {
      where.MaterialId = query.materialId;
    }

    // Filter by FinishGoodId (PartNumber)
    if (query.finishGoodId) {
      where.FinishGoodId = query.finishGoodId;
    }

    // Filter by ReferenceDoc
    if (query.referenceDoc) {
      where.ReferenceDoc = {
        contains: query.referenceDoc,
        mode: 'insensitive',
      };
    }

    // Filter by CreatedBy
    if (query.createdBy) {
      where.CreatedBy = {
        contains: query.createdBy,
        mode: 'insensitive',
      };
    }

    const [total, data] = await Promise.all([
      this.prisma.inventoryLedger.count({ where }),
      this.prisma.inventoryLedger.findMany({
        where,
        orderBy: { TransactionDate: 'desc' },
        skip: offset,
        take: limit,
        select: {
          Id: true,
          TransactionDate: true,
          ItemCategory: true,
          MaterialId: true,
          FinishGoodId: true,
          Location: true,
          TransactionType: true,
          ReferenceDoc: true,
          BalanceBefore: true,
          QtyIn: true,
          QtyOut: true,
          BalanceAfter: true,
          CreatedBy: true,
          Notes: true,
        },
      }),
    ]);

    return {
      data: data.map((item) => ({
        id: item.Id,
        transactionDate: item.TransactionDate,
        itemCategory: item.ItemCategory,
        materialId: item.MaterialId,
        finishGoodId: item.FinishGoodId,
        location: item.Location,
        transactionType: item.TransactionType,
        referenceDoc: item.ReferenceDoc,
        balanceBefore: item.BalanceBefore,
        qtyIn: item.QtyIn,
        qtyOut: item.QtyOut,
        balanceAfter: item.BalanceAfter,
        createdBy: item.CreatedBy,
        notes: item.Notes,
      })),
      meta: {
        totalItems: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Export Inventory Ledger to Excel file
   * Supports date range filtering and other filters
   */
  async exportInventoryLedgerToExcel(
    query: InventoryLedgerExportDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    // Build where clause
    const where: Prisma.InventoryLedgerWhereInput = {};

    // Filter by TransactionDate range
    if (query.transactionDateFrom || query.transactionDateTo) {
      where.TransactionDate = {};
      if (query.transactionDateFrom) {
        where.TransactionDate.gte = new Date(query.transactionDateFrom);
      }
      if (query.transactionDateTo) {
        const endDate = new Date(query.transactionDateTo);
        endDate.setHours(23, 59, 59, 999);
        where.TransactionDate.lte = endDate;
      }
    }

    // Filter by ItemCategory
    if (query.itemCategory) {
      where.ItemCategory = query.itemCategory;
    }

    // Filter by TransactionType
    if (query.transactionType) {
      where.TransactionType = query.transactionType;
    }

    // Filter by MaterialId (PartNumber)
    if (query.materialId) {
      where.MaterialId = query.materialId;
    }

    // Filter by FinishGoodId (PartNumber)
    if (query.finishGoodId) {
      where.FinishGoodId = query.finishGoodId;
    }

    // Filter by ReferenceDoc
    if (query.referenceDoc) {
      where.ReferenceDoc = {
        contains: query.referenceDoc,
        mode: 'insensitive',
      };
    }

    // Filter by CreatedBy
    if (query.createdBy) {
      where.CreatedBy = {
        contains: query.createdBy,
        mode: 'insensitive',
      };
    }

    // Get all data (no pagination for export)
    const data = await this.prisma.inventoryLedger.findMany({
      where,
      orderBy: { TransactionDate: 'desc' },
      select: {
        Id: true,
        TransactionDate: true,
        ItemCategory: true,
        MaterialId: true,
        FinishGoodId: true,
        Location: true,
        TransactionType: true,
        ReferenceDoc: true,
        BalanceBefore: true,
        QtyIn: true,
        QtyOut: true,
        BalanceAfter: true,
        CreatedBy: true,
        Notes: true,
      },
    });

    const displayNames = await getUserDisplayNameMap(
      data.map((item) => item.CreatedBy),
      this.prisma,
    );

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ANSEI IPCS System';
    workbook.created = new Date();

    // Add worksheet
    const worksheet = workbook.addWorksheet('Inventory Ledger', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        verticalCentered: false,
        margins: {
          top: 0.5,
          bottom: 0.5,
          left: 0.5,
          right: 0.5,
          header: 0.3,
          footer: 0.3,
        },
      },
    });

    // ===== HEADER SECTION (Rows 1-3) =====
    // Company/Title Header
    worksheet.mergeCells('A1:M1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'PT ANSEI INDONESIA';
    titleCell.font = {
      name: 'Arial',
      size: 16,
      bold: true,
      color: { argb: 'FF1E3A5F' },
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EDF5' },
    };

    worksheet.mergeCells('A2:M2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = 'INVENTORY LEDGER REPORT';
    subtitleCell.font = {
      name: 'Arial',
      size: 12,
      bold: true,
      color: { argb: 'FF1E3A5F' },
    };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subtitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EDF5' },
    };

    // Info Row
    let dateRangeText = 'All Dates';
    if (query.transactionDateFrom && query.transactionDateTo) {
      dateRangeText = `${this.formatDateForDisplay(query.transactionDateFrom)} - ${this.formatDateForDisplay(query.transactionDateTo)}`;
    } else if (query.transactionDateFrom) {
      dateRangeText = `From ${this.formatDateForDisplay(query.transactionDateFrom)}`;
    } else if (query.transactionDateTo) {
      dateRangeText = `Until ${this.formatDateForDisplay(query.transactionDateTo)}`;
    }

    let filterText = `Period: ${dateRangeText}`;
    if (query.itemCategory) {
      filterText += ` | Category: ${query.itemCategory}`;
    }
    if (query.transactionType) {
      filterText += ` | Type: ${query.transactionType}`;
    }
    if (query.materialId) {
      filterText += ` | Material: ${query.materialId}`;
    }
    if (query.finishGoodId) {
      filterText += ` | Finish Good: ${query.finishGoodId}`;
    }
    if (query.referenceDoc) {
      filterText += ` | Ref: ${query.referenceDoc}`;
    }
    if (query.createdBy) {
      filterText += ` | By: ${query.createdBy}`;
    }

    worksheet.mergeCells('A3:M3');
    const infoCell = worksheet.getCell('A3');
    infoCell.value = filterText;
    infoCell.font = { name: 'Arial', size: 10, italic: true };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    infoCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };

    // Summary Row
    const totalIn = data.reduce((sum, item) => sum + item.QtyIn, 0);
    const totalOut = data.reduce((sum, item) => sum + item.QtyOut, 0);

    worksheet.mergeCells('A4:M4');
    const summaryCell = worksheet.getCell('A4');
    summaryCell.value = `Total Records: ${data.length} | Total Qty In: ${totalIn.toLocaleString()} | Total Qty Out: ${totalOut.toLocaleString()} | Generated: ${this.formatDateTimeForDisplay(new Date().toISOString())}`;
    summaryCell.font = { name: 'Arial', size: 10, bold: true };
    summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summaryCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F5E9' },
    };

    // ===== COLUMN HEADERS (Row 5) =====
    const columns = [
      { header: 'No', width: 6, align: 'center' as const },
      { header: 'Date', width: 14, align: 'center' as const },
      { header: 'Category', width: 12, align: 'center' as const },
      { header: 'Part Number', width: 16, align: 'left' as const },
      { header: 'Location', width: 14, align: 'center' as const },
      { header: 'Transaction Type', width: 20, align: 'left' as const },
      { header: 'Reference', width: 18, align: 'left' as const },
      { header: 'Balance Before', width: 14, align: 'right' as const },
      { header: 'Qty In', width: 12, align: 'right' as const },
      { header: 'Qty Out', width: 12, align: 'right' as const },
      { header: 'Balance After', width: 14, align: 'right' as const },
      { header: 'Created By', width: 12, align: 'left' as const },
      { header: 'Notes', width: 25, align: 'left' as const },
    ];

    worksheet.getRow(5).height = 22;

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const cell = worksheet.getCell(5, i + 1);
      cell.value = col.header;
      cell.font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' },
      };
      cell.alignment = {
        horizontal: col.align,
        vertical: 'middle',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      };
      worksheet.getColumn(i + 1).width = col.width;
    }

    // ===== DATA ROWS (starting row 6) =====
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const rowNum = 6 + i;

      // Alternate row background
      const isAlternate = i % 2 === 1;
      const rowBgColor = isAlternate ? 'FFF9FAFB' : 'FFFFFFFF';

      // Determine row color based on transaction type
      let transactionBgColor = rowBgColor;
      if (item.QtyIn > 0) {
        transactionBgColor = 'FFD1FAE5'; // Light green for incoming
      } else if (item.QtyOut > 0) {
        transactionBgColor = 'FFFEE2E2'; // Light red for outgoing
      }

      worksheet.getRow(rowNum).height = 16;

      // No
      const noCell = worksheet.getCell(rowNum, 1);
      noCell.value = i + 1;
      noCell.font = { name: 'Arial', size: 9 };
      noCell.alignment = { horizontal: 'center', vertical: 'middle' };
      noCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor },
      };
      noCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      // Date
      const dateCell = worksheet.getCell(rowNum, 2);
      dateCell.value = this.formatDateForDisplay(
        item.TransactionDate.toISOString(),
      );
      dateCell.font = { name: 'Arial', size: 9 };
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      dateCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor },
      };
      dateCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      // Category
      const catCell = worksheet.getCell(rowNum, 3);
      catCell.value =
        item.ItemCategory === 'MATERIAL' ? 'Material' : 'Finish Good';
      catCell.font = {
        name: 'Arial',
        size: 9,
        bold: true,
        color:
          item.ItemCategory === 'MATERIAL'
            ? { argb: 'FF059669' }
            : { argb: 'FF7C3AED' },
      };
      catCell.alignment = { horizontal: 'center', vertical: 'middle' };
      catCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor },
      };
      catCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      // Part Number (Material or Finish Good)
      const partCell = worksheet.getCell(rowNum, 4);
      const partNumber =
        item.ItemCategory === 'MATERIAL' ? item.MaterialId : item.FinishGoodId;
      partCell.value = partNumber || '-';
      partCell.font = { name: 'Courier New', size: 9, bold: true };
      partCell.alignment = { horizontal: 'left', vertical: 'middle' };
      partCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F4FF' },
      };
      partCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      // Location
      const locCell = worksheet.getCell(rowNum, 5);
      locCell.value = this.formatLocation(item.Location);
      locCell.font = { name: 'Arial', size: 9, bold: true };
      locCell.alignment = { horizontal: 'center', vertical: 'middle' };
      locCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor },
      };
      locCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      // Transaction Type
      const typeCell = worksheet.getCell(rowNum, 6);
      typeCell.value = this.formatTransactionType(item.TransactionType);
      typeCell.font = { name: 'Arial', size: 9 };
      typeCell.alignment = { horizontal: 'left', vertical: 'middle' };
      typeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: transactionBgColor },
      };
      typeCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      // Reference
      const refCell = worksheet.getCell(rowNum, 7);
      refCell.value = item.ReferenceDoc || '-';
      refCell.font = { name: 'Arial', size: 9 };
      refCell.alignment = { horizontal: 'left', vertical: 'middle' };
      refCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor },
      };
      refCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      // Balance Before
      const balBeforeCell = worksheet.getCell(rowNum, 8);
      balBeforeCell.value = item.BalanceBefore;
      balBeforeCell.font = { name: 'Arial', size: 9 };
      balBeforeCell.alignment = { horizontal: 'right', vertical: 'middle' };
      balBeforeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor },
      };
      balBeforeCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      // Qty In
      const qtyInCell = worksheet.getCell(rowNum, 9);
      qtyInCell.value = item.QtyIn > 0 ? item.QtyIn : '';
      qtyInCell.font = {
        name: 'Arial',
        size: 9,
        bold: item.QtyIn > 0,
        color: item.QtyIn > 0 ? { argb: 'FF059669' } : { argb: 'FF9CA3AF' },
      };
      qtyInCell.alignment = { horizontal: 'right', vertical: 'middle' };
      qtyInCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: item.QtyIn > 0 ? { argb: 'FFD1FAE5' } : { argb: rowBgColor },
      };
      qtyInCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      // Qty Out
      const qtyOutCell = worksheet.getCell(rowNum, 10);
      qtyOutCell.value = item.QtyOut > 0 ? item.QtyOut : '';
      qtyOutCell.font = {
        name: 'Arial',
        size: 9,
        bold: item.QtyOut > 0,
        color: item.QtyOut > 0 ? { argb: 'FFDC2626' } : { argb: 'FF9CA3AF' },
      };
      qtyOutCell.alignment = { horizontal: 'right', vertical: 'middle' };
      qtyOutCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: item.QtyOut > 0 ? { argb: 'FFFEE2E2' } : { argb: rowBgColor },
      };
      qtyOutCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      // Balance After
      const balAfterCell = worksheet.getCell(rowNum, 11);
      balAfterCell.value = item.BalanceAfter;
      balAfterCell.font = { name: 'Arial', size: 9, bold: true };
      balAfterCell.alignment = { horizontal: 'right', vertical: 'middle' };
      balAfterCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor },
      };
      balAfterCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      // Created By
      const createdByCell = worksheet.getCell(rowNum, 12);
      createdByCell.value = getUserDisplayName(item.CreatedBy, displayNames);
      createdByCell.font = { name: 'Arial', size: 9 };
      createdByCell.alignment = { horizontal: 'left', vertical: 'middle' };
      createdByCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor },
      };
      createdByCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      // Notes
      const notesCell = worksheet.getCell(rowNum, 13);
      notesCell.value = item.Notes || '';
      notesCell.font = { name: 'Arial', size: 9, italic: true };
      notesCell.alignment = { horizontal: 'left', vertical: 'middle' };
      notesCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor },
      };
      notesCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };
    }

    // ===== FOOTER =====
    const lastDataRow = 6 + data.length;
    const footerRow = lastDataRow + 1;
    worksheet.mergeCells(`A${footerRow}:M${footerRow}`);
    const footerCell = worksheet.getCell(`A${footerRow}`);
    footerCell.value = `Generated by ANSEI IPCS System on ${this.formatDateTimeForDisplay(
      new Date().toISOString(),
    )}`;
    footerCell.font = {
      name: 'Arial',
      size: 8,
      italic: true,
      color: { argb: 'FF9CA3AF' },
    };
    footerCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Generate filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .slice(0, 15);
    const filename = `InventoryLedger_Export_${timestamp}.xlsx`;

    return {
      buffer: Buffer.from(buffer),
      filename,
    };
  }

  /**
   * Format date for display (e.g., "16 July 2026")
   */
  private formatDateForDisplay(dateStr: string): string {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    };
    return date.toLocaleDateString('id-ID', options);
  }

  /**
   * Format datetime for display (e.g., "16 July 2026, 08:30")
   */
  private formatDateTimeForDisplay(dateStr: string): string {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    return date.toLocaleDateString('id-ID', options);
  }

  /**
   * Format location enum to readable string
   */
  private formatLocation(location: string): string {
    const locationMap: Record<string, string> = {
      WAREHOUSE: 'Warehouse',
      RACK: 'Rack',
      FINISH_GOOD_AREA: 'FG Area',
    };
    return locationMap[location] || location;
  }

  /**
   * Format transaction type enum to readable string
   */
  private formatTransactionType(type: string): string {
    const typeMap: Record<string, string> = {
      INCOMING_SUPPLIER: 'Incoming Supplier',
      TRANSFER_TO_RACK: 'Transfer to Rack',
      PRODUCTION_USAGE: 'Production Usage',
      PRODUCTION_RESULT: 'Production Result',
      DELIVERY_TO_CUSTOMER: 'Delivery to Customer',
      NG_SCRAP: 'NG / Scrap',
      ADJUSTMENT_MANUAL: 'Manual Adjustment',
      STOCK_OPNAME_DIFF: 'Stock Opname Diff',
      MATERIAL_OUT_DELIVERY: 'Material Out Delivery',
    };
    return typeMap[type] || type;
  }
}
