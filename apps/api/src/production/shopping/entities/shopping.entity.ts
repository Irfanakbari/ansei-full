import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Material Entity - For Shopping response
 */
export class MaterialEntity {
  @ApiProperty({ description: 'ID material', example: 1 })
  Id: number;

  @ApiProperty({ description: 'Part number material', example: 'MAT-001' })
  PartNumber: string;

  @ApiProperty({ description: 'Nama part material', example: 'Baut M10x30' })
  PartName: string;

  @ApiProperty({ description: 'Qty di rack', example: 250 })
  QtyRack: number;
}

/**
 * Forecast Entity - For Shopping response
 */
export class ForecastEntity {
  @ApiProperty({ description: 'ID forecast', example: 1 })
  Id: number;

  @ApiProperty({ description: 'PO ID forecast', example: 'PO-001' })
  PoId: string;

  @ApiProperty({ description: 'Qty forecast', example: 100 })
  Qty: number;

  @ApiProperty({
    description: 'Tanggal pengiriman',
    example: '2026-07-15T00:00:00.000Z',
  })
  DeliveryDate: Date;
}

/**
 * Shopping Entity - Shopping response format
 */
export class ShoppingEntity {
  @ApiProperty({
    description: 'ID shopping (UUID)',
    example: 'a0b1c2d3-e4f5-6a7b-8c9d-0e1f2a3b4c5d',
  })
  Id: string;

  @ApiPropertyOptional({
    description: 'Keterangan picking',
    nullable: true,
    example: 'Picking untuk order PO-001',
  })
  Description: string | null;

  @ApiProperty({ description: 'Tipe shopping', example: 'REGULER' })
  Type: string;

  @ApiProperty({
    description: 'Waktu dibuat',
    example: '2026-06-14T17:00:00.000Z',
  })
  CreatedAt: Date;

  @ApiProperty({
    description: 'Waktu diupdate',
    example: '2026-06-14T17:15:00.000Z',
  })
  UpdatedAt: Date;

  @ApiProperty({ description: 'ID forecast terkait', example: 'PO-001' })
  ProductionDemandId: string;

  @ApiProperty({ description: 'User pembuat', example: 'operator1' })
  CreatedBy: string;

  @ApiPropertyOptional({ description: 'Nama user pembuat' })
  CreatedByName?: string;

  @ApiProperty({ description: 'Qty yang dipick', example: 50 })
  QtyPick: number;

  @ApiProperty({ description: 'ID material terkait', example: '1' })
  MaterialId: string;

  @ApiProperty({ description: 'Data forecast terkait', type: ForecastEntity })
  ForecastData: ForecastEntity;

  @ApiProperty({ description: 'Data material terkait', type: MaterialEntity })
  MaterialData: MaterialEntity;
}

/**
 * Shopping Pick Result - Result after picking
 */
export class ShoppingPickResult {
  @ApiProperty({
    description: 'ID shopping',
    example: 'a0b1c2d3-e4f5-6a7b-8c9d-0e1f2a3b4c5d',
  })
  id: string;

  @ApiProperty({ description: 'Forecast ID', example: 'PO-001' })
  forecastId: string;

  @ApiProperty({ description: 'Material ID', example: '1' })
  materialId: string;

  @ApiProperty({ description: 'Qty yang dipick', example: 50 })
  qtyPicked: number;

  @ApiProperty({ description: 'Nama material', example: 'Baut M10x30' })
  materialName: string;

  @ApiProperty({ description: 'Saldo rack sebelum picking', example: 250 })
  rackBalanceBefore: number;

  @ApiProperty({ description: 'Saldo rack setelah picking', example: 200 })
  rackBalanceAfter: number;

  @ApiProperty({ description: 'Status update inventory', example: true })
  inventoryUpdated: boolean;
}

/**
 * Bom Summary Entity
 */
export class BomSummaryEntity {
  @ApiProperty() standardRequired: number;
  @ApiProperty() standardIssued: number;
  @ApiProperty() replacementIssued: number;
  @ApiProperty() remainingReplacement: number;
  @ApiProperty({ description: 'ID material', example: 'MAT-001' })
  materialId: string;

  @ApiProperty({ description: 'Nama material', example: 'Baut M10x30' })
  materialName: string;

  @ApiProperty({ description: 'Qty kebutuhan per unit FG', example: 2 })
  bomQtyPerUnit: number;

  @ApiProperty({
    description: 'Total kebutuhan untuk forecast qty',
    example: 200,
  })
  totalRequired: number;

  @ApiProperty({ description: 'Qty yang sudah dipick', example: 150 })
  alreadyPicked: number;

  @ApiProperty({ description: 'Sisa qty yang harus dipick', example: 50 })
  remainingToPick: number;

