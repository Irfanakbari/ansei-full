import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportService } from './report.service';
import {
  DateRangeQueryDto,
  StockMaterialReportQueryDto,
  IncomingWarehouseReportQueryDto,
  IncomingRackReportQueryDto,
  TransferMaterialReportQueryDto,
  ProductionReleaseReportQueryDto,
  PokayokeScanReportQueryDto,
  DeliveryHistoryReportQueryDto,
  ProductionReportQueryDto,
  ShoppingHistoryReportQueryDto,
  MaterialNgReportQueryDto,
  InventoryLedgerReportQueryDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permission } from '../auth/decorators/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../auth/interfaces/current-user.interface';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  // ========== STOCK MATERIAL REPORT ==========

  @Get('stock-material')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Stock Material Report (Active Materials)',
    description:
      'Downloads Excel file containing all active materials with stock information',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async generateStockMaterialReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
  ) {
    const buffer = await this.reportService.generateStockMaterialReport();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Stock_Material_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ========== INCOMING WAREHOUSE REPORT ==========

  @Get('incoming-warehouse')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Incoming Warehouse Report',
    description:
      'Downloads Excel file containing incoming warehouse data with date range filter',
  })
  @ApiQuery({
    name: 'fromdate',
    required: false,
    description: 'Start date in DDMMYYYY format (e.g., 01072026)',
  })
  @ApiQuery({
    name: 'todate',
    required: false,
    description: 'End date in DDMMYYYY format (e.g., 31072026)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async generateIncomingWarehouseReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: IncomingWarehouseReportQueryDto,
  ) {
    const buffer = await this.reportService.generateIncomingWarehouseReport(
      query.fromdate,
      query.todate,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Incoming_Warehouse_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ========== INCOMING RACK REPORT ==========

  @Get('incoming-rack')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Incoming Rack Report',
    description:
      'Downloads Excel file containing transfer to rack data with date range filter',
  })
  @ApiQuery({
    name: 'fromdate',
    required: false,
    description: 'Start date in DDMMYYYY format (e.g., 01072026)',
  })
  @ApiQuery({
    name: 'todate',
    required: false,
    description: 'End date in DDMMYYYY format (e.g., 31072026)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async generateIncomingRackReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: IncomingRackReportQueryDto,
  ) {
    const buffer = await this.reportService.generateIncomingRackReport(
      query.fromdate,
      query.todate,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Incoming_Rack_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ========== TRANSFER MATERIAL REPORT ==========

  @Get('transfer-material')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Transfer Material Report (Material Delivery Note)',
    description:
      'Downloads Excel file containing material delivery notes with date range filter',
  })
  @ApiQuery({
    name: 'fromdate',
    required: false,
    description: 'Start date in DDMMYYYY format (e.g., 01072026)',
  })
  @ApiQuery({
    name: 'todate',
    required: false,
    description: 'End date in DDMMYYYY format (e.g., 31072026)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async generateTransferMaterialReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: TransferMaterialReportQueryDto,
  ) {
    const buffer = await this.reportService.generateTransferMaterialReport(
      query.fromdate,
      query.todate,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Transfer_Material_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ========== PRODUCTION RELEASE REPORT ==========

  @Get('production-release')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Production Release Resume Report',
    description:
      'Downloads Excel file containing production release data with date range filter',
  })
  @ApiQuery({
    name: 'fromdate',
    required: false,
    description: 'Start date in DDMMYYYY format (e.g., 01072026)',
  })
  @ApiQuery({
    name: 'todate',
    required: false,
    description: 'End date in DDMMYYYY format (e.g., 31072026)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async generateProductionReleaseReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: ProductionReleaseReportQueryDto,
  ) {
    const buffer = await this.reportService.generateProductionReleaseReport(
      query.fromdate,
      query.todate,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Production_Release_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ========== POKAYOKE SCAN REPORT ==========

  @Get('pokayoke-scan')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Pokayoke Scan History Report',
    description:
      'Downloads Excel file containing pokayoke scan history with date range filter',
  })
  @ApiQuery({
    name: 'fromdate',
    required: false,
    description: 'Start date in DDMMYYYY format (e.g., 01072026)',
  })
  @ApiQuery({
    name: 'todate',
    required: false,
    description: 'End date in DDMMYYYY format (e.g., 31072026)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async generatePokayokeScanReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: PokayokeScanReportQueryDto,
  ) {
    const buffer = await this.reportService.generatePokayokeScanReport(
      query.fromdate,
      query.todate,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Pokayoke_Scan_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ========== DELIVERY HISTORY REPORT ==========

  @Get('delivery-history')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Delivery History Report',
    description:
      'Downloads Excel file containing delivery history with date range filter',
  })
  @ApiQuery({
    name: 'fromdate',
    required: false,
    description: 'Start date in DDMMYYYY format (e.g., 01072026)',
  })
  @ApiQuery({
    name: 'todate',
    required: false,
    description: 'End date in DDMMYYYY format (e.g., 31072026)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async generateDeliveryHistoryReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: DeliveryHistoryReportQueryDto,
  ) {
    const buffer = await this.reportService.generateDeliveryHistoryReport(
      query.fromdate,
      query.todate,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Delivery_History_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ========== PRODUCTION REPORT ==========

  @Get('production-report')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Production Report',
    description:
      'Downloads Excel file containing production report data with date range filter',
  })
  @ApiQuery({
    name: 'fromdate',
    required: false,
    description: 'Start date in DDMMYYYY format (e.g., 01072026)',
  })
  @ApiQuery({
    name: 'todate',
    required: false,
    description: 'End date in DDMMYYYY format (e.g., 31072026)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async generateProductionReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: ProductionReportQueryDto,
  ) {
    const buffer = await this.reportService.generateProductionReport(
      query.fromdate,
      query.todate,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Production_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ========== SHOPPING HISTORY REPORT ==========

  @Get('shopping-history')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Shopping History Report',
    description:
      'Downloads Excel file containing shopping/picking history with date range filter',
  })
  @ApiQuery({
    name: 'fromdate',
    required: false,
    description: 'Start date in DDMMYYYY format (e.g., 01072026)',
  })
  @ApiQuery({
    name: 'todate',
    required: false,
    description: 'End date in DDMMYYYY format (e.g., 31072026)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async generateShoppingHistoryReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: ShoppingHistoryReportQueryDto,
  ) {
    const buffer = await this.reportService.generateShoppingHistoryReport(
      query.fromdate,
      query.todate,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Shopping_History_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ========== MATERIAL NG REPORT ==========

  @Get('material-ng')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Material NG Report',
    description:
      'Downloads Excel file containing material NG (reject) data with date range filter',
  })
  @ApiQuery({
    name: 'fromdate',
    required: false,
    description: 'Start date in DDMMYYYY format (e.g., 01072026)',
  })
  @ApiQuery({
    name: 'todate',
    required: false,
    description: 'End date in DDMMYYYY format (e.g., 31072026)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async generateMaterialNgReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: MaterialNgReportQueryDto,
  ) {
    const buffer = await this.reportService.generateMaterialNgReport(
      query.fromdate,
      query.todate,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Material_NG_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ========== INVENTORY LEDGER REPORT ==========

  @Get('inventory-ledger')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Inventory Ledger Report',
    description:
      'Downloads Excel file containing inventory ledger data with date range filter',
  })
  @ApiQuery({
    name: 'fromdate',
    required: false,
    description: 'Start date in DDMMYYYY format (e.g., 01072026)',
  })
  @ApiQuery({
    name: 'todate',
    required: false,
    description: 'End date in DDMMYYYY format (e.g., 31072026)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by item category (MATERIAL or FINISH_GOOD)',
  })
  @ApiQuery({
    name: 'location',
    required: false,
    description: 'Filter by location (WAREHOUSE, RACK, FINISH_GOOD_AREA)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async generateInventoryLedgerReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: InventoryLedgerReportQueryDto,
  ) {
    const buffer = await this.reportService.generateInventoryLedgerReport(
      query.fromdate,
      query.todate,
      query.category,
      query.location,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=Inventory_Ledger_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }
}
