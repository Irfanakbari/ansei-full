import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for individual material check-in
 */
export class CheckIncomingMaterialDto {
  @ApiProperty({ description: 'ID incoming material', example: 1 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  incomingMaterialId: number;

  @ApiProperty({
    description: 'Qty yang dicek/real (QtyChecked)',
    example: 100,
  })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  qtyChecked: number;
}

/**
 * DTO for check-in incoming materials
 * This endpoint is used to submit QtyChecked for incoming materials
 */
export class CheckIncomingDto {
  @ApiProperty({
    description: 'Daftar material yang dicek beserta QtyChecked',
    type: [CheckIncomingMaterialDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckIncomingMaterialDto)
  materials: CheckIncomingMaterialDto[];
}
