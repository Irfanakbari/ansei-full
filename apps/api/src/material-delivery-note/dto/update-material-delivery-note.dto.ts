import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMaterialDeliveryNoteDto {
  @ApiPropertyOptional({
    description: 'Destination/location',
    example: 'Gudang Subcont B',
  })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({
    description: 'Notes/reason',
    example: 'Updated notes',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PickItemDto {
  @ApiProperty({ description: 'Material PartNumber', example: 'MAT-001' })
  @IsString()
  materialId: string;

  @ApiProperty({ description: 'Picked quantity', example: 100 })
  @IsNumber()
  qtyPicking: number;
}

export class PickMaterialDto {
  @ApiProperty({
    description: 'List of materials with picked quantities',
    type: [PickItemDto],
    example: [
      { materialId: 'MAT-001', qtyPicking: 100 },
      { materialId: 'MAT-002', qtyPicking: 50 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickItemDto)
  items: PickItemDto[];
}
