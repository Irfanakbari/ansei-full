import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

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
    description: 'Nama supplier',
    example: 'PT Supplier ABC',
  })
  @IsString()
  @IsOptional()
  supplier?: string;

  @ApiPropertyOptional({ description: 'ID satuan', example: 1 })
  @IsNumber()
  @IsOptional()
  satuanId?: number;

  @ApiPropertyOptional({
    description: 'Lokasi rak penyimpanan',
    example: 'R-A01',
  })
  @IsString()
  @IsOptional()
  rackLocation?: string;

  @ApiPropertyOptional({ description: 'Qty di rak', example: 100 })
  @IsNumber()
  @IsOptional()
  qtyRack?: number;

  @ApiPropertyOptional({ description: 'Qty di gudang', example: 500 })
  @IsNumber()
  @IsOptional()
  qtyWarehouse?: number;
}
