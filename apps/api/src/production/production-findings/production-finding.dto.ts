import { Transform, Type } from 'class-transformer';
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

export class PublicFindingOptionsQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class PublicMaterialFindingOptionDto {
  @ApiProperty() partNumber: string;
  @ApiProperty() partName: string;
}

export class PublicLabelFindingOptionDto {
  @ApiProperty() labelNumber: string;
  @ApiProperty({ minimum: 0 }) labelQty: number;
  @ApiProperty() finishGoodPartNumber: string;
  @ApiProperty() finishGoodPartName: string;
}

export class SubmitMaterialFindingDto {
  @ApiProperty() @IsUUID() requestId: string;
  @ApiProperty() @IsString() @IsNotEmpty() materialId: string;
  @ApiProperty({ enum: ['WAREHOUSE', 'RACK', 'ASSY'] })
  @IsEnum(['WAREHOUSE', 'RACK', 'ASSY'])
  location: 'WAREHOUSE' | 'RACK' | 'ASSY';
  @ApiProperty() @IsInt() @Min(1) qty: number;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1000) reason: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) reporter: string;
}

export class FindingComponentDto {
  @ApiProperty() @IsUUID() snapshotLineId: string;
  @ApiProperty() @IsInt() @Min(1) qty: number;
}

export class PublicFinishGoodFindingContextQueryDto {
  @ApiProperty({ maxLength: 255 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  labelNumber: string;
}

export class PublicFinishGoodFindingComponentDto {
  @ApiProperty({ format: 'uuid' }) snapshotLineId: string;
  @ApiProperty() materialPartNumber: string;
  @ApiProperty() materialPartName: string;
  @ApiProperty({ minimum: 1 }) QtyPerUnit: number;
}

export class PublicFinishGoodFindingContextDto {
  @ApiProperty() labelNumber: string;
  @ApiProperty() finishGoodPartNumber: string;
  @ApiProperty() finishGoodPartName: string;
  @ApiProperty({ minimum: 1 }) labelQty: number;
  @ApiProperty({ type: [PublicFinishGoodFindingComponentDto] })
  components: PublicFinishGoodFindingComponentDto[];
}

export class SubmitFinishGoodFindingDto {
  @ApiProperty() @IsUUID() requestId: string;
  @ApiProperty() @IsString() @IsNotEmpty() labelNumber: string;
  @ApiProperty() @IsInt() @Min(1) qty: number;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1000) reason: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) reporter: string;
  @ApiProperty({ type: [FindingComponentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((line: FindingComponentDto) => line.snapshotLineId)
  @ValidateNested({ each: true })
  @Type(() => FindingComponentDto)
  components: FindingComponentDto[];
}

export class ReviewFindingDto {
  @ApiPropertyOptional({ enum: ['REWORK', 'SCRAP'] })
  @IsOptional()
  @IsEnum(['REWORK', 'SCRAP'])
  disposition?: 'REWORK' | 'SCRAP';
  @ApiProperty() @IsUUID() requestId: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReplacementPickDto extends ReviewFindingDto {
  @ApiProperty() @IsUUID() componentId: string;
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) qty: number;
}

export class RejectFindingDto {
  @ApiProperty() @IsUUID() requestId: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1000) note: string;
}

export class AllocateFindingDto extends ReviewFindingDto {
  @ApiProperty() @IsUUID() componentId: string;
  @ApiProperty() @IsString() @IsNotEmpty() shoppingId: string;
  @ApiProperty() @IsInt() @Min(1) qty: number;
}

export class ProductionFindingQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: ['MATERIAL', 'FINISH_GOOD'] })
  @IsOptional()
  @IsEnum(['MATERIAL', 'FINISH_GOOD'])
  category?: 'MATERIAL' | 'FINISH_GOOD';
  @ApiPropertyOptional({
    enum: ['PENDING', 'WAITING_PART_CHANGE', 'COMPLETED', 'REJECTED'],
  })
  @IsOptional()
  @IsEnum(['PENDING', 'WAITING_PART_CHANGE', 'COMPLETED', 'REJECTED'])
  status?: 'PENDING' | 'WAITING_PART_CHANGE' | 'COMPLETED' | 'REJECTED';
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit =
    20;
}
