import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { TypeShopping } from '../../../generated/prisma/enums';

export class CreateShoppingDto {
  /**
   * Forecast ID (PO ID) - WAJIB untuk REGULER, TIDAK WAJIB untuk ADDITIONAL
   */
  @ApiProperty({
    description: 'Forecast ID (PO ID) - wajib untuk REGULER',
    example: 'PO-001',
  })
  @ValidateIf((o) => o.type === 'REGULER')
  @IsString()
  @IsNotEmpty({ message: 'forecastId is required for REGULER shopping' })
  forecastId: string;

  @ApiProperty({ description: 'ID material yang diambil', example: '1' })
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @ApiProperty({ description: 'Qty yang diambil (pick)', example: 50 })
  @IsNumber()
  qtyPick: number;

  @ApiProperty({
    description: 'Tipe shopping',
    enum: ['REGULER', 'ADDITIONAL'],
    example: 'REGULER',
  })
  @IsEnum(TypeShopping)
  type: 'REGULER' | 'ADDITIONAL';

  @ApiPropertyOptional({
    description: 'Keterangan',
    example: 'Picking untuk order PO-001',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
