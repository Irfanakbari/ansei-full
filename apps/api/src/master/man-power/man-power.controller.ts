import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ManPowerService } from './man-power.service';
import { CreateManPowerDto, UpdateManPowerDto } from './dto';
import { ManPowerEntity } from './entities/man-power.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';
import { ApiSuccessEnvelope } from '../../common/interceptors/api-response.swagger';

@ApiTags('ManPower')
@ApiBearerAuth()
@Controller('master/man-power')
export class ManPowerController {
  constructor(private readonly manPowerService: ManPowerService) {}

  @ApiOperation({ summary: 'Get all man power' })
  @ApiSuccessEnvelope({
    status: 200,
    type: ManPowerEntity,
    isArray: true,
    paginated: true,
  })
  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(
    @Query() query: SearchPaginationQueryDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.manPowerService.findAll(query);
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
    return this.manPowerService.create(createManPowerDto, user?.username);
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
    return this.manPowerService.update(uid, updateManPowerDto, user?.username);
  }

  @ApiOperation({ summary: 'Delete man power' })
  @ApiResponse({ status: 200, description: 'Man power berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'Man power tidak ditemukan' })
  @Delete(':uid')
  @Permission('IPCS.MASTER_DELETE')
  async remove(@Param('uid') uid: string, @CurrentUser() user: ICurrentUser) {
    return this.manPowerService.remove(uid, user?.username);
  }

  @ApiOperation({
    summary: 'Upload picture for man power (max 5MB, png/jpg/jpeg/gif/webp)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, type: ManPowerEntity })
  @ApiResponse({
    status: 400,
    description: 'File tidak valid atau melebihi 5MB',
  })
  @ApiResponse({ status: 404, description: 'Man power tidak ditemukan' })
  @Post(':uid/picture')
  @Permission('IPCS.MASTER_UPDATE')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  )
  async uploadPicture(
    @Param('uid') uid: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.manPowerService.uploadPicture(uid, file, user?.username);
  }

  @ApiOperation({ summary: 'Delete picture for man power' })
  @ApiResponse({ status: 200, type: ManPowerEntity })
  @ApiResponse({ status: 404, description: 'Man power tidak ditemukan' })
  @Delete(':uid/picture')
  @Permission('IPCS.MASTER_UPDATE')
  async deletePicture(
    @Param('uid') uid: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.manPowerService.deletePicture(uid, user?.username);
  }
}
