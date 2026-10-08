import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { CreateBillOfMaterialsDto, UpdateBillOfMaterialsDto } from './dto';
import type { BillOfMaterialsModel } from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';
import type {
  ApiResult,
  PaginationMeta,
} from '../../common/interceptors/api-response.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';

import * as ExcelJS from 'exceljs';

@Injectable()
export class BillOfMaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async exportExcel(query: SearchPaginationQueryDto): Promise<Buffer> {
    const where: Prisma.BillOfMaterialsWhereInput = query.search
      ? {
          OR: [
            {
              FGData: {
                PartNumber: { contains: query.search, mode: 'insensitive' },
              },
            },
            {
              MaterialData: {
                PartNumber: { contains: query.search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {};

    const data = await this.prisma.billOfMaterials.findMany({
      where,
      orderBy: [
        { FGData: { PartNumber: 'asc' } },
        { MaterialData: { PartNumber: 'asc' } },
      ],
      include: {
        FGData: true,
        MaterialData: {
          include: {
            SatuanData: true,
          },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ANSEI System';
    const worksheet = workbook.addWorksheet('Bill of Materials', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    worksheet.columns = [
      { header: 'Lvl 1', key: 'level1', width: 6 },
      { header: 'Lvl 2', key: 'level2', width: 6 },
      { header: 'FG Part Number', key: 'parentFg', width: 25 },
      { header: 'FG Part Name', key: 'fgName', width: 35 },
      { header: 'Component Part Number', key: 'childMaterial', width: 25 },
      { header: 'Component Part Name', key: 'materialName', width: 35 },
      { header: 'Usage / Qty', key: 'qty', width: 15 },
      { header: 'UOM', key: 'unit', width: 10 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let currentFgId: number | null = null;
    let level2Counter = 1;

    data.forEach((item) => {
      const isNewFg = currentFgId !== item.FinishGoodId;

      if (isNewFg) {
        currentFgId = item.FinishGoodId;
        level2Counter = 1;
        const parentRow = worksheet.addRow({
          level1: 1,
          level2: '',
          parentFg: item.FGData?.PartNumber || '-',
          fgName: item.FGData?.PartName || '-',
          childMaterial: '',
          materialName: '',
          qty: '',
          unit: '',
        });
        parentRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        };
        parentRow.font = { bold: true };
      }

      worksheet.addRow({
        level1: '',
        level2: level2Counter++,
        parentFg: item.FGData?.PartNumber || '-',
        fgName: item.FGData?.PartName || '-',
        childMaterial: item.MaterialData?.PartNumber || '-',
        materialName: item.MaterialData?.PartName || '-',
        qty: item.Qty,
        unit: item.MaterialData?.SatuanData?.Name || '-',
      });
    });

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        if (rowNumber > 1) {
          cell.alignment = { vertical: 'middle' };
          if (colNumber === 1 || colNumber === 2 || colNumber === 7) {
            cell.alignment.horizontal = 'center';
          }
        }
      });
    });

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async findAll(
    query: SearchPaginationQueryDto,
  ): Promise<ApiResult<BillOfMaterialsModel[], PaginationMeta>> {
    const where: Prisma.BillOfMaterialsWhereInput = query.search
      ? {
          OR: [
            {
              FGData: {
                PartNumber: { contains: query.search, mode: 'insensitive' },
              },
            },
            {
              FGData: {
                PartName: { contains: query.search, mode: 'insensitive' },
              },
            },
            {
              MaterialData: {
                PartNumber: { contains: query.search, mode: 'insensitive' },
              },
            },
            {
              MaterialData: {
                PartName: { contains: query.search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {};
    where.FGData = { ActiveBomRevisionId: { not: null } };
    const [totalItems, data] = await Promise.all([
      this.prisma.billOfMaterials.count({ where }),
      this.prisma.billOfMaterials.findMany({
        where,
        include: {
          FGData: true,
          MaterialData: true,
        },
        orderBy: [{ Id: 'asc' }],
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

  async findByFinishGoodId(
    finishGoodId: number,
  ): Promise<BillOfMaterialsModel[]> {
    const results = await this.prisma.billOfMaterials.findMany({
      where: {
        FinishGoodId: finishGoodId,
        FGData: { ActiveBomRevisionId: { not: null } },
      },
      include: {
        FGData: true,
        MaterialData: true,
      },
      orderBy: { Id: 'asc' },
    });

    return results;
  }

  async findByMaterialId(materialId: number): Promise<BillOfMaterialsModel[]> {
    const results = await this.prisma.billOfMaterials.findMany({
      where: {
        MaterialId: materialId,
        FGData: { ActiveBomRevisionId: { not: null } },
      },
      include: {
        FGData: true,
        MaterialData: true,
      },
      orderBy: { Id: 'asc' },
    });

    return results;
  }

  create(
    dto: CreateBillOfMaterialsDto,
    createdBy: string,
  ): Promise<BillOfMaterialsModel> {
    throw new ConflictException({
      code: 'BOM_REVISION_REQUIRED',
      message:
        'Direct BOM mutation is retired. Use /v1/master/bom-revisions and the approval workflow.',
    });
  }

  update(
    id: number,
    dto: UpdateBillOfMaterialsDto,
    createdBy: string,
  ): Promise<BillOfMaterialsModel> {
    throw new ConflictException({
      code: 'BOM_REVISION_REQUIRED',
      message:
        'Direct BOM mutation is retired. Use /v1/master/bom-revisions and the approval workflow.',
    });
  }

  remove(
    _id: number,
    _createdBy: string,
  ): Promise<{ deleted: boolean; id: number }> {
    throw new ConflictException({
      code: 'BOM_REVISION_REQUIRED',
      message:
        'Direct BOM mutation is retired. Use /v1/master/bom-revisions and the approval workflow.',
    });
  }
}
