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
} from './dto';
import { MaterialEntity } from './entities/material.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';
import { ApiSuccessEnvelope } from '../../common/interceptors/api-response.swagger';

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
    @Query() query: SearchPaginationQueryDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.materialService.findAll(query);
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
  @Permission('IPCS.MASTER_UPDATE')
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
  @Permission('IPCS.MASTER_UPDATE')
  async reactivate(
    @Param('partNumber') partNumber: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.materialService.reactivate(partNumber, user.username);
  }
}
