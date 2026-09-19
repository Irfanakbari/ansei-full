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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { ApiSuccessEnvelope } from '../interceptors/api-response.swagger';
import {
  IntegrationQueryDto,
  RecoverIntegrationDto,
  IntegrationEventDto,
  IntegrationSummaryDto,
} from './outbox.dto';
import { OutboxService } from './outbox.service';
@ApiTags('Integration Monitor')
@ApiBearerAuth()
@Controller('system-log/integrations')
export class OutboxController {
  constructor(private readonly service: OutboxService) {}
  @Get()
  @Permission('IPCS.SYSTEM_LOG_READ')
  @ApiOperation({
    summary: 'List integration status without delivery payloads',
  })
  @ApiSuccessEnvelope({
    status: 200,
    type: IntegrationEventDto,
    isArray: true,
    paginated: true,
  })
  list(@Query() query: IntegrationQueryDto) {
    return this.service.list(query);
  }
  @Get('summary')
  @Permission('IPCS.SYSTEM_LOG_READ')
  @ApiSuccessEnvelope({ status: 200, type: IntegrationSummaryDto })
  summary() {
    return this.service.summary();
  }
  @Post(':id/recover')
  @Permission('IPCS.INTEGRATION_RECOVER')
  @ApiOperation({
    summary:
      'Reconcile or retry a failed integration with an immutable reason and command identity',
  })
  @ApiSuccessEnvelope({ status: 201, type: IntegrationEventDto })
  recover(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecoverIntegrationDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.recover(id, dto, user.username);
  }
}
