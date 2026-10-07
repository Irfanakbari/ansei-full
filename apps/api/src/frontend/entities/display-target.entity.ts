import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DisplayTargetEntity {
  @ApiProperty({ example: 'FG-001' })
  partNumber: string;

  @ApiProperty({ example: 'Cover Assembly A' })
  partName: string;

  @ApiPropertyOptional({ nullable: true, example: 'C-ASM-A' })
  alias: string | null;

  @ApiProperty({
    description:
      'Sum of forecast quantities for this finish good in the active production release',
    example: 120,
  })
  targetQty: number;

  @ApiProperty({
    description:
      'Sum of box quantities with completed assembly for this finish good in the active production release; each box is counted once',
    example: 80,
  })
  actualQty: number;

  @ApiPropertyOptional({ nullable: true, example: 'uuid' })
  productionReleaseId: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'PR-20260917-001' })
  releaseNumber: string | null;
}
