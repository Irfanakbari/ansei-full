import { SearchPaginationQueryDto } from '../../../common/dto/search-pagination-query.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  ValidateIf,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { TypeShopping } from '../../../generated/prisma/enums';

export class CreateShoppingDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() requestId: string;
  @ApiProperty({ enum: ['STANDARD', 'NON_PRODUCTION'] })
  @IsEnum(['STANDARD', 'NON_PRODUCTION'])
  purpose: 'STANDARD' | 'NON_PRODUCTION';
  @ApiPropertyOptional() @IsOptional() @IsUUID() snapshotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() destination?: string;
  /**
   * Forecast ID (PO ID) - WAJIB untuk REGULER, TIDAK WAJIB untuk ADDITIONAL
   */
  @ApiPropertyOptional({
    description: 'Forecast ID (PO ID) - wajib untuk REGULER',
    example: 'PO-001',
  })
  @ValidateIf((o) => o.type === 'REGULER')
  @IsString()
  @IsNotEmpty({ message: 'forecastId is required for REGULER shopping' })
  @IsOptional()
  forecastId?: string;

  @ApiProperty({ description: 'ID material yang diambil', example: '1' })
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @ApiProperty({ description: 'Qty yang diambil (pick)', example: 50 })
  @IsInt()
  @Min(1)
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

export class ShoppingQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ enum: ['OPERATIONS'] })
  @IsOptional()
  @IsEnum(['OPERATIONS'])
  scope?: 'OPERATIONS';

  @ApiPropertyOptional({
    enum: [
      'STANDARD',
      'NG_REPLACEMENT',
      'NON_PRODUCTION',
      'LEGACY_UNCLASSIFIED',
    ],
  })
  @IsOptional()
  @IsEnum([
    'STANDARD',
    'NG_REPLACEMENT',
    'NON_PRODUCTION',
    'LEGACY_UNCLASSIFIED',
  ])
  purpose?:
    'STANDARD' | 'NG_REPLACEMENT' | 'NON_PRODUCTION' | 'LEGACY_UNCLASSIFIED';
}
