import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FrontendFinishGoodEntity {
  @ApiProperty({ description: 'Part number finish good', example: 'FG-001' })
  PartNumber: string;

  @ApiProperty({ description: 'Nama part', example: 'Cover Assembly A' })
  PartName: string;

  @ApiPropertyOptional({
    description: 'Alias part',
    nullable: true,
    example: 'C-ASM-A',
  })
  Alias: string | null;
}
