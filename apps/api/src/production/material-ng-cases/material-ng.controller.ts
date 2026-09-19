import { ApiSuccessEnvelope } from '../../common/interceptors/api-response.swagger';
import {
  NgCaseResponseDto,
  TraceSearchResponseDto,
} from '../../traceability/phase-one-response.dto';
/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { MaterialNgService } from './material-ng.service';
import {
  CloseNgDto,
  CreateNgCaseDto,
  IssueNgDto,
  NgQueryDto,
} from './material-ng.dto';
@ApiTags('Material NG')
@Controller('production/material-ng-cases')
export class MaterialNgController {
  constructor(private readonly service: MaterialNgService) {}
  @Get()
  @ApiSuccessEnvelope({
    status: 200,
    type: NgCaseResponseDto,
    isArray: true,
    paginated: true,
  })
  @Permission('IPCS.MATERIAL_NG_READ')
  list(@Query() q: NgQueryDto) {
    return this.service.list(q);
  }
  @Post()
  @ApiSuccessEnvelope({ status: 201, type: NgCaseResponseDto })
  @Permission('IPCS.MATERIAL_NG_CREATE')
  create(@Body() dto: CreateNgCaseDto, @CurrentUser() user: ICurrentUser) {
    return this.service.create(dto, user.username);
  }
  @Get('candidates')
  @ApiSuccessEnvelope({
    status: 200,
    type: TraceSearchResponseDto,
    isArray: true,
    paginated: true,
  })
  @Permission('IPCS.MATERIAL_NG_READ', 'IPCS.MATERIAL_NG_CREATE')
  candidates(@Query() q: NgQueryDto) {
    return this.service.candidates(q);
  }
  @Get(':id')
  @ApiSuccessEnvelope({ status: 200, type: NgCaseResponseDto })
  @Permission('IPCS.MATERIAL_NG_READ')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }
  @Post(':id/issue')
  @ApiSuccessEnvelope({ status: 201, type: NgCaseResponseDto })
  @Permission('IPCS.MATERIAL_NG_ISSUE')
  issue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueNgDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.issue(id, dto, user.username);
  }
  @Post(':id/close')
  @ApiSuccessEnvelope({ status: 201, type: NgCaseResponseDto })
  @Permission('IPCS.MATERIAL_NG_CLOSE')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseNgDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.close(id, dto, user.username);
  }
}
