/**
 * MRP Response Entity
 * Represents the structure of MRP calculation response
 */

export interface MrpDayDemandEntity {
  /** Date for this demand entry (YYYY-MM-DD) */
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

export interface MrpMaterialEntity {
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
  /** Daily demand forecast for 7 days (today, H+1, H-1 to H-5) */
  dailyDemand: MrpDayDemandEntity[];
}

export interface MrpDateRangeEntity {
  /** Today's date (YYYY-MM-DD) */
  today: string;
  /** Start date of range (YYYY-MM-DD) */
  startDate: string;
  /** End date of range (YYYY-MM-DD) */
  endDate: string;
}

export interface MrpCalculateEntity {
  /** Calculation timestamp (ISO 8601) */
  calculatedAt: string;
  /** Date range information */
  dateRange: MrpDateRangeEntity;
  /** Array of material MRP data */
  materials: MrpMaterialEntity[];
}
