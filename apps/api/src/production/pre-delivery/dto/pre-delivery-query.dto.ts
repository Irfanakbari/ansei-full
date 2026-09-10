import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, IsBoolean } from 'class-validator';

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
}
