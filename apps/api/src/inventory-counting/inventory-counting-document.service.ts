import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Workbook } from 'exceljs';
import archiver = require('archiver');
import { PassThrough } from 'node:stream';
import dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { NasUploadService } from '../common/utils/nas-upload.service';
import { excelToPdf } from '../common/utils/document-converter.util';
import {
  LocationType,
  ItemCategory,
  OpnameStatus,
} from '../generated/prisma/enums';
import type { StockOpnameAttachmentModel } from '../generated/prisma/models';

interface PackageFile {
  name: string;
  content: Buffer;
}

@Injectable()
export class InventoryCountingDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nas: NasUploadService,
  ) {}

  async buildAndPersist(
    opnameId: string,
    actor: string,
    snapshot: Buffer,
  ): Promise<StockOpnameAttachmentModel> {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { Id: opnameId },
      include: {
        Details: {
          orderBy: [{ Location: 'asc' }, { MaterialId: 'asc' }],
          include: {
            MaterialData: { select: { PartName: true, RackLocation: true } },
          },
        },
      },
    });
    if (!opname) throw new NotFoundException('Inventory counting not found');
    this.assertPackageEligible(
      opname.Category,
      opname.Status,
      opname.StartedAt,
    );

    const safeNumber = opname.RecordNumber.replace(/[^a-zA-Z0-9._-]/g, '_');
    const worksheet = await this.worksheet(opname);
    const labels = await this.labels(opname);
    const files: PackageFile[] = [
      { name: `Worksheet_${safeNumber}.xlsx`, content: worksheet },
      {
        name: `Worksheet_${safeNumber}.pdf`,
        content: await excelToPdf(worksheet),
      },
      { name: `Stock_Snapshot_${safeNumber}.xlsx`, content: snapshot },
      {
        name: `Stock_Snapshot_${safeNumber}.pdf`,
        content: await excelToPdf(snapshot),
      },
      { name: `STO_Labels_${safeNumber}.xlsx`, content: labels },
      {
        name: `STO_Labels_${safeNumber}.pdf`,
        content: await excelToPdf(labels),
      },
    ];
    const zip = await this.zip(files);
    const fileName = `Inventory_Counting_${safeNumber}_${Date.now()}.zip`;
    const filePath = await this.nas.uploadFile({
      fileName,
      fileBuffer: zip,
      subFolder: `inventory-counting/${opname.Id}/packages`,
    });
    try {
      return await this.prisma.stockOpnameAttachment.create({
        data: {
          OpnameId: opname.Id,
          FileName: fileName,
          OriginalFileName: fileName,
          FilePath: filePath,
          FileSize: zip.length,
          MimeType: 'application/zip',
          CreatedBy: actor,
        },
      });
    } catch (error: unknown) {
      try {
        await this.nas.deleteFile(filePath);
      } catch {
        throw new Error(
          'Artifact metadata persistence failed and uploaded file cleanup could not be confirmed.',
          { cause: error },
        );
      }
      throw error;
    }
  }

  async download(opnameId: string) {
    const counting = await this.prisma.stockOpname.findUnique({
      where: { Id: opnameId },
      select: { Category: true, Status: true, StartedAt: true },
    });
    if (!counting) throw new NotFoundException('Inventory counting not found');
    this.assertPackageEligible(
      counting.Category,
      counting.Status,
      counting.StartedAt,
    );
    const artifact = await this.prisma.stockOpnameAttachment.findFirst({
      where: { OpnameId: opnameId, MimeType: 'application/zip' },
      orderBy: { CreatedAt: 'desc' },
    });
    if (!artifact)
      throw new NotFoundException('Inventory counting package is not ready');
    return {
      artifact,
      response: await this.nas.downloadFile(artifact.FilePath),
    };
  }

  private async worksheet(opname: {
    RecordNumber: string;
    StartedAt: Date | null;
    Details: Array<{
      Location: LocationType;
      MaterialId: string | null;
      MaterialData: { PartName: string; RackLocation: string | null } | null;
    }>;
  }) {
    const workbook = new Workbook();
    for (const location of [LocationType.WAREHOUSE, LocationType.RACK]) {
      const sheet = workbook.addWorksheet(location);
      sheet.pageSetup = {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      };
      sheet.addRow([
        'STOCK OPNAME WORKSHEET',
        opname.RecordNumber,
        dayjs(opname.StartedAt).format('DD-MM-YYYY'),
      ]);
      sheet.addRow([]);
      sheet.addRow([
        'No',
        'Part Number',
        'Part Name',
        'Location',
        'Qty 1',
        'Qty 2',
        'Validasi',
      ]);
      opname.Details.filter((item) => item.Location === location).forEach(
        (item, index) => {
          sheet.addRow([
            index + 1,
            item.MaterialId,
            item.MaterialData?.PartName ?? '',
            location === LocationType.RACK
              ? (item.MaterialData?.RackLocation ?? 'RACK')
              : 'WAREHOUSE',
            '',
            '',
            '',
          ]);
        },
      );
      this.styleTable(sheet, 3, 7);
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private async labels(opname: {
    RecordNumber: string;
    StartedAt: Date | null;
    Details: Array<{
      Location: LocationType;
      MaterialId: string | null;
      MaterialData: { PartName: string; RackLocation: string | null } | null;
    }>;
  }) {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('STO Labels');
    sheet.pageSetup = {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.25,
        bottom: 0.25,
        header: 0,
        footer: 0,
      },
    };
    sheet.columns = Array.from({ length: 6 }, () => ({ width: 14 }));
    opname.Details.forEach((item, index) => {
      const labelRow = Math.floor(index / 2) * 12 + 1;
      const startCol = index % 2 === 0 ? 1 : 4;
      const endCol = startCol + 2;
      const location =
        item.Location === LocationType.RACK
          ? (item.MaterialData?.RackLocation ?? 'RACK')
          : 'WAREHOUSE';
      const values = [
        'AREA UNDER STO',
        `Opname: ${opname.RecordNumber}`,
        `Part: ${item.MaterialId ?? ''}`,
        `Name: ${item.MaterialData?.PartName ?? ''}`,
        `Location: ${location}`,
        `Date: ${dayjs(opname.StartedAt).format('DD-MM-YYYY')}`,
      ];
      values.forEach((value, line) => {
        const row = labelRow + line * 2;
        sheet.mergeCells(row, startCol, row + 1, endCol);
        const cell = sheet.getCell(row, startCol);
        cell.value = value;
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true,
        };
        cell.font = {
          bold: line === 0 || line === 2,
          size: line === 0 ? 16 : 10,
        };
        for (let r = row; r <= row + 1; r++)
          for (let c = startCol; c <= endCol; c++)
            sheet.getCell(r, c).border = {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' },
            };
      });
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private styleTable(
    sheet: import('exceljs').Worksheet,
    headerRow: number,
    columns: number,
  ) {
    sheet.views = [{ showGridLines: false }];
    sheet.getRow(1).font = { bold: true, size: 14 };
    const header = sheet.getRow(headerRow);
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9EAD3' },
      };
    });
    for (let row = headerRow; row <= sheet.rowCount; row++)
      for (let col = 1; col <= columns; col++)
        sheet.getCell(row, col).border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
    sheet.columns.forEach((column, index) => {
      column.width = index === 2 ? 32 : index === 1 ? 20 : 15;
    });
  }

  private assertPackageEligible(
    category: ItemCategory,
    status: OpnameStatus,
    startedAt: Date | null,
  ): void {
    if (category !== ItemCategory.MATERIAL) {
      throw new BadRequestException(
        'Document package is only available for MATERIAL inventory counting.',
      );
    }
    if (status !== OpnameStatus.IN_PROGRESS || !startedAt) {
      throw new BadRequestException(
        'Document package requires a started MATERIAL inventory counting in IN_PROGRESS status.',
      );
    }
  }

  private zip(files: PackageFile[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const output = new PassThrough();
      const chunks: Buffer[] = [];
      output.on('data', (chunk: Buffer) => chunks.push(chunk));
      output.on('end', () => resolve(Buffer.concat(chunks)));
      output.on('error', reject);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', reject);
      archive.pipe(output);
      files.forEach((file) =>
        archive.append(file.content, { name: file.name }),
      );
      void archive.finalize();
    });
  }
}
