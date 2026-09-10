import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { DashboardSettingService } from './dashboard-setting.service';
import { UpdateDashboardSettingDto } from './dto';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('DashboardSetting')
@Controller('settings/dashboard-setting')
export class DashboardSettingController {
  constructor(
    private readonly dashboardSettingService: DashboardSettingService,
  ) {}

  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(@CurrentUser() _user: ICurrentUser) {
    return this.dashboardSettingService.findAll();
  }

  @Get('latest')
  @Permission('IPCS.MASTER_READ')
  async findLatest(@CurrentUser() _user: ICurrentUser) {
    return this.dashboardSettingService.findLatest();
  }

  @Get(':id')
  @Permission('IPCS.MASTER_READ')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.dashboardSettingService.findOne(id);
  }

  @Patch(':id')
  @Permission('IPCS.MASTER_UPDATE')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDashboardSettingDto: UpdateDashboardSettingDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.dashboardSettingService.update(id, updateDashboardSettingDto);
  }
}
