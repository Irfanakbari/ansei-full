import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class SearchPaginationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive search term' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
