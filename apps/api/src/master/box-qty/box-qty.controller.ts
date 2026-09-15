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
import { BoxQtyService } from './box-qty.service';
import { CreateBoxQtyDto, UpdateBoxQtyDto } from './dto';
import { BoxQTYEntity } from './entities/box-qty.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';
import { ApiSuccessEnvelope } from '../../common/interceptors/api-response.swagger';

@ApiTags('BoxQty')
@Controller('master/box-qty')
export class BoxQtyController {
  constructor(private readonly boxQtyService: BoxQtyService) {}

  @ApiOperation({ summary: 'Get all box qty' })
  @ApiSuccessEnvelope({
    status: 200,
    type: BoxQTYEntity,
    isArray: true,
    paginated: true,
  })
  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(
    @Query() query: SearchPaginationQueryDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.boxQtyService.findAll(query);
  }

  @ApiOperation({ summary: 'Get box qty by ID' })
  @ApiResponse({ status: 200, type: BoxQTYEntity })
  @ApiResponse({ status: 404, description: 'BoxQty tidak ditemukan' })
  @Get(':id')
  @Permission('IPCS.MASTER_READ')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.boxQtyService.findOne(id);
  }

  // IMPORTANT: Specific routes MUST come before parameterized routes
  @ApiOperation({ summary: 'Get box qty by part number' })
  @ApiResponse({ status: 200, type: BoxQTYEntity })
  @Get('part-number/:partNumber')
  @Permission('IPCS.MASTER_READ')
  async findByPartNumber(
    @Param('partNumber') partNumber: string,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.boxQtyService.findByPartNumber(partNumber);
  }

  @ApiOperation({ summary: 'Create new box qty' })
  @ApiResponse({ status: 201, type: BoxQTYEntity })
  @Post()
  @Permission('IPCS.MASTER_CREATE')
  async create(
    @Body() createBoxQtyDto: CreateBoxQtyDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.boxQtyService.create(createBoxQtyDto, user.username);
  }

  @ApiOperation({ summary: 'Update box qty' })
  @ApiResponse({ status: 200, type: BoxQTYEntity })
  @ApiResponse({ status: 404, description: 'BoxQty tidak ditemukan' })
  @Patch(':id')
  @Permission('IPCS.MASTER_UPDATE')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBoxQtyDto: UpdateBoxQtyDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.boxQtyService.update(id, updateBoxQtyDto, user.username);
  }

  @ApiOperation({ summary: 'Delete box qty' })
  @ApiResponse({ status: 200, description: 'BoxQty berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'BoxQty tidak ditemukan' })
  @Delete(':id')
  @Permission('IPCS.MASTER_DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.boxQtyService.remove(id, user.username);
  }
}
