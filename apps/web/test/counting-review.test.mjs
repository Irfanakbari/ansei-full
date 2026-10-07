import assert from "node:assert/strict";
import test from "node:test";
import { toCountingReviewRow } from "../app/apps/warehouse/inventory-counting/_components/countingReview.ts";

test("rack approval compares the actual rack count against the rack snapshot", () => {
  const row = toCountingReviewRow({
    Location: "RACK",
    SystemQty: 0,
    ActualQty: 9808,
    SystemQtyRack: 10000,
    ActualQtyRack: 9808,
  });
  assert.equal(row.SystemQty, 10000);
  assert.equal(row.ActualQty, 9808);
  assert.equal(row.DiffQty, -192);
});
test("rack zero and missing count remain distinct", () => {
  assert.equal(
    toCountingReviewRow({
      Location: "RACK",
      SystemQtyRack: 0,
      ActualQtyRack: 0,
    }).DiffQty,
    0,
  );
  assert.equal(
    toCountingReviewRow({
      Location: "RACK",
      SystemQtyRack: 10000,
      ActualQty: 0,
      ActualQtyRack: null,
    }).ActualQty,
    null,
  );
});
test("warehouse review remains unchanged", () => {
  const row = { Location: "WAREHOUSE", SystemQty: 1000, ActualQty: 900 };
  assert.equal(toCountingReviewRow(row), row);
});
