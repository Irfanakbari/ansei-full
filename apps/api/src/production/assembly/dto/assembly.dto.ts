/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AssemblyStatus } from '../../../generated/prisma/enums';

export class AssemblyOperatorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  manPowerNik: string;
}
export class CompleteAssemblyDto extends AssemblyOperatorDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  requestId: string;
}
export class StartAssemblyDto extends CompleteAssemblyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  labelNumber: string;
}
export class CancelAssemblyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reason: string;
}
export class AssemblyQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  manPowerNik?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  labelNumber?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  productionReleaseId?: string;
  @ApiPropertyOptional({ enum: AssemblyStatus })
  @IsOptional()
  @IsEnum(AssemblyStatus)
  status?: AssemblyStatus;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CompleteInternalAssemblyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  requestId: string;
}
