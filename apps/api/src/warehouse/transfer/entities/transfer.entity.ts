import { ApiProperty } from '@nestjs/swagger';

export class TransferResultEntity {
  @ApiProperty({ example: 'MAT-001' })
  partNumber: string;

  @ApiProperty({ example: 500 })
  warehouseBefore: number;

  @ApiProperty({ example: 450 })
  warehouseAfter: number;

  @ApiProperty({ example: 100 })
  rackBefore: number;

  @ApiProperty({ example: 150 })
  rackAfter: number;

  @ApiProperty({ example: 50 })
  transferQty: number;

  @ApiProperty({ example: true })
  success: boolean;
}
