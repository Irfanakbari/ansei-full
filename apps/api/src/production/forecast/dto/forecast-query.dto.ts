import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { SearchPaginationQueryDto } from '../../../common/dto/search-pagination-query.dto';

export class ForecastQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by exact or partial PO Number',
    example: 'PO-12345',
  })
  @IsOptional()
  @IsString()
  poNumber?: string;

  @ApiPropertyOptional({
    description: 'Filter by exact or partial Part Number',
    example: 'PN-9876',
  })
  @IsOptional()
  @IsString()
  partNumber?: string;

  @ApiPropertyOptional({
    description: 'Filter by exact delivery date',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  deliveryDate?: string;

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
