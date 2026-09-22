import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LocationType } from '../../generated/prisma/enums';

export class OcrInventoryCountingResultDto {
  @IsInt()
  @Min(1)
  detailId: number;

  @IsString()
  @MaxLength(255)
  partNumber: string;

  @IsIn([
    LocationType.WAREHOUSE,
    LocationType.RACK,
    LocationType.FINISH_GOOD_AREA,
  ])
  location: LocationType;

  @IsInt()
  @Min(0)
  actualQty: number;
}

export class ApplyOcrResultsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OcrInventoryCountingResultDto)
  results: OcrInventoryCountingResultDto[];
}
