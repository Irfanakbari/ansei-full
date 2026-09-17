import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { SearchPaginationQueryDto } from '../../../common/dto/search-pagination-query.dto';

export class ForecastQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Delivery date range start (inclusive)',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  deliveryDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Delivery date range end (inclusive)',
    example: '2026-09-30',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  deliveryDateTo?: string;
}
