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
} from '@nestjs/common';
import { ManPowerService } from './man-power.service';
import { CreateManPowerDto, UpdateManPowerDto } from './dto';
import { ManPowerEntity } from './entities/man-power.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('ManPower')
@Controller('master/man-power')
export class ManPowerController {
  constructor(private readonly manPowerService: ManPowerService) {}

  @ApiOperation({ summary: 'Get all man power' })
  @ApiResponse({ status: 200, type: [ManPowerEntity] })
  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(@CurrentUser() _user: ICurrentUser) {
    return this.manPowerService.findAll();
  }

  @ApiOperation({ summary: 'Get man power by UID' })
  @ApiResponse({ status: 200, type: ManPowerEntity })
  @ApiResponse({ status: 404, description: 'Man power tidak ditemukan' })
  @Get(':uid')
  @Permission('IPCS.MASTER_READ')
  async findOne(@Param('uid') uid: string, @CurrentUser() _user: ICurrentUser) {
    return this.manPowerService.findOne(uid);
  }

  @ApiOperation({ summary: 'Get man power by NIK' })
  @ApiResponse({ status: 200, type: ManPowerEntity })
  @ApiResponse({ status: 404, description: 'Man power tidak ditemukan' })
  @Get('nik/:nik')
  @Permission('IPCS.MASTER_READ')
  async findByNik(
    @Param('nik') nik: string,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.manPowerService.findByNik(nik);
  }

  @ApiOperation({ summary: 'Create new man power' })
  @ApiResponse({ status: 201, type: ManPowerEntity })
  @Post()
  @Permission('IPCS.MASTER_CREATE')
  async create(
    @Body() createManPowerDto: CreateManPowerDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.manPowerService.create(createManPowerDto);
  }

  @ApiOperation({ summary: 'Update man power' })
  @ApiResponse({ status: 200, type: ManPowerEntity })
  @ApiResponse({ status: 404, description: 'Man power tidak ditemukan' })
  @Patch(':uid')
  @Permission('IPCS.MASTER_UPDATE')
  async update(
    @Param('uid') uid: string,
    @Body() updateManPowerDto: UpdateManPowerDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.manPowerService.update(uid, updateManPowerDto);
  }

  @ApiOperation({ summary: 'Delete man power' })
  @ApiResponse({ status: 200, description: 'Man power berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'Man power tidak ditemukan' })
  @Delete(':uid')
  @Permission('IPCS.MASTER_DELETE')
  async remove(@Param('uid') uid: string, @CurrentUser() user: ICurrentUser) {
    return this.manPowerService.remove(uid);
  }
}
