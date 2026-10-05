import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class PreDeliveryQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of records per page',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Filter by ProductionRelease ID (UUID)' })
  @IsOptional()
  @IsString()
  productionReleaseId?: string;

  @ApiPropertyOptional({ description: 'Filter by Forecast ID (PoId)' })
  @IsOptional()
  @IsString()
  forecastId?: string;

  @ApiPropertyOptional({ description: 'Filter by FinishGood PartNumber' })
  @IsOptional()
  @IsString()
  finishGoodId?: string;

  @ApiPropertyOptional({ description: 'Filter by LabelNumber (partial match)' })
  @IsOptional()
  @IsString()
  labelNumber?: string;

  @ApiPropertyOptional({
    description:
      'Filter by Scanned status (true = scanned, false = not scanned)',
  })
  @IsOptional()
  @Type(() => Boolean)
  scanned?: boolean;

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
