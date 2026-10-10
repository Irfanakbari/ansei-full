/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
export class SapQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([
    'PENDING',
    'PROCESSING',
    'SYNCED',
    'FAILED',
    'BLOCKED',
    'RECONCILE',
    'CANCELLED',
  ])
  status?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenceId?: string;
}
export class SapActionDto {
  @ApiProperty() @IsUUID() requestId: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(500) reason: string;
}
export class SapMappingDto extends SapActionDto {
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(255) demandId: string;
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) salesOrderEntry: number;
  @ApiProperty() @IsInt() @Min(0) @Max(2147483647) salesOrderLine: number;
}
export class SapAutoSalesDto extends SapActionDto {
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(255) demandId: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(100) cardCode: string;
}
export class SapSettingsDto extends SapActionDto {
  @ApiProperty() @IsBoolean() enabled: boolean;
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(20) projectCode: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(20) costCenter: string;
}
