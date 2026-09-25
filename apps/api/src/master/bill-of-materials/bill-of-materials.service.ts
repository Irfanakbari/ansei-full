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
      orderBy: { Id: 'asc' },
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
    const worksheet = workbook.addWorksheet('Bill of Materials');

    worksheet.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Parent FG', key: 'parentFg', width: 25 },
      { header: 'FG Name', key: 'fgName', width: 35 },
      { header: 'Child Material', key: 'childMaterial', width: 25 },
      { header: 'Material Name', key: 'materialName', width: 35 },
      { header: 'Qty', key: 'qty', width: 15 },
      { header: 'Unit', key: 'unit', width: 10 },
    ];

    // Header styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF004B87' },
    };
    worksheet.getRow(1).alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    data.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1,
        parentFg: item.FGData?.PartNumber || '-',
        fgName: item.FGData?.PartName || '-',
        childMaterial: item.MaterialData?.PartNumber || '-',
        materialName: item.MaterialData?.PartName || '-',
        qty: item.Qty,
        unit: item.MaterialData?.SatuanData?.Name || '-',
      });
    });

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        if (rowNumber > 1) {
          cell.alignment = { vertical: 'middle' };
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
