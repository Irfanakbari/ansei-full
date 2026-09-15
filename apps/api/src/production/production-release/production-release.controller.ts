import { ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductionReleaseService } from './production-release.service';
import {
  CreateProductionReleaseDto,
  UpdateProductionReleaseDto,
  UploadProductionAttachmentDto,
  ProductionReleaseQueryDto,
} from './dto';
import {
  AttachmentResponseEntity,
  DeleteAttachmentResponseDto,
  DeliveryAttachmentEntity,
  ForecastListResponseEntity,
  LabelDataEntity,
  ProductionReleaseDetailEntity,
  ProductionReleaseEntity,
  PaginatedProductionReleaseEntity,
} from './entities';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('Production Release')
@Controller('production/production-release')
export class ProductionReleaseController {
  constructor(
    private readonly productionReleaseService: ProductionReleaseService,
  ) {}

  @Get()
  @Permission('IPCS.PRODUCTION_RELEASE_READ')
  @ApiResponse({ status: 200, type: PaginatedProductionReleaseEntity })
  async findAll(
    @CurrentUser() _user: ICurrentUser,
    @Query() query: ProductionReleaseQueryDto,
  ) {
    return this.productionReleaseService.findAll(query);
  }

  @Get('release-number/:releaseNumber')
  @Permission('IPCS.PRODUCTION_RELEASE_READ')
  @ApiResponse({ status: 200, type: ProductionReleaseEntity })
  @ApiResponse({ status: 404, description: 'Release not found' })
  async findByReleaseNumber(
    @Param('releaseNumber') releaseNumber: string,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.productionReleaseService.findByReleaseNumber(releaseNumber);
  }

  @Get(':id')
  @Permission('IPCS.PRODUCTION_RELEASE_READ')
  @ApiResponse({ status: 200, type: ProductionReleaseDetailEntity })
  @ApiResponse({ status: 404, description: 'Release not found' })
  async findOne(@Param('id') id: string, @CurrentUser() _user: ICurrentUser) {
    return this.productionReleaseService.findOne(id);
  }

  @Get(':id/labels')
  @Permission('IPCS.PRODUCTION_RELEASE_READ')
  @ApiResponse({ status: 200, type: [LabelDataEntity] })
  @ApiResponse({ status: 404, description: 'Release not found' })
  async getLabels(@Param('id') id: string, @CurrentUser() _user: ICurrentUser) {
    return this.productionReleaseService.getLabels(id);
  }

  @Get(':id/forecast')
  @Permission('IPCS.PRODUCTION_RELEASE_READ')
  @ApiResponse({ status: 200, type: ForecastListResponseEntity })
  @ApiResponse({ status: 404, description: 'Release not found' })
  async getForecastList(
    @Param('id') id: string,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.productionReleaseService.getForecastList(id);
  }

  @Post()
  @Permission('IPCS.PRODUCTION_RELEASE_CREATE')
  @ApiResponse({ status: 201, type: ProductionReleaseEntity })
  async create(
    @Body() createDto: CreateProductionReleaseDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReleaseService.create(createDto, user.username);
  }

  @Patch(':id')
  @Permission('IPCS.PRODUCTION_RELEASE_UPDATE')
  @ApiResponse({ status: 200, type: ProductionReleaseEntity })
  @ApiResponse({ status: 404, description: 'Release not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductionReleaseDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReleaseService.update(id, updateDto, user.username);
  }

  @Delete(':id')
  @Permission('IPCS.PRODUCTION_RELEASE_DELETE')
  @ApiResponse({
    status: 200,
    type: Object,
    description: '{ deleted: true, id: "..." }',
  })
  @ApiResponse({ status: 404, description: 'Release not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.productionReleaseService.remove(id, user.username);
  }

  // ==================== ATTACHMENT ENDPOINTS ====================

  @Post(':id/attachments')
  @Permission('IPCS.PRODUCTION_RELEASE_CREATE')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, type: AttachmentResponseEntity })
  @ApiResponse({ status: 404, description: 'Release not found' })
  async uploadAttachment(
    @Param('id') id: string,
    @Body() dto: UploadProductionAttachmentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReleaseService.uploadAttachment(
      { ...dto, productionReleaseId: id },
      file,
      user.username,
    );
  }

  @Get(':id/attachments')
  @Permission('IPCS.PRODUCTION_RELEASE_READ')
  @ApiResponse({ status: 200, type: [DeliveryAttachmentEntity] })
  @ApiResponse({ status: 404, description: 'Release not found' })
  async getAttachments(
    @Param('id') id: string,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.productionReleaseService.getAttachments(id);
  }

  @Delete('attachments/:attachmentId')
  @Permission('IPCS.PRODUCTION_RELEASE_DELETE')
  @ApiResponse({ status: 200, type: DeleteAttachmentResponseDto })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async deleteAttachment(
    @Param('attachmentId', ParseFilePipe) attachmentId: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReleaseService.deleteAttachment(
      attachmentId,
      user.username,
    );
  }
}
