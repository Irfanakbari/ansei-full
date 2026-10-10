/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SapBomService } from '../../common/sap/sap-bom.service';
import { SapBomPreviewDto } from './dto/sap-bom-preview.dto';

@Injectable()
export class SapBomPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapBomService,
  ) {}

  async get(finishGoodId: number): Promise<SapBomPreviewDto> {
    const fg = await this.prisma.finishGood.findUnique({
      where: { Id: finishGoodId },
      select: { Id: true, PartNumber: true, PartNumberSAP: true },
    });
    if (!fg) throw new NotFoundException('Finish good not found');
    const sapPartNumber = fg.PartNumberSAP?.trim() || null;
    const result = sapPartNumber
      ? await this.sap.get(sapPartNumber)
      : {
          status: 'UNMAPPED' as const,
          bom: null,
          checkedAt: null,
          stale: false,
        };
    return {
      finishGoodId: fg.Id,
      partNumber: fg.PartNumber,
      sapPartNumber,
      ...result,
    };
  }
}
