import {
  ApiTags,
  ApiBearerAuth,
  ApiResponse,
  ApiOperation,
  ApiConsumes,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DisplayConfigService } from './display-config.service';
import { CreateDisplayConfigDto, UpdateDisplayConfigDto } from './dto';
import { DisplayConfigEntity } from './entities/display-config.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { Public } from '../../auth/decorators/public.decorator';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';

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
  async findActive(@Query('line') line?: string) {
    return this.displayConfigService.findActive(line);
  }

  @Get()
  @Permission('DISPLAY_CONFIG_READ')
  @ApiResponse({
    status: 200,
    description: 'List semua display config',
    type: [DisplayConfigEntity],
  })
  async findAll(
    @Query() query: SearchPaginationQueryDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.displayConfigService.findAll(query);
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

  @ApiOperation({
    summary: 'Upload media for display config (max 50MB, mp4/webm/ogg/png/jpg)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, type: DisplayConfigEntity })
  @Post(':id/media')
  @Permission('DISPLAY_CONFIG_UPDATE')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  )
  async uploadMedia(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.displayConfigService.uploadMedia(id, file, user?.username);
  }

  @ApiOperation({ summary: 'Delete media for display config' })
  @ApiResponse({ status: 200, type: DisplayConfigEntity })
  @Delete(':id/media')
  @Permission('DISPLAY_CONFIG_UPDATE')
  async deleteMedia(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.displayConfigService.deleteMedia(id, user?.username);
  }
}
