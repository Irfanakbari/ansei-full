/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
import type { InventoryCountingDetailEntity } from "@/store/features/warehouse/inventoryCounting/inventoryCountingSlice";

// The API stores rack snapshots separately from warehouse snapshots.
export function toCountingReviewRow(
  detail: InventoryCountingDetailEntity,
): InventoryCountingDetailEntity {
  if (detail.Location !== "RACK") return detail;
  return {
    ...detail,
    SystemQty: detail.SystemQtyRack,
    ActualQty: detail.ActualQtyRack,
    DiffQty:
      detail.ActualQtyRack === null
        ? null
        : detail.ActualQtyRack - detail.SystemQtyRack,
  };
}
