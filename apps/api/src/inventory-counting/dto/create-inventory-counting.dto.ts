import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ItemCategory } from '../../generated/prisma/enums';

export class CreateInventoryCountingDto {
  @IsString()
  @IsNotEmpty()
  opnameNumber: string;

  @IsEnum(ItemCategory)
  @IsNotEmpty()
  category: ItemCategory;

  @IsOptional()
  @IsString()
  notes?: string;
}
