import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsInt } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SearchPaginationQueryDto } from '../../../common/dto/search-pagination-query.dto';

export class MaterialQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Return all materials with only ID, part number, and part name, without pagination',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  option?: boolean;

  @ApiPropertyOptional({ description: 'Filter by Supplier ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;
}
