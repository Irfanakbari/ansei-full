import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    description:
      'Search by part number, part name, reference doc, or created by',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by status: ALL, COMPLETED, REVERTED',
    enum: ['ALL', 'COMPLETED', 'REVERTED'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'COMPLETED', 'REVERTED'])
  status?: 'ALL' | 'COMPLETED' | 'REVERTED';
}
