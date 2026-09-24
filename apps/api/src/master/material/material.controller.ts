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
import { MaterialService } from './material.service';
import {
  CreateMaterialDto,
  UpdateMaterialDto,
  DiscontinueMaterialDto,
  TransferMaterialStockDto,
  MaterialQueryDto,
} from './dto';
import { MaterialEntity } from './entities/material.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { MaterialQueryDto } from './dto';
import { ApiSuccessEnvelope } from '../../common/interceptors/api-response.swagger';

import { Response } from 'express';
import { Res } from '@nestjs/common';

@ApiTags('Material')
@Controller('master/material')
export class MaterialController {
  constructor(private readonly materialService: MaterialService) {}

  @ApiOperation({ summary: 'Get all materials' })
  @ApiSuccessEnvelope({
    status: 200,
    type: MaterialEntity,
    isArray: true,
    paginated: true,
    description: 'Daftar material',
  })
  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(
    @Query() query: MaterialQueryDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.materialService.findAll(query);
  }

  @ApiOperation({ summary: 'Export all materials to Excel' })
  @Get('export')
  @Permission('IPCS.MASTER_READ')
  async exportExcel(@Query() query: MaterialQueryDto, @Res() res: Response) {
    const buffer = await this.materialService.exportExcel(query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=materials.xlsx');
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Get material by ID' })
  @ApiResponse({
    status: 200,
    type: MaterialEntity,
    description: 'Data material',
  })
  @ApiResponse({ status: 404, description: 'Material tidak ditemukan' })
  @Get(':id')
  @Permission('IPCS.MASTER_READ')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.materialService.findOne(id);
  }

  @ApiOperation({ summary: 'Get material by part number' })
  @ApiResponse({
    status: 200,
    type: MaterialEntity,
    description: 'Data material',
  })
  @ApiResponse({ status: 404, description: 'Material tidak ditemukan' })
  @Get('part-number/:partNumber')
  @Permission('IPCS.MASTER_READ')
  async findByPartNumber(
    @Param('partNumber') partNumber: string,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.materialService.findByPartNumber(partNumber);
  }

  @ApiOperation({ summary: 'Create new material' })
  @ApiResponse({
    status: 201,
    type: MaterialEntity,
    description: 'Material berhasil dibuat',
  })
  @ApiResponse({ status: 409, description: 'Part number sudah ada' })
  @Post()
  @Permission('IPCS.MASTER_CREATE')
  async create(
    @Body() createMaterialDto: CreateMaterialDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.materialService.create(createMaterialDto, user.username);
  }

  @ApiOperation({ summary: 'Update material' })
  @ApiResponse({
    status: 200,
    type: MaterialEntity,
    description: 'Material berhasil diupdate',
  })
  @ApiResponse({ status: 404, description: 'Material tidak ditemukan' })
  @Patch(':id')
  @Permission('IPCS.MASTER_UPDATE')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMaterialDto: UpdateMaterialDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.materialService.update(id, updateMaterialDto, user.username);
  }

  @ApiOperation({ summary: 'Delete material' })
  @ApiResponse({ status: 200, description: 'Material berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'Material tidak ditemukan' })
  @Delete(':id')
  @Permission('IPCS.MASTER_DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.materialService.remove(id, user.username);
  }

  @ApiOperation({ summary: 'Discontinue material by part number' })
  @ApiResponse({
    status: 200,
    type: MaterialEntity,
    description: 'Material berhasil di-discontinue',
  })
  @ApiResponse({ status: 404, description: 'Material tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Material sudah di-discontinue' })
  @Post('part-number/:partNumber/discontinue')
  @Permission('IPCS.MATERIAL_DISCONTINUE')
  async discontinue(
    @Param('partNumber') partNumber: string,
    @Body() dto: DiscontinueMaterialDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.materialService.discontinue(
      partNumber,
      dto.reason,
      user.username,
    );
  }

  @ApiOperation({ summary: 'Reactivate discontinued material by part number' })
  @ApiResponse({
    status: 200,
    type: MaterialEntity,
    description: 'Material berhasil di-reactivate',
  })
  @ApiResponse({ status: 404, description: 'Material tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Material sudah aktif' })
  @Post('part-number/:partNumber/reactivate')
  @Permission('IPCS.MATERIAL_REACTIVATE')
  async reactivate(
    @Param('partNumber') partNumber: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.materialService.reactivate(partNumber, user.username);
  }

  @ApiOperation({ summary: 'Transfer stock between materials (supersession)' })
  @ApiResponse({
    status: 200,
    description: 'Stock material berhasil ditransfer',
  })
  @ApiResponse({ status: 400, description: 'Validasi stok atau status gagal' })
  @ApiResponse({ status: 404, description: 'Material tidak ditemukan' })
  @Post('transfer-stock')
  @Permission('IPCS.MATERIAL_TRANSFER_STOCK')
  async transferStock(
    @Body() dto: TransferMaterialStockDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.materialService.transferStock(dto, user.username);
  }
}
