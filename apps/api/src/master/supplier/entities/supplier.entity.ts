import { ApiProperty } from '@nestjs/swagger';

/**
 * Supplier Entity - Supplier response format
 */
export class SupplierEntity {
  @ApiProperty({ description: 'ID supplier', example: 1 })
  Id: number;

  @ApiProperty({ description: 'Nama supplier', example: 'PT Supplier ABC' })
  Name: string;

  @ApiProperty({
    description: 'Tanggal dibuat',
    example: '2026-01-15T08:00:00.000Z',
  })
  CreatedAt: Date;
}
