import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * FinishGood Entity - Finish Good response format
 */
export class FinishGoodEntity {
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

  @ApiProperty({ description: 'Skip assembly after shopping' })
  IsPassthrough: boolean;

  @ApiProperty({ description: 'ID finish good', example: 1 })
  Id: number;

  @ApiProperty({ description: 'Part number', example: 'FG-001' })
  PartNumber: string;

  @ApiProperty({
    description: 'SAP item code; may be shared by multiple Genba finish goods',
    type: String,
    nullable: true,
  })
  PartNumberSAP: string | null;

  @ApiProperty({ description: 'Nama part', example: 'Cover Assembly A' })
  PartName: string;

  @ApiPropertyOptional({
    description: 'Alias part finish good',
    nullable: true,
    example: 'C-ASM-A',
  })
  Alias: string | null;

  @ApiPropertyOptional({
    description: 'Harga per unit',
    nullable: true,
    example: 15000,
  })
  Price: number | null;

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

  @ApiProperty({ description: 'Qty stok', example: 200 })
  Qty: number;

  @ApiProperty({ description: 'Status aktif finish good', example: true })
  IsActive: boolean;

  @ApiPropertyOptional({
    description: 'Tanggal discontinue finish good',
    nullable: true,
    example: '2026-07-20T10:00:00.000Z',
  })
  DiscontinueDate: Date | null;
}
