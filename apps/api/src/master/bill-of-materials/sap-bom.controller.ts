/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '../../auth/decorators/permission.decorator';
import { ApiSuccessEnvelope } from '../../common/interceptors/api-response.swagger';
import { SapBomPreviewService } from './sap-bom-preview.service';
import { SapBomPreviewDto } from './dto/sap-bom-preview.dto';

@ApiTags('BillOfMaterials')
@Controller('master/bill-of-materials')
export class SapBomController {
  constructor(private readonly service: SapBomPreviewService) {}

  @Get('sap/:finishGoodId')
  @Permission('IPCS.BOM_REVISION_READ')
  @ApiOperation({
    summary: 'Read cached SAP BOM using the finish good SAP part number',
  })
  @ApiSuccessEnvelope({ status: 200, type: SapBomPreviewDto })
  get(@Param('finishGoodId', ParseIntPipe) finishGoodId: number) {
    return this.service.get(finishGoodId);
  }
}
