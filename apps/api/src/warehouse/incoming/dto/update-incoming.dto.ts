import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateIncomingMaterialDto {
  @ApiProperty({ description: 'ID material', example: 1 })
  @IsNumber()
  materialId: number;

  @ApiProperty({ description: 'Qty material', example: 150 })
  @IsNumber()
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
  @IsNumber()
  supplierId?: number;

  @ApiPropertyOptional({
    description: 'Daftar material yang diupdate',
    type: [UpdateIncomingMaterialDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateIncomingMaterialDto)
  materials?: UpdateIncomingMaterialDto[];
}
