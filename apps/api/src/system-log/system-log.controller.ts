import { Controller, Get, Param, Query, Post, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ActionAuditDto, ActionAuditQueryDto } from './dto/action-audit.dto';
import { SystemLogService } from './system-log.service';
import { SystemLogQueryDto } from './dto/system-log-query.dto';
import { InventoryLedgerQueryDto } from './dto/inventory-ledger-query.dto';
import { InventoryLedgerExportDto } from './dto/inventory-ledger-export.dto';
import {
  LogProcessDetailResponseDto,
  LogProcessDto,
} from './dto/system-log-response.dto';
import { InventoryLedgerDto } from './dto/inventory-ledger-response.dto';
import { Permission } from '../auth/decorators/permission.decorator';
import { ApiSuccessEnvelope } from '../common/interceptors/api-response.swagger';
import type {
  ApiResult,
  PaginationMeta,
} from '../common/interceptors/api-response.interface';

/**
 * Irfan Akbari Vuteq Indonesia
 */
@ApiTags('System Log')
@Controller('system-log')
export class SystemLogController {
  constructor(private readonly systemLogService: SystemLogService) {}

  @Get()
  @Permission('IPCS.SYSTEM_LOG_READ')
  @ApiOperation({
    summary:
      'Get all process logs (paginated, newest first, default 50 per page)',
  })
  @ApiSuccessEnvelope({
    status: 200,
    type: LogProcessDto,
    isArray: true,
    paginated: true,
  })
  async findAll(
    @Query() query: SystemLogQueryDto,
  ): Promise<ApiResult<LogProcessDto[], PaginationMeta>> {
    return this.systemLogService.findAll(query);
  }

  @Get('inventory-ledger')
  @Permission('IPCS.SYSTEM_LOG_READ')
  @ApiOperation({
    summary: 'Get all inventory ledger records (paginated, newest first)',
  })
  @ApiSuccessEnvelope({
    status: 200,
    type: InventoryLedgerDto,
    isArray: true,
    paginated: true,
  })
  async findAllInventoryLedger(
    @Query() query: InventoryLedgerQueryDto,
  ): Promise<ApiResult<InventoryLedgerDto[], PaginationMeta>> {
    return this.systemLogService.findAllInventoryLedger(query);
  }

  @Post('inventory-ledger/export')
  @Permission('IPCS.SYSTEM_LOG_READ')
  @ApiOperation({
    summary: 'Export inventory ledger to Excel with date range filter',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async exportInventoryLedger(
    @Query() query: InventoryLedgerExportDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } =
      await this.systemLogService.exportInventoryLedgerToExcel(query);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.end(buffer);
  }

  @Get('actions')
  @Permission('IPCS.SYSTEM_LOG_READ')
  @ApiOperation({
    summary: 'Read immutable action evidence and transaction replays',
  })
  @ApiSuccessEnvelope({
    status: 200,
    type: ActionAuditDto,
    isArray: true,
    paginated: true,
  })
  actions(@Query() query: ActionAuditQueryDto) {
    return this.systemLogService.actions(query);
  }

  @Get(':id')
  @Permission('IPCS.SYSTEM_LOG_READ')
  @ApiOperation({
    summary: 'Get one process log by ProcessId (includes all detail messages)',
  })
  @ApiSuccessEnvelope({ status: 200, type: LogProcessDetailResponseDto })
  async findOne(@Param('id') id: string): Promise<LogProcessDetailResponseDto> {
    return this.systemLogService.findOne(id);
  }
}
