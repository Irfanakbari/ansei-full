import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ProductionReportService } from './production-report.service';
import {
  CreateProductionReportDto,
  UpdateProductionReportDto,
  ProductionReportQueryDto,
} from './dto';
import {
  PaginatedProductionReportDto,
  ProductionReportEntity,
} from './entities/production-report.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('Production Report')
@Controller('production/production-report')
export class ProductionReportController {
  constructor(
    private readonly productionReportService: ProductionReportService,
  ) {}

  @Get()
  @Permission('IPCS.PRODUCTION_REPORT_READ')
  @ApiOperation({
    summary: 'Get all production reports (paginated)',
  })
  @ApiResponse({ status: 200, type: PaginatedProductionReportDto })
  async findAll(@Query() query: ProductionReportQueryDto) {
    return this.productionReportService.findAll(query);
  }

  @Get('operator-history/:nik')
  @Public()
  @ApiOperation({
    summary:
      'Get production report history by operator NIK (Public - for Operator Station)',
  })
  async getOperatorHistory(
    @Param('nik') nik: string,
    @Query('date') date?: string,
    @Query('limit') limit?: number,
  ) {
    return this.productionReportService.findByOperatorNik(
      nik,
      date,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('active-forecasts')
  @Public()
  @ApiOperation({
    summary:
      'Get active forecasts with Pokayoke Scan History (Public - for Operator Station)',
  })
  async getActiveForecasts(@Query('finishGoodId') finishGoodId?: string) {
    return this.productionReportService.getActiveForecasts(finishGoodId);
  }

  @Get(':id')
  @Permission('IPCS.PRODUCTION_REPORT_READ')
  @ApiOperation({
    summary: 'Get one production report by ID',
  })
  @ApiResponse({ status: 200, type: ProductionReportEntity })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productionReportService.findOne(id);
  }

  @Post()
  @Public()
  @ApiOperation({
    summary:
      'Create new production report with POKAYOKE validation (Public - for Operator Station)',
  })
  @ApiResponse({ status: 201, type: ProductionReportEntity })
  async create(@Body() createDto: CreateProductionReportDto) {
    // Use 'OPERATOR' as createdBy for public endpoint
    return this.productionReportService.create(createDto, 'OPERATOR');
  }

  @Patch(':id')
  @Permission('IPCS.PRODUCTION_REPORT_UPDATE')
  @ApiOperation({
    summary: 'Update production report (cannot update validated reports)',
  })
  @ApiResponse({ status: 200, type: ProductionReportEntity })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateProductionReportDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReportService.update(id, updateDto, user.username);
  }

  @Delete(':id')
  @Permission('IPCS.PRODUCTION_REPORT_DELETE')
  @ApiOperation({
    summary: 'Delete production report (cannot delete validated reports)',
  })
  @ApiResponse({ status: 200 })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReportService.remove(id, user.username);
  }

  @Post(':id/validate')
  @Permission('IPCS.PRODUCTION_REPORT_UPDATE')
  @ApiOperation({
    summary: 'Validate production report',
  })
  @ApiResponse({ status: 200, type: ProductionReportEntity })
  async validate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReportService.validateReport(id, user.username);
  }

  @Post(':id/unvalidate')
  @Permission('IPCS.PRODUCTION_REPORT_UPDATE')
  @ApiOperation({
    summary: 'Unvalidate production report (allow editing again)',
  })
  @ApiResponse({ status: 200, type: ProductionReportEntity })
  async unvalidate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReportService.unvalidateReport(id, user.username);
  }
}
