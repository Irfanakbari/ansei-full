import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationType } from '../../generated/prisma/enums';

export class GenerateCutOffItemDto {
  @IsString()
  @IsNotEmpty()
  itemCode: string;

  @IsOptional()
  @IsString()
  materialId?: string;

  @IsOptional()
  @IsString()
  finishGoodId?: string;

  @IsOptional()
  @IsString()
  location?: string;

  systemQty: number;
}

export class GenerateCutOffDto {
  @IsString()
  @IsNotEmpty()
  inventoryCountingId: string;

  @IsString()
  @IsNotEmpty()
  itemCategory: 'MATERIAL' | 'FINISH_GOOD';

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
