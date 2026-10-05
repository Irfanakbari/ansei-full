import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';

export class CreateDeliveryDto {
  @ApiProperty({
    description:
      'Label number to deliver (qty will be taken from LabelData.QtyThisBox)',
    example: 'LBL001',
  })
  @IsString()
  @IsNotEmpty()
  labelNumber: string;

  @ApiPropertyOptional({
    description: 'Optional Pallet ID / Code for delivery',
    example: 'PP2PANS001',
  })
  @IsOptional()
  @IsString()
  palletNumber?: string;
}

export class DeliveryQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Records per page', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Filter by Forecast ID (PoId)' })
  @IsOptional()
  @IsString()
  forecastId?: string;

  @ApiPropertyOptional({ description: 'Filter by CreatedBy' })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({
    description:
      'Filter records belonging to active (RELEASED) production release only',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  activeReleaseOnly?: boolean;
}
