/**
 * Response DTO for MRP Calculate endpoint
 * Contains material stock information and demand forecast for 6 days
 */

export interface MrpDayDemand {
  /** Date for this demand entry */
  date: string;
  /** Demand quantity for this material on the date */
  demand: number;
  /**
   * Lack quantity = max(0, demand - qtyCurrentTotal)
   * - If demand <= stock: lack = 0 (stock cukup)
   * - If demand > stock: lack = demand - stock (stock kurang)
   */
  lack: number;
  /**
   * Indicator if there's a shortage (lack > 0)
   * Frontend can use this for color coding:
   * - hasShortage: true (RED) = stock kurang, perlu reorder
   * - hasShortage: false (GREEN) = stock cukup
   */
  hasShortage: boolean;
}

export interface MrpMaterialResponse {
  /** Material ID */
  materialId: number;
  /** Part number */
  partNumber: string;
  /** Part name */
  partName: string;
  /** Supplier name */
  supplier: string | null;
  /** Rack location */
  rackLocation: string | null;
  /** Current quantity in rack */
  qtyRack: number;
  /** Current quantity in warehouse */
  qtyWarehouse: number;
  /** Pending quantity from open incoming orders */
  qtyPending: number;
  /** Total current quantity: QtyRack + QtyWarehouse + QtyPending */
  qtyCurrentTotal: number;
  /** Daily demand forecast for 6 days (today, H+1, H-1, H-2, H-3, H-4, H-5) */
  dailyDemand: MrpDayDemand[];
}

export interface MrpCalculateResponse {
  /** Calculation timestamp */
  calculatedAt: string;
  /** Date range info */
  dateRange: {
    today: string;
    startDate: string;
    endDate: string;
  };
  /** Array of material MRP data */
  materials: MrpMaterialResponse[];
}
