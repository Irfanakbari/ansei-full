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

  it('wraps invalid workbook errors', async () => {
    const file = {
      buffer: Buffer.from('not an xlsx file'),
    } as Express.Multer.File;

    await expect(service.readExcelByPosition(file)).rejects.toThrow(
      'Error reading Excel file:',
    );
  });
});
