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
import { SatuanService } from './satuan.service';
import { CreateSatuanDto, UpdateSatuanDto } from './dto';
import { SatuanEntity } from './entities/satuan.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';
import { ApiSuccessEnvelope } from '../../common/interceptors/api-response.swagger';

@ApiTags('Satuan')
@Controller('master/satuan')
export class SatuanController {
  constructor(private readonly satuanService: SatuanService) {}

  @ApiOperation({ summary: 'Get all satuan' })
  @ApiSuccessEnvelope({
    status: 200,
    type: SatuanEntity,
    isArray: true,
    paginated: true,
  })
  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(
    @Query() query: SearchPaginationQueryDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.satuanService.findAll(query);
  }

  @ApiOperation({ summary: 'Get satuan by ID' })
  @ApiResponse({ status: 200, type: SatuanEntity })
  @ApiResponse({ status: 404, description: 'Satuan tidak ditemukan' })
  @Get(':id')
  @Permission('IPCS.MASTER_READ')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.satuanService.findOne(id);
  }

  @ApiOperation({ summary: 'Create new satuan' })
  @ApiResponse({ status: 201, type: SatuanEntity })
  @Post()
  @Permission('IPCS.MASTER_CREATE')
  async create(
    @Body() createSatuanDto: CreateSatuanDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.satuanService.create(createSatuanDto, user.username);
  }

  @ApiOperation({ summary: 'Update satuan' })
  @ApiResponse({ status: 200, type: SatuanEntity })
  @ApiResponse({ status: 404, description: 'Satuan tidak ditemukan' })
  @Patch(':id')
  @Permission('IPCS.MASTER_UPDATE')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSatuanDto: UpdateSatuanDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.satuanService.update(id, updateSatuanDto, user.username);
  }

  @ApiOperation({ summary: 'Delete satuan' })
  @ApiResponse({ status: 200, description: 'Satuan berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'Satuan tidak ditemukan' })
  @Delete(':id')
  @Permission('IPCS.MASTER_DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.satuanService.remove(id, user.username);
  }
}
