import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Post, Body, Param } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { TransferToRackDto } from './dto';
import { TransferResultEntity } from './entities';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('Transfer')
@Controller('warehouse/material')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @ApiOperation({ summary: 'Transfer material dari gudang ke rak' })
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
    );
  }
}
