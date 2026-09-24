import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { SearchPaginationQueryDto } from '../../../common/dto/search-pagination-query.dto';

export class MaterialQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by Supplier ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;
}
