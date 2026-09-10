import { ApiProperty } from '@nestjs/swagger';

/**
 * BillOfMaterials Entity - BOM response format
 */
export class FGDataEntity {
  @ApiProperty({ description: 'ID finish good', example: 1 })
  Id: number;

  @ApiProperty({ description: 'Part number FG', example: 'FG-001' })
  PartNumber: string;

  @ApiProperty({ description: 'Nama part FG', example: 'Cover Assembly A' })
  PartName: string;
}

export class MaterialDataEntity {
  @ApiProperty({ description: 'ID material', example: 1 })
  Id: number;

  @ApiProperty({ description: 'Part number material', example: 'MAT-001' })
  PartNumber: string;

  @ApiProperty({ description: 'Nama part material', example: 'Baut M10x30' })
  PartName: string;
}

export class BillOfMaterialsEntity {
  @ApiProperty({ description: 'ID BOM', example: 1 })
  Id: number;

  @ApiProperty({ description: 'ID material', example: 1 })
  MaterialId: number;

  @ApiProperty({ description: 'ID finish good', example: 1 })
  FinishGoodId: number;

  @ApiProperty({ description: 'Qty kebutuhan per unit FG', example: 4 })
  Qty: number;

  @ApiProperty({ description: 'Data finish good', type: FGDataEntity })
  FGData: FGDataEntity;

  @ApiProperty({ description: 'Data material', type: MaterialDataEntity })
  MaterialData: MaterialDataEntity;
}
