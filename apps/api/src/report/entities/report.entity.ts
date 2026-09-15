import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Stock Material Report Response Entity
 */
export class StockMaterialReportEntity {
  @ApiProperty({ example: 'MAT-001' })
  partNumber: string;

  @ApiProperty({ example: 'Material Name' })
  partName: string;

  @ApiProperty({ example: 'Supplier Name' })
  supplier: string;

  @ApiPropertyOptional({ example: 'RACK-A1' })
  rackLocation: string;

  @ApiProperty({ example: 'PCS' })
  satuanName: string;

  @ApiProperty({ example: 100 })
  qtyRack: number;

  @ApiProperty({ example: 500 })
  qtyWarehouse: number;

  @ApiProperty({ example: 600 })
  totalStock: number;

  @ApiProperty({ example: true })
  isActive: boolean;
}

/**
 * Incoming Warehouse Report Row Entity (flattened with children)
 */
export class IncomingWarehouseReportEntity {
  @ApiProperty({ example: 'INC-001' })
  incomingId: string;

  @ApiProperty({ example: 'PO-2026-001' })
  poId: string;

  @ApiProperty({ example: 'Supplier Name' })
  supplierName: string;

  @ApiProperty({ example: '2026-07-01T10:00:00Z' })
  receivedAt: string;

  @ApiProperty({ example: 'John Doe' })
  receivedBy: string;

  @ApiPropertyOptional({ example: 'Material Part Number' })
  partNumber: string;

  @ApiPropertyOptional({ example: 'Material Name' })
  partName: string;

  @ApiPropertyOptional({ example: 100 })
  qty: number;

  @ApiPropertyOptional({ example: 95 })
  qtyChecked: number;
}

/**
 * Incoming Rack Report Row Entity
 */
export class IncomingRackReportEntity {
  @ApiProperty({ example: 'INC-001' })
  incomingId: string;

  @ApiProperty({ example: 'PO-2026-001' })
  poId: string;

  @ApiProperty({ example: 'Supplier Name' })
  supplierName: string;

  @ApiProperty({ example: '2026-07-01T10:00:00Z' })
  receivedAt: string;

  @ApiProperty({ example: 'John Doe' })
  receivedBy: string;

  @ApiPropertyOptional({ example: 'Material Part Number' })
  partNumber: string;

  @ApiPropertyOptional({ example: 'Material Name' })
  partName: string;

  @ApiPropertyOptional({ example: 100 })
  qty: number;

  @ApiPropertyOptional({ example: 95 })
  qtyChecked: number;
}

/**
 * Transfer Material (Material Delivery Note) Report Entity
 */
export class TransferMaterialReportEntity {
  @ApiProperty({ example: 'SJ-MAT/2026/07/0001' })
  deliveryNoteNum: string;

  @ApiProperty({ example: 'Destination Area A' })
  destination: string;

  @ApiProperty({ example: 'DRAFT' })
  status: string;

  @ApiProperty({ example: '2026-07-01T10:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: 'John Doe' })
  createdBy: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  createdByName?: string;

  @ApiPropertyOptional({ example: '2026-07-01T14:00:00Z' })
  shippedAt: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  shippedBy: string;

  @ApiPropertyOptional({ example: 'Material Part Number' })
  partNumber: string;

  @ApiPropertyOptional({ example: 'Material Name' })
  partName: string;

  @ApiPropertyOptional({ example: 50 })
  qtyRequested: number;

  @ApiPropertyOptional({ example: 50 })
  qtyPicking: number;

  @ApiPropertyOptional({ example: 48 })
  qtyReceived: number;

  @ApiPropertyOptional()
  notes: string;
}

/**
 * Production Release Resume Report Entity
 */
export class ProductionReleaseReportEntity {
  @ApiProperty({ example: 'PR-2026-001' })
  releaseNumber: string;

  @ApiProperty({ example: '2026-07-01' })
  planDate: string;

  @ApiProperty({ example: 'RELEASED' })
  status: string;

  @ApiProperty({ example: 1000 })
  totalTargetQty: number;

  @ApiProperty({ example: 950 })
  totalGoodQty: number;

  @ApiProperty({ example: 50 })
  totalNgQty: number;

  @ApiProperty({ example: '2026-07-01T10:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: 'John Doe' })
  createdBy: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  createdByName?: string;

  @ApiPropertyOptional({ example: 'PO-2026-001' })
  forecastPoId: string;

  @ApiPropertyOptional({ example: 'Finish Good Part Number' })
  fgPartNumber: string;

  @ApiPropertyOptional({ example: 'Finish Good Name' })
  fgPartName: string;

  @ApiPropertyOptional({ example: 100 })
  forecastQty: number;
}

/**
 * Pokayoke Scan History Report Entity
 */
export class PokayokeScanReportEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'LABEL-001' })
  labelNumber: string;

  @ApiProperty({ example: 'PO-2026-001' })
  poId: string;

  @ApiProperty({ example: 'FG-001' })
  partNumber: string;

  @ApiProperty({ example: 'Finish Good Name' })
  partName: string;

  @ApiProperty({ example: 'SUKSES' })
  status: string;

  @ApiProperty({ example: '2026-07-01T10:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: 'John Doe' })
  createdBy: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  createdByName?: string;
}

/**
 * Delivery History Report Entity
 */
export class DeliveryHistoryReportEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'PO-2026-001' })
  forecastId: string;

