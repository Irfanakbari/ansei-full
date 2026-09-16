import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * FinishGood Entity - Finish Good response format
 */
export class FinishGoodEntity {
  @ApiProperty({ description: 'ID finish good', example: 1 })
  Id: number;

  @ApiProperty({ description: 'Part number', example: 'FG-001' })
  PartNumber: string;

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

  @ApiProperty({ description: 'Qty stok', example: 200 })
  Qty: number;
}
