import { convertDocument } from '@matbee/libreoffice-converter';

/**
 * Convert Excel buffer to PDF using LibreOffice WASM
 * @param excelBuffer - Excel file as Buffer
 * @returns PDF file as Buffer
 */
export async function excelToPdf(excelBuffer: Buffer): Promise<Buffer> {
  const result = await convertDocument(excelBuffer, {
    outputFormat: 'pdf',
  });
  return Buffer.from(result.data);
}
