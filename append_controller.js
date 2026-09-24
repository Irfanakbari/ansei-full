const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/api/src/report/report.controller.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Add imports
content = content.replace(
  "InventoryLedgerReportQueryDto,\\r?\\n} from './dto';",
  "InventoryLedgerReportQueryDto,\n  ProductionEfficiencyReportQueryDto,\n  PokayokeFalloffReportQueryDto,\n  MaterialScrapRateReportQueryDto,\n} from './dto';"
);

// Add methods
const methods = \
  // ========== PRODUCTION EFFICIENCY REPORT ==========

  @Get('production-efficiency')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Production Efficiency Report',
    description:
      'Downloads Excel file containing production bottleneck and efficiency data with date range filter',
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
  async generateProductionEfficiencyReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: ProductionEfficiencyReportQueryDto,
  ) {
    const buffer = await this.reportService.generateProductionEfficiencyReport(
      query.fromdate,
      query.todate,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': \\\ttachment; filename=Production_Efficiency_Report_\\\.xlsx\\\,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ========== POKAYOKE FALLOFF REPORT ==========

  @Get('pokayoke-falloff')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Pokayoke Falloff Report',
    description:
      'Downloads Excel file containing pokayoke scan falloff rate data with date range filter',
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
  async generatePokayokeFalloffReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: PokayokeFalloffReportQueryDto,
  ) {
    const buffer = await this.reportService.generatePokayokeFalloffReport(
      query.fromdate,
      query.todate,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': \\\ttachment; filename=Pokayoke_Falloff_Report_\\\.xlsx\\\,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ========== MATERIAL SCRAP RATE REPORT ==========

  @Get('material-scrap-rate')
  @Permission('IPCS.REPORT_READ')
  @ApiOperation({
    summary: 'Generate Material Scrap Rate Report',
    description:
      'Downloads Excel file containing material scrap rate data with date range filter',
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
  async generateMaterialScrapRateReport(
    @CurrentUser() _user: ICurrentUser,
    @Res() res: Response,
    @Query() query: MaterialScrapRateReportQueryDto,
  ) {
    const buffer = await this.reportService.generateMaterialScrapRateReport(
      query.fromdate,
      query.todate,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': \\\ttachment; filename=Material_Scrap_Rate_Report_\\\.xlsx\\\,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }
}
\;

content = content.replace(/}(\s*)$/, methods);
fs.writeFileSync(filePath, content, 'utf8');
