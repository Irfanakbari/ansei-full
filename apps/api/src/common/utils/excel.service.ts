import { Injectable } from '@nestjs/common';
import { CellValue, Workbook } from 'exceljs';
import moment from 'moment-timezone';

export interface ExcelRow {
  [columnPosition: number]: string | number | boolean | Date | undefined;
}

export interface ExcelPositionedRow {
  row: ExcelRow;
  rowNumber: number;
}

export interface ExcelPositionedReadResult {
  rows: ExcelPositionedRow[];
  usedRequestedWorksheet: boolean;
}

export interface ExcelPositionedReadOptions {
  worksheetName: string;
  headerColumns: number[];
  minimumPopulatedHeaderColumns: number;
}

type ExcelCellValue = ExcelRow[number];

@Injectable()
export class ExcelService {
  /**
   * Read Excel file and return data as array of objects with column position as key.
   * Column A = index 0, Column B = index 1, etc.
   * This approach reads by position rather than header name, making it robust against header name changes.
   */
  async readExcelByPosition(file: Express.Multer.File): Promise<ExcelRow[]> {
    const result = await this.readExcelByPositionWithMetadata(file);
    return result.rows.map(({ row }) => row);
  }

  /**
   * Reads a requested worksheet when present and detects its header row by
   * populated column positions. If it is absent, the legacy first-sheet/A1
   * layout is preserved.
   */
  async readExcelByPositionWithMetadata(
    file: Express.Multer.File,
    options?: ExcelPositionedReadOptions,
  ): Promise<ExcelPositionedReadResult> {
    try {
      const workbook = new Workbook();
      const workbookBuffer = file.buffer.buffer.slice(
        file.buffer.byteOffset,
        file.buffer.byteOffset + file.buffer.byteLength,
      ) as ArrayBuffer;
      await workbook.xlsx.load(workbookBuffer);
      const requestedWorksheet = options
        ? workbook.getWorksheet(options.worksheetName)
        : undefined;
      const worksheet = requestedWorksheet ?? workbook.worksheets[0];

      if (!worksheet) {
        return { rows: [], usedRequestedWorksheet: false };
      }

      const headerRowNumber = requestedWorksheet
        ? this.findHeaderRowNumber(worksheet, options!)
        : 1;
      const rows: ExcelPositionedRow[] = [];
      for (
        let rowNumber = headerRowNumber + 1;
        rowNumber <= worksheet.rowCount;
        rowNumber++
      ) {
        const worksheetRow = worksheet.getRow(rowNumber);
        const row: ExcelRow = {};

        for (
          let columnNumber = 1;
          columnNumber <= worksheetRow.cellCount;
          columnNumber++
        ) {
          row[columnNumber - 1] = this.normalizeCellValue(
            worksheetRow.getCell(columnNumber).value,
          );
        }

        if (worksheetRow.cellCount > 0) {
          rows.push({ row, rowNumber });
        }
      }

      return {
        rows,
        usedRequestedWorksheet: requestedWorksheet !== undefined,
      };
    } catch (error) {
      throw new Error(
        'Error reading Excel file: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
    }
  }

  private findHeaderRowNumber(
    worksheet: import('exceljs').Worksheet,
    options: ExcelPositionedReadOptions,
  ): number {
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const populatedColumns = options.headerColumns.filter(
        (columnPosition) => {
          const value = this.normalizeCellValue(
            row.getCell(columnPosition + 1).value,
          );
          return value !== undefined && String(value).trim() !== '';
        },
      ).length;

      if (populatedColumns >= options.minimumPopulatedHeaderColumns) {
        return rowNumber;
      }
    }

    throw new Error(
      `Unable to detect the header row in worksheet "${options.worksheetName}"`,
    );
  }

  private normalizeCellValue(value: CellValue): ExcelCellValue {
    if (value === null) {
      return '';
    }
    if (
      value instanceof Date ||
      ['string', 'number', 'boolean'].includes(typeof value)
    ) {
      return value as ExcelCellValue;
    }
    if (typeof value !== 'object') {
      return String(value);
    }
    if ('result' in value && value.result !== undefined) {
      return this.normalizeCellValue(value.result);
    }
    if ('text' in value) {
      return value.text;
    }
    if ('richText' in value) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('error' in value) {
      return value.error;
    }
    return String(value);
  }

  /**
   * Parse date string in YYYYMMDD format to Date object (UTC)
   * Also accepts Date objects and returns them directly
   */
  parseDateYYYYMMDD(dateVal: string | number | Date | undefined): Date {
    if (!dateVal) {
      throw new Error('Date is required');
    }
    if (dateVal instanceof Date) {
      return dateVal;
    }
    const dateStr = String(dateVal).trim();
    return moment.tz(dateStr, 'YYYYMMDD', 'UTC').toDate();
  }

  /**
   * Parse date string in YYYYMMDD format with fallback to other common formats
   */
  parseDateFlexible(dateStr: string | number | undefined): Date | null {
    if (!dateStr) return null;
    const dateStrClean = String(dateStr).trim();
    if (!dateStrClean) return null;

    // Try YYYYMMDD first
    const parsed = moment.tz(dateStrClean, 'YYYYMMDD', 'UTC');
    if (parsed.isValid()) {
      return parsed.toDate();
    }

    // Try other common formats
    const formats = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY/MM/DD'];
    for (const fmt of formats) {
      const altParsed = moment(dateStrClean, fmt, true);
      if (altParsed.isValid()) {
        return altParsed.toDate();
      }
    }

    return null;
  }
}
