import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { OpnameStatus } from '../../generated/prisma/enums';

export class InventoryCountingQueryDto {
  @IsOptional()
  @IsString()
  status?: OpnameStatus;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
