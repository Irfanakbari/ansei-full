/* By Irfan Akbari Vuteq Indonesia - 2026-10-10 */
import { Workbook } from 'exceljs';
import { validate } from 'class-validator';
import {
  createDeliveryMonthlyWorkbook,
  type MonthlyOrder,
  type MonthlyDelivery,
  type MonthlyReceipt,
} from './delivery-monthly.workbook';
import { ReportService } from './report.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogProcessService } from '../common/log-process/log-process.service';
import { DeliveryMonthlyReportQueryDto } from './dto';
import { ReportController } from './report.controller';
import { InventoryReconciliationService } from './inventory-reconciliation.service';
import type { Response } from 'express';
import type { ICurrentUser } from '../auth/interfaces/current-user.interface';

const order: MonthlyOrder = {
  PoId: 'demand-1',
  SourceType: 'PO',
  VendorCode: 'V',
  VendorName: 'Vendor',
  ReceivingArea: '3R05',
  DeliveryDate: new Date('2026-09-01T00:00:00Z'),
  DeliveryPeriod: 1,
  Classification: 'C',
  PoNumber: 'PO-1',
  Item: 1,
  FinishGoodId: '5715B130',
  Qty: 100,
  Notes: null,
  PartData: { PartName: 'Test part' },
};
const delivery = (
  Qty: number,
  date: string,
  PoData = order,
): MonthlyDelivery => ({
  Qty,
  CreatedAt: new Date(date),
  ProductionDemandId: PoData.PoId,
  PoData,
});
const receipt = (approvedAt = '2026-09-01T02:00:00Z'): MonthlyReceipt => ({
  PoId: 'PO-INCOMING-1',
  ApprovedAt: new Date(approvedAt),
  SupplierName: 'PT Supplier',
  ReceivedBy: 'warehouse-user',
  IncomingMaterial: [
    {
      Qty: 42,
      MaterialData: { PartNumber: 'MAT-001', PartName: 'Material receipt' },
    },
  ],
});
const result = (value: unknown) =>
  typeof value === 'object' && value !== null && 'result' in value
    ? value.result
    : value;

