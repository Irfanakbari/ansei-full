import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SearchPaginationQueryDto } from '../../../common/dto/search-pagination-query.dto';
import { ProductionStatus } from '../../../generated/prisma/enums';

export class ProductionReleaseQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ enum: ProductionStatus })
  @IsOptional()
  @IsEnum(ProductionStatus)
  status?: ProductionStatus;
}
