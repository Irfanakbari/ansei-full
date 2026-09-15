import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ItemCategory, OpnameStatus } from '../../generated/prisma/enums';

export class InventoryCountingQueryDto {
  @IsOptional()
  @IsString()
  status?: OpnameStatus;

  @IsOptional()
  @IsString()
  category?: ItemCategory;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit = 50;
}
