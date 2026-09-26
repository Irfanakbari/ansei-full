import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIncomingMaterialDto {
  @ApiProperty({ description: 'ID material', example: 1 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  materialId: number;

  @ApiProperty({ description: 'Qty material masuk', example: 100 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  qty: number;
}

export class CreateIncomingDto {
  /** PO ID dari supplier */
  @ApiProperty({ description: 'PO ID supplier', example: 'PO-SUP-001' })
  @IsString()
  @IsNotEmpty()
  poId: string;

  @ApiPropertyOptional({
    description: 'Keterangan',
    example: 'Incoming material batch 1',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Penerima barang', example: 'Budi' })
  @IsString()
  @IsNotEmpty()
  receivedBy: string;

  @ApiProperty({ description: 'ID supplier', example: 1 })
  @IsNumber()
  supplierId: number;

  @ApiProperty({
    description: 'Daftar material yang masuk',
    type: [CreateIncomingMaterialDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateIncomingMaterialDto)
  materials: CreateIncomingMaterialDto[];
}
