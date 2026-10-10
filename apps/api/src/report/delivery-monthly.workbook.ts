/* By Irfan Akbari Vuteq Indonesia - 2026-10-10 */
import { Workbook, type Worksheet } from 'exceljs';
import { DELIVERY_MONTHLY_TEMPLATE as template } from './delivery-monthly.template';

export interface MonthlyOrder {
  PoId: string;
  SourceType: string;
  VendorCode: string;
  VendorName: string;
  ReceivingArea: string;
  DeliveryDate: Date;
  DeliveryPeriod: number;
  Classification: string;
  PoNumber: string;
  Item: number;
  FinishGoodId: string;
  Qty: number;
  Notes: string | null;
  PartData: { PartName: string };
}

export interface MonthlyDelivery {
  ProductionDemandId: string;
  Qty: number;
  CreatedAt: Date;
  PoData: MonthlyOrder;
}

export interface MonthlyReceipt {
  PoId: string;
  ApprovedAt: Date;
  SupplierName: string;
  ReceivedBy: string;
  IncomingMaterial: {
    Qty: number;
    MaterialData: { PartNumber: string; PartName: string } | null;
  }[];
}

const quantityFormat = '_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)';
const black = { argb: 'FF000000' };
const thin = { style: 'thin' as const, color: black };
const medium = { style: 'medium' as const, color: black };
const sections = [
  { title: 'SCHEDULE DELIVERY MASSPRO (REGULER)', row: 4, end: 53 },
  { title: 'SCHEDULE DELIVERY KD (FUJITRANS)', row: 55, end: 103 },
  { title: 'SCHEDULE DELIVERY EVENT (MMKI)', row: 105, end: 113 },
  { title: 'TRIAL GC-5P45 (IN JAPAN)', row: 115, end: 119 },
];

export function jakartaDate(date: Date): string {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function deliveryDestination(receivingArea: string): string {
  const area = receivingArea.trim().toUpperCase();
  const lookup: Readonly<Record<string, string>> = template.receivingAreas;
  return (
    lookup[area] ||
    (['REGULER', 'QX', 'KD', 'EVENT', 'JAPAN', 'SPE', 'SPD'].includes(area)
      ? area
      : `UNMAPPED (${area || '-'})`)
  );
}

function rowKey(destination: string, part: string): string {
  return JSON.stringify([destination, part]);
}

function fill(color: string) {
  return {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: `FF${color}` },
  };
}

function setup(
  sheet: Worksheet,
  widths: readonly number[],
  title: string,
  month: string,
) {
  // Reference dimensions are Office points; ExcelJS uses Calibri-11 character widths.
  widths.forEach((points, index) => {
    sheet.getColumn(index + 1).width = Math.max(0, ((points * 4) / 3 - 5) / 7);
  });
  sheet.getRow(1).height = title === 'ACTUAL FORECAST' ? 19.5 : 16.5;
  for (const row of [2, 3]) {
    const cell = sheet.getCell(row, 2);
    cell.value =
      row === 2
        ? title
        : new Date(`${month}-01T00:00:00Z`)
            .toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })
            .toUpperCase();
    cell.font = { name: 'Calibri Light', size: 18, bold: true, color: black };
    cell.alignment = { horizontal: 'left', vertical: 'bottom' };
    // Reference title is an unmerged B:D box with text overflowing blank cells.
    for (let col = 2; col <= 4; col++) {
      sheet.getCell(row, col).border = {
        top: medium,
        bottom: medium,
        ...(col === 2 ? { left: medium } : {}),
        ...(col === 4 ? { right: medium } : {}),
      };
    }
    sheet.getRow(row).height = title === 'ACTUAL FORECAST' ? 30 : 29.25;
  }
}

function styleTableRow(
  sheet: Worksheet,
  row: number,
  lastCol: number,
  header = false,
  firstCol = 2,
) {
  for (let col = firstCol; col <= lastCol; col++) {
    const cell = sheet.getCell(row, col);
    cell.font = {
      name: sheet.name === 'Forecast' ? 'Calibri Light' : 'Calibri',
      size: header && sheet.name === 'Forecast' ? 14 : 12,
      bold: header,
      color: black,
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: header ? medium : thin,
      bottom: thin,
      left: col === firstCol ? medium : thin,
      right: col === lastCol ? medium : thin,
    };
    if (header) cell.fill = fill('FFFF99');
  }
}

/** The visible sheets preserve the September reference presentation.
 * Delivered uses planned Forecast quantities on DeliveryDate after the order is fully shipped.
 * Received quantities are actual Incoming transactions.
 * Vehicle-unit summaries deliberately retain the reference's selected-part formulas.
 */
