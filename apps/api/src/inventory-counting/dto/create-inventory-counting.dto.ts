import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ItemCategory } from '../../generated/prisma/enums';

export class CreateInventoryCountingDto {
  @IsEnum(ItemCategory)
  @IsNotEmpty()
  category: ItemCategory;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  tolerance?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
