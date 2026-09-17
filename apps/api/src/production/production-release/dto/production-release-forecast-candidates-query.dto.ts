import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SearchPaginationQueryDto } from '../../../common/dto/search-pagination-query.dto';

export class ProductionReleaseForecastCandidatesQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ enum: ['tag', 'untag'], default: 'tag' })
  @IsOptional()
  @IsIn(['tag', 'untag'])
  mode: 'tag' | 'untag' = 'tag';
}
