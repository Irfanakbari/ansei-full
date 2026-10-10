import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  ValidateIf,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
} from 'class-validator';

export class CreateFinishGoodDto {
  @ApiPropertyOptional({
    description: 'Skip assembly after shopping',
    default: false,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isPassthrough?: boolean;

  /** Part number finish good */
  @ApiProperty({ description: 'Part number finish good', example: 'FG-001' })
  @IsString()
  @IsNotEmpty()
  partNumber: string;

  @ApiPropertyOptional({
    description:
      'SAP item code; multiple Genba finish goods may share this code',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  partNumberSAP?: string | null;

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
