/* By Irfan Akbari Vuteq Indonesia - 2026-10-10 */
import { sapPostingDate } from './sap-posting-date';

describe('SAP Jakarta posting date', () => {
  it.each([
    ['2026-10-09T16:59:59.999Z', '2026-10-09'],
    ['2026-10-09T17:00:00.000Z', '2026-10-10'],
    ['2026-10-09T23:10:44.641Z', '2026-10-10'],
    ['2026-10-10T16:59:59.999Z', '2026-10-10'],
    ['2026-10-31T17:00:00.000Z', '2026-11-01'],
    ['2026-12-31T17:00:00.000Z', '2027-01-01'],
  ])('%s posts on Jakarta date %s', (instant, expected) => {
    expect(sapPostingDate(new Date(instant))).toBe(expected);
  });
});
