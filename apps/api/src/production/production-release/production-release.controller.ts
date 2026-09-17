import { ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  UploadedFiles,
  UseInterceptors,
  ParseIntPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ProductionReleaseService } from './production-release.service';
import {
  CreateProductionReleaseDto,
  UpdateProductionReleaseDto,
  UploadProductionAttachmentDto,
  ProductionReleaseQueryDto,
  CancelProductionReleaseDto,
  AmendProductionReleaseForecastsDto,
  ProductionReleaseForecastCandidatesQueryDto,
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

  @Get(':id/forecast-candidates')
  @Permission('IPCS.PRODUCTION_RELEASE_READ')
  async getForecastCandidates(
    @Param('id') id: string,
    @Query() query: ProductionReleaseForecastCandidatesQueryDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.productionReleaseService.getForecastCandidates(id, query);
  }

  @Post()
  @Permission('IPCS.PRODUCTION_RELEASE_CREATE')
  @ApiResponse({ status: 201, type: ProductionReleaseEntity })
  @ApiResponse({ status: 409, description: 'Forecast assignment conflict' })
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
  @ApiResponse({
    status: 409,
    description: 'Concurrent release or forecast conflict',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductionReleaseDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReleaseService.update(id, updateDto, user.username);
  }

  @Post(':id/cancel')
  @Permission('IPCS.PRODUCTION_RELEASE_UPDATE')
  @ApiResponse({ status: 200, type: ProductionReleaseEntity })
  @ApiResponse({
    status: 409,
    description: 'Release or linked forecasts have operational activity',
  })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelProductionReleaseDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReleaseService.cancel(id, dto, user.username);
  }

  @Post(':id/forecasts/tag')
  @Permission('IPCS.PRODUCTION_RELEASE_UPDATE')
  @ApiResponse({ status: 200, type: ProductionReleaseEntity })
  @ApiResponse({ status: 409, description: 'Forecast cannot be amended' })
  async tagForecasts(
    @Param('id') id: string,
    @Body() dto: AmendProductionReleaseForecastsDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReleaseService.tagForecasts(id, dto, user.username);
  }

  @Post(':id/forecasts/untag')
  @Permission('IPCS.PRODUCTION_RELEASE_UPDATE')
  @ApiResponse({ status: 200, type: ProductionReleaseEntity })
  @ApiResponse({ status: 409, description: 'Forecast cannot be amended' })
  async untagForecasts(
    @Param('id') id: string,
    @Body() dto: AmendProductionReleaseForecastsDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReleaseService.untagForecasts(id, dto, user.username);
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
  @Permission('IPCS.PRODUCTION_RELEASE_UPDATE')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 10 * 1024 * 1024, files: 10, fields: 1, parts: 11 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          maxItems: 10,
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  @ApiResponse({ status: 201, type: [AttachmentResponseEntity] })
  @ApiResponse({ status: 404, description: 'Release not found' })
  async uploadAttachment(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReleaseService.uploadAttachment(
      { productionReleaseId: id },
      files,
      user.username,
    );
  }

  @Patch(':id/attachments/:attachmentId')
  @Permission('IPCS.PRODUCTION_RELEASE_UPDATE')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, type: AttachmentResponseEntity })
  async replaceAttachment(
    @Param('id') id: string,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReleaseService.replaceAttachment(
      id,
      attachmentId,
      file,
      user.username,
    );
  }

  @Get(':id/attachments/:attachmentId/download')
  @Permission('IPCS.PRODUCTION_RELEASE_READ')
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const download = await this.productionReleaseService.downloadAttachment(
      id,
      attachmentId,
    );
    response.setHeader('Content-Type', download.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(download.fileName)}`,
    );
    return new StreamableFile(download.response.body as never);
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

  @Delete(':id/attachments/:attachmentId')
  @Permission('IPCS.PRODUCTION_RELEASE_DELETE')
  @ApiResponse({ status: 200, type: DeleteAttachmentResponseDto })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.productionReleaseService.deleteAttachment(
      id,
      attachmentId,
      user.username,
    );
  }
}
