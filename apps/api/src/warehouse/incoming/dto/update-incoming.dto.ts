import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateIncomingMaterialDto {
  @ApiProperty({ description: 'ID material', example: 1 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  materialId: number;

  @ApiProperty({ description: 'Qty material', example: 150 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  qty: number;
}

export class UpdateIncomingDto {
  @ApiPropertyOptional({
    description: 'Keterangan',
    example: 'Updated incoming batch',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Penerima barang', example: 'Andi' })
  @IsOptional()
  @IsString()
  receivedBy?: string;

  @ApiPropertyOptional({ description: 'ID supplier', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  supplierId?: number;

  @ApiPropertyOptional({
    description: 'Daftar material yang diupdate',
    type: [UpdateIncomingMaterialDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateIncomingMaterialDto)
  materials?: UpdateIncomingMaterialDto[];
}
