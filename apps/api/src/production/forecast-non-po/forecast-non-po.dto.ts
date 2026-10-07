/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';

export class NonPoFieldsDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) partNumber: string;
  @ApiProperty({ example: '2026-10-07' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deliveryDate: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  receivingArea: string;
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) deliveryPeriod: number;
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) qty: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  poNumber?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class CreateNonPoDto extends NonPoFieldsDto {
  @ApiProperty() @IsUUID() requestId: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() confirmDuplicates?: boolean;
}
export class UpdateNonPoDto extends PartialType(NonPoFieldsDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() confirmDuplicates?: boolean;
}
export class NonPoQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() referenceNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() partNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() receivingArea?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() poNumber?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deliveryDate?: string;
}
export class ImportNonPoDto {
  @ApiProperty() @IsUUID() requestId: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^(true|false)$/)
  confirmDuplicates?: string;
}
