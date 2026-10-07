/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import {
  AssemblySessionEntity,
  AssemblyLabelEntity,
  AssemblyCreateOptionsEntity,
  AssemblyOperatorEntity,
  AssemblyProgressEntity,
} from './entities/assembly.entity';
import { AssemblyService } from './assembly.service';
import {
  AssemblyOperatorDto,
  AssemblyQueryDto,
  CancelAssemblyDto,
  CompleteAssemblyDto,
  CompleteInternalAssemblyDto,
  StartAssemblyDto,
} from './dto/assembly.dto';

@ApiTags('Assembly')
@ApiBearerAuth()
@Controller('production/assembly')
export class AssemblyController {
  constructor(private readonly service: AssemblyService) {}
  @Get('create-options')
  @Permission('IPCS.ASSEMBLY_CREATE')
  @ApiOkResponse({ type: AssemblyCreateOptionsEntity })
  @ApiOperation({
    summary:
      'Ready labels (up to 100; search by labelNumber) and available active manpower',
  })
  createOptions(@Query() query: AssemblyQueryDto) {
    return this.service.createOptions(query);
  }

  @ApiOkResponse({ type: AssemblyProgressEntity })
  @Get('progress')
  @Permission('IPCS.ASSEMBLY_READ')
  progress(@Query() query: AssemblyQueryDto) {
    return this.service.progress(query);
  }

  @ApiOkResponse({
    type: AssemblySessionEntity,
    isArray: true,
    description:
      'Paginated sessions; standard success envelope with pagination meta',
  })
  @Get('sessions')
  @Permission('IPCS.ASSEMBLY_READ')
  @ApiOperation({ summary: 'List assembly sessions and cancellation history' })
  sessions(@Query() query: AssemblyQueryDto) {
    return this.service.findAll(query);
  }
  @Get('labels/:labelNumber')
  @Permission('IPCS.ASSEMBLY_READ')
  inspect(@Param('labelNumber') label: string) {
    return this.service.inspect(label);
  }
  @ApiCreatedResponse({ type: AssemblySessionEntity })
  @Post('start')
  @Permission('IPCS.ASSEMBLY_CREATE')
  start(@Body() dto: StartAssemblyDto, @CurrentUser() user: ICurrentUser) {
    return this.service.start(dto, user.username, 'INTERNAL');
  }
  @ApiOkResponse({ type: AssemblySessionEntity })
  @Post(':id/complete')
  @HttpCode(200)
  @Permission('IPCS.ASSEMBLY_CREATE')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteInternalAssemblyDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.complete(id, dto, user.username);
  }
  @ApiOkResponse({ type: AssemblySessionEntity })
  @Post(':id/cancel')
  @HttpCode(200)
  @Permission('IPCS.ASSEMBLY_CANCEL')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAssemblyDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.cancel(id, dto.reason, user.username);
  }
}

@ApiTags('Display Assembly')
@Controller('display/assembly')
@Throttle({ default: { limit: 120, ttl: 60000 } })
export class DisplayAssemblyController {
  constructor(private readonly service: AssemblyService) {}
  @Get('ready-labels')
  @Public()
  @ApiOperation({
    summary: 'Up to 100 ready assembly labels; search by labelNumber',
  })
  @ApiOkResponse({ type: AssemblyLabelEntity, isArray: true })
  readyLabels(@Query() query: AssemblyQueryDto) {
    return this.service.readyLabels(query);
  }
  @ApiOkResponse({ type: AssemblyOperatorEntity })
  @Get('operator')
  @Public()
  operator(@Query() query: AssemblyOperatorDto) {
    return this.service.operatorSession(query.manPowerNik);
  }
  @Get('labels/:labelNumber')
  @Public()
  inspect(@Param('labelNumber') label: string) {
    return this.service.inspect(label);
  }
  @ApiCreatedResponse({ type: AssemblySessionEntity })
  @Post('start')
  @Public()
  start(@Body() dto: StartAssemblyDto) {
    return this.service.start(dto, 'DISPLAY', 'DISPLAY');
  }
  @ApiOkResponse({ type: AssemblySessionEntity })
  @Post(':id/complete')
  @HttpCode(200)
  @Public()
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteAssemblyDto,
  ) {
    return this.service.complete(id, dto, 'DISPLAY');
  }
}
