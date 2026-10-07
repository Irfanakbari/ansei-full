/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseOrderCandidateIds } from "../store/features/production/productionRelease/orderCandidateIds.ts";

for (const source of ["PO", "NPO"]) {
  test(`${source}: full envelope preserves all IDs across three pages`, () => {
    const demandIds = Array.from(
      { length: 25 },
      (_, index) => `${source}-${index}`,
    );
    const data = { demandIds, total: 25 };
    assert.deepEqual(parseOrderCandidateIds({ success: true, data }), data);
  });
}
test("raw payload compatibility", () => {
  assert.deepEqual(parseOrderCandidateIds({ demandIds: ["PO-1"], total: 1 }), {
    demandIds: ["PO-1"],
    total: 1,
  });
});
test("empty result is valid", () => {
  assert.deepEqual(
    parseOrderCandidateIds({
      success: true,
      data: { demandIds: [], total: 0 },
    }),
    { demandIds: [], total: 0 },
  );
});
for (const payload of [
  undefined,
  null,
  {},
  { forecastIds: ["PO-1"], total: 1 },
  { demandIds: [null], total: 1 },
  { demandIds: [""], total: 1 },
  { demandIds: ["PO-1"], total: 2 },
  { demandIds: ["PO-1", "PO-1"], total: 2 },
]) {
  test(`reject malformed selection ${JSON.stringify(payload)}`, () => {
    assert.throws(
      () => parseOrderCandidateIds({ success: true, data: payload }),
      /Invalid production order selection response/,
    );
  });
}
