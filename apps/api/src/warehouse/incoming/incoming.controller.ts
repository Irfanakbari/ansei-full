import {
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IncomingService } from './incoming.service';
import {
  AttachmentResponseDto,
  CheckIncomingDto,
  CreateIncomingDto,
  DeleteResponseDto,
  IncomingCheckResultDto,
  IncomingReceiveResultDto,
  IncomingResponseDto,
  UpdateIncomingDto,
  UploadIncomingAttachmentDto,
} from './dto';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';

@ApiTags('Incoming')
@Controller('warehouse/incoming')
export class IncomingController {
  constructor(private readonly incomingService: IncomingService) {}

  @Get()
  @Permission('IPCS.INCOMING_READ')
  @ApiQuery({
    name: 'open',
    required: false,
    type: Boolean,
    description:
      'Filter by closed status: true=open only, false=closed only, undefined=all',
  })
  @ApiResponse({
    status: 200,
    description: 'Get all incoming records',
    type: [IncomingResponseDto],
  })
  async findAll(
    @Query() query: SearchPaginationQueryDto,
    @CurrentUser() user: ICurrentUser,
    @Query('open') open?: string,
  ) {
    return this.incomingService.findAll(query, open);
  }

  @Get('po/:poId')
  @Permission('IPCS.INCOMING_READ')
  @ApiResponse({
    status: 200,
    description: 'Get incoming by PO ID',
    type: IncomingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Incoming not found' })
  async findByPoId(
    @Param('poId') poId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.incomingService.findByPoId(poId);
  }

  @Get(':id')
  @Permission('IPCS.INCOMING_READ')
  @ApiResponse({
    status: 200,
    description: 'Get incoming by ID',
    type: IncomingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Incoming not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.incomingService.findOne(id);
  }

  @Post()
  @Permission('IPCS.INCOMING_CREATE')
  @ApiResponse({
    status: 201,
    description: 'Create incoming',
    type: IncomingResponseDto,
  })
  async create(
    @Body() createIncomingDto: CreateIncomingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.incomingService.create(createIncomingDto, user.username);
  }

  @Patch(':id')
  @Permission('IPCS.INCOMING_UPDATE')
  @ApiResponse({
    status: 200,
    description: 'Update incoming',
    type: IncomingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Incoming not found' })
  async update(
    @Param('id') id: string,
    @Body() updateIncomingDto: UpdateIncomingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.incomingService.update(id, updateIncomingDto, user.username);
  }

  @Delete(':id')
  @Permission('IPCS.INCOMING_DELETE')
  @ApiResponse({
    status: 200,
    description: 'Delete incoming',
    type: DeleteResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Incoming not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.incomingService.remove(id, user.username);
  }

  @Post(':id/receive')
  @Permission('IPCS.INCOMING_UPDATE')
  @ApiResponse({
    status: 200,
    description: 'Receive incoming',
    type: IncomingReceiveResultDto,
  })
  @ApiResponse({ status: 404, description: 'Incoming not found' })
  @ApiResponse({ status: 400, description: 'Cannot receive incoming' })
  async receive(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.incomingService.receive(id, user.username);
  }

  @Post(':id/check')
  @Permission('IPCS.INCOMING_UPDATE')
  @ApiResponse({
    status: 200,
    description: 'Check incoming materials',
    type: IncomingCheckResultDto,
  })
  @ApiResponse({ status: 404, description: 'Incoming not found' })
  @ApiResponse({ status: 400, description: 'Cannot check incoming' })
  async check(
    @Param('id') id: string,
    @Body() checkIncomingDto: CheckIncomingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.incomingService.check(id, checkIncomingDto, user.username);
  }

  // ==================== ATTACHMENT ENDPOINTS ====================

  @Post(':id/attachments')
  @Permission('IPCS.INCOMING_CREATE')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 4, parts: 5 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Upload attachment',
    type: AttachmentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Incoming not found' })
  async uploadAttachment(
    @Param('id') id: string,
    @Body() dto: UploadIncomingAttachmentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.incomingService.uploadAttachment(id, dto, file, user.username);
  }

  @Get(':id/attachments')
  @Permission('IPCS.INCOMING_READ')
  @ApiResponse({ status: 200, description: 'Get attachment info' })
  @ApiResponse({ status: 404, description: 'Incoming or attachment not found' })
  async getAttachments(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.incomingService.getAttachments(id);
  }

  @Delete('attachments/:attachmentId')
  @Permission('IPCS.INCOMING_DELETE')
  @ApiResponse({
    status: 200,
    description: 'Delete attachment',
    type: DeleteResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async deleteAttachment(
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.incomingService.deleteAttachment(attachmentId, user.username);
  }
}
