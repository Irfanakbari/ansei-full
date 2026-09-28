import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Permission } from '../../auth/decorators/permission.decorator';
import { PrintAgentRoute } from '../../auth/decorators/print-agent-route.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import {
  CreatePrintAgentDto,
  EnrollPrintAgentDto,
  FailPrintJobDto,
  HeartbeatDto,
  IssueEnrollmentDto,
  LeasePrintJobDto,
  PrintJobLeaseDto,
  SyncPrinterProfileDto,
} from './dto/print-agent.dto';
import type { PrintAgentRequest } from './print-agent-auth.guard';
import { PrintAgentService } from './print-agent.service';

@ApiTags('Print agents')
@Controller('settings/print-agents')
export class PrintAgentController {
  constructor(private readonly service: PrintAgentService) {}

  @Post()
  @ApiBearerAuth()
  @Permission('IPCS.MASTER_CREATE')
  create(@Body() dto: CreatePrintAgentDto, @CurrentUser() user: ICurrentUser) {
    return this.service.createAgent(dto, user.username);
  }

  @Post(':id/enrollments')
  @ApiBearerAuth()
  @Permission('IPCS.MASTER_CREATE')
  async issue(
    @Param('id') id: string,
    @Body() dto: IssueEnrollmentDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    await this.service.requireAgent(id);
    return this.service.issueEnrollment(
      id,
      dto.expiresInMinutes ?? 15,
      user.username,
    );
  }

  @Post('enroll')
  @Public()
  enroll(@Body() dto: EnrollPrintAgentDto) {
    return this.service.enroll(dto);
  }

  @Post('runtime/heartbeat')
  @PrintAgentRoute()
  heartbeat(@Req() request: PrintAgentRequest, @Body() dto: HeartbeatDto) {
    return this.service.heartbeat(request.printAgent!.id, dto);
  }

  @Post('runtime/profiles')
  @PrintAgentRoute()
  profile(
    @Req() request: PrintAgentRequest,
    @Body() dto: SyncPrinterProfileDto,
  ) {
    return this.service.syncProfile(request.printAgent!.id, dto);
  }

  @Post('runtime/jobs/lease')
  @PrintAgentRoute()
  lease(@Req() request: PrintAgentRequest, @Body() dto: LeasePrintJobDto) {
    return this.service.lease(request.printAgent!.id, dto);
  }

  @Post('runtime/jobs/:id/renew')
  @PrintAgentRoute()
  renew(
    @Req() request: PrintAgentRequest,
    @Param('id') id: string,
    @Body() dto: PrintJobLeaseDto,
  ) {
    return this.service.renew(request.printAgent!.id, id, dto);
  }

  @Post('runtime/jobs/:id/downloaded')
  @PrintAgentRoute()
  downloaded(
    @Req() request: PrintAgentRequest,
    @Param('id') id: string,
    @Body() dto: PrintJobLeaseDto,
  ) {
    return this.service.downloaded(request.printAgent!.id, id, dto);
  }

  @Post('runtime/jobs/:id/spooling')
  @PrintAgentRoute()
  spooling(
    @Req() request: PrintAgentRequest,
    @Param('id') id: string,
    @Body() dto: PrintJobLeaseDto,
  ) {
    return this.service.spooling(request.printAgent!.id, id, dto);
  }

  @Post('runtime/jobs/:id/succeeded')
  @PrintAgentRoute()
  succeeded(
    @Req() request: PrintAgentRequest,
    @Param('id') id: string,
    @Body() dto: PrintJobLeaseDto,
  ) {
    return this.service.succeeded(request.printAgent!.id, id, dto);
  }

  @Post('runtime/jobs/:id/failed')
  @PrintAgentRoute()
  failed(
    @Req() request: PrintAgentRequest,
    @Param('id') id: string,
    @Body() dto: FailPrintJobDto,
  ) {
    return this.service.failed(request.printAgent!.id, id, dto);
  }
}
