import { ApiHeader } from '@nestjs/swagger';
import { ApiSuccessEnvelope } from '../../common/interceptors/api-response.swagger';
import {
  BomRevisionResponseDto,
  BomComparisonResponseDto,
} from '../../traceability/phase-one-response.dto';
/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { BomRevisionsService } from './bom-revisions.service';
import {
  CreateRevisionDto,
  UpdateRevisionDto,
  RevisionActionDto,
  RevisionQueryDto,
} from './bom-revision.dto';
@ApiTags('BOM Revisions')
@Controller('master/bom-revisions')
export class BomRevisionsController {
  constructor(private readonly service: BomRevisionsService) {}
  @Get()
  @ApiSuccessEnvelope({
    status: 200,
    type: BomRevisionResponseDto,
    isArray: true,
    paginated: true,
  })
  @Permission('IPCS.BOM_REVISION_READ')
  @ApiOperation({ summary: 'List BOM revisions' })
  list(@Query() query: RevisionQueryDto) {
    return this.service.list(query);
  }
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description:
      'Reuse for retries of the same command; generate a new key for a new action.',
  })
  @Post()
  @ApiSuccessEnvelope({ status: 201, type: BomRevisionResponseDto })
  @Permission('IPCS.BOM_REVISION_CREATE')
  @ApiOperation({ summary: 'Create or import baseline draft' })
  create(@Body() dto: CreateRevisionDto, @CurrentUser() user: ICurrentUser) {
    return this.service.create(dto, user.username);
  }
  @Get(':id/compare')
  @ApiSuccessEnvelope({
    status: 200,
    type: BomComparisonResponseDto,
    isArray: true,
  })
  @Permission('IPCS.BOM_REVISION_READ')
  compare(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('baseId', new ParseUUIDPipe({ optional: true })) baseId?: string,
  ) {
    return this.service.compare(id, baseId);
  }
  @Get(':id')
  @ApiSuccessEnvelope({ status: 200, type: BomRevisionResponseDto })
  @Permission('IPCS.BOM_REVISION_READ')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description:
      'Reuse for retries of the same command; generate a new key for a new action.',
  })
  @Patch(':id')
  @ApiSuccessEnvelope({ status: 200, type: BomRevisionResponseDto })
  @Permission('IPCS.BOM_REVISION_UPDATE')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRevisionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.update(id, dto, user.username);
  }
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description:
      'Reuse for retries of the same command; generate a new key for a new action.',
  })
  @Post(':id/submit')
  @ApiSuccessEnvelope({ status: 201, type: BomRevisionResponseDto })
  @Permission('IPCS.BOM_REVISION_SUBMIT')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisionActionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.action(id, 'SUBMIT', dto, user.username);
  }
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description:
      'Reuse for retries of the same command; generate a new key for a new action.',
  })
  @Post(':id/approve')
  @ApiSuccessEnvelope({ status: 201, type: BomRevisionResponseDto })
  @Permission('IPCS.BOM_REVISION_APPROVE')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisionActionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.action(id, 'APPROVE', dto, user.username);
  }
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description:
      'Reuse for retries of the same command; generate a new key for a new action.',
  })
  @Post(':id/reject')
  @ApiSuccessEnvelope({ status: 201, type: BomRevisionResponseDto })
  @Permission('IPCS.BOM_REVISION_APPROVE')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisionActionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.action(id, 'REJECT', dto, user.username);
  }
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description:
      'Reuse for retries of the same command; generate a new key for a new action.',
  })
  @Post(':id/cancel')
  @ApiSuccessEnvelope({ status: 201, type: BomRevisionResponseDto })
  @Permission('IPCS.BOM_REVISION_UPDATE')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisionActionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.action(id, 'CANCEL', dto, user.username);
  }
}