export function createDeliveryMonthlyWorkbook(
  month: string,
  orders: MonthlyOrder[],
  orderDeliveries: Pick<
    MonthlyDelivery,
    'ProductionDemandId' | 'Qty' | 'CreatedAt'
  >[],
  receipts: MonthlyReceipt[] = [],
): Workbook {
  const workbook = new Workbook();
  workbook.creator = 'ANSEI';
  workbook.calcProperties.fullCalcOnLoad = true;
  const forecast = workbook.addWorksheet('Forecast', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
  });
  const delivered = workbook.addWorksheet('Delivered', {
    views: [{ state: 'frozen', xSplit: 6, ySplit: 5, showGridLines: false }],
  });
  const received = workbook.addWorksheet('Received', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
  });
  setup(forecast, template.forecastWidths, 'ACTUAL FORECAST', month);
  setup(delivered, template.deliveredWidths, 'ACTUAL DELIVERED DATE', month);
  const headers = [
    'Vendor Code',
    'Vendor Name',
    'Reciving Area',
    'Type',
    'Delivery date',
    'Periode',
    'Clasification',
    'PO No',
    'Item',
    'Part No',
    'Part Name',
    'Quantity',
    'Actual Date',
    'Remarks',
  ];
  forecast.getRow(5).height = 28.5;
  headers.forEach((header, i) => {
    forecast.getCell(5, i + 2).value = header;
  });
  styleTableRow(forecast, 5, 15, true);
  const deliveryByOrder = new Map<string, { qty: number; lastDate: string }>();
  for (const item of orderDeliveries) {
    const previous = deliveryByOrder.get(item.ProductionDemandId);
    const date = jakartaDate(item.CreatedAt);
    deliveryByOrder.set(item.ProductionDemandId, {
      qty: (previous?.qty ?? 0) + item.Qty,
      lastDate: previous && previous.lastDate > date ? previous.lastDate : date,
    });
  }
  orders.forEach((order, index) => {
    const row = index + 6;
    const actual = deliveryByOrder.get(order.PoId);
    const remarks = [
      order.SourceType === 'NON_PO' ? `NON-PO: ${order.PoId}` : '',
      order.Notes,
      actual
        ? `Delivered ${actual.qty}/${order.Qty}; last delivery ${actual.lastDate}`
        : 'Not delivered',
    ];
    const values = [
      order.VendorCode,
      order.VendorName,
      order.ReceivingArea,
      deliveryDestination(order.ReceivingArea),
      Number(order.DeliveryDate.toISOString().slice(0, 10).replace(/-/g, '')),
      order.DeliveryPeriod,
      order.Classification,
      order.PoNumber,
      order.Item,
      order.FinishGoodId,
      order.PartData.PartName,
      order.Qty,
      actual && actual.qty >= order.Qty
        ? new Date(`${actual.lastDate}T00:00:00Z`)
        : null,
      remarks.filter(Boolean).join('; '),
    ];
    values.forEach((value, i) => {
      forecast.getCell(row, i + 2).value = value;
    });
    styleTableRow(forecast, row, 15);
    forecast.getRow(row).height = 18.75;
    forecast.getCell(row, 14).numFmt = 'dd-mmm-yyyy';
    const remarksCell = forecast.getCell(row, 15);
    remarksCell.alignment = {
      horizontal: 'left',
      vertical: 'middle',
      wrapText: true,
    };
    forecast.getRow(row).height = Math.max(
      18.75,
      Math.ceil(String(remarksCell.value).length / 30) * 18.75,
    );
  });
  forecast.autoFilter = `B5:O${Math.max(5, orders.length + 5)}`;

  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const lastDayCol = 6 + days;
  const totalCol = lastDayCol + 1;
  // Hide the reference's extra date slots instead of accidentally counting next month.
  for (let col = 7; col <= 40; col++) {
    delivered.getColumn(col).width =
      col === totalCol
        ? ((54 * 4) / 3 - 5) / 7
        : col === 7
          ? ((41.25 * 4) / 3 - 5) / 7
          : ((39 * 4) / 3 - 5) / 7;
    delivered.getColumn(col).hidden = col > totalCol;
  }
  template.deliveredHeights.forEach((height, index) => {
    delivered.getRow(index + 1).height = height;
  });
  const daily = new Map<string, number[]>();
  const names = new Map<string, string>();
  for (const item of orders) {
    const completed = deliveryByOrder.get(item.PoId);
    if (!completed || completed.qty < item.Qty) continue;
    const date = item.DeliveryDate.toISOString().slice(0, 10);
    if (!date.startsWith(`${month}-`)) continue;
    const key = rowKey(
      deliveryDestination(item.ReceivingArea),
      item.FinishGoodId,
    );
    const amounts = daily.get(key) ?? Array<number>(days).fill(0);
    amounts[Number(date.slice(-2)) - 1] += item.Qty;
    daily.set(key, amounts);
    names.set(key, item.PartData.PartName);
  }
  const rowAmounts = new Map<number, number[]>();
  function dates(
    row: number,
    header: boolean,
    amounts: number[] = Array<number>(days).fill(0),
  ) {
    for (let day = 1; day <= days; day++) {
      const cell = delivered.getCell(row, day + 6);
      const date = new Date(Date.UTC(year, monthNumber - 1, day));
      const weekend = date.getUTCDay();
      cell.fill = fill(
        weekend === 6 ? 'F2DCDB' : weekend === 0 ? 'DAEEF3' : 'FFFFFF',
      );
      cell.value = header ? date : amounts[day - 1];
      cell.numFmt = header ? '[$-409]d-mmm;@' : quantityFormat;
      if (header)
        cell.font = { name: 'Calibri', size: 9, bold: true, color: black };
    }
    const cell = delivered.getCell(row, totalCol);
    cell.fill = fill(header ? 'FFFF99' : 'FFFFFF');
    cell.value = header
      ? 'Total'
      : {
          formula: `SUM(G${row}:${delivered.getColumn(lastDayCol).letter}${row})`,
          result: amounts.reduce((sum, qty) => sum + qty, 0),
        };
    if (!header) {
      cell.numFmt = quantityFormat;
      cell.font = { name: 'Calibri', size: 12 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
    if (!header) rowAmounts.set(row, amounts);
  }
  function sectionHeader(row: number, title: string) {
    delivered.getCell(row, 2).value = title;
    delivered.getCell(row, 2).font = { name: 'Calibri', size: 12, bold: true };
    ['No', 'CAR NAME', 'DESTINATION', 'PART NUMBER', 'PART NAME'].forEach(
      (value, i) => {
        delivered.getCell(row + 1, i + 2).value = value;
      },
    );
    styleTableRow(delivered, row + 1, totalCol, true);
    dates(row + 1, true);
  }
  function dataRow(
    row: number,
    no: number,
    car: string,
    destination: string,
    part: string,
    name: string,
  ) {
    [no, car, destination, part, name].forEach((value, i) => {
      delivered.getCell(row, i + 2).value = value;
    });
    styleTableRow(delivered, row, totalCol);
    dates(row, false, daily.get(rowKey(destination, part)));
  }
  for (const section of sections) {
    sectionHeader(section.row, section.title);
    for (const item of template.catalog.filter(
      (item) => item.row > section.row + 1 && item.row < section.end,
    )) {
      dataRow(
        item.row,
        item.no,
        item.car,
        item.destination,
        item.part,
        names.get(rowKey(item.destination, item.part)) ?? item.name,
      );
    }
    const sum = Array.from({ length: days }, (_, day) =>
      template.catalog
        .filter((item) => item.row > section.row + 1 && item.row < section.end)
        .reduce((qty, item) => qty + (rowAmounts.get(item.row)?.[day] ?? 0), 0),
    );
    styleTableRow(delivered, section.end, totalCol);
    delivered.mergeCells(section.end, 2, section.end, 6);
    delivered.getCell(section.end, 2).value = 'Total';
    dates(section.end, false, sum);
    for (let col = 7; col <= lastDayCol; col++) {
      const letter = delivered.getColumn(col).letter;
      delivered.getCell(section.end, col).value = {
        formula: `SUM(${letter}${section.row + 2}:${letter}${section.end - 1})`,
        result: sum[col - 7],
      };
    }
    for (let col = 2; col <= totalCol; col++)
      delivered.getCell(section.end, col).border = {
        ...delivered.getCell(section.end, col).border,
        bottom: medium,
      };
  }
  for (const summary of template.summaries) {
    const row = summary.row;
    delivered.getCell(row, 6).value = summary.label;
    delivered.getCell(row, 6).font = { name: 'Calibri', size: 12, bold: true };
    delivered.getCell(row, 6).alignment = {
      horizontal: 'left',
      vertical: 'middle',
      shrinkToFit: true,
    };
    const references = summary.formula.startsWith('SUM(')
      ? (() => {
          const numbers = summary.formula.match(/\d+/g)!.map(Number);
          return Array.from(
            { length: numbers[1] - numbers[0] + 1 },
            (_, i) => numbers[0] + i,
          );
        })()
      : summary.formula.match(/\d+/g)!.map(Number);
    const amounts = Array.from({ length: days }, (_, day) =>
      references.reduce(
        (sum, ref) => sum + (rowAmounts.get(ref)?.[day] ?? 0),
        0,
      ),
    );
    dates(row, false, amounts);
    for (let col = 7; col <= lastDayCol; col++) {
      const cell = delivered.getCell(row, col);
      cell.value = {
        formula: summary.formula.replace(
          /G(?=\d)/g,
          delivered.getColumn(col).letter,
        ),
        result: amounts[col - 7],
      };
      cell.font = { name: 'Calibri', size: 12 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = fill('FFFFFF');
    }
    const total = [124, 129, 136].includes(row);
    if (row >= 124)
      delivered.getCell(row, 6).fill = fill(total ? 'FFFF99' : 'FFFF00');
    if (total)
      for (let col = 6; col <= totalCol; col++)
        delivered.getCell(row, col).border = {
          top: thin,
          bottom: thin,
          left: thin,
          right: thin,
        };
  }
  const knownKeys = new Set(
    template.catalog.map((item) => rowKey(item.destination, item.part)),
  );
  const missing = [...daily.keys()].filter((key) => !knownKeys.has(key)).sort();
  if (missing.length) {
    sectionHeader(139, 'ADDITIONAL DELIVERY — NOT IN REFERENCE CATALOG');
    missing.forEach((key, index) => {
      const [destination, part] = JSON.parse(key) as [string, string];
      dataRow(
        141 + index,
        index + 1,
        'UNMAPPED',
        destination,
        part,
        names.get(key) ?? '',
      );
      delivered.getRow(141 + index).height = 28.5;
    });
  }

  // The reference's Parts Received sheet is a compact eight-column log. Incoming
  // is included only after its receive command closes and timestamps the document.
  // Widths start at column A; B:I are the eight visible reference columns.
  const receivingWidths = [21.75, 45, 90, 130, 150, 130, 240, 80, 130];
  setup(received, receivingWidths, 'ACTUAL PARTS RECEIVED', month);
  const receivedHeaders = [
    'No',
    'Received Date',
    'Hashtag',
    'Supplier',
    'Part Number',
    'Part Name',
    'Quantity',
    'Received By',
  ];
  received.getRow(5).height = 28.5;
  receivedHeaders.forEach((header, index) => {
    received.getCell(5, index + 2).value = header;
  });
  styleTableRow(received, 5, 9, true);
  const receiptRows = receipts
    .flatMap((receipt) =>
      receipt.IncomingMaterial.map((material) => ({ receipt, material })),
    )
    .filter(({ material }) => material.MaterialData)
    .sort(
      (left, right) =>
        left.receipt.ApprovedAt.getTime() -
          right.receipt.ApprovedAt.getTime() ||
        left.receipt.PoId.localeCompare(right.receipt.PoId) ||
        left.material.MaterialData!.PartNumber.localeCompare(
          right.material.MaterialData!.PartNumber,
        ),
    );
  receiptRows.forEach(({ receipt, material }, index) => {
    const row = index + 6;
    const part = material.MaterialData!;
    const values = [
      index + 1,
      new Date(`${jakartaDate(receipt.ApprovedAt)}T00:00:00Z`),
      receipt.PoId,
      receipt.SupplierName,
      part.PartNumber,
      part.PartName,
      material.Qty,
      receipt.ReceivedBy,
    ];
    values.forEach((value, column) => {
      received.getCell(row, column + 2).value = value;
    });
    styleTableRow(received, row, 9);
    received.getCell(row, 3).numFmt = 'dd-mmm-yyyy';
    received.getCell(row, 8).numFmt = quantityFormat;
    for (const column of [4, 5, 6, 7, 9]) {
      received.getCell(row, column).alignment = {
        horizontal: 'left',
        vertical: 'middle',
        wrapText: column === 7,
      };
    }
    received.getCell(row, 8).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };
    received.getRow(row).height = Math.max(
      22.5,
      Math.ceil(part.PartName.length / 40) * 18.75,
    );
  });
  const receivedTotalRow = receiptRows.length + 6;
  styleTableRow(received, receivedTotalRow, 9);
  received.mergeCells(receivedTotalRow, 2, receivedTotalRow, 7);
  received.getCell(receivedTotalRow, 2).value = 'Total';
  received.getCell(receivedTotalRow, 2).font = {
    name: 'Calibri',
    size: 12,
    bold: true,
  };
  received.getCell(receivedTotalRow, 8).value = {
    formula: `SUM(H6:H${Math.max(6, receivedTotalRow - 1)})`,
    result: receiptRows.reduce((total, row) => total + row.material.Qty, 0),
  };
  received.getCell(receivedTotalRow, 8).numFmt = quantityFormat;
  for (let col = 2; col <= 9; col++) {
    received.getCell(receivedTotalRow, col).fill = fill('FFFF99');
    received.getCell(receivedTotalRow, col).border = {
      top: medium,
      bottom: medium,
      left: col === 2 ? medium : thin,
      right: col === 9 ? medium : thin,
    };
  }
  received.autoFilter = `B5:I${Math.max(5, receivedTotalRow - 1)}`;
  return workbook;
}
