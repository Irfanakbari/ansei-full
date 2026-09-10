import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import moment from 'moment-timezone';

export interface ExcelRow {
  [columnPosition: number]: string | number | Date | undefined;
}

@Injectable()
export class ExcelService {
  /**
   * Read Excel file and return data as array of objects with column position as key.
   * Column A = index 0, Column B = index 1, etc.
   * This approach reads by position rather than header name, making it robust against header name changes.
   */
  readExcelByPosition(file: Express.Multer.File): ExcelRow[] {
    try {
      const fileBuffer = file.buffer;
      const workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellDates: true,
        raw: false,
      });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with header: 1 (use 1-based column numbers as headers)
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      });

      // Skip header row (index 0) and process data rows
      const rows: ExcelRow[] = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as (string | number | Date | undefined)[];
        if (row && row.length > 0) {
          const obj: ExcelRow = {};
          row.forEach((cell, colIndex) => {
            obj[colIndex] = cell;
          });
          rows.push(obj);
        }
      }

      return rows;
    } catch (error) {
      throw new Error(
        'Error reading Excel file: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
    }
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
