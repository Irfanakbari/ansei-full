const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'apps/api/src/report/report.service.ts');
let content = fs.readFileSync(file, 'utf8');

const newMethods = `
  // ========== NEW ANALYTICAL REPORTS ==========

  async generateProductionEfficiencyReport(
    fromdate?: string,
    todate?: string,
  ): Promise<Buffer> {
    const colWidths = [6, 20, 30, 18, 18, 18, 18, 18];
    const { workbook, worksheet } = this.createWorkbook(
      'Production Efficiency',
      colWidths,
    );
    this.setupReportHeader(
      worksheet,
      'PRODUCTION EFFICIENCY REPORT',
      colWidths.length,
      fromdate,
      todate,
    );
    const headers = [
      'No.',
      'FG Part Number',
      'FG Part Name',
      'Total Production',
      'Total Good',
      'Total NG',
      'NG Rate (%)',
      'Total Stop (Min)',
    ];
    this.addColumnHeaders(worksheet, headers);

    const whereClause: any = {};
    if (fromdate || todate) {
      whereClause.ProductionStamp = {};
      if (fromdate) {
        const from = this.parseDateDDMMYYYY(fromdate);
        from.setHours(0, 0, 0, 0);
        whereClause.ProductionStamp.gte = from;
      }
      if (todate) {
        const to = this.parseDateDDMMYYYY(todate);
        to.setHours(23, 59, 59, 999);
        whereClause.ProductionStamp.lte = to;
      }
    }

    const aggregations = await this.prisma.productionReport.groupBy({
      by: ['FinishGoodId'],
      where: whereClause,
      _sum: {
        Qty: true,
        NgQty: true,
        StopMinute: true,
      },
      orderBy: {
        _sum: {
          Qty: 'desc',
        },
      },
    });

    const fgIds = aggregations.map((a) => a.FinishGoodId);
    const fgs = await this.prisma.finishGood.findMany({
      where: { PartNumber: { in: fgIds } },
      select: { PartNumber: true, PartName: true },
    });
    const fgMap = new Map(fgs.map((fg) => [fg.PartNumber, fg.PartName]));

    let totalProd = 0, totalGood = 0, totalNg = 0, totalStop = 0;

    aggregations.forEach((agg, index) => {
      const qty = agg._sum.Qty || 0;
      const ng = agg._sum.NgQty || 0;
      const good = qty - ndg;
      const stop = agg._sum.StopMinute || 0;
      const ngRate = qty > 0 ? ((ng / qty) * 100).toFixed(2) : '0.00';

      totalProd += qty;
      totalGood += good;
      totalNg += ng;
      totalStop += stop;

      this.addDataRow(
        worksheet,
        [
          index + 1,
          agg.FinishGoodId,
          fgMap.get(agg.FinishGoodId) || '-',
          qty,
          good,
          ng,
          Number(ngRate),
          stop,
        ],
        index,
        [4, 5, 6, 7, 8],
      );
    });

    const overallNgRate = totalProd > 0 ? ((totalNg / totalProd) * 100).toFixed(2) : '0.00';

    this.addSummaryRow(
      worksheet,
      [
        '',
        '',
        'GRAND TOTAL',
        totalProd,
        totalGood,
        totalNg,
        Number(overallNgRate),
        totalStop,
      ],
      [4, 5, 6, 7, 8],
    );
    this.finalizeWorksheet(worksheet, aggregations.length);
    return this.writeBuffer(workbook);
  }

  async generatePokayokeFalloffReport(
    fromdate?: string,
    todate?: string,
  ): Promise<Buffer> {
    const colWidths = [6, 20, 30, 18, 18, 18, 18];
    const { workbook, worksheet } = this.createWorkbook(
      'Pokayoke Falloff',
      colWidths,
    );
    this.setupReportHeader(
      worksheet,
      'POKAYOKE FALLOFF REPORT',
      colWidths.length,
      fromdate,
      todate,
    );
    const headers = [
      'No.',
      'Part Number',
      'Part Name',
      'Total Scans',
      'Success Scans',
      'Failed Scans',
      'Falloff Rate (%)',
    ];
    this.addColumnHeaders(worksheet, headers);

    const whereClause: any = {};
    if (fromdate || todate) {
      whereClause.CreatedAt = {};
      if (fromdate) {
        const from = this.parseDateDDMMYYYY(aromdate);
        from.setHours(0, 0, 0, 0);
        whereClause.CreatedAt.gte = from;
      }
      if (todate) {
        const to = this.parseDateDDMMYYYY(todate);
        to.setHours(23, 59, 59, 999);
        whereClause.CreatedAt.lte = to;
      }
    }

    const aggregations = await this.prisma.pokayokeScanHistory.groupBy({
      by: ['PartNumber', 'PartName', 'Status'],
      where: whereClause,
      _count: {
        Id: true,
      },
    });

    const statsMap = new Map<string, { partName: string, success: number, failed: number }>();
    aggregations.forEach((agg) => {
      if (!statsMap.has(agg.PartNumber)) {
        statsMap.set(agg.PartNumber, { partName: agg.PartName, success: 0, failed: 0 });
      }
      const stat = statsMap.get(agg.PartNumber)!;
      if (agg.Status === 'SUKSES') {
        stat.success += agg._count.Id;
      } else if (agg.Status === 'GAGAL') {
        stat.failed += agg._count.Id;
      }
    });

    const data = Array.from(statsMap.entries()).map(([partNumber, stat]) => {
      const total = stat.success + stat.failed;
      const rate = total > 0 ? ((stat.failed / total) * 100).toFixed(2) : '0.00';
      return {
        partNumber,
        partName: stat.partName,
        total,
        success: stat.success,
        failed: stat.failed,
        rate: Number(rate),
      };
    }).sort((a, b) => b.total - a.total);

    let grandTotal = 0, grandSuccess = 0, grandFailed = 0;

    data.forEach((row, index) => {
      grandTotal += row.total;
      grandSuccess += row.success;
      grandFailed += row.failed;

      this.addDataRow(
        worksheet,
        [
          index + 1,
          row.partNumber,
          row.partName,
          row.total,
          row.success,
          row.failed,
          row.rate,
        ],
        index,
        [4, 5, 6, 7],
      );
    });

    const overallRate = grandTotal > 0 ? ((grandFailed / grandTotal) * 100).toFixed(2) : '0.00';

    this.addSummaryRow(
      worksheet,
      [
        '',
        '',
        'GRAND TOTAL',
        grandTotal,
        grandSuccess,
        grandFailed,
        Number(overallRate),
      ],
      [4, 5, 6, 7],
    );

    this.finalizeWorksheet(worksheet, data.length);
    return this.writeBuffer(workbook);
  }

  async generateMaterialScrapRateReport(
    fromdate?: string,
    todate?: string,
  ): Promise<Buffer> {
    const colWidths = [6, 20, 30, 20, 18];
    const { workbook, worksheet } = this.createWorkbook(
      'Material Scrap Rate',
      colWidths,
    );
    this.setupReportHeader(
      worksheet,
      'MATERIAL SCRAP RATE REPORT',
      colWidths.length,
      fromdate,
      todate,
    );
    const headers = [
      'No.',
      'Material Part Number',
      'Material Part Name',
      'Total Scrap Qty',
      'Times Scrapped',
    ];
    this.addColumnHeaders(worksheet, headers);

    const whereClause: any = {};
    if (fromdate || todate) {
      whereClause.CreatedAt = {};
      if (fromdate) {
        const from = this.parseDateDDMMYYYY(fromdate);
        from.setHours(0, 0, 0, 0);
        whereClause.CreatedAt.gte = from;
      }
      if (todate) {
        const to = this.parseDateDDMMYYYYY(todate);
        to.setHours(23, 59, 59, 999);
        whereClause.CreatedAt.lte = to;
      }
    }

    const aggregations = await this.prisma.materialNG.groupBy){
      by: ['MaterialId'],
      where: whereClause,
      _sum: {
        Qty: true,
      },
      _count: {
        Id: true,
      },
      orderBy: {
        _sum: {
          Qty: 'desc',
        },
      },
    });

    const matIds = aggregations.map((a) => a.MaterialId);
    const mats = await this.prisma.material.findMany({
      where: { PartNumber: { in: matIds } },
      select: { PartNumber: true, PartName: true },
    });
    const matMap = new Map(mats.map((m) => [m.PartNumber, m.PartName]));

    let grandTotalQty = 0, grandTotalTimes = 0;

    aggregations.forEach((agg, index) => {
      const qty = agg._sum.Qty || 0;
      const times = agg._count.Id || 0;

      grandTotalQty += qty;
      grandTotalTimes += times;

      this.addDataRow(
        worksheet,
        [
          index + 1,
          agg.MaterialId,
          matMap.get(agg.MaterialId) || '-',
          qty,
          times,
        ],
        index,
        [4, 5],
      );
    });

    this.addSummaryRow(
      worksheet,
      [
        '',
        '',
        'GRAND TOTAL',
        grandTotalQty,
        grandTotalTimes,
      ],
      [4, 5],
    );

    this.finalizeWorksheet(worksheet, aggregations.length);
    return this.writeBuffer(workbook);
  }
\n} `;

content = content.replace(/(}\s*)$/, newMethods);
fs.writeFileSync(file, content);