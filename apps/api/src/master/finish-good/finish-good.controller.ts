import {
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
  Param,
  Patch,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { FinishGoodService } from './finish-good.service';
import {
  CreateFinishGoodDto,
  UpdateFinishGoodDto,
  DiscontinueFinishGoodDto,
  TransferFinishGoodStockDto,
} from './dto';
import { FinishGoodEntity } from './entities/finish-good.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';
import { ApiSuccessEnvelope } from '../../common/interceptors/api-response.swagger';

import { Response } from 'express';
import { Res } from '@nestjs/common';

@ApiTags('FinishGood')
@Controller('master/finish-good')
export class FinishGoodController {
  constructor(private readonly finishGoodService: FinishGoodService) {}

  @ApiOperation({ summary: 'Get all finish goods' })
  @ApiSuccessEnvelope({
    status: 200,
    type: FinishGoodEntity,
    isArray: true,
    paginated: true,
  })
  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(
    @Query() query: SearchPaginationQueryDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.finishGoodService.findAll(query);
  }

  @ApiOperation({ summary: 'Export all finish goods to Excel' })
  @Get('export')
  @Permission('IPCS.MASTER_READ')
  async exportExcel(
    @Query() query: SearchPaginationQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.finishGoodService.exportExcel(query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=finish-goods.xlsx',
    );
    res.send(buffer);
  }

  // IMPORTANT: Specific routes MUST come before parameterized routes
  @ApiOperation({ summary: 'Get finish good by part number' })
  @ApiResponse({ status: 200, type: FinishGoodEntity })
  @ApiResponse({ status: 404, description: 'Finish good tidak ditemukan' })
  @Get('part-number/:partNumber')
  @Permission('IPCS.MASTER_READ')
  async findByPartNumber(
    @Param('partNumber') partNumber: string,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.finishGoodService.findByPartNumber(partNumber);
  }

  @ApiOperation({ summary: 'Get finish good by ID' })
  @ApiResponse({ status: 200, type: FinishGoodEntity })
  @ApiResponse({ status: 404, description: 'Finish good tidak ditemukan' })
  @Get(':id')
  @Permission('IPCS.MASTER_READ')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.finishGoodService.findOne(id);
  }

  @ApiOperation({ summary: 'Create new finish good' })
  @ApiResponse({ status: 201, type: FinishGoodEntity })
  @Post()
  @Permission('IPCS.MASTER_CREATE')
  async create(
    @Body() createFinishGoodDto: CreateFinishGoodDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.finishGoodService.create(createFinishGoodDto, user.username);
  }

  @ApiOperation({ summary: 'Update finish good' })
  @ApiResponse({ status: 200, type: FinishGoodEntity })
  @ApiResponse({ status: 404, description: 'Finish good tidak ditemukan' })
  @Patch(':id')
  @Permission('IPCS.MASTER_UPDATE')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFinishGoodDto: UpdateFinishGoodDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.finishGoodService.update(
      id,
      updateFinishGoodDto,
      user.username,
    );
  }

  @ApiOperation({ summary: 'Delete finish good' })
  @ApiResponse({ status: 200, description: 'Finish good berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'Finish good tidak ditemukan' })
  @Delete(':id')
  @Permission('IPCS.MASTER_DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.finishGoodService.remove(id, user.username);
  }

  @ApiOperation({ summary: 'Discontinue finish good by ID' })
  @ApiResponse({
    status: 200,
    type: FinishGoodEntity,
    description: 'Finish good berhasil di-discontinue',
  })
  @ApiResponse({ status: 404, description: 'Finish good tidak ditemukan' })
  @ApiResponse({
    status: 409,
    description: 'Finish good sudah di-discontinue',
  })
  @Post(':id/discontinue')
  @Permission('IPCS.FINISH_GOOD_DISCONTINUE')
  async discontinue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DiscontinueFinishGoodDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.finishGoodService.discontinue(id, dto.reason, user.username);
  }

  @ApiOperation({
    summary: 'Reactivate discontinued finish good by ID',
  })
  @ApiResponse({
    status: 200,
    type: FinishGoodEntity,
    description: 'Finish good berhasil di-reactivate',
  })
  @ApiResponse({ status: 404, description: 'Finish good tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Finish good sudah aktif' })
  @Post(':id/reactivate')
  @Permission('IPCS.FINISH_GOOD_REACTIVATE')
  async reactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.finishGoodService.reactivate(id, user.username);
  }

  @ApiOperation({
    summary: 'Transfer stock between finish goods (supersession) by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock finish good berhasil ditransfer',
  })
  @ApiResponse({ status: 400, description: 'Validasi stok atau status gagal' })
  @ApiResponse({ status: 404, description: 'Finish good tidak ditemukan' })
  @Post(':id/transfer-stock')
  @Permission('IPCS.FINISH_GOOD_TRANSFER_STOCK')
  async transferStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransferFinishGoodStockDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.finishGoodService.transferStock(id, dto, user.username);
  }
}
