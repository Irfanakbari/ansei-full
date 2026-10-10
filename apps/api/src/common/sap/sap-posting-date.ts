/* By Irfan Akbari Vuteq Indonesia - 2026-10-10 */
const jakartaDate = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** SAP DocDate is a business calendar date, not the UTC date of the event. */
export function sapPostingDate(instant: Date): string {
  const parts = jakartaDate.formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
