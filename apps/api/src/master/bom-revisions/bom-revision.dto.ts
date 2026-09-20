/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
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
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BomRevisionStatus } from '../../generated/prisma/enums';

export class RevisionLineDto {
  @ApiProperty() @IsInt() @Min(1) materialId: number;
  @ApiProperty() @IsInt() @Min(1) @Max(1000000) qty: number;
}
export class CreateRevisionDto {
  @ApiProperty() @IsInt() @Min(1) finishGoodId: number;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1000) reason: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() copyFromId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() importLegacy?: boolean;
  @ApiPropertyOptional({ type: [RevisionLineDto] })
  @IsOptional()
  @IsArray()
  @ArrayUnique((v: RevisionLineDto) => v.materialId)
  @ValidateNested({ each: true })
  @Type(() => RevisionLineDto)
  lines?: RevisionLineDto[];
}
export class RevisionActionDto {
  @ApiProperty() @IsInt() @Min(1) expectedVersion: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
export class UpdateRevisionDto extends RevisionActionDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Active revision observed while reviewing this edit; null for the first baseline.',
  })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsUUID()
  expectedActiveRevisionId: string | null;
  @ApiProperty({ type: [RevisionLineDto] })
  @IsArray()
  @ArrayUnique((v: RevisionLineDto) => v.materialId)
  @ValidateNested({ each: true })
  @Type(() => RevisionLineDto)
  lines: RevisionLineDto[];
}
export class RevisionQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  finishGoodId?: number;
  @ApiPropertyOptional({ enum: BomRevisionStatus })
  @IsOptional()
  @IsEnum(BomRevisionStatus)
  status?: BomRevisionStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['true', 'false'])
  active?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
