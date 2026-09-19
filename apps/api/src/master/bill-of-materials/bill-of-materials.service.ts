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

@Injectable()
export class BillOfMaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

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
