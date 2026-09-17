import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { InventoryCountingService } from './inventory-counting.service';
import {
  CreateInventoryCountingDto,
  UpdateInventoryCountingDto,
  UpdateActualStockDto,
  CloseInventoryCountingDto,
  GenerateCutOffDto,
  InventoryCountingQueryDto,
  GenerateExcelDto,
} from './dto';
import {
  InventoryCountingEntity,
  InventoryCountingDetailEntity,
  InventoryCountingResponseEntity,
  InventoryCountingRemoveResponseEntity,
  GenerateCutOffResponseEntity,
  PaginatedInventoryCountingEntity,
} from './entities';
import { Permission } from '../auth/decorators/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../auth/interfaces/current-user.interface';

@ApiTags('Inventory Counting')
@Controller(['inventory-counting', 'warehouse/inventory-counting'])
export class InventoryCountingController {
  constructor(
    private readonly inventoryCountingService: InventoryCountingService,
  ) {}

  @Post()
  @Permission('IPCS.INVENTORY_COUNTING_CREATE')
  @ApiOperation({ summary: 'Create new inventory counting session' })
  @ApiResponse({ status: 201, type: InventoryCountingResponseEntity })
  async create(
    @Body() dto: CreateInventoryCountingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.inventoryCountingService.create(dto, user.username);
  }

  @Get()
  @Permission('IPCS.INVENTORY_COUNTING_READ')
  @ApiOperation({ summary: 'Get all inventory counting sessions (paginated)' })
  @ApiResponse({ status: 200, type: PaginatedInventoryCountingEntity })
  async findAll(@Query() query: InventoryCountingQueryDto) {
    return this.inventoryCountingService.findAll(query);
  }

  @Get(':id')
  @Permission('IPCS.INVENTORY_COUNTING_READ')
  @ApiOperation({ summary: 'Get inventory counting by ID' })
  @ApiParam({ name: 'id', description: 'StockOpname ID' })
  @ApiResponse({ status: 200, type: InventoryCountingEntity })
  async findOne(@Param('id') id: string) {
    return this.inventoryCountingService.findOne(id);
  }

  @Get(':id/details')
  @Permission('IPCS.INVENTORY_COUNTING_READ')
  @ApiOperation({
    summary: 'Get all details for an inventory counting session',
  })
  @ApiParam({ name: 'id', description: 'StockOpname ID' })
  @ApiResponse({ status: 200, type: [InventoryCountingDetailEntity] })
  async getDetails(@Param('id') id: string) {
    return this.inventoryCountingService.getDetails(id);
  }

  @Patch(':id')
  @Permission('IPCS.INVENTORY_COUNTING_UPDATE')
  @ApiOperation({ summary: 'Update inventory counting notes' })
  @ApiParam({ name: 'id', description: 'StockOpname ID' })
  @ApiResponse({ status: 200, type: InventoryCountingResponseEntity })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryCountingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.inventoryCountingService.update(id, dto, user.username);
  }

  @Delete(':id')
  @Permission('IPCS.INVENTORY_COUNTING_DELETE')
  @ApiOperation({ summary: 'Delete inventory counting (DRAFT only)' })
  @ApiParam({ name: 'id', description: 'StockOpname ID' })
  @ApiResponse({ status: 200, type: InventoryCountingRemoveResponseEntity })
  async remove(@Param('id') id: string) {
    return this.inventoryCountingService.remove(id);
  }

  @Post(':id/start')
  @Permission('IPCS.INVENTORY_COUNTING_UPDATE')
  @ApiOperation({
    summary: 'Start inventory counting (change status to IN_PROGRESS)',
  })
  @ApiParam({ name: 'id', description: 'StockOpname ID' })
  @ApiResponse({ status: 200, type: InventoryCountingResponseEntity })
  async start(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.inventoryCountingService.start(id, user.username);
  }

  @Post('generate-cutoff')
  @Permission('IPCS.INVENTORY_COUNTING_CREATE')
  @ApiOperation({ summary: 'Generate cut-off items for inventory counting' })
  @ApiResponse({ status: 200, type: GenerateCutOffResponseEntity })
  async generateCutOff(
    @Body() dto: GenerateCutOffDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.inventoryCountingService.generateCutOff(dto, user.username);
  }

  @Patch('details/:detailId')
  @Permission('IPCS.INVENTORY_COUNTING_UPDATE')
  @ApiOperation({ summary: 'Update actual stock for a detail item' })
  @ApiParam({ name: 'detailId', description: 'StockOpnameDetail ID' })
  @ApiResponse({ status: 200, type: InventoryCountingResponseEntity })
  async updateActualStock(
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() dto: UpdateActualStockDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    // Get opnameId from query param or body
    return this.inventoryCountingService.updateActualStock(
      '', // opnameId is validated in service via detail
      detailId,
      dto,
      user.username,
    );
  }

  @Post('close')
  @Permission('IPCS.INVENTORY_COUNTING_APPROVE')
  @ApiOperation({ summary: 'Approve and close inventory counting session' })
  @ApiResponse({ status: 200, type: InventoryCountingResponseEntity })
  async close(
    @Body() dto: CloseInventoryCountingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.inventoryCountingService.close(dto, user.username);
  }

  @Post('approve')
  @Permission('IPCS.INVENTORY_COUNTING_APPROVE')
  @ApiOperation({ summary: 'Approve and close inventory counting session' })
  @ApiResponse({ status: 200, type: InventoryCountingResponseEntity })
  async approve(
    @Body() dto: CloseInventoryCountingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.inventoryCountingService.close(dto, user.username);
  }

  @Post('generate-ws')
  @Permission('IPCS.INVENTORY_COUNTING_READ')
  @ApiOperation({
    summary: 'Generate Worksheet Excel file for inventory counting',
  })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async generateWorksheet(@Body() dto: GenerateExcelDto, @Res() res: Response) {
    const buffer = await this.inventoryCountingService.generateWorksheet(
      dto.id,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Inventory_Worksheet_${dto.id}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post('generate-snapshot')
  @Permission('IPCS.INVENTORY_COUNTING_READ')
  @ApiOperation({
    summary: 'Generate Snapshot Excel file for inventory counting',
  })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async generateSnapshot(@Body() dto: GenerateExcelDto, @Res() res: Response) {
    const buffer = await this.inventoryCountingService.generateSnapshot(dto.id);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Inventory_Snapshot_${dto.id}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post('generate-temporary-report')
  @Permission('IPCS.INVENTORY_COUNTING_READ')
  @ApiOperation({
    summary:
      'Generate Temporary Report Excel file for inventory counting with tolerance',
  })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async generateTemporaryReport(
    @Body() dto: GenerateExcelDto,
    @Res() res: Response,
  ) {
    const buffer = await this.inventoryCountingService.generateTemporaryReport(
      dto.id,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Inventory_Temporary_Report_${dto.id}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }
}
