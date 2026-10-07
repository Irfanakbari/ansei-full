import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { SearchPaginationQueryDto } from '../../../common/dto/search-pagination-query.dto';

export class ProductionReleaseForecastCandidatesQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ enum: ['PO', 'NON_PO'] })
  @IsOptional()
  @IsIn(['PO', 'NON_PO'])
  sourceType?: 'PO' | 'NON_PO';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  poNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  partNumber?: string;

  @ApiPropertyOptional({ example: '2026-10-07' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  deliveryDate?: string;
  @ApiPropertyOptional({ enum: ['tag', 'untag'], default: 'tag' })
  @IsOptional()
  @IsIn(['tag', 'untag'])
  mode: 'tag' | 'untag' = 'tag';
}
