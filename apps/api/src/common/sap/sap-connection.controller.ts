/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import {
  Body,
  ForbiddenException,
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
import { SapConnectionService } from './sap-connection.service';
import {
  SapActionDto,
  SapMappingDto,
  SapQueryDto,
  SapAutoSalesDto,
  SapSettingsDto,
} from './sap-connection.dto';

@ApiTags('SAP Connection')
@ApiBearerAuth()
@Controller('sap-connection')
export class SapConnectionController {
  constructor(private readonly service: SapConnectionService) {}
  @Get('overview')
  @Permission('IPCS.SYSTEM_LOG_READ')
  @ApiOperation({
    summary: 'Read local SAP integration health without a SAP request',
  })
  overview() {
    return this.service.overview();
  }
  @Post('settings')
  @Permission('IPCS.SAP_MAPPING_UPDATE', 'IPCS.INTEGRATION_RECOVER')
  settings(@Body() dto: SapSettingsDto, @CurrentUser() user: ICurrentUser) {
    const superUser =
      user.globalRoles?.includes('SUPER_ADMINISTRATOR') ||
      user.roleName === 'SUPER' ||
      user.permissions.includes('SUPER');
    if (
      !superUser &&
      !['IPCS.SAP_MAPPING_UPDATE', 'IPCS.INTEGRATION_RECOVER'].every(
        (permission) => user.permissions.includes(permission),
      )
    )
      throw new ForbiddenException(
        'Mapping and recovery permissions are required to change SAP settings.',
      );
    return this.service.saveSettings(dto, user.username);
  }
  @Get('transactions')
  @Permission('IPCS.SYSTEM_LOG_READ')
  transactions(@Query() query: SapQueryDto) {
    return this.service.transactions(query);
  }
  @Get('transactions/:id')
  @Permission('IPCS.SYSTEM_LOG_READ')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id);
  }
  @Get('external-documents')
  @Permission('IPCS.SYSTEM_LOG_READ')
  external(@Query() query: SapQueryDto) {
    return this.service.externalDocuments(query);
  }
  @Get('stock')
  @Permission('IPCS.SYSTEM_LOG_READ')
  stock(@Query() query: SapQueryDto) {
    return this.service.stock(query);
  }
  @Get('mappings')
  @Permission('IPCS.SYSTEM_LOG_READ')
  mappings(@Query() query: SapQueryDto) {
    return this.service.mappings(query);
  }
  @Post('mappings')
  @Permission('IPCS.SAP_MAPPING_UPDATE')
  map(@Body() dto: SapMappingDto, @CurrentUser() user: ICurrentUser) {
    return this.service.map(dto, user.username);
  }
  @Post('automatic-sales')
  @Permission('IPCS.SAP_MAPPING_UPDATE')
  automaticSales(
    @Body() dto: SapAutoSalesDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.automaticSales(dto, user.username);
  }
  @Post('check')
  @Permission('IPCS.INTEGRATION_RECOVER')
  check(@CurrentUser() user: ICurrentUser) {
    return this.service.check(user.username);
  }
  @Post('refresh-stock')
  @Permission('IPCS.INTEGRATION_RECOVER')
  refresh(@CurrentUser() user: ICurrentUser) {
    return this.service.refresh(user.username);
  }
  @Post('transactions/:id/retry')
  @Permission('IPCS.INTEGRATION_RECOVER')
  retry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SapActionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.retry(id, dto, user.username);
  }
  @Post('transactions/:id/cancel-counting')
  @Permission('IPCS.INTEGRATION_RECOVER')
  cancelCounting(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SapActionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.cancelCounting(id, dto, user.username);
  }
  @Post('transactions/:id/reconcile')
  @Permission('IPCS.INTEGRATION_RECOVER')
  reconcile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.reconcile(id, user.username);
  }
}
