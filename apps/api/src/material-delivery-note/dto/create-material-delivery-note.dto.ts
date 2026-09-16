import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMaterialDeliveryNoteItemDto {
  @ApiProperty({ description: 'Material PartNumber', example: 'MAT-001' })
  @IsString()
  materialId: string;

  @ApiProperty({ description: 'Requested quantity', example: 100 })
  @IsNumber()
  @Min(1)
  qtyRequested: number;

  @ApiPropertyOptional({
    description: 'Temporary finish good part number reference',
    example: 'FG-001',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  FinishGoodPartTemp?: string;
}

export class CreateMaterialDeliveryNoteDto {
  @ApiProperty({
    description: 'Destination/location',
    example: 'Gudang Subcont A',
  })
  @IsString()
  destination: string;

  @ApiPropertyOptional({
    description: 'Notes/reason',
    example: 'Transfer untuk produksi outsourcing',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Temporary finish good part number reference for all items',
    example: 'FG-001',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  FinishGoodPartTemp?: string;

  @ApiProperty({
    description: 'List of materials to deliver',
    type: [CreateMaterialDeliveryNoteItemDto],
    example: [
      {
        materialId: 'MAT-001',
        qtyRequested: 100,
        FinishGoodPartTemp: 'FG-001',
      },
      {
        materialId: 'MAT-002',
        qtyRequested: 50,
        FinishGoodPartTemp: 'FG-002',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMaterialDeliveryNoteItemDto)
  items: CreateMaterialDeliveryNoteItemDto[];
}
