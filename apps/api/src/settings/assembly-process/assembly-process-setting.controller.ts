import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Permission } from '../../auth/decorators/permission.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { AssemblyProcessSettingService } from './assembly-process-setting.service';
import { UpdateAssemblyProcessSettingDto } from './dto/update-assembly-process-setting.dto';
import { AssemblyProcessSettingEntity } from './entities/assembly-process-setting.entity';

@ApiTags('Assembly Process Setting')
@ApiBearerAuth()
@Controller('settings/assembly-process')
export class AssemblyProcessSettingController {
  constructor(private readonly service: AssemblyProcessSettingService) {}

  @Get()
  @Permission('IPCS.MASTER_READ')
  @ApiOperation({ summary: 'Get the global assembly-process setting' })
  @ApiResponse({ status: 200, type: AssemblyProcessSettingEntity })
  find(@CurrentUser() _user: ICurrentUser) {
    return this.service.find();
  }

  @Patch()
  @Permission('IPCS.MASTER_UPDATE')
  @ApiOperation({ summary: 'Update the global assembly-process setting' })
  @ApiResponse({ status: 200, type: AssemblyProcessSettingEntity })
  update(
    @Body() dto: UpdateAssemblyProcessSettingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.update(dto, user.username);
  }
}
