import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for individual material check-in
 */
export class CheckIncomingMaterialDto {
  @ApiProperty({ description: 'ID incoming material', example: 1 })
  @IsNumber()
  incomingMaterialId: number;

  @ApiProperty({
    description: 'Qty yang dicek/real (QtyChecked)',
    example: 100,
  })
  @IsNumber()
  @IsNotEmpty()
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
  @ValidateNested({ each: true })
  @Type(() => CheckIncomingMaterialDto)
  materials: CheckIncomingMaterialDto[];
}
