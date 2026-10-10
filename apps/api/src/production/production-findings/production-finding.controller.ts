import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import {
  AllocateFindingDto,
  ProductionFindingQueryDto,
  PublicFinishGoodFindingContextDto,
  PublicFinishGoodFindingContextQueryDto,
  PublicFindingOptionsQueryDto,
  PublicLabelFindingOptionDto,
  PublicMaterialFindingOptionDto,
  RejectFindingDto,
  ReviewFindingDto,
  SubmitFinishGoodFindingDto,
  SubmitMaterialFindingDto,
} from './production-finding.dto';
import { ProductionFindingService } from './production-finding.service';
import { ReplacementPickDto } from './production-finding.dto';

@ApiTags('Production Findings')
@Controller('production/findings')
export class ProductionFindingController {
  constructor(private readonly service: ProductionFindingService) {}

  @Post(':id/replacement-pick')
  @Permission('IPCS.MATERIAL_NG_REVIEW')
  replacementPick(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplacementPickDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.replacementPick(id, dto, user.username);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('public/material-options')
  @ApiOperation({ summary: 'Search active material options for findings' })
  @ApiOkResponse({ type: [PublicMaterialFindingOptionDto] })
  getPublicMaterialOptions(@Query() query: PublicFindingOptionsQueryDto) {
    return this.service.getPublicMaterialOptions(query);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('public/label-options')
  @ApiOperation({ summary: 'Search released production label options' })
  @ApiOkResponse({ type: [PublicLabelFindingOptionDto] })
  getPublicLabelOptions(@Query() query: PublicFindingOptionsQueryDto) {
    return this.service.getPublicLabelOptions(query);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('public/finish-good')
  @ApiOperation({ summary: 'Resolve released label BOM context for a finding' })
  @ApiOkResponse({ type: PublicFinishGoodFindingContextDto })
  getPublicFinishGoodContext(
    @Query() query: PublicFinishGoodFindingContextQueryDto,
  ) {
    return this.service.getPublicFinishGoodContext(query.labelNumber);
  }

  @Public()
  @Post('public/material')
  submitMaterial(@Body() dto: SubmitMaterialFindingDto) {
    return this.service.submitMaterial(dto);
  }

  @Public()
  @Post('public/finish-good')
  submitFinishGood(@Body() dto: SubmitFinishGoodFindingDto) {
    return this.service.submitFinishGood(dto);
  }

  @Get()
  @Permission('IPCS.MATERIAL_NG_REVIEW')
  list(@Query() query: ProductionFindingQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @Permission('IPCS.MATERIAL_NG_REVIEW')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Delete(':id')
  @Permission('IPCS.MATERIAL_NG_REVIEW')
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectFindingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.delete(id, dto, user.username);
  }

  @Post(':id/approve')
  @Permission('IPCS.MATERIAL_NG_REVIEW')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewFindingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.approve(id, dto, user.username);
  }

  @Post(':id/reject')
  @Permission('IPCS.MATERIAL_NG_REVIEW')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectFindingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.reject(id, dto, user.username);
  }

  @Post(':id/allocations')
  @Permission('IPCS.MATERIAL_NG_REVIEW')
  allocate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateFindingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.allocate(id, dto, user.username);
  }

  @Post(':id/complete')
  @Permission('IPCS.MATERIAL_NG_REVIEW')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewFindingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.complete(id, dto, user.username);
  }
}
