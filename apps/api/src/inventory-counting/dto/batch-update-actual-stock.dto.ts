import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BatchUpdateActualStockItemDto {
  @IsInt()
  @Min(1)
  detailId: number;

  @IsInt()
  @Min(0)
  actualQty: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  actualQtyRack?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BatchUpdateActualStockDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BatchUpdateActualStockItemDto)
  items: BatchUpdateActualStockItemDto[];
}
