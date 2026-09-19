/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
export class NgLineDto {
  @ApiProperty() @IsString() @IsNotEmpty() materialId: string;
  @ApiProperty() @IsInt() @Min(1) qtyNg: number;
  @ApiProperty() @IsInt() @Min(0) qtyReplacement: number;
}
export class CreateNgCaseDto {
  @ApiProperty() @IsUUID() requestId: string;
  @ApiProperty() @IsString() @IsNotEmpty() forecastId: string;
  @ApiProperty() @IsUUID() snapshotId: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) stage: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1000) reason: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) labelId?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assemblySessionId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  productionReportId?: number;
  @ApiProperty({ type: [NgLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((line: NgLineDto) => line.materialId)
  @ValidateNested({ each: true })
  @Type(() => NgLineDto)
  lines: NgLineDto[];
}
export class IssueNgLineDto {
  @ApiProperty() @IsInt() @Min(1) detailId: number;
  @ApiProperty() @IsInt() @Min(1) qty: number;
}
export class IssueNgDto {
  @ApiProperty() @IsUUID() requestId: string;
  @ApiProperty({ type: [IssueNgLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((line: IssueNgLineDto) => line.detailId)
  @ValidateNested({ each: true })
  @Type(() => IssueNgLineDto)
  lines: IssueNgLineDto[];
}
export class CloseNgDto {
  @ApiProperty() @IsUUID() requestId: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1000) reason: string;
  @ApiProperty({ enum: ['CLOSE', 'CANCEL'] })
  @IsEnum(['CLOSE', 'CANCEL'])
  action: 'CLOSE' | 'CANCEL';
}
export class NgQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() forecastId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['OPEN', 'FULFILLED', 'CLOSED', 'CANCELLED'])
  status?: 'OPEN' | 'FULFILLED' | 'CLOSED' | 'CANCELLED';
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit =
    20;
}
