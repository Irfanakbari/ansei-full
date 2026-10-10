import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaterialSource } from '../../../generated/prisma/enums';

/**
 * Material Entity - Material response format with SatuanData
 */
export class SatuanDataEntity {
  @ApiProperty({ description: 'ID satuan', example: 1 })
  Id: number;

  @ApiProperty({ description: 'Nama satuan', example: 'PCS' })
  Name: string;
}

export class MaterialEntity {
  @ApiPropertyOptional({
    enum: ['PENDING', 'SYNCED', 'FAILED', 'NOT_REQUESTED', 'DISABLED'],
    description:
      'Delivery status of the latest current material edit to SAP, separate from item existence',
  })
  SAPUpdateStatus?: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  SAPUpdateCheckedAt?: string | null;

  @ApiPropertyOptional({
    enum: ['SYNCED', 'NOT_FOUND', 'UNKNOWN'],
    description:
      'GET only: existence in configured SAP item group; UNKNOWN when unavailable',
  })
  SAPSyncStatus?: 'SYNCED' | 'NOT_FOUND' | 'UNKNOWN';

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Last complete SAP snapshot timestamp',
  })
  SAPSyncCheckedAt?: string | null;

  @ApiPropertyOptional({
    description: 'Snapshot is older than the refresh interval',
  })
  SAPSyncStale?: boolean;

  @ApiProperty({ description: 'ID material', example: 1 })
  Id: number;

  @ApiProperty({ description: 'Part number', example: 'MAT-001' })
  PartNumber: string;

  @ApiProperty({ description: 'SAP part number', type: String, nullable: true })
  PartNumberSAP: string | null;

  @ApiProperty({ description: 'Nama part', example: 'Baut M10x30' })
  PartName: string;

  @ApiProperty({
    description: 'Tanggal dibuat',
    example: '2026-01-15T08:00:00.000Z',
  })
  CreatedAt: Date;

  @ApiProperty({ description: 'Dibuat oleh', example: 'admin' })
  CreatedBy: string;

  @ApiPropertyOptional({ description: 'Nama user pembuat' })
  CreatedByName?: string;

  @ApiProperty({
    description: 'Tanggal update',
    example: '2026-06-14T09:00:00.000Z',
  })
  UpdatedAt: Date;

  @ApiProperty() UpdatedBy: string;

  @ApiPropertyOptional({ description: 'Nama user pengubah' })
  UpdatedByName?: string;

  @ApiPropertyOptional({
    description: 'Nama supplier',
    nullable: true,
    example: 'PT Supplier ABC',
  })
  Supplier: string | null;

  @ApiPropertyOptional({ description: 'ID satuan', nullable: true, example: 1 })
  SatuanId: number | null;

  @ApiPropertyOptional({
    description: 'Lokasi rak',
    nullable: true,
    example: 'R-A01',
  })
  RackLocation: string | null;

  @ApiProperty({ description: 'Qty di rak', example: 100 })
  QtyRack: number;

  @ApiProperty({ description: 'Qty di gudang', example: 500 })
  QtyWarehouse: number;

  @ApiProperty({ description: 'Minimum stock', example: 100 })
  MinimumStock: number;

  @ApiProperty({
    description: 'Maximum stock; 0 means not configured',
    example: 500,
  })
  MaximumStock: number;

  @ApiProperty({ description: 'Record-only quantity per box', example: 20 })
  QtyPerBox: number;

  @ApiProperty({ description: 'Status aktif material', example: true })
  IsActive: boolean;

  @ApiPropertyOptional({
    description: 'Tanggal discontinue material',
    nullable: true,
    example: '2026-07-20T10:00:00.000Z',
  })
  DiscontinueDate: Date | null;

  @ApiPropertyOptional({
    description: 'Sumber material',
    enum: MaterialSource,
    example: MaterialSource.LOKAL,
  })
  MaterialSource: MaterialSource | null;

  @ApiPropertyOptional({
    description: 'Remark / catatan tambahan',
    nullable: true,
    example: 'Material pengganti',
  })
  Remark: string | null;

  @ApiPropertyOptional({
    description: 'Data satuan',
    nullable: true,
    type: SatuanDataEntity,
  })
  SatuanData: SatuanDataEntity | null;
}