  @ApiProperty({
    description: 'Apakah material ini sudah selesai dipick',
    example: false,
  })
  isCompleted: boolean;
}

/**
 * Forecast Picking Status Progress Entity
 */
export class ForecastPickingStatusProgressEntity {
  @ApiProperty({ description: 'Total jenis material', example: 5 })
  totalMaterials: number;

  @ApiProperty({
    description: 'Jumlah material yang selesai dipick',
    example: 4,
  })
  completedMaterials: number;

  @ApiProperty({ description: 'Persentase total picking', example: 80 })
  totalPickedPercent: number;
}

/**
 * Forecast Picking Status Entity
 */
export class ForecastPickingStatusEntity {
  @ApiProperty() snapshotId: string;
  @ApiProperty() bomRevision: number;
  @ApiProperty({ description: 'ID Forecast', example: 'PO-001' })
  forecastId: string;

  @ApiProperty({ description: 'ID Finish Good', example: 'FG-001' })
  finishGoodId: string;

  @ApiProperty({ description: 'Nama Finish Good', example: 'Cover Assembly A' })
  finishGoodName: string;

  @ApiProperty({ description: 'Qty forecast', example: 100 })
  forecastQty: number;

  @ApiPropertyOptional({
    description: 'Status rilis produksi',
    nullable: true,
    example: 'RELEASED',
  })
  status: string | null;

  @ApiProperty({
    description: 'Rangkuman status per BOM material',
    type: [BomSummaryEntity],
  })
  bomSummary: BomSummaryEntity[];

  @ApiProperty({
    description: 'Progress picking',
    type: ForecastPickingStatusProgressEntity,
  })
  progress: ForecastPickingStatusProgressEntity;
}

/**
 * Check Requirement Item Entity
 */
export class CheckRequirementItemEntity {
  @ApiProperty() standardRequired: number;
  @ApiProperty() standardIssued: number;
  @ApiProperty() replacementIssued: number;
  @ApiProperty() remainingReplacement: number;
  @ApiProperty({ description: 'ID material', example: 'MAT-001' })
  materialId: string;

  @ApiProperty({ description: 'Nama material', example: 'Baut M10x30' })
  materialName: string;

  @ApiProperty({ description: 'BOM qty per unit FG', example: 2 })
  bomQtyPerUnit: number;

  @ApiProperty({ description: 'Total qty dibutuhkan', example: 200 })
  qtyNeeded: number;

  @ApiProperty({ description: 'Total qty sudah dipick', example: 200 })
  qtyPicked: number;

  @ApiProperty({ description: 'Sisa qty yang harus dipick', example: 0 })
  qtyRemaining: number;

  @ApiProperty({
    description: 'Apakah status picking untuk material ini sudah selesai',
    example: true,
  })
  isCompleted: boolean;
}

/**
 * Check Requirement Summary Entity
 */
export class CheckRequirementSummaryEntity {
  @ApiProperty({ description: 'Total jenis material', example: 5 })
  totalMaterials: number;

  @ApiProperty({
    description: 'Jumlah material yang selesai dipick',
    example: 5,
  })
  completedMaterials: number;

  @ApiProperty({
    description: 'Total qty dibutuhkan dari semua material',
    example: 1000,
  })
  totalQtyNeeded: number;

  @ApiProperty({
    description: 'Total qty sudah dipick dari semua material',
    example: 1000,
  })
  totalQtyPicked: number;

  @ApiProperty({
    description: 'Total sisa qty dari semua material',
    example: 0,
  })
  totalQtyRemaining: number;

  @ApiProperty({ description: 'Persentase total picking', example: 100 })
  overallPercentage: number;
}

/**
 * Check Requirement Response Entity
 */
export class CheckRequirementResponseEntity {
  @ApiProperty() snapshotId: string;
  @ApiProperty() bomRevision: number;
  @ApiProperty({ description: 'ID Forecast (PO ID)', example: 'PO-001' })
  forecastId: string;

  @ApiProperty({ description: 'ID Finish Good', example: 'FG-001' })
  finishGoodId: string;

  @ApiProperty({ description: 'Nama Finish Good', example: 'Cover Assembly A' })
  finishGoodName: string;

  @ApiProperty({ description: 'Qty forecast', example: 100 })
  forecastQty: number;

  @ApiPropertyOptional({
    description: 'Status rilis produksi',
    nullable: true,
    example: 'RELEASED',
  })
  productionReleaseStatus: string | null;

  @ApiProperty({
    description: 'Daftar item requirement',
    type: [CheckRequirementItemEntity],
  })
  requirements: CheckRequirementItemEntity[];

  @ApiProperty({
    description: 'Rangkuman requirement',
    type: CheckRequirementSummaryEntity,
  })
  summary: CheckRequirementSummaryEntity;
}
