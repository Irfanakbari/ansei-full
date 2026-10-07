/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiConsumes,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { ForecastNonPoService } from './forecast-non-po.service';
import {
  CreateNonPoDto,
  UpdateNonPoDto,
  NonPoQueryDto,
  ImportNonPoDto,
} from './forecast-non-po.dto';

const excelUpload = FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2 },
});
@ApiTags('Forecast Non PO')
@ApiBearerAuth()
@Controller('production/forecast-non-po')
export class ForecastNonPoController {
  constructor(private readonly service: ForecastNonPoService) {}
  @Get()
  @Permission('IPCS.FORECAST_READ')
  findAll(@Query() query: NonPoQueryDto) {
    return this.service.findAll(query);
  }
  @Get('template')
  @Permission('IPCS.FORECAST_READ')
  async template() {
    return new StreamableFile(await this.service.template(), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="forecast-non-po.xlsx"',
    });
  }
  @Post('import/preview')
  @Permission('IPCS.FORECAST_CREATE')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(excelUpload)
  preview(@UploadedFile() file: Express.Multer.File) {
    return this.service.preview(file);
  }
  @Post('import')
  @Permission('IPCS.FORECAST_CREATE')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(excelUpload)
  importFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportNonPoDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.importFile(file, dto, user.username);
  }
  @Get(':id')
  @Permission('IPCS.FORECAST_READ')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  @Post()
  @Permission('IPCS.FORECAST_CREATE')
  create(@Body() dto: CreateNonPoDto, @CurrentUser() user: ICurrentUser) {
    return this.service.create(dto, user.username);
  }
  @Patch(':id')
  @Permission('IPCS.FORECAST_UPDATE')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNonPoDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.update(id, dto, user.username);
  }
  @Delete(':id')
  @Permission('IPCS.FORECAST_DELETE')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.remove(id, user.username);
  }
  @Post(':id/print-tag')
  @Permission('IPCS.FORECAST_UPDATE')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  print(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.print(id, user.username);
  }
  @Get(':id/download-tag')
  @Permission('IPCS.FORECAST_READ')
  async download(@Param('id', ParseIntPipe) id: number) {
    return new StreamableFile(await this.service.download(id), {
      type: 'application/pdf',
      disposition: `attachment; filename="non-po-${id}.pdf"`,
    });
  }
}
