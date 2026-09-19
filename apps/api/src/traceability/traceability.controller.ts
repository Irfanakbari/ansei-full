import { ApiSuccessEnvelope } from '../common/interceptors/api-response.swagger';
import {
  TraceSearchResponseDto,
  TraceDetailResponseDto,
  TraceEventResponseDto,
  SnapshotResponseDto,
} from './phase-one-response.dto';
/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '../auth/decorators/permission.decorator';
import { TraceabilityService } from './traceability.service';
import { TraceQueryDto } from './traceability.dto';
@ApiTags('Traceability')
@Controller('traceability')
@Permission('IPCS.TRACEABILITY_READ')
export class TraceabilityController {
  constructor(private readonly service: TraceabilityService) {}
  @ApiSuccessEnvelope({
    status: 200,
    type: TraceSearchResponseDto,
    isArray: true,
    paginated: true,
  })
  @Get('search')
  search(@Query() q: TraceQueryDto) {
    return this.service.search(q);
  }
  @ApiSuccessEnvelope({ status: 200, type: TraceDetailResponseDto })
  @Get('forecasts/:poId')
  get(@Param('poId') id: string) {
    return this.service.get(id);
  }
  @ApiSuccessEnvelope({
    status: 200,
    type: TraceEventResponseDto,
    isArray: true,
    paginated: true,
  })
  @Get('forecasts/:poId/events')
  events(@Param('poId') id: string, @Query() q: TraceQueryDto) {
    return this.service.events(id, q);
  }
}
@ApiTags('Production BOM snapshots')
@Controller('production/production-release')
export class BomSnapshotsController {
  constructor(private readonly service: TraceabilityService) {}
  @ApiSuccessEnvelope({ status: 200, type: SnapshotResponseDto, isArray: true })
  @Get(':id/bom-snapshots')
  @Permission(
    'IPCS.PRODUCTION_RELEASE_READ',
    'IPCS.TRACEABILITY_READ',
    'IPCS.MATERIAL_NG_CREATE',
  )
  snapshots(@Param('id') id: string) {
    return this.service.snapshots(id);
  }
}
