import { Workbook } from 'exceljs';
import { ExcelService } from './excel.service';

describe('ExcelService', () => {
  const service = new ExcelService();

  async function createFile(workbook: Workbook): Promise<Express.Multer.File> {
    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer) } as Express.Multer.File;
  }

  it('reads the first worksheet by position and skips the header row', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Forecast');
    worksheet.addRow(['PO ID', 'Date', 'Quantity', 'Active']);
    const date = new Date(Date.UTC(2026, 8, 17));
    worksheet.addRow(['PO-001', date, 12, true]);
    worksheet.addRow(['PO-002', '', 0, false]);
    workbook.addWorksheet('Ignored').addRow(['not returned']);

    await expect(
      service.readExcelByPosition(await createFile(workbook)),
    ).resolves.toEqual([
      { 0: 'PO-001', 1: date, 2: 12, 3: true },
      { 0: 'PO-002', 1: '', 2: 0, 3: false },
    ]);
  });

  it('preserves formula results, rich text, hyperlinks, and blank rows', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Forecast');
    worksheet.addRow(['Formula', 'Text', 'Link']);
    worksheet.addRow([
      { formula: '1+1', result: 2 },
      { richText: [{ text: 'PO-' }, { text: '001' }] },
      { text: 'Vendor', hyperlink: 'https://example.com' },
    ]);
    worksheet.addRow([]);
    worksheet.addRow(['last']);

    await expect(
      service.readExcelByPosition(await createFile(workbook)),
    ).resolves.toEqual([{ 0: 2, 1: 'PO-001', 2: 'Vendor' }, { 0: 'last' }]);
  });

  it('finds a positional header below row 1 in Delivery actual date', async () => {
    const workbook = new Workbook();
    workbook.addWorksheet('Forecast').addRow(['legacy']);
    const worksheet = workbook.addWorksheet('Delivery actual date');
    worksheet.addRow(['report title']);
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow([
      '',
      'header-b',
      'header-c',
      'header-d',
      'header-e',
      'header-f',
      'header-g',
      'header-h',
      'header-i',
      'header-j',
      'header-k',
      'header-l',
      'header-m',
      'header-n',
    ]);
    worksheet.addRow([
      '',
      'PO-001',
      '20261004',
      'V001',
      'Vendor',
      '3R27',
      '20261006',
      1,
      'ZN21',
      '2004536846',
      10,
      'FG-001',
      'Part name',
      32,
    ]);

    await expect(
      service.readExcelByPositionWithMetadata(await createFile(workbook), {
        worksheetName: 'Delivery actual date',
        headerColumns: Array.from(
          { length: 11 },
          (_, index) => index + 1,
        ).concat(13),
        minimumPopulatedHeaderColumns: 8,
      }),
    ).resolves.toEqual({
      usedRequestedWorksheet: true,
      rows: [
        {
          rowNumber: 5,
          row: {
            0: '',
            1: 'PO-001',
            2: '20261004',
            3: 'V001',
            4: 'Vendor',
            5: '3R27',
            6: '20261006',
            7: 1,
            8: 'ZN21',
            9: '2004536846',
            10: 10,
            11: 'FG-001',
            12: 'Part name',
            13: 32,
          },
        },
      ],
    });
  });

  it('falls back to the legacy first worksheet when the requested sheet is absent', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Forecast');
    worksheet.addRow(['header']);
    worksheet.addRow(['PO-001']);

    await expect(
      service.readExcelByPositionWithMetadata(await createFile(workbook), {
        worksheetName: 'Delivery actual date',
        headerColumns: [0],
        minimumPopulatedHeaderColumns: 1,
      }),
    ).resolves.toEqual({
      usedRequestedWorksheet: false,
      rows: [{ rowNumber: 2, row: { 0: 'PO-001' } }],
    });
  });

  it('wraps invalid workbook errors', async () => {
    const file = {
      buffer: Buffer.from('not an xlsx file'),
    } as Express.Multer.File;

    await expect(service.readExcelByPosition(file)).rejects.toThrow(
      'Error reading Excel file:',
    );
  });
});
