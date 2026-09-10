import { ApiProperty } from '@nestjs/swagger';

/**
 * Satuan Entity - Unit of measurement response format
 */
export class SatuanEntity {
  @ApiProperty({ description: 'ID satuan', example: 1 })
  Id: number;

  @ApiProperty({ description: 'Nama satuan', example: 'PCS' })
  Name: string;
}
