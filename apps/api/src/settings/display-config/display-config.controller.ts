import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { DisplayConfigService } from './display-config.service';
import { CreateDisplayConfigDto, UpdateDisplayConfigDto } from './dto';
import { DisplayConfigEntity } from './entities/display-config.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('DisplayConfig')
@ApiBearerAuth()
@Controller('settings/display-config')
export class DisplayConfigController {
  constructor(private readonly displayConfigService: DisplayConfigService) {}

  @Get('active')
  @Public()
  @ApiResponse({
    status: 200,
    description: 'Active display configuration, or null when none is active',
    type: DisplayConfigEntity,
  })
  async findActive() {
    return this.displayConfigService.findActive();
  }

  @Get()
  @Permission('DISPLAY_CONFIG_READ')
  @ApiResponse({
    status: 200,
    description: 'List semua display config',
    type: [DisplayConfigEntity],
  })
  async findAll(@CurrentUser() _user: ICurrentUser) {
    return this.displayConfigService.findAll();
  }

  @Post()
  @Permission('DISPLAY_CONFIG_CREATE')
  async create(
    @Body() createDisplayConfigDto: CreateDisplayConfigDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.displayConfigService.create(
      createDisplayConfigDto,
      user.username,
    );
  }

  @Patch(':id')
  @Permission('DISPLAY_CONFIG_UPDATE')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDisplayConfigDto: UpdateDisplayConfigDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.displayConfigService.update(
      id,
      updateDisplayConfigDto,
      user.username,
    );
  }

  @Delete(':id')
  @Permission('DISPLAY_CONFIG_DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.displayConfigService.remove(id, user.username);
  }
}
