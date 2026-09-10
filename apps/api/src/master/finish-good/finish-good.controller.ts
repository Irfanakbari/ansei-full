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
} from '@nestjs/common';
import { FinishGoodService } from './finish-good.service';
import { CreateFinishGoodDto, UpdateFinishGoodDto } from './dto';
import { FinishGoodEntity } from './entities/finish-good.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('FinishGood')
@Controller('master/finish-good')
export class FinishGoodController {
  constructor(private readonly finishGoodService: FinishGoodService) {}

  @ApiOperation({ summary: 'Get all finish goods' })
  @ApiResponse({ status: 200, type: [FinishGoodEntity] })
  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(@CurrentUser() _user: ICurrentUser) {
    return this.finishGoodService.findAll();
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
}
