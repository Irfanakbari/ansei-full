import { ApiProperty } from '@nestjs/swagger';

/**
 * BoxQTY Entity - Box quantity per part number response format
 */
export class PartDataEntity {
  @ApiProperty({ description: 'Part number', example: 'FG-001' })
  PartNumber: string;

  @ApiProperty({ description: 'Nama part', example: 'Cover Assembly A' })
  PartName: string;
}

export class BoxQTYEntity {
  @ApiProperty({ description: 'ID', example: 1 })
  Id: number;

  @ApiProperty({ description: 'Part number', example: 'FG-001' })
  PartNumber: string;

  @ApiProperty({ description: 'Qty per box', example: 50 })
  Qty: number;

  @ApiProperty({ description: 'Data part terkait', type: PartDataEntity })
  PartData: PartDataEntity;
}
