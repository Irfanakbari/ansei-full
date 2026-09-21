import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateMaterialDto {
  /** Part number material */
  @ApiProperty({ description: 'Part number material', example: 'MAT-001' })
  @IsString()
  @IsNotEmpty()
  partNumber: string;

  /** Nama part material */
  @ApiProperty({ description: 'Nama part', example: 'Baut M10x30' })
  @IsString()
  @IsNotEmpty()
  partName: string;

  @ApiPropertyOptional({
    description: 'Nama supplier (Legacy string)',
    example: 'PT Supplier ABC',
  })
  @IsString()
  @IsOptional()
  supplier?: string;

  @ApiPropertyOptional({
    description: 'ID Supplier (Relasi master supplier)',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  supplierId?: number;

  @ApiPropertyOptional({ description: 'ID satuan', example: 1 })
  @IsInt()
  @IsOptional()
  satuanId?: number;

  @ApiPropertyOptional({
    description: 'Lokasi rak penyimpanan',
    example: 'R-A01',
  })
  @IsString()
  @IsOptional()
  rackLocation?: string;

  @ApiPropertyOptional({ description: 'Minimum stock', example: 100 })
  @IsInt()
  @Min(0)
  @IsOptional()
  minimumStock?: number;

  @ApiPropertyOptional({
    description: 'Maximum stock; 0 means not configured',
    example: 500,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  maximumStock?: number;

  @ApiPropertyOptional({
    description: 'Record-only quantity per box',
    example: 20,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  qtyPerBox?: number;
}