  @ApiProperty({ example: 'LABEL-001' })
  labelNumber: string;

  @ApiProperty({ example: 'FG-001' })
  finishGoodPartNumber: string;

  @ApiProperty({ example: 'Finish Good Name' })
  finishGoodPartName: string;

  @ApiProperty({ example: 10 })
  qty: number;

  @ApiProperty({ example: '2026-07-01T10:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: 'John Doe' })
  createdBy: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  createdByName?: string;
}

/**
 * Production Report Entity
 */
export class ProductionReportEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '2026-07-01' })
  date: string;

  @ApiProperty({ example: '08:00' })
  time: string;

  @ApiProperty({ example: 'PO-2026-001' })
  poNumber: string;

  @ApiProperty({ example: 'FG-001' })
  finishGoodPartNumber: string;

  @ApiProperty({ example: 'Finish Good Name' })
  finishGoodPartName: string;

  @ApiProperty({ example: 'John Doe' })
  operatorName: string;

  @ApiProperty({ example: 100 })
  qty: number;

  @ApiProperty({ example: 5 })
  ngQty: number;

  @ApiProperty({ example: 95 })
  goodQty: number;

  @ApiPropertyOptional({ example: 30 })
  stopMinute: number;

  @ApiProperty({ example: '2026-07-01T10:00:00Z' })
  createdAt: string;

  @ApiPropertyOptional({ example: '2026-07-01T18:00:00Z' })
  validatedAt: string;

  @ApiPropertyOptional({ example: 'Validator Name' })
  validatedBy: string;
}

/**
 * Shopping History Report Entity
 */
export class ShoppingHistoryReportEntity {
  @ApiProperty({ example: 'SHP-001' })
  id: string;

  @ApiProperty({ example: 'PO-2026-001' })
  forecastId: string;

  @ApiProperty({ example: 'Material Part Number' })
  materialPartNumber: string;

  @ApiProperty({ example: 'Material Name' })
  materialPartName: string;

  @ApiProperty({ example: 'REGULER' })
  type: string;

  @ApiProperty({ example: 50 })
  qtyPick: number;

  @ApiPropertyOptional({ example: 'Description text' })
  description: string;

  @ApiProperty({ example: '2026-07-01T10:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: 'John Doe' })
  createdBy: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  createdByName?: string;
}

/**
 * Material NG Report Entity
 */
export class MaterialNgReportEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Material Part Number' })
  materialPartNumber: string;

  @ApiProperty({ example: 'Material Name' })
  materialPartName: string;

  @ApiProperty({ example: 10 })
  qty: number;

  @ApiProperty({ example: 'Defect description' })
  description: string;

  @ApiProperty({ example: '2026-07-01T10:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: 'John Doe' })
  createdBy: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  createdByName?: string;
}

/**
 * Inventory Ledger Report Entity
 */
export class InventoryLedgerReportEntity {
  @ApiProperty({ example: 'uuid-string' })
  id: string;

  @ApiProperty({ example: '2026-07-01' })
  transactionDate: string;

  @ApiProperty({ example: 'MATERIAL' })
  itemCategory: string;

  @ApiPropertyOptional({ example: 'Material Part Number' })
  materialPartNumber: string;

  @ApiPropertyOptional({ example: 'Finish Good Part Number' })
  finishGoodPartNumber: string;

  @ApiProperty({ example: 'WAREHOUSE' })
  location: string;

  @ApiProperty({ example: 'INCOMING_SUPPLIER' })
  transactionType: string;

  @ApiProperty({ example: 'PO-2026-001' })
  referenceDoc: string;

  @ApiProperty({ example: 100 })
  balanceBefore: number;

  @ApiProperty({ example: 50 })
  qtyIn: number;

  @ApiProperty({ example: 0 })
  qtyOut: number;

  @ApiProperty({ example: 150 })
  balanceAfter: number;

  @ApiPropertyOptional({ example: 'Notes text' })
  notes: string;

  @ApiProperty({ example: 'John Doe' })
  createdBy: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  createdByName?: string;
}

/**
 * Generic report metadata
 */
export class ReportMetadataEntity {
  @ApiProperty({ example: 'Stock Material Report' })
  reportName: string;

  @ApiProperty({ example: '2026-07-24' })
  generatedAt: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-07-24' })
  toDate?: string;

  @ApiProperty({ example: 100 })
  totalRecords: number;
}
