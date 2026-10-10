/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
export function sapCorrelationFilter(kind: string, id: string): string {
  const marker = `ANSEI:${id.replace(/'/g, "''")}`;
  if (kind === 'PRODUCTION_ORDER')
    return `(Remarks eq '${marker}' or JournalRemarks eq '${marker}')`;
  if (kind === 'GOODS_RECEIPT' || kind === 'SALES_ORDER')
    return `(Comments eq '${marker}' or JournalMemo eq '${marker}')`;
  return `Comments eq '${marker}'`;
}

export function sapDocumentMarker(doc: Record<string, unknown>): string | null {
  for (const value of [doc.Comments, doc.JournalMemo, doc.Reference2]) {
    if (typeof value === 'string' && /^ANSEI:[0-9a-f-]{36}$/.test(value))
      return value.slice(6);
  }
  return null;
}

export function sapCountingMarker(doc: Record<string, unknown>): string | null {
  const reference =
    typeof doc.Remarks === 'string'
      ? /^STO: (AIC-\d{8})(?: Based On Inventory Counting \d+)?$/.exec(
          doc.Remarks,
        )?.[1]
      : undefined;
  return reference && doc.Reference2 === reference.replace('-', '')
    ? reference
    : null;
}
