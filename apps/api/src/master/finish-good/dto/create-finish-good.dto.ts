import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
} from 'class-validator';

export class CreateFinishGoodDto {
  /** Part number finish good */
  @ApiProperty({ description: 'Part number finish good', example: 'FG-001' })
  @IsString()
  @IsNotEmpty()
  partNumber: string;

  /** Nama part finish good */
  @ApiProperty({ description: 'Nama part', example: 'Cover Assembly A' })
  @IsString()
  @IsNotEmpty()
  partName: string;

  @ApiPropertyOptional({
    description: 'Alias part finish good',
    example: 'C-ASM-A',
  })
  @IsString()
  @IsOptional()
  alias?: string;

  @ApiPropertyOptional({ description: 'Harga per unit', example: 15000 })
  @IsNumber()
  @IsOptional()
  @IsPositive()
  price?: number;

  @ApiPropertyOptional({ description: 'Qty stok', example: 200 })
  @IsNumber()
  @IsOptional()
  qty?: number;
}