describe('Delivery Report (Monthly)', () => {
  it('uses Forecast quantity on DeliveryDate only after cumulative delivery completes the order', async () => {
    const deliveries = [
      delivery(20, '2026-08-31T17:00:00Z'),
      delivery(30, '2026-09-01T05:00:00Z'),
      delivery(50, '2026-09-30T16:59:59Z'),
    ];
    const source = createDeliveryMonthlyWorkbook(
      '2026-09',
      [order],
      deliveries,
      [receipt()],
    );
    const workbook = new Workbook();
    await workbook.xlsx.load(await source.xlsx.writeBuffer());
    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      'Forecast',
      'Delivered',
      'Received',
    ]);
    const forecast = workbook.getWorksheet('Forecast')!;
    const sheet = workbook.getWorksheet('Delivered')!;
    expect(forecast.getCell('M6').value).toBe(100);
    expect(forecast.getCell('N6').value).toEqual(
      new Date('2026-09-30T00:00:00Z'),
    );
    expect(forecast.getCell('O6').value).toContain('Delivered 100/100');
    expect(sheet.getCell('B2').value).toBe('ACTUAL DELIVERED DATE');
    expect(sheet.getCell('B3').value).toBe('SEPTEMBER 2026');
    expect(sheet.getCell('G7').value).toBe(100);
    expect(sheet.getCell('AJ7').value).toBe(0);
    expect(result(sheet.getCell('AK7').value)).toBe(100);
    expect(result(sheet.getCell('G53').value)).toBe(100);
    expect(result(sheet.getCell('G126').value)).toBe(100);
    expect(sheet.getCell('G126').formula).toBe('G7+G9+G58+G60+G61');
    expect(sheet.getCell('B5').fill).toMatchObject({
      fgColor: { argb: 'FFFFFF99' },
    });
    expect(sheet.getCell('K7').fill).toMatchObject({
      fgColor: { argb: 'FFF2DCDB' },
    });
    expect(sheet.getCell('L7').fill).toMatchObject({
      fgColor: { argb: 'FFDAEEF3' },
    });
    expect(sheet.getRow(7).height).toBe(28.5);
    expect(sheet.views[0]).toMatchObject({ xSplit: 6, ySplit: 5 });
    const received = workbook.getWorksheet('Received')!;
    expect(received.getCell('B2').value).toBe('ACTUAL PARTS RECEIVED');
    expect(received.getCell('D6').value).toBe('PO-INCOMING-1');
    expect(received.getCell('F6').value).toBe('MAT-001');
    expect(received.getCell('H6').value).toBe(42);
    expect(result(received.getCell('H7').value)).toBe(42);
  });

  it('keeps only material lines in Received and puts the Incoming PO Number in Hashtag', () => {
    const initialReceipt = receipt();
    const workbook = createDeliveryMonthlyWorkbook(
      '2026-09',
      [],
      [],
      [
        {
          ...initialReceipt,
          IncomingMaterial: [
            ...initialReceipt.IncomingMaterial,
            { Qty: 7, MaterialData: null },
          ],
        },
      ],
    );
    const received = workbook.getWorksheet('Received')!;
    expect(received.getCell('D6').value).toBe('PO-INCOMING-1');
    expect(received.getCell('H6').value).toBe(42);
    expect(received.getRow(7).getCell(2).value).toBe('Total');
  });

  it.each([
    ['2026-02', 28],
    ['2028-02', 29],
    ['2026-12', 31],
  ])('uses the calendar day count for %s', (month, days) => {
    const workbook = createDeliveryMonthlyWorkbook(month, [], []);
    const sheet = workbook.getWorksheet('Delivered')!;
    expect(sheet.getCell(5, Number(days) + 7).value).toBe('Total');
    expect(sheet.getCell(7, Number(days) + 7).result).toBe(0);
    expect(sheet.getColumn(Number(days) + 8).hidden).toBe(true);
  });

  it('separates the same part across destinations and retains unknown parts and NON-PO deliveries', () => {
    const regular = { ...order, FinishGoodId: '65622W000P', Qty: 1 };
    const qx = { ...regular, PoId: 'qx', ReceivingArea: '3R53', Qty: 2 };
    const kd = { ...regular, PoId: 'kd', ReceivingArea: '7R06', Qty: 3 };
    const unknown = {
      ...order,
      PoId: 'np',
      SourceType: 'NON_PO',
      FinishGoodId: 'NEW-PART',
      ReceivingArea: 'NEW-AREA',
      Qty: 4,
    };
    const deliveries = [
      delivery(1, '2026-09-01T00:00:00Z', regular),
      delivery(2, '2026-09-01T00:00:00Z', qx),
      delivery(3, '2026-09-01T00:00:00Z', kd),
      delivery(4, '2026-09-01T00:00:00Z', unknown),
    ];
    const workbook = createDeliveryMonthlyWorkbook(
      '2026-09',
      [regular, qx, kd, unknown],
      deliveries,
    );
    const sheet = workbook.getWorksheet('Delivered')!;
    expect(sheet.getCell('G14').value).toBe(1);
    expect(sheet.getCell('G20').value).toBe(2);
    expect(sheet.getCell('G66').value).toBe(3);
    expect(sheet.getCell('E141').value).toBe('NEW-PART');
    expect(sheet.getCell('D141').value).toBe('UNMAPPED (NEW-AREA)');
    expect(sheet.getCell('G141').value).toBe(4);
    expect(workbook.getWorksheet('Forecast')!.getCell('O9').value).toContain(
      'NON-PO: np',
    );
  });

  it('does not count partial orders and ignores the actual shipment date when placing completed Forecast quantity', () => {
    const deliveries = [
      delivery(50, '2026-08-31T16:59:59Z'),
      delivery(50, '2026-09-01T00:00:00Z'),
      delivery(100, '2026-09-30T17:00:00Z'),
    ];
    const partialWorkbook = createDeliveryMonthlyWorkbook(
      '2026-09',
      [order],
      deliveries.slice(0, 1),
    );
    expect(
      partialWorkbook.getWorksheet('Delivered')!.getCell('AK7').result,
    ).toBe(0);
    const workbook = createDeliveryMonthlyWorkbook(
      '2026-09',
      [order],
      deliveries.slice(0, 2),
    );
    expect(
      result(workbook.getWorksheet('Delivered')!.getCell('AK7').value),
    ).toBe(100);
    expect(workbook.getWorksheet('Forecast')!.getCell('N6').value).toEqual(
      new Date('2026-09-01T00:00:00Z'),
    );
  });

  it.each([undefined, '', '2026-00', '2026-13', '26-09', '2026-09-01'])(
    'rejects invalid month %s',
    async (month) => {
      expect(
        (
          await validate(
            Object.assign(new DeliveryMonthlyReportQueryDto(), { month }),
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );

  it('reads monthly Forecast completion and Jakarta Incoming ranges without database writes', async () => {
    const prisma = {
      productionOrder: { findMany: jest.fn().mockResolvedValue([order]) },
      deliveryHistory: { findMany: jest.fn().mockResolvedValue([]) },
      incoming: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((queries: Promise<unknown>[]) =>
        Promise.all(queries),
      ),
    };
    const service = new ReportService(
      prisma as unknown as PrismaService,
      {} as LogProcessService,
    );
    const output = await service.generateDeliveryMonthlyReport('2026-09');
    expect(output).toBeInstanceOf(Buffer);
    expect(prisma.productionOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          DeliveryDate: {
            gte: new Date('2026-09-01T00:00:00Z'),
            lt: new Date('2026-10-01T00:00:00Z'),
          },
        },
      }),
    );
    expect(prisma.deliveryHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          PoData: {
            DeliveryDate: {
              gte: new Date('2026-09-01T00:00:00Z'),
              lt: new Date('2026-10-01T00:00:00Z'),
            },
          },
        },
      }),
    );
    expect(prisma.incoming.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          Closed: true,
          ApprovedAt: {
            gte: new Date('2026-08-31T17:00:00Z'),
            lt: new Date('2026-09-30T17:00:00Z'),
          },
        },
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: 'RepeatableRead',
    });
    prisma.$transaction.mockClear();
    await expect(
      service.generateDeliveryMonthlyReport('2026-13'),
    ).rejects.toThrow('month');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns the binary workbook using the existing report permission', async () => {
    const service = {
      generateDeliveryMonthlyReport: jest
        .fn()
        .mockResolvedValue(Buffer.from('xlsx')),
    };
    const controller = new ReportController(
      service as unknown as ReportService,
      {} as InventoryReconciliationService,
    );
    const response = { set: jest.fn(), send: jest.fn() };
    await controller.generateDeliveryMonthlyReport(
      {} as ICurrentUser,
      response as unknown as Response,
      { month: '2026-09' },
    );
    expect(service.generateDeliveryMonthlyReport).toHaveBeenCalledWith(
      '2026-09',
    );
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Disposition':
          'attachment; filename=Delivery_Report_Monthly_2026-09.xlsx',
      }),
    );
    expect(response.send).toHaveBeenCalledWith(Buffer.from('xlsx'));
    expect(
      Reflect.getMetadata(
        'permissions',
        ReportController.prototype.generateDeliveryMonthlyReport,
      ),
    ).toEqual(['IPCS.REPORT_READ']);
  });
});
