import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { MaterialDeliveryNoteService } from './material-delivery-note.service';
import {
  CreateMaterialDeliveryNoteDto,
  UpdateMaterialDeliveryNoteDto,
  PickMaterialDto,
  SendDeliveryNoteEmailDto,
  MaterialDeliveryNoteResponseDto,
  PaginatedMaterialDeliveryNoteResponseDto,
  MaterialDeliveryNoteDetailResponseDto,
  DeleteMaterialDeliveryNoteResponseDto,
  CancelMaterialDeliveryNoteResponseDto,
  PickMaterialResponseDto,
  ShipMaterialDeliveryNoteResponseDto,
  ReceiveMaterialDeliveryNoteResponseDto,
} from './dto';
import { Permission } from '../auth/decorators/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../auth/interfaces/current-user.interface';
import { DeliveryNoteStatus } from '../generated/prisma/enums';

@ApiTags('Material Delivery Note')
@Controller('transfer-material')
export class MaterialDeliveryNoteController {
  constructor(
    private readonly materialDeliveryNoteService: MaterialDeliveryNoteService,
  ) {}

  @Post()
  @Permission('IPCS.TRANSFER_MATERIAL_CREATE')
  @ApiOperation({ summary: 'Create draft delivery note' })
  @ApiResponse({ status: 201, type: MaterialDeliveryNoteResponseDto })
  async create(
    @Body() dto: CreateMaterialDeliveryNoteDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.materialDeliveryNoteService.create(dto, user.username);
  }

