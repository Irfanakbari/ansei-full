import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class SystemLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Search process, function, status, or creator',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by FunctionId' })
  @IsOptional()
  @IsString()
  functionId?: string;

  @ApiPropertyOptional({ description: 'Filter by ProcessStatus' })
  @IsOptional()
  @IsString()
  processStatus?: string;
}
