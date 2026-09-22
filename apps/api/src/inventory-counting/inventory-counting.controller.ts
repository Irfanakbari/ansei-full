import {
  Controller,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
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
  ValidateMaterialRackDto,
  ApplyOcrResultsDto,
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

  @Post(':id/attachments')
  @Permission('IPCS.INVENTORY_COUNTING_UPDATE')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 10 * 1024 * 1024, files: 10, fields: 0, parts: 10 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          maxItems: 10,
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload optional inventory counting audit attachments',
  })
  async uploadAttachments(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.inventoryCountingService.uploadAttachments(
      id,
      files,
      user.username,
    );
  }

  @Get(':id/attachments')
  @Permission('IPCS.INVENTORY_COUNTING_READ')
  @ApiOperation({ summary: 'List inventory counting audit attachments' })
  async getAttachments(@Param('id') id: string) {
    return this.inventoryCountingService.getAttachments(id);
  }

  @Get(':id/attachments/:attachmentId/download')
  @Permission('IPCS.INVENTORY_COUNTING_READ')
  @ApiOperation({ summary: 'Download an inventory counting audit attachment' })
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const download = await this.inventoryCountingService.downloadAttachment(
      id,
      attachmentId,
    );
    response.setHeader('Content-Type', download.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(download.fileName)}`,
    );
    return new StreamableFile(download.response.body as never);
  }

  @Delete(':id/attachments/:attachmentId')
  @Permission('IPCS.INVENTORY_COUNTING_DELETE')
  @ApiOperation({ summary: 'Delete an inventory counting audit attachment' })
  async deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.inventoryCountingService.deleteAttachment(
      id,
      attachmentId,
      user.username,
    );
  }

  @Post(':id/ocr/preview')
  @Permission('IPCS.INVENTORY_COUNTING_UPDATE')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, parts: 3 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        saveAsAttachment: { type: 'boolean', default: true },
      },
    },
  })
  @ApiOperation({
    summary: 'Extract inventory counting values from a PDF for review',
  })
  async previewOcr(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body('saveAsAttachment') saveAsAttachment: string | undefined,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.inventoryCountingService.previewOcr(
      id,
      file,
      saveAsAttachment !== 'false',
      user.username,
    );
  }

  @Post(':id/ocr/apply')
  @Permission('IPCS.INVENTORY_COUNTING_UPDATE')
  @ApiOperation({
    summary: 'Apply user-confirmed OCR values to inventory counting details',
  })
  async applyOcrResults(
    @Param('id') id: string,
    @Body() dto: ApplyOcrResultsDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.inventoryCountingService.applyOcrResults(
      id,
      dto,
      user.username,
    );
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

  @Post(':id/material-rack/validate')
  @Permission('IPCS.INVENTORY_COUNTING_UPDATE')
  @ApiOperation({
    summary: 'Validate a scanned material rack location for inventory counting',
  })
  @ApiParam({ name: 'id', description: 'StockOpname ID' })
  async validateMaterialRack(
    @Param('id') id: string,
    @Body() dto: ValidateMaterialRackDto,
  ) {
    return this.inventoryCountingService.validateMaterialRack(id, dto.rackQr);
  }

  @Patch(':id/details/:detailId')
  @Permission('IPCS.INVENTORY_COUNTING_UPDATE')
  @ApiOperation({ summary: 'Update actual stock for a detail item' })
  @ApiParam({ name: 'detailId', description: 'StockOpnameDetail ID' })
  @ApiResponse({ status: 200, type: InventoryCountingResponseEntity })
  async updateActualStock(
    @Param('id') id: string,
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() dto: UpdateActualStockDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.inventoryCountingService.updateActualStock(
      id,
      detailId,
      dto,
      user.username,
    );
  }

  @Post(':id/cancel')
  @Permission('IPCS.INVENTORY_COUNTING_UPDATE')
  @ApiOperation({ summary: 'Cancel inventory counting session' })
  @ApiParam({ name: 'id', description: 'StockOpname ID' })
  @ApiResponse({ status: 200, type: InventoryCountingResponseEntity })
  async cancel(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.inventoryCountingService.cancel(id, user.username);
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

  @Post('generate-final-report')
  @Permission('IPCS.INVENTORY_COUNTING_READ')
  @ApiOperation({
    summary: 'Generate approved Final Report Excel file for inventory counting',
  })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  @ApiResponse({
    status: 400,
    description: 'Inventory counting has not been closed and approved',
  })
  async generateFinalReport(
    @Body() dto: GenerateExcelDto,
    @Res() res: Response,
  ) {
    const buffer = await this.inventoryCountingService.generateFinalReport(
      dto.id,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Inventory_Final_Report_${dto.id}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }
}