  @Get()
  @Permission('IPCS.TRANSFER_MATERIAL_READ')
  @ApiOperation({ summary: 'List all delivery notes (paginated)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: DeliveryNoteStatus,
    description: 'Filter by status',
  })
  @ApiResponse({ status: 200, type: PaginatedMaterialDeliveryNoteResponseDto })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: DeliveryNoteStatus,
  ) {
    return this.materialDeliveryNoteService.findAll({ page, limit, status });
  }

  @Get(':id')
  @Permission('IPCS.TRANSFER_MATERIAL_READ')
  @ApiOperation({ summary: 'Get one delivery note by ID' })
  @ApiParam({ name: 'id', description: 'Delivery Note UUID' })
  @ApiResponse({ status: 200, type: MaterialDeliveryNoteResponseDto })
  @ApiResponse({ status: 404, description: 'Delivery note not found' })
  async findOne(@Param('id') id: string) {
    return this.materialDeliveryNoteService.findOne(id);
  }

  @Get(':id/details')
  @Permission('IPCS.TRANSFER_MATERIAL_READ')
  @ApiOperation({ summary: 'Get delivery note details (material items)' })
  @ApiParam({ name: 'id', description: 'Delivery Note UUID' })
  @ApiResponse({ status: 200, type: [MaterialDeliveryNoteDetailResponseDto] })
  async getDetails(@Param('id') id: string) {
    return this.materialDeliveryNoteService.getDetails(id);
  }

  @Patch(':id')
  @Permission('IPCS.TRANSFER_MATERIAL_UPDATE')
  @ApiOperation({ summary: 'Update delivery note header (DRAFT only)' })
  @ApiParam({ name: 'id', description: 'Delivery Note UUID' })
  @ApiResponse({ status: 200, type: MaterialDeliveryNoteResponseDto })
  @ApiResponse({ status: 404, description: 'Delivery note not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot update non-DRAFT delivery note',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDeliveryNoteDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.materialDeliveryNoteService.update(id, dto, user.username);
  }

  @Delete(':id')
  @Permission('IPCS.TRANSFER_MATERIAL_DELETE')
  @ApiOperation({ summary: 'Delete delivery note (DRAFT only)' })
  @ApiParam({ name: 'id', description: 'Delivery Note UUID' })
  @ApiResponse({ status: 200, type: DeleteMaterialDeliveryNoteResponseDto })
  @ApiResponse({ status: 404, description: 'Delivery note not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete non-DRAFT delivery note',
  })
  async remove(@Param('id') id: string) {
    return this.materialDeliveryNoteService.remove(id);
  }

  @Patch(':id/pick')
  @Permission('IPCS.TRANSFER_MATERIAL_UPDATE')
  @ApiOperation({ summary: 'Pick material (operator shopping) - DRAFT only' })
  @ApiParam({ name: 'id', description: 'Delivery Note UUID' })
  @ApiResponse({ status: 200, type: PickMaterialResponseDto })
  @ApiResponse({ status: 404, description: 'Delivery note not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot pick non-DRAFT delivery note',
  })
  async pick(
    @Param('id') id: string,
    @Body() dto: PickMaterialDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.materialDeliveryNoteService.pick(id, dto, user.username);
  }

  @Post(':id/ship')
  @Permission('IPCS.TRANSFER_MATERIAL_UPDATE')
  @ApiOperation({
    summary:
      'Ship delivery note (DRAFT → SHIPPED) - cuts stock & creates ledger',
  })
  @ApiParam({ name: 'id', description: 'Delivery Note UUID' })
  @ApiResponse({ status: 200, type: ShipMaterialDeliveryNoteResponseDto })
  @ApiResponse({ status: 404, description: 'Delivery note not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot ship non-DRAFT delivery note',
  })
  async ship(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.materialDeliveryNoteService.ship(id, user.username);
  }

  @Post(':id/receive')
  @Permission('IPCS.TRANSFER_MATERIAL_UPDATE')
  @ApiOperation({ summary: 'Confirm receipt (SHIPPED → RECEIVED)' })
  @ApiParam({ name: 'id', description: 'Delivery Note UUID' })
  @ApiResponse({ status: 200, type: ReceiveMaterialDeliveryNoteResponseDto })
  @ApiResponse({ status: 404, description: 'Delivery note not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot receive non-SHIPPED delivery note',
  })
  async receive(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.materialDeliveryNoteService.receive(id, user.username);
  }

  @Post(':id/cancel')
  @Permission('IPCS.TRANSFER_MATERIAL_UPDATE')
  @ApiOperation({ summary: 'Cancel delivery note (DRAFT only)' })
  @ApiParam({ name: 'id', description: 'Delivery Note UUID' })
  @ApiResponse({ status: 200, type: CancelMaterialDeliveryNoteResponseDto })
  @ApiResponse({ status: 404, description: 'Delivery note not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel non-DRAFT delivery note',
  })
  async cancel(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.materialDeliveryNoteService.cancel(id, user.username);
  }

  @Post(':id/generate-dn')
  @Permission('IPCS.TRANSFER_MATERIAL_READ')
  @ApiOperation({
    summary: 'Generate and download Delivery Note Excel (debug mode)',
  })
  @ApiParam({ name: 'id', description: 'Delivery Note UUID' })
  @ApiResponse({
    status: 200,
    description: 'PDF file download',
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async generateDN(@Param('id') id: string, @Res() res: Response) {
    const buffer =
      await this.materialDeliveryNoteService.generateDeliveryNotePDF(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=DN_${id}.pdf`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post(':id/send-dn')
  @Permission('IPCS.TRANSFER_MATERIAL_UPDATE')
  @ApiOperation({
    summary: 'Send Delivery Note PDF via email (Outlook 365)',
  })
  @ApiParam({ name: 'id', description: 'Delivery Note UUID' })
  @ApiResponse({
    status: 200,
    description: 'Email sent successfully',
  })
  @ApiResponse({ status: 404, description: 'Delivery note not found' })
  async sendDN(
    @Param('id') id: string,
    @Body() dto: SendDeliveryNoteEmailDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.materialDeliveryNoteService.sendDeliveryNoteEmail(
      id,
      dto,
      user.username,
    );
  }
}
