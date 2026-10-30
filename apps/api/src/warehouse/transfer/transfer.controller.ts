import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { TransferService } from './transfer.service';
import {
  TransferToRackDto,
  CreateTransferDto,
  RevertTransferDto,
  TransferQueryDto,
} from './dto';
import {
  TransferResultEntity,
  TransferHistoryItemEntity,
  RevertTransferResultEntity,
} from './entities';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('Transfer')
@Controller('warehouse/material')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Get('transfer-history')
  @Permission('IPCS.TRANSFER_READ')
  @ApiOperation({ summary: 'Daftar riwayat transfer material ke rak' })
  @ApiResponse({ status: 200, type: [TransferHistoryItemEntity] })
  async getTransferHistory(@Query() query: TransferQueryDto) {
    return this.transferService.getTransferHistory(query);
  }

  @ApiOperation({ summary: 'Transfer material dari gudang ke rak' })
  @ApiResponse({ status: 201, type: TransferResultEntity })
  @ApiResponse({ status: 404, description: 'Material tidak ditemukan' })
  @ApiResponse({ status: 400, description: 'Stok gudang tidak cukup' })
  @Post('transfer-to-rack')
  @Permission('IPCS.TRANSFER_CREATE')
  async createTransfer(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.transferService.transferToRack(
      dto.partNumber,
      dto.qty,
      user.username,
      dto.requestId,
      dto.scanCode,
      dto.notes,
    );
  }

  @ApiOperation({
    summary: 'Transfer material dari gudang ke rak (by part number param)',
  })
  @ApiResponse({ status: 201, type: TransferResultEntity })
  @ApiResponse({ status: 404, description: 'Material tidak ditemukan' })
  @ApiResponse({ status: 400, description: 'Stok gudang tidak cukup' })
  @Post(':partNumber/transfer-to-rack')
  @Permission('IPCS.TRANSFER_CREATE')
  async transferToRack(
    @Param('partNumber') partNumber: string,
    @Body() dto: TransferToRackDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.transferService.transferToRack(
      partNumber,
      dto.qty,
      user.username,
      dto.requestId,
      dto.scanCode,
    );
  }

  @ApiOperation({ summary: 'Revert / kembalikan transfer material ke gudang' })
  @ApiResponse({ status: 200, type: RevertTransferResultEntity })
  @ApiResponse({ status: 404, description: 'Transfer tidak ditemukan' })
  @ApiResponse({ status: 400, description: 'Gagal revert transfer' })
  @Post('transfer/:referenceDoc/revert')
  @Permission('IPCS.TRANSFER_REVERT')
  async revertTransfer(
    @Param('referenceDoc') referenceDoc: string,
    @Body() dto: RevertTransferDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.transferService.revertTransfer(
      referenceDoc,
      user.username,
      dto.reason,
      dto.requestId,
    );
  }
}
