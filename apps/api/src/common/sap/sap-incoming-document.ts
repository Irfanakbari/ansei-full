/* By Irfan Akbari Vuteq Indonesia - 2026-10-10 */
import type { SapTransaction } from '../../generated/prisma/client';
import type { SapIncomingLine } from './sap-transaction-capture';

export function receiptItemLabel(row: SapTransaction): string {
  if (row.Kind !== 'GOODS_RECEIPT') return row.ItemCode;
  try {
    const lines = incomingLines(row);
    return lines
      ? [...new Set(lines.map((line) => line.itemCode))].join(', ')
      : row.ItemCode;
  } catch {
    return row.ItemCode;
  }
}

export function incomingLines(
  row: Pick<SapTransaction, 'Snapshot' | 'Quantity'>,
): SapIncomingLine[] | null {
  const snapshot = row.Snapshot as Record<string, unknown>;
  if (snapshot.lines === undefined) return null; // Historical single-line event.
  if (!Array.isArray(snapshot.lines) || !snapshot.lines.length)
    throw new Error('Incoming receipt lines are missing.');
  const lines = snapshot.lines as SapIncomingLine[];
  if (
    lines.some(
      (line) =>
        !line ||
        typeof line.itemCode !== 'string' ||
        !line.itemCode.trim() ||
        typeof line.partNumber !== 'string' ||
        !line.partNumber.trim() ||
        typeof line.ledgerId !== 'string' ||
        !line.ledgerId ||
        !Number.isSafeInteger(line.quantity) ||
        line.quantity <= 0,
    ) ||
    new Set(lines.map((line) => line.ledgerId)).size !== lines.length ||
    lines.reduce((sum, line) => sum + line.quantity, 0) !== row.Quantity
  ) {
    throw new Error(
      'Incoming receipt lines do not match the captured quantities.',
    );
  }
  return lines;
}

export function matchesIncomingDocument(
  row: SapTransaction,
  document: Record<string, unknown>,
): boolean {
  try {
    const expected = incomingLines(row);
    if (!expected) return false;
    const actual = document.DocumentLines as
      Record<string, unknown>[] | undefined;
    const snapshot = row.Snapshot as Record<string, unknown>;
    return (
      document.Cancelled !== 'tYES' &&
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every(
        (line, index) =>
          actual[index].ItemCode === line.itemCode &&
          actual[index].Quantity === line.quantity &&
          actual[index].WarehouseCode === row.Warehouse &&
          Number(actual[index].UnitPrice) === 0 &&
          (!snapshot.projectCode ||
            actual[index].ProjectCode === snapshot.projectCode) &&
          (!snapshot.costCenter ||
            actual[index].CostingCode === snapshot.costCenter),
      )
    );
  } catch {
    return false;
  }
}
