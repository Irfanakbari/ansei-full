import {
  ApiHeader,
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ForecastService } from './forecast.service';
import { CreateForecastDto, ForecastQueryDto, UpdateForecastDto } from './dto';
import {
  ForecastEntity,
  ForecastOperatorEntity,
} from './entities/forecast.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('Forecast')
@Controller('production/forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @ApiOperation({ summary: 'Get all forecasts' })
  @ApiResponse({
    status: 200,
    type: [ForecastEntity],
    description: 'List of forecasts',
  })
  @Get()
  @Permission('IPCS.FORECAST_READ')
  async findAll(
    @Query() query: ForecastQueryDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.forecastService.findAll(query);
  }

  @ApiOperation({
    summary:
      'Get forecasts for operator dashboard (next 14 days, RELEASED status)',
  })
  @ApiResponse({
    status: 200,
    type: [ForecastOperatorEntity],
    description: 'List of forecasts for operator',
  })
  @Get('operator')
  @Permission('IPCS.FORECAST_READ')
  async findForOperator(@CurrentUser() user: ICurrentUser) {
    return this.forecastService.findForOperator();
  }

  @ApiOperation({ summary: 'Get forecast by numeric ID or PoId' })
  @ApiResponse({
    status: 200,
    type: ForecastEntity,
    description: 'Forecast details',
  })
  @ApiResponse({ status: 404, description: 'Forecast not found' })
  @Get(':id')
  @Permission('IPCS.FORECAST_READ')
  async findOne(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.forecastService.findOne(id);
  }

  @ApiOperation({ summary: 'Create new forecast record' })
  @ApiResponse({
    status: 201,
    type: ForecastEntity,
    description: 'Forecast created successfully',
  })
  @Post()
  @Permission('IPCS.FORECAST_CREATE')
  async create(
    @Body() createForecastDto: CreateForecastDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.forecastService.create(createForecastDto, user.username);
  }

  /**
   * Import forecast data from Excel file.
   * Reads columns by position (A=0, B=1, C=2, etc.)
   */
  @ApiOperation({ summary: 'Import forecast records from Excel file' })
  @ApiResponse({
    status: 201,
    description: 'Excel import result',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 100 },
        created: { type: 'number', example: 80 },
        skipped: { type: 'number', example: 20 },
      },
    },
  })
  @Post('import')
  @Permission('IPCS.FORECAST_CREATE')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  )
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: ICurrentUser,
  ) {
    if (!file) {
      throw new Error('File is required');
    }
    return this.forecastService.importExcel(file, user.username);
  }

  @ApiOperation({ summary: 'Update forecast record' })
  @ApiResponse({
    status: 200,
    type: ForecastEntity,
    description: 'Forecast updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Forecast not found' })
  @Patch(':id')
  @Permission('IPCS.FORECAST_UPDATE')
  async update(
    @Param('id') id: string,
    @Body() updateForecastDto: UpdateForecastDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.forecastService.update(id, updateForecastDto, user.username);
  }

  @ApiOperation({ summary: 'Delete forecast record' })
  @ApiResponse({
    status: 200,
    description: 'Forecast deleted successfully',
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean', example: true },
        id: { type: 'number', example: 1 },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Forecast not found' })
  @Delete(':id')
  @Permission('IPCS.FORECAST_DELETE')
  async remove(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.forecastService.remove(id, user.username);
  }

  @ApiOperation({ summary: 'Print forecast part tag manually' })
  @ApiResponse({
    status: 200,
    description:
      'Durable print request accepted; integrationId identifies its delivery status',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        integrationId: { type: 'string' },
        poId: { type: 'string' },
        qtyOrder: { type: 'number' },
        partNumber: { type: 'string' },
        partName: { type: 'string' },
        vendorCode: { type: 'string' },
        classificationCode: { type: 'string' },
        deliveryDate: { type: 'string' },
        qtyPerbox: { type: 'number' },
        poNumber: { type: 'string' },
        receivingArea: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Forecast not found' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @Post(':id/print-tag')
  @Permission('IPCS.FORECAST_UPDATE')
  async printTag(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.forecastService.printTag(id, user.username);
  }

  @ApiOperation({ summary: 'Download forecast part tag PDF' })
  @ApiResponse({
    status: 200,
    description: 'Part tag PDF',
    content: { 'application/pdf': {} },
  })
  @ApiResponse({ status: 400, description: 'Forecast has no label data' })
  @ApiResponse({ status: 404, description: 'Forecast not found' })
  @Get(':id/download-tag')
  @Permission('IPCS.FORECAST_READ')
  async downloadTag(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const pdf = await this.forecastService.downloadTag(id);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="forecast-label-${encodeURIComponent(id)}.pdf"`,
    );
    return pdf;
  }
}
